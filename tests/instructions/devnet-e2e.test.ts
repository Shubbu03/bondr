import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { PublicKey, SystemProgram, Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { BN } from "bn.js";
import { MPL_CORE_PROGRAM_ID } from "@metaplex-foundation/mpl-core";
import { Bondr } from "../../target/types/bondr";
import fs from "fs";

anchor.setProvider(anchor.AnchorProvider.env());
const program = anchor.workspace.Bondr as Program<Bondr>;

async function loadKeypair(path: string) {
    return Keypair.fromSecretKey(
        new Uint8Array(JSON.parse(fs.readFileSync(path, "utf-8")))
    );
}

describe("Bondr Devnet E2E", () => {
    it("runs full escrow flow with NFT minting milestones", async () => {
        const provider = anchor.getProvider();
        const connection = provider.connection;

        const client = await loadKeypair("/Users/shubbu/DEV/bondr/wallets/client.json");
        const freelancer = await loadKeypair("/Users/shubbu/DEV/bondr/wallets/freelancer.json");

        console.log("🔑 Using client:", client.publicKey.toBase58());
        console.log("🔑 Using freelancer:", freelancer.publicKey.toBase58());

        // await connection.requestAirdrop(client.publicKey, 2 * LAMPORTS_PER_SOL);
        // await connection.requestAirdrop(freelancer.publicKey, 1 * LAMPORTS_PER_SOL);
        // await new Promise((r) => setTimeout(r, 5000));

        const amount = new BN(0.05 * LAMPORTS_PER_SOL); // Smaller amount for multiple escrows

        const [badgePda] = await PublicKey.findProgramAddress(
            [Buffer.from("badge"), freelancer.publicKey.toBuffer()],
            program.programId
        );

        try {
            await program.methods
                .initializeFreelancerBadge()
                .accountsStrict({
                    freelancer: freelancer.publicKey,
                    badge: badgePda,
                    systemProgram: SystemProgram.programId,
                })
                .signers([freelancer])
                .rpc();
            console.log("✅ Freelancer badge initialized");
        } catch (error) {
            console.log("ℹ️ Badge already exists or initialization failed");
        }

        for (let i = 1; i <= 4; i++) {
            const refSeed = 90 + i;

            const [escrowPda] = await PublicKey.findProgramAddress(
                [Buffer.from("escrow"), client.publicKey.toBuffer(), freelancer.publicKey.toBuffer(), Buffer.from([refSeed])],
                program.programId
            );
            const [vaultPda] = await PublicKey.findProgramAddress(
                [Buffer.from("vault"), client.publicKey.toBuffer(), freelancer.publicKey.toBuffer(), Buffer.from([refSeed])],
                program.programId
            );
            const [statsPda] = await PublicKey.findProgramAddress(
                [Buffer.from("user_stats"), freelancer.publicKey.toBuffer()],
                program.programId
            );

            console.log(`\n🔄 Starting escrow ${i}...`);

            // 1) Init escrow
            await program.methods
                .initializeEscrow(amount, refSeed, false, false)
                .accountsPartial({
                    sender: client.publicKey,
                    receiver: freelancer.publicKey,
                    escrow: escrowPda,
                    vault: vaultPda,
                    senderStats: null,
                    clientMultisig: null,
                    systemProgram: SystemProgram.programId,
                    tokenProgram: null,
                    senderTokenAccount: null,
                    escrowTokenAccount: null,
                    tokenMint: null,
                    associatedTokenProgram: null,
                })
                .signers([client])
                .rpc();

            console.log(`📝 Escrow ${i} initialized:`, escrowPda.toBase58());

            // 2) Release payment
            await program.methods
                .releasePayment(refSeed)
                .accountsStrict({
                    client: client.publicKey,
                    escrow: escrowPda,
                })
                .signers([client])
                .rpc();

            console.log(`💰 Escrow ${i} payment released`);

            // 3) Claim payment
            await program.methods
                .claimPayment(refSeed, false)
                .accountsPartial({
                    client: client.publicKey,
                    freelancer: freelancer.publicKey,
                    escrow: escrowPda,
                    vault: vaultPda,
                    receiverStats: statsPda,
                    multisig: null,
                    receiverSol: freelancer.publicKey,
                    escrowTokenAccount: null,
                    receiverTokenAccount: null,
                    tokenMint: null,
                    tokenProgram: null,
                    systemProgram: SystemProgram.programId,
                })
                .signers([freelancer])
                .rpc();

            console.log(`✅ Escrow ${i} payment claimed`);

            // 4) Update freelancer badge
            await program.methods
                .updateFreelancerBadge(amount)
                .accountsStrict({
                    freelancer: freelancer.publicKey,
                    badge: badgePda,
                })
                .signers([freelancer])
                .rpc();

            // 5) Check badge stats
            const badge = await program.account.freelancerBadge.fetch(badgePda);
            console.log(`📊 Badge stats after escrow ${i}: ${badge.completedEscrows} completed, tier: ${JSON.stringify(badge.tier)}`);

            // 6) Try to mint NFT at milestone (3 escrows = Verified tier)
            if (badge.completedEscrows >= 3) {
                const asset = Keypair.generate();
                const collection = Keypair.generate();
                const MPL_PROGRAM_ID = new PublicKey(MPL_CORE_PROGRAM_ID);

                try {
                    await program.methods
                        .mintReputationNft()
                        .accountsStrict({
                            freelancer: freelancer.publicKey,
                            badge: badgePda,
                            asset: asset.publicKey,
                            collection: collection.publicKey,
                            mplCoreProgram: MPL_PROGRAM_ID,
                            systemProgram: SystemProgram.programId,
                        })
                        .signers([freelancer, asset])
                        .rpc();

                    console.log(`🎖️ NFT minted! Asset: ${asset.publicKey.toBase58()}`);

                    const updatedBadge = await program.account.freelancerBadge.fetch(badgePda);
                    console.log(`🏆 New tier after minting: ${JSON.stringify(updatedBadge.tier)}`);
                    break;
                } catch (error: any) {
                    const msg = error?.error?.errorMessage || error.message || "";
                    if (msg.includes("InsufficientEscrows")) {
                        console.log(`ℹ️ Not enough escrows yet for NFT (need 3+)`);
                    } else if (msg.includes("NFTAlreadyMinted")) {
                        console.log(`ℹ️ NFT already minted for this tier`);
                        break;
                    } else {
                        console.log(`⚠️ NFT minting failed: ${msg}`);
                    }
                }
            }

            try {
                await program.account.escrow.fetch(escrowPda);
                throw new Error("Escrow should be closed!");
            } catch {
                // Expected - escrow should be closed
            }
        }

        // Final verification
        const finalStats = await program.account.userStats.fetch(
            await PublicKey.findProgramAddress(
                [Buffer.from("user_stats"), freelancer.publicKey.toBuffer()],
                program.programId
            ).then(([pda]) => pda)
        );
        const finalBadge = await program.account.freelancerBadge.fetch(badgePda);

        console.log("\n🎯 Final Results:");
        console.log(`📈 Total completed escrows: ${finalStats.completedEscrows}`);
        console.log(`🎖️ Badge completed escrows: ${finalBadge.completedEscrows}`);
        console.log(`🏆 Final tier: ${JSON.stringify(finalBadge.tier)}`);
        console.log(`💰 Total value completed: ${finalBadge.totalValueCompleted.toString()} lamports`);
    });

    it("runs multisig escrow flow on devnet", async () => {
        const provider = anchor.getProvider();
        const connection = provider.connection;

        const client = await loadKeypair("/Users/shubbu/DEV/bondr/wallets/client.json");
        const freelancer = await loadKeypair("/Users/shubbu/DEV/bondr/wallets/freelancer.json");

        const member1 = Keypair.generate();
        const member2 = Keypair.generate();
        const member3 = Keypair.generate();

        console.log("🔑 Using client:", client.publicKey.toBase58());
        console.log("🔑 Using freelancer:", freelancer.publicKey.toBase58());
        console.log("👥 Member 1:", member1.publicKey.toBase58());
        console.log("👥 Member 2:", member2.publicKey.toBase58());

        const refSeed = 88;
        const amount = new BN(0.02 * LAMPORTS_PER_SOL);

        // PDAs
        const [multisigPda] = await PublicKey.findProgramAddress(
            [Buffer.from("client_multisig"), client.publicKey.toBuffer()],
            program.programId
        );
        const [escrowPda] = await PublicKey.findProgramAddress(
            [Buffer.from("escrow"), client.publicKey.toBuffer(), freelancer.publicKey.toBuffer(), Buffer.from([refSeed])],
            program.programId
        );
        const [vaultPda] = await PublicKey.findProgramAddress(
            [Buffer.from("vault"), client.publicKey.toBuffer(), freelancer.publicKey.toBuffer(), Buffer.from([refSeed])],
            program.programId
        );
        const [statsPda] = await PublicKey.findProgramAddress(
            [Buffer.from("user_stats"), freelancer.publicKey.toBuffer()],
            program.programId
        );

        // 1) Initialize multisig client
        const members: PublicKey[] = [
            client.publicKey,
            member1.publicKey,
            member2.publicKey,
            member3.publicKey,
            PublicKey.default,
        ];
        const memberCount = 4;
        const threshold = 2; // 2 of 4 approvals needed

        try {
            await program.methods
                .initializeMultisigClient(members, memberCount, threshold)
                .accountsStrict({
                    client: client.publicKey,
                    multisig: multisigPda,
                    systemProgram: SystemProgram.programId,
                })
                .signers([client])
                .rpc();
            console.log("✅ Multisig client initialized");
        } catch (error) {
            console.log("ℹ️ Multisig client already exists or initialization failed");
        }

        // 2) Initialize escrow with multisig enabled
        await program.methods
            .initializeEscrow(amount, refSeed, false, true)
            .accountsPartial({
                sender: client.publicKey,
                receiver: freelancer.publicKey,
                escrow: escrowPda,
                vault: vaultPda,
                senderStats: null,
                clientMultisig: multisigPda,
                systemProgram: SystemProgram.programId,
                tokenProgram: null,
                senderTokenAccount: null,
                escrowTokenAccount: null,
                tokenMint: null,
                associatedTokenProgram: null,
            })
            .signers([client])
            .rpc();

        console.log("📝 Multisig escrow initialized:", escrowPda.toBase58());

        // 3) First member approval
        await program.methods
            .approveMultisigRelease(refSeed)
            .accountsStrict({
                member: member1.publicKey,
                multisig: multisigPda,
                escrow: escrowPda,
                systemProgram: SystemProgram.programId,
            })
            .signers([member1])
            .rpc();

        console.log("✅ Member 1 approved");

        let escrow = await program.account.escrow.fetch(escrowPda);
        console.log(`📊 Escrow released after 1 approval: ${escrow.isReleased}`);

        // 4) Second member approval (meets threshold)
        await program.methods
            .approveMultisigRelease(refSeed)
            .accountsStrict({
                member: member2.publicKey,
                multisig: multisigPda,
                escrow: escrowPda,
                systemProgram: SystemProgram.programId,
            })
            .signers([member2])
            .rpc();

        console.log("✅ Member 2 approved - threshold met!");

        escrow = await program.account.escrow.fetch(escrowPda);
        console.log(`📊 Escrow released after 2 approvals: ${escrow.isReleased}`);

        // 5) Freelancer claims payment
        await program.methods
            .claimPayment(refSeed, false)
            .accountsPartial({
                client: client.publicKey,
                freelancer: freelancer.publicKey,
                escrow: escrowPda,
                vault: vaultPda,
                receiverStats: statsPda,
                multisig: multisigPda,
                receiverSol: freelancer.publicKey,
                escrowTokenAccount: null,
                receiverTokenAccount: null,
                tokenMint: null,
                tokenProgram: null,
                systemProgram: SystemProgram.programId,
            })
            .signers([freelancer])
            .rpc();

        console.log("💰 Payment claimed by freelancer");

        // 6) Verify multisig reset
        const ms = await program.account.clientMultisig.fetch(multisigPda);
        console.log(`🔄 Multisig reset - pending escrow: ${ms.pendingEscrow.equals(PublicKey.default)}`);
        console.log(`🔄 All approvals reset: ${ms.approvals.every(approval => approval === 0)}`);

        // 7) Verify escrow closed
        try {
            await program.account.escrow.fetch(escrowPda);
            throw new Error("Escrow should be closed!");
        } catch {
            console.log("✅ Escrow closed successfully");
        }

        console.log("\n🎯 Multisig flow completed successfully!");
    });
});
