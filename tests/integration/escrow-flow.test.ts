import * as anchor from "@coral-xyz/anchor";
import { Keypair, SystemProgram } from "@solana/web3.js";
import { assert } from "chai";
import { describe, it } from "mocha";

import { program, createFundedKeypair } from "../utils/setup";
import { deriveEscrowPDAs, deriveUserStatsPDA, deriveFreelancerBadgePDA } from "../utils/helpers";

describe("Complete Escrow Flow Integration", () => {
    it("should complete full escrow lifecycle: initialize → release → claim → badge update", async () => {
        // Setup
        const client = await createFundedKeypair();
        const freelancer = await createFundedKeypair(1_000_000_000);
        const amount = new anchor.BN(5_000_000); // 0.005 SOL
        const refSeed = 67;

        // Derive all PDAs
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
        assert.deepStrictEqual(badge.tier, { verified: {} });

        // 2. Initialize escrow
        await program.methods
            .initializeEscrow(amount, refSeed, false)
            .accountsPartial({
                sender: client.publicKey,
                receiver: freelancer.publicKey,
                escrow: escrowPda,
                vault: vaultPda,
                senderStats: clientStatsPda,
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
        assert.deepStrictEqual(badge.tier, { verified: {} }); // Still verified at 1 escrow
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

        // Complete 5 escrows to reach Professional tier
        for (let i = 0; i < 5; i++) {
            const refSeed = 100 + i;
            const { escrowPda, vaultPda } = await deriveEscrowPDAs(client.publicKey, freelancer.publicKey, refSeed);
            const { statsPda: clientStatsPda } = await deriveUserStatsPDA(client.publicKey);
            const { statsPda: freelancerStatsPda } = await deriveUserStatsPDA(freelancer.publicKey);

            // Initialize → Release → Claim → Update Badge
            await program.methods
                .initializeEscrow(amount, refSeed, false)
                .accountsPartial({
                    sender: client.publicKey,
                    receiver: freelancer.publicKey,
                    escrow: escrowPda,
                    vault: vaultPda,
                    senderStats: clientStatsPda,
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

        // Verify Professional tier reached
        const badge = await program.account.freelancerBadge.fetch(badgePda);
        assert.strictEqual(badge.completedEscrows, 5);
        assert.deepStrictEqual(badge.tier, { professional: {} });

        const totalValue = amount.toNumber() * 5;
        assert.strictEqual(badge.totalValueCompleted.toNumber(), totalValue);
    });
}); 