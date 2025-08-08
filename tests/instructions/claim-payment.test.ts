import * as anchor from "@coral-xyz/anchor";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { assert } from "chai";
import { describe, it } from "mocha";

import { program, connection, sleep } from "../utils/setup";
import { deriveEscrowPDAs, deriveUserStatsPDA } from "../utils/helpers";

describe("claim_payment()", () => {
    let client: Keypair;
    let freelancer: Keypair;
    let escrowPda: PublicKey;
    let escrowBump: number;
    let vaultPda: PublicKey;
    let vaultBump: number;

    const refSeed = 77;
    const amount = new anchor.BN(2_000_000);

    before(async () => {
        // 1. Generate actors
        client = Keypair.generate();
        freelancer = Keypair.generate();

        // 2. Airdrop funds
        await Promise.all([
            connection.requestAirdrop(client.publicKey, 2_000_000_000),
            connection.requestAirdrop(freelancer.publicKey, 1_000_000_000),
        ]);
        await sleep(3000);

        // 3. Derive PDAs using helpers
        const escrowPDAs = await deriveEscrowPDAs(client.publicKey, freelancer.publicKey, refSeed);
        escrowPda = escrowPDAs.escrowPda;
        escrowBump = escrowPDAs.escrowBump;
        vaultPda = escrowPDAs.vaultPda;
        vaultBump = escrowPDAs.vaultBump;

        const { statsPda: clientStatsPda } = await deriveUserStatsPDA(client.publicKey);

        // 4. Initialize escrow
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

        // 5. Release the escrow
        await program.methods
            .releasePayment(refSeed)
            .accountsStrict({
                client: client.publicKey,
                escrow: escrowPda,
            })
            .signers([client])
            .rpc();
    });

    it("claims payment successfully", async () => {
        const { statsPda: freelancerStatsPda, statsBump: freelancerStatsBump } = await deriveUserStatsPDA(freelancer.publicKey);

        await program.methods
            .claimPayment(refSeed, false)
            .accountsPartial({
                client: client.publicKey,
                freelancer: freelancer.publicKey,
                escrow: escrowPda,
                vault: vaultPda,
                receiverStats: freelancerStatsPda,
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

        const stats = await program.account.userStats.fetch(freelancerStatsPda);
        assert.strictEqual(stats.completedEscrows, 1);
    });

    it("fails if payment not released", async () => {
        const newClient = Keypair.generate();
        const newFreelancer = Keypair.generate();
        const newRefSeed = 88;
        const newAmount = new anchor.BN(2_000_000);

        await Promise.all([
            connection.requestAirdrop(newClient.publicKey, 2_000_000_000),
            connection.requestAirdrop(newFreelancer.publicKey, 1_000_000_000),
        ]);
        await sleep(3000);

        const { escrowPda: newEscrowPda, vaultPda: newVaultPda } = await deriveEscrowPDAs(
            newClient.publicKey,
            newFreelancer.publicKey,
            newRefSeed
        );

        const { statsPda: newClientStatsPda } = await deriveUserStatsPDA(newClient.publicKey);

        await program.methods
            .initializeEscrow(newAmount, newRefSeed, false, false)
            .accountsPartial({
                sender: newClient.publicKey,
                receiver: newFreelancer.publicKey,
                escrow: newEscrowPda,
                vault: newVaultPda,
                senderStats: newClientStatsPda,
                clientMultisig: null,
                systemProgram: SystemProgram.programId,
                tokenProgram: null,
                senderTokenAccount: null,
                escrowTokenAccount: null,
                tokenMint: null,
                associatedTokenProgram: null,
            })
            .signers([newClient])
            .rpc();

        const { statsPda: freelancerStatsPda, statsBump: freelancerStatsBump } = await deriveUserStatsPDA(newFreelancer.publicKey);

        try {
            await program.methods
                .claimPayment(newRefSeed, false)
                .accountsPartial({
                    client: newClient.publicKey,
                    freelancer: newFreelancer.publicKey,
                    escrow: newEscrowPda,
                    vault: newVaultPda,
                    receiverStats: freelancerStatsPda,
                    multisig: null,
                    receiverSol: newFreelancer.publicKey,
                    escrowTokenAccount: null,
                    receiverTokenAccount: null,
                    tokenMint: null,
                    tokenProgram: null,
                    systemProgram: SystemProgram.programId,
                })
                .signers([newFreelancer])
                .rpc();
            assert.fail("Expected payment claim to fail (not released)");
        } catch (err: any) {
            const msg = err.error?.errorMessage || err.message;
            assert.strictEqual(msg, "Payment not released yet");
        }
    });

    it("fails if claimed by someone other than freelancer", async () => {
        const { escrowPda: wrongEscrowPda, vaultPda: wrongVaultPda } = await deriveEscrowPDAs(
            client.publicKey,
            client.publicKey, // Using client as both client AND freelancer
            refSeed
        );

        const { statsPda: clientStatsPda, statsBump: clientStatsBump } = await deriveUserStatsPDA(client.publicKey);

        try {
            await program.methods
                .claimPayment(refSeed, false)
                .accountsPartial({
                    client: client.publicKey,
                    freelancer: client.publicKey,
                    escrow: wrongEscrowPda,
                    vault: wrongVaultPda,
                    receiverStats: clientStatsPda,
                    multisig: null,
                    receiverSol: client.publicKey,
                    escrowTokenAccount: null,
                    receiverTokenAccount: null,
                    tokenMint: null,
                    tokenProgram: null,
                    systemProgram: SystemProgram.programId,
                })
                .signers([client])
                .rpc();
            assert.fail("Expected failure when claimed by wrong actor");
        } catch (err: any) {
            const msg = err.error?.errorMessage || err.message;
            assert.match(msg, /(account|not found|does not exist)/i);
        }
    });

    it("fails to claim payment if multisig threshold not met", async () => {
        // Setup multisig test data
        const multisigClient = Keypair.generate();
        const member1 = Keypair.generate();
        const member2 = Keypair.generate();
        const member3 = Keypair.generate();

        await Promise.all([
            connection.requestAirdrop(multisigClient.publicKey, 2_000_000_000),
            connection.requestAirdrop(member1.publicKey, 1_000_000_000),
            connection.requestAirdrop(member2.publicKey, 1_000_000_000),
            connection.requestAirdrop(member3.publicKey, 1_000_000_000),
        ]);
        await sleep(3000);

        // Derive multisig PDA
        const [multisigPda] = await PublicKey.findProgramAddress(
            [Buffer.from("client_multisig"), multisigClient.publicKey.toBuffer()],
            program.programId
        );

        // Initialize multisig client
        await program.methods
            .initializeMultisigClient([multisigClient.publicKey, member1.publicKey, member2.publicKey, member3.publicKey, new PublicKey("11111111111111111111111111111111")], 3, 2)
            .accountsStrict({
                client: multisigClient.publicKey,
                multisig: multisigPda,
                systemProgram: SystemProgram.programId,
            })
            .signers([multisigClient])
            .rpc();

        // Derive escrow PDAs for multisig test
        const multisigEscrowPDAs = await deriveEscrowPDAs(multisigClient.publicKey, freelancer.publicKey, refSeed);

        // Initialize escrow with multisig
        await program.methods
            .initializeEscrow(amount, refSeed, false, true)
            .accountsPartial({
                sender: multisigClient.publicKey,
                receiver: freelancer.publicKey,
                escrow: multisigEscrowPDAs.escrowPda,
                vault: multisigEscrowPDAs.vaultPda,
                senderStats: null,
                clientMultisig: multisigPda,
                systemProgram: SystemProgram.programId,
                tokenProgram: null,
                senderTokenAccount: null,
                escrowTokenAccount: null,
                tokenMint: null,
                associatedTokenProgram: null,
            })
            .signers([multisigClient])
            .rpc();

        // Approve with only 1 member (threshold is 2)
        await program.methods
            .approveMultisigRelease(refSeed)
            .accountsStrict({
                member: member1.publicKey,
                multisig: multisigPda,
                escrow: multisigEscrowPDAs.escrowPda,
                systemProgram: SystemProgram.programId,
            })
            .signers([member1])
            .rpc();

        const { statsPda: receiverStatsPda, statsBump: receiverStatsBump } = await deriveUserStatsPDA(freelancer.publicKey);

        // Try claim without enough approvals
        try {
            await program.methods
                .claimPayment(refSeed, false)
                .accountsPartial({
                    client: multisigClient.publicKey,
                    freelancer: freelancer.publicKey,
                    escrow: multisigEscrowPDAs.escrowPda,
                    vault: multisigEscrowPDAs.vaultPda,
                    receiverStats: receiverStatsPda,
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
            assert.fail("Expected MultisigThresholdNotMet");
        } catch (err: any) {
            const code = err.error?.errorCode?.code;
            assert.strictEqual(code, "MultisigThresholdNotMet");
        }
    });

    it("fails to claim payment if multisig pending escrow does not match", async () => {
        const multisigClient = Keypair.generate();
        const member1 = Keypair.generate();
        const member2 = Keypair.generate();
        const member3 = Keypair.generate();

        await Promise.all([
            connection.requestAirdrop(multisigClient.publicKey, 2_000_000_000),
            connection.requestAirdrop(member1.publicKey, 1_000_000_000),
            connection.requestAirdrop(member2.publicKey, 1_000_000_000),
            connection.requestAirdrop(member3.publicKey, 1_000_000_000),
        ]);
        await sleep(3000);

        // Derive multisig PDA
        const [multisigPda] = await PublicKey.findProgramAddress(
            [Buffer.from("client_multisig"), multisigClient.publicKey.toBuffer()],
            program.programId
        );

        // Initialize multisig client (client must be a member; array must be length 5)
        await program.methods
            .initializeMultisigClient([
                multisigClient.publicKey,
                member1.publicKey,
                member2.publicKey,
                member3.publicKey,
                new PublicKey("11111111111111111111111111111111"),
            ], 3, 2)
            .accountsStrict({
                client: multisigClient.publicKey,
                multisig: multisigPda,
                systemProgram: SystemProgram.programId,
            })
            .signers([multisigClient])
            .rpc();

        // 1) Initialize a multisig escrow to set pending_escrow
        const msRefSeed = 88;
        const msEscrowPDAs = await deriveEscrowPDAs(multisigClient.publicKey, freelancer.publicKey, msRefSeed);

        await program.methods
            .initializeEscrow(amount, msRefSeed, false, true)
            .accountsPartial({
                sender: multisigClient.publicKey,
                receiver: freelancer.publicKey,
                escrow: msEscrowPDAs.escrowPda,
                vault: msEscrowPDAs.vaultPda,
                senderStats: null,
                clientMultisig: multisigPda,
                systemProgram: SystemProgram.programId,
                tokenProgram: null,
                senderTokenAccount: null,
                escrowTokenAccount: null,
                tokenMint: null,
                associatedTokenProgram: null,
            })
            .signers([multisigClient])
            .rpc();

        // 2) Initialize a second NON-multisig escrow for same client
        const nonMsRefSeed = 99;
        const nonMsEscrowPDAs = await deriveEscrowPDAs(multisigClient.publicKey, freelancer.publicKey, nonMsRefSeed);
        const { statsPda: clientStatsPda } = await deriveUserStatsPDA(multisigClient.publicKey);

        await program.methods
            .initializeEscrow(amount, nonMsRefSeed, false, false)
            .accountsPartial({
                sender: multisigClient.publicKey,
                receiver: freelancer.publicKey,
                escrow: nonMsEscrowPDAs.escrowPda,
                vault: nonMsEscrowPDAs.vaultPda,
                senderStats: clientStatsPda,
                clientMultisig: null,
                systemProgram: SystemProgram.programId,
                tokenProgram: null,
                senderTokenAccount: null,
                escrowTokenAccount: null,
                tokenMint: null,
                associatedTokenProgram: null,
            })
            .signers([multisigClient])
            .rpc();

        const { statsPda: receiverStatsPda } = await deriveUserStatsPDA(freelancer.publicKey);

        // 3) Try to claim the NON-multisig escrow while providing multisig -> should mismatch pending_escrow (which points to msEscrow)
        try {
            await program.methods
                .claimPayment(nonMsRefSeed, false)
                .accountsPartial({
                    client: multisigClient.publicKey,
                    freelancer: freelancer.publicKey,
                    escrow: nonMsEscrowPDAs.escrowPda,
                    vault: nonMsEscrowPDAs.vaultPda,
                    receiverStats: receiverStatsPda,
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
            assert.fail("Expected MultisigPendingEscrowMismatch");
        } catch (err: any) {
            const code = err.error?.errorCode?.code;
            assert.strictEqual(code, "MultisigPendingEscrowMismatch");
        }
    });

}); 