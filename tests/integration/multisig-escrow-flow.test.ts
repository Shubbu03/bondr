import * as anchor from "@coral-xyz/anchor";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { MPL_CORE_PROGRAM_ID } from "@metaplex-foundation/mpl-core";
import { assert } from "chai";
import { describe, it } from "mocha";

import { program, createFundedKeypair, connection, sleep } from "../utils/setup";
import { deriveEscrowPDAs, deriveUserStatsPDA, deriveFreelancerBadgePDA } from "../utils/helpers";

describe("Multisig Full Flow Integration", () => {
    it("should run full multisig lifecycle: init ms → init escrow → approvals → claim → resets + stats", async () => {
        // Actors
        const client = await createFundedKeypair();
        const freelancer = await createFundedKeypair(1_000_000_000);
        const member1 = await createFundedKeypair(1_000_000_000);
        const member2 = await createFundedKeypair(1_000_000_000);
        const member3 = await createFundedKeypair(1_000_000_000);

        // PDAs
        const [multisigPda] = await PublicKey.findProgramAddress(
            [Buffer.from("client_multisig"), client.publicKey.toBuffer()],
            program.programId
        );

        const refSeed = 77;
        const amount = new anchor.BN(3_000_000);

        const { escrowPda, vaultPda } = await deriveEscrowPDAs(client.publicKey, freelancer.publicKey, refSeed);

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

        // Initial balances
        const beforeVaultInfo = await connection.getAccountInfo(vaultPda);
        const beforeVaultLamports = beforeVaultInfo?.lamports ?? 0;
        const beforeFreelancerLamports = (await connection.getAccountInfo(freelancer.publicKey))!.lamports;

        // 1) Initialize multisig client
        const members: PublicKey[] = [
            client.publicKey,
            member1.publicKey,
            member2.publicKey,
            member3.publicKey,
            PublicKey.default,
        ];
        const memberCount = 4;
        const threshold = 2; // 2 of 4

        await program.methods
            .initializeMultisigClient(members, memberCount, threshold)
            .accountsStrict({
                client: client.publicKey,
                multisig: multisigPda,
                systemProgram: SystemProgram.programId,
            })
            .signers([client])
            .rpc();

        // Verify on-chain multisig
        let ms = await program.account.clientMultisig.fetch(multisigPda);
        assert.strictEqual(ms.memberCount, memberCount);
        assert.strictEqual(ms.threshold, threshold);
        assert.ok(ms.pendingEscrow.equals(PublicKey.default));
        for (let i = 0; i < 5; i++) assert.strictEqual(ms.approvals[i], 0);

        // 2) Initialize escrow (multisig enabled)
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

        let escrow = await program.account.escrow.fetch(escrowPda);
        assert.ok(escrow.sender.equals(client.publicKey));
        assert.ok(escrow.receiver.equals(freelancer.publicKey));
        assert.strictEqual(escrow.amount.toNumber(), amount.toNumber());
        assert.isFalse(escrow.isReleased);

        // Multisig now linked to pending escrow
        ms = await program.account.clientMultisig.fetch(multisigPda);
        assert.ok(ms.pendingEscrow.equals(escrowPda));
        for (let i = 0; i < 5; i++) assert.strictEqual(ms.approvals[i], 0);

        // 3) Members approve
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

        ms = await program.account.clientMultisig.fetch(multisigPda);
        // member1 is at index 1 (client is index 0)
        assert.strictEqual(ms.approvals[1], 1);
        // threshold not yet met, escrow should still be not released until second approval flips it
        escrow = await program.account.escrow.fetch(escrowPda);
        assert.isFalse(escrow.isReleased);

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

        // 4) Threshold met -> escrow.is_released = true
        escrow = await program.account.escrow.fetch(escrowPda);
        assert.isTrue(escrow.isReleased, "Escrow should be marked released after threshold approvals");

        // 5) Freelancer claims payment
        const { statsPda: receiverStatsPda } = await deriveUserStatsPDA(freelancer.publicKey);

        await program.methods
            .claimPayment(refSeed, false)
            .accountsPartial({
                client: client.publicKey,
                freelancer: freelancer.publicKey,
                escrow: escrowPda,
                vault: vaultPda,
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

        // 6) Stats updated
        const freelancerStats = await program.account.userStats.fetch(receiverStatsPda);
        assert.strictEqual(freelancerStats.completedEscrows, 1);

        // 7) Update freelancer badge after completion
        await program.methods
            .updateFreelancerBadge(amount)
            .accountsStrict({
                freelancer: freelancer.publicKey,
                badge: badgePda,
            })
            .signers([freelancer])
            .rpc();

        let badge = await program.account.freelancerBadge.fetch(badgePda);
        assert.strictEqual(badge.completedEscrows, 1);
        assert.strictEqual(badge.totalValueCompleted.toNumber(), amount.toNumber());
        assert.deepStrictEqual(badge.tier, { unranked: {} });

        // 8) Attempt to mint reputation NFT (should fail after only 1 escrow)
        const MPL_PROGRAM_ID = new PublicKey(MPL_CORE_PROGRAM_ID);
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
        } catch (error: any) {
            const msg = error?.error?.errorMessage || error.message || "";
            assert.isTrue(
                msg.includes("Insufficient escrows completed for NFT minting") ||
                msg.includes("InsufficientEscrows"),
                `unexpected error: ${msg}`
            );
        }

        // Verify tier remains unranked
        badge = await program.account.freelancerBadge.fetch(badgePda);
        assert.deepStrictEqual(badge.tier, { unranked: {} });

        // 9) Post assertions
        const vaultInfoAfter = await connection.getAccountInfo(vaultPda);
        const vaultLamportsAfter = vaultInfoAfter?.lamports ?? 0;
        assert.strictEqual(vaultLamportsAfter, 0, "vault should be drained to 0 after claim");

        const freelancerLamportsAfter = (await connection.getAccountInfo(freelancer.publicKey))!.lamports;
        assert.isTrue(
            freelancerLamportsAfter > beforeFreelancerLamports,
            "freelancer balance should increase after claim"
        );

        // - Escrow account closed (fetch should fail)
        try {
            await program.account.escrow.fetch(escrowPda);
            assert.fail("escrow account should be closed after claim");
        } catch (_) {
            // expected
        }

        // - Multisig resets
        ms = await program.account.clientMultisig.fetch(multisigPda);
        assert.ok(ms.pendingEscrow.equals(PublicKey.default));
        for (let i = 0; i < 5; i++) assert.strictEqual(ms.approvals[i], 0);
    });
});


