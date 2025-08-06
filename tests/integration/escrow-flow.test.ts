import * as anchor from "@coral-xyz/anchor";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { assert } from "chai";
import { describe, it } from "mocha";

import { program, createFundedKeypair } from "../utils/setup";
import { deriveEscrowPDAs, deriveUserStatsPDA, deriveFreelancerBadgePDA } from "../utils/helpers";
import { MPL_CORE_PROGRAM_ID } from "@metaplex-foundation/mpl-core";

describe("Complete Escrow Flow Integration", () => {
    // MPL Core program ID
    const MPL_PROGRAM_ID = new PublicKey(MPL_CORE_PROGRAM_ID);

    it("should complete full escrow lifecycle: initialize → release → claim → badge update → mint nft", async () => {
        const client = await createFundedKeypair();
        const freelancer = await createFundedKeypair(1_000_000_000);
        const amount = new anchor.BN(5_000_000);
        const refSeed = 67;

        const { escrowPda, vaultPda } = await deriveEscrowPDAs(client.publicKey, freelancer.publicKey, refSeed);
        const { statsPda: clientStatsPda } = await deriveUserStatsPDA(client.publicKey);
        const { statsPda: freelancerStatsPda } = await deriveUserStatsPDA(freelancer.publicKey);
        const { badgePda } = await deriveFreelancerBadgePDA(freelancer.publicKey);

        // 1. Initialize freelancer badge
        await program.methods
            .initializeFreelancerBadge()
            .accountsStrict({
                freelancer: freelancer.publicKey,
                badge: badgePda,
                systemProgram: SystemProgram.programId,
            })
            .signers([freelancer])
            .rpc();

        let badge = await program.account.freelancerBadge.fetch(badgePda);
        assert.strictEqual(badge.completedEscrows, 0);
        assert.deepStrictEqual(badge.tier, { unranked: {} });

        // 2. Initialize escrow
        await program.methods
            .initializeEscrow(amount, refSeed, false, false)
            .accountsPartial({
                sender: client.publicKey,
                receiver: freelancer.publicKey,
                escrow: escrowPda,
                vault: vaultPda,
                senderStats: clientStatsPda,
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

        let escrowAccount = await program.account.escrow.fetch(escrowPda);
        assert.isFalse(escrowAccount.isReleased);

        let clientStats = await program.account.userStats.fetch(clientStatsPda);
        assert.strictEqual(clientStats.completedEscrows, 0); // Not incremented on initialization

        // 3. Release payment
        await program.methods
            .releasePayment(refSeed)
            .accountsStrict({
                client: client.publicKey,
                escrow: escrowPda,
            })
            .signers([client])
            .rpc();

        escrowAccount = await program.account.escrow.fetch(escrowPda);
        assert.isTrue(escrowAccount.isReleased);

        // 4. Claim payment
        await program.methods
            .claimPayment(refSeed, false)
            .accountsPartial({
                client: client.publicKey,
                freelancer: freelancer.publicKey,
                escrow: escrowPda,
                vault: vaultPda,
                receiverStats: freelancerStatsPda,
                receiverSol: freelancer.publicKey,
                escrowTokenAccount: null,
                receiverTokenAccount: null,
                tokenMint: null,
                tokenProgram: null,
                systemProgram: SystemProgram.programId,
            })
            .signers([freelancer])
            .rpc();

        // Verify freelancer stats were updated
        const freelancerStats = await program.account.userStats.fetch(freelancerStatsPda);
        assert.strictEqual(freelancerStats.completedEscrows, 1);

        // 5. Update freelancer badge
        await program.methods
            .updateFreelancerBadge(amount)
            .accountsStrict({
                freelancer: freelancer.publicKey,
                badge: badgePda,
            })
            .signers([freelancer])
            .rpc();

        badge = await program.account.freelancerBadge.fetch(badgePda);
        assert.strictEqual(badge.completedEscrows, 1);
        assert.strictEqual(badge.totalValueCompleted.toNumber(), amount.toNumber());
        assert.deepStrictEqual(badge.tier, { unranked: {} }); // Still verified at 1 escrow

        // 6. Mint NFT to upgrade tier (but this will fail since 1 escrow is insufficient for any tier)
        const asset = Keypair.generate();
        const collection = Keypair.generate();

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

            assert.fail("Expected InsufficientEscrows error");
        } catch (error) {
            assert.isTrue(
                error.message.includes("Insufficient escrows completed for NFT minting") ||
                error.message.includes("InsufficientEscrows")
            );
        }

        // Verify tier remains unranked after failed mint attempt
        badge = await program.account.freelancerBadge.fetch(badgePda);
        assert.deepStrictEqual(badge.tier, { unranked: {} });
    });

    it("should handle multiple escrows and tier progression", async () => {
        const client = await createFundedKeypair();
        const freelancer = await createFundedKeypair(1_000_000_000);
        const amount = new anchor.BN(2_000_000);

        // Initialize badge
        const { badgePda } = await deriveFreelancerBadgePDA(freelancer.publicKey);
        await program.methods
            .initializeFreelancerBadge()
            .accountsStrict({
                freelancer: freelancer.publicKey,
                badge: badgePda,
                systemProgram: SystemProgram.programId,
            })
            .signers([freelancer])
            .rpc();

        // Complete 5 escrows to reach Verified tier (3-9 escrows = Verified)
        for (let i = 0; i < 5; i++) {
            const refSeed = 100 + i;
            const { escrowPda, vaultPda } = await deriveEscrowPDAs(client.publicKey, freelancer.publicKey, refSeed);
            const { statsPda: clientStatsPda } = await deriveUserStatsPDA(client.publicKey);
            const { statsPda: freelancerStatsPda } = await deriveUserStatsPDA(freelancer.publicKey);

            // Initialize → Release → Claim → Update Badge
            await program.methods
                .initializeEscrow(amount, refSeed, false, false)
                .accountsPartial({
                    sender: client.publicKey,
                    receiver: freelancer.publicKey,
                    escrow: escrowPda,
                    vault: vaultPda,
                    senderStats: clientStatsPda,
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

            await program.methods
                .releasePayment(refSeed)
                .accountsStrict({
                    client: client.publicKey,
                    escrow: escrowPda,
                })
                .signers([client])
                .rpc();

            await program.methods
                .claimPayment(refSeed, false)
                .accountsPartial({
                    client: client.publicKey,
                    freelancer: freelancer.publicKey,
                    escrow: escrowPda,
                    vault: vaultPda,
                    receiverStats: freelancerStatsPda,
                    receiverSol: freelancer.publicKey,
                    escrowTokenAccount: null,
                    receiverTokenAccount: null,
                    tokenMint: null,
                    tokenProgram: null,
                    systemProgram: SystemProgram.programId,
                })
                .signers([freelancer])
                .rpc();

            await program.methods
                .updateFreelancerBadge(amount)
                .accountsStrict({
                    freelancer: freelancer.publicKey,
                    badge: badgePda,
                })
                .signers([freelancer])
                .rpc();
        }

        // Fetch the badge and verify completed escrows
        const badge = await program.account.freelancerBadge.fetch(badgePda);

        // The completed_escrows counter should only increment after releasePayment + claimPayment + updateFreelancerBadge for each escrow
        assert.strictEqual(
            badge.completedEscrows,
            5,
            "completedEscrows should reflect actual completed escrows (release+claim+update), not just escrow creations"
        );

        assert.deepStrictEqual(
            badge.tier,
            { unranked: {} },
            "Badge tier should remain unranked until NFT is minted"
        );

        // Total value completed should be the sum of all escrow amounts
        const expectedTotalValue = amount.toNumber() * 5;
        assert.strictEqual(
            badge.totalValueCompleted.toNumber(),
            expectedTotalValue,
            "totalValueCompleted should equal the sum of all completed escrow amounts"
        );

        // Now mint the NFT to upgrade to Verified tier
        const asset = Keypair.generate();
        const collection = Keypair.generate();

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

        // Verify tier is now updated to Verified
        const updatedBadge = await program.account.freelancerBadge.fetch(badgePda);
        assert.deepStrictEqual(
            updatedBadge.tier,
            { verified: {} },
            "Badge tier should be Verified after minting NFT"
        );
    });

    it("should reach Professional tier after 10 completed escrows", async () => {
        const client = await createFundedKeypair();
        const freelancer = await createFundedKeypair(1_000_000_000);
        const amount = new anchor.BN(2_000_000);

        // Initialize badge
        const { badgePda } = await deriveFreelancerBadgePDA(freelancer.publicKey);
        await program.methods
            .initializeFreelancerBadge()
            .accountsStrict({
                freelancer: freelancer.publicKey,
                badge: badgePda,
                systemProgram: SystemProgram.programId,
            })
            .signers([freelancer])
            .rpc();

        // Complete 10 escrows to reach Professional tier (10-24 escrows = Professional)
        for (let i = 0; i < 10; i++) {
            const refSeed = 200 + i;
            const { escrowPda, vaultPda } = await deriveEscrowPDAs(client.publicKey, freelancer.publicKey, refSeed);
            const { statsPda: clientStatsPda } = await deriveUserStatsPDA(client.publicKey);
            const { statsPda: freelancerStatsPda } = await deriveUserStatsPDA(freelancer.publicKey);

            // Initialize → Release → Claim → Update Badge
            await program.methods
                .initializeEscrow(amount, refSeed, false, false)
                .accountsPartial({
                    sender: client.publicKey,
                    receiver: freelancer.publicKey,
                    escrow: escrowPda,
                    vault: vaultPda,
                    senderStats: clientStatsPda,
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

            await program.methods
                .releasePayment(refSeed)
                .accountsStrict({
                    client: client.publicKey,
                    escrow: escrowPda,
                })
                .signers([client])
                .rpc();

            await program.methods
                .claimPayment(refSeed, false)
                .accountsPartial({
                    client: client.publicKey,
                    freelancer: freelancer.publicKey,
                    escrow: escrowPda,
                    vault: vaultPda,
                    receiverStats: freelancerStatsPda,
                    receiverSol: freelancer.publicKey,
                    escrowTokenAccount: null,
                    receiverTokenAccount: null,
                    tokenMint: null,
                    tokenProgram: null,
                    systemProgram: SystemProgram.programId,
                })
                .signers([freelancer])
                .rpc();

            await program.methods
                .updateFreelancerBadge(amount)
                .accountsStrict({
                    freelancer: freelancer.publicKey,
                    badge: badgePda,
                })
                .signers([freelancer])
                .rpc();
        }

        // Fetch the badge and verify completed escrows
        const badge = await program.account.freelancerBadge.fetch(badgePda);

        assert.strictEqual(
            badge.completedEscrows,
            10,
            "completedEscrows should be 10 after 10 completed escrows"
        );

        assert.deepStrictEqual(
            badge.tier,
            { unranked: {} },
            "Badge tier should remain unranked until NFT is minted"
        );

        // Total value completed should be the sum of all escrow amounts
        const expectedTotalValue = amount.toNumber() * 10;
        assert.strictEqual(
            badge.totalValueCompleted.toNumber(),
            expectedTotalValue,
            "totalValueCompleted should equal the sum of all completed escrow amounts"
        );

        // Now mint the NFT to upgrade to Professional tier
        const asset = Keypair.generate();
        const collection = Keypair.generate();

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

        // Verify tier is now updated to Professional
        const updatedBadge = await program.account.freelancerBadge.fetch(badgePda);
        assert.deepStrictEqual(
            updatedBadge.tier,
            { professional: {} },
            "Badge tier should be Professional after minting NFT"
        );
    });
}); 