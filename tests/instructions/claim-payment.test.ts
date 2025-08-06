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
        const { statsPda: freelancerStatsPda } = await deriveUserStatsPDA(freelancer.publicKey);

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

        const { statsPda: freelancerStatsPda } = await deriveUserStatsPDA(newFreelancer.publicKey);

        try {
            await program.methods
                .claimPayment(newRefSeed, false)
                .accountsPartial({
                    client: newClient.publicKey,
                    freelancer: newFreelancer.publicKey,
                    escrow: newEscrowPda,
                    vault: newVaultPda,
                    receiverStats: freelancerStatsPda,
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

        const { statsPda: clientStatsPda } = await deriveUserStatsPDA(client.publicKey);

        try {
            await program.methods
                .claimPayment(refSeed, false)
                .accountsPartial({
                    client: client.publicKey,
                    freelancer: client.publicKey,
                    escrow: wrongEscrowPda,
                    vault: wrongVaultPda,
                    receiverStats: clientStatsPda,
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
}); 