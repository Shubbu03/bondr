import * as anchor from "@coral-xyz/anchor";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { assert } from "chai";
import { describe, it, before } from "mocha";

import { program, createFundedKeypair } from "../utils/setup";
import { deriveEscrowPDAs } from "../utils/helpers";

describe("approve_multisig_release()", () => {
    const refSeed = 55;
    const amount = new anchor.BN(2_000_000);

    let client: Keypair;
    let freelancer: Keypair;
    let member1: Keypair;
    let member2: Keypair;
    let member3: Keypair;
    let member4: Keypair;
    let nonMember: Keypair;

    let multisigPda: PublicKey;
    let multisigBump: number;
    let escrowPda: PublicKey;
    let escrowBump: number;
    let vaultPda: PublicKey;
    let vaultBump: number;

    before(async () => {
        // Create and fund all keypairs
        client = await createFundedKeypair();
        freelancer = await createFundedKeypair();
        member1 = await createFundedKeypair();
        member2 = await createFundedKeypair();
        member3 = await createFundedKeypair();
        member4 = await createFundedKeypair();
        nonMember = await createFundedKeypair();

        // Derive PDAs
        [multisigPda, multisigBump] = await PublicKey.findProgramAddress(
            [Buffer.from("client_multisig"), client.publicKey.toBuffer()],
            program.programId
        );

        const escrowPDAs = await deriveEscrowPDAs(client.publicKey, freelancer.publicKey, refSeed);
        escrowPda = escrowPDAs.escrowPda;
        escrowBump = escrowPDAs.escrowBump;
        vaultPda = escrowPDAs.vaultPda;
        vaultBump = escrowPDAs.vaultBump;

        // Initialize multisig with 5 members, threshold 3
        const members: PublicKey[] = [
            client.publicKey,
            member1.publicKey,
            member2.publicKey,
            member3.publicKey,
            member4.publicKey
        ];

        const memberCount = 5;
        const threshold = 3;

        await program.methods
            .initializeMultisigClient(members, memberCount, threshold)
            .accountsPartial({
                client: client.publicKey,
                multisig: multisigPda,
                systemProgram: SystemProgram.programId,
            })
            .signers([client])
            .rpc();

        // Initialize escrow with multisig
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
    });

    describe("Positive Tests", () => {
        it("happy path: valid multisig member approves a pending escrow", async () => {
            const initialMultisig = await program.account.clientMultisig.fetch(multisigPda);
            assert.ok(initialMultisig.pendingEscrow.equals(escrowPda), "pending_escrow must match");
            assert.strictEqual(initialMultisig.approvals[1], 0, "member1 should not be approved initially");

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

            const updatedMultisig = await program.account.clientMultisig.fetch(multisigPda);
            assert.strictEqual(updatedMultisig.approvals[1], 1, "Approval flag must be set to 1 for member1");
        });

        it("multiple members approve: simulate 3-of-5 approval threshold", async () => {
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

            await program.methods
                .approveMultisigRelease(refSeed)
                .accountsStrict({
                    member: member3.publicKey,
                    multisig: multisigPda,
                    escrow: escrowPda,
                    systemProgram: SystemProgram.programId,
                })
                .signers([member3])
                .rpc();

            const finalMultisig = await program.account.clientMultisig.fetch(multisigPda);
            assert.strictEqual(finalMultisig.approvals[1], 1, "member1 should be approved");
            assert.strictEqual(finalMultisig.approvals[2], 1, "member2 should be approved");
            assert.strictEqual(finalMultisig.approvals[3], 1, "member3 should be approved");

            const totalApprovals = finalMultisig.approvals.reduce((sum, approval) => sum + approval, 0);
            assert.strictEqual(totalApprovals, 3, "Should have 3 approvals total");
        });
    });

    describe("Negative Tests", () => {
        it("non-member tries to approve", async () => {
            try {
                await program.methods
                    .approveMultisigRelease(refSeed)
                    .accountsStrict({
                        member: nonMember.publicKey,
                        multisig: multisigPda,
                        escrow: escrowPda,
                        systemProgram: SystemProgram.programId,
                    })
                    .signers([nonMember])
                    .rpc();
                assert.fail("instruction should have thrown NotMultisigMember");
            } catch (err: any) {
                const errorMessage = err.error?.errorMessage || err.message;
                assert.strictEqual(errorMessage, "Caller is not a member of the multisig group.");
            }
        });

        it("member tries to double-approve", async () => {
            await program.methods
                .approveMultisigRelease(refSeed)
                .accountsStrict({
                    member: member4.publicKey,
                    multisig: multisigPda,
                    escrow: escrowPda,
                    systemProgram: SystemProgram.programId,
                })
                .signers([member4])
                .rpc();

            try {
                await program.methods
                    .approveMultisigRelease(refSeed)
                    .accountsStrict({
                        member: member4.publicKey,
                        multisig: multisigPda,
                        escrow: escrowPda,
                        systemProgram: SystemProgram.programId,
                    })
                    .signers([member4])
                    .rpc();
                assert.fail("instruction should have thrown AlreadyApproved");
            } catch (err: any) {
                const errorMessage = err.error?.errorMessage || err.message;
                assert.strictEqual(errorMessage, "This member has already approved.");
            }
        });
    });
});
