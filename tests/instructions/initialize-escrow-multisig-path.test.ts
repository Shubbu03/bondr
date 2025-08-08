import * as anchor from "@coral-xyz/anchor";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { assert } from "chai";
import { describe, it, before } from "mocha";

import { program, createFundedKeypair } from "../utils/setup";
import { deriveEscrowPDAs, deriveUserStatsPDA } from "../utils/helpers";

describe("initialize_escrow() - Multisig Path", () => {
    const amount = new anchor.BN(1_000_000);
    const refSeed = 42;

    let client: Keypair;
    let freelancer: Keypair;
    let member1: Keypair;
    let member2: Keypair;
    let nonMember: Keypair;
    let multisigPda: PublicKey;
    let multisigBump: number;

    before(async () => {
        client = await createFundedKeypair();
        freelancer = await createFundedKeypair();
        member1 = Keypair.generate();
        member2 = Keypair.generate();
        nonMember = Keypair.generate();

        [multisigPda, multisigBump] = await PublicKey.findProgramAddress(
            [Buffer.from("client_multisig"), client.publicKey.toBuffer()],
            program.programId
        );
    });

    it("verifies linking works and pending_escrow is set", async () => {
        // Step 1: Initialize multisig
        const members: PublicKey[] = [
            client.publicKey,
            member1.publicKey,
            member2.publicKey,
            PublicKey.default,
            PublicKey.default
        ];
        const memberCount = 3;
        const threshold = 2;

        await program.methods
            .initializeMultisigClient(members, memberCount, threshold)
            .accountsPartial({
                client: client.publicKey,
                multisig: multisigPda,
                systemProgram: SystemProgram.programId,
            })
            .signers([client])
            .rpc();

        // Step 2: Derive escrow PDAs
        const escrowPDAs = await deriveEscrowPDAs(client.publicKey, freelancer.publicKey, refSeed);
        const statsPDAs = await deriveUserStatsPDA(client.publicKey);

        // Step 3: Initialize escrow with multisig
        await program.methods
            .initializeEscrow(amount, refSeed, false, true)
            .accountsPartial({
                sender: client.publicKey,
                receiver: freelancer.publicKey,
                escrow: escrowPDAs.escrowPda,
                vault: escrowPDAs.vaultPda,
                senderStats: statsPDAs.statsPda,
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

        // Step 4: Assert escrow is linked to multisig
        const escrow = await program.account.escrow.fetch(escrowPDAs.escrowPda);
        assert.ok(escrow.clientMultisig.equals(multisigPda), "escrow should be linked to multisig");

        // Step 5: Assert multisig has pending_escrow set
        const multisig = await program.account.clientMultisig.fetch(multisigPda);
        assert.ok(multisig.pendingEscrow.equals(escrowPDAs.escrowPda), "multisig should have pending escrow set");
    });

    it("ensures the instruction fails when multisig flagged but not passed", async () => {
        const newClient = await createFundedKeypair();
        const newFreelancer = await createFundedKeypair();
        const newRefSeed = 43;

        const escrowPDAs = await deriveEscrowPDAs(newClient.publicKey, newFreelancer.publicKey, newRefSeed);
        const statsPDAs = await deriveUserStatsPDA(newClient.publicKey);

        try {
            await program.methods
                .initializeEscrow(amount, newRefSeed, false, true)
                .accountsPartial({
                    sender: newClient.publicKey,
                    receiver: newFreelancer.publicKey,
                    escrow: escrowPDAs.escrowPda,
                    vault: escrowPDAs.vaultPda,
                    senderStats: statsPDAs.statsPda,
                    systemProgram: SystemProgram.programId,
                    tokenProgram: null,
                    senderTokenAccount: null,
                    escrowTokenAccount: null,
                    tokenMint: null,
                    associatedTokenProgram: null,
                })
                .signers([newClient])
                .rpc();
            assert.fail("instruction should have failed");
        } catch (err: any) {
            const errorMessage = err.message || err.error?.errorMessage;
            assert(
                errorMessage.includes("Account `clientMultisig` not provided") ||
                errorMessage.includes("Invalid multisig config"),
                `Expected account validation error, got: ${errorMessage}`
            );
        }
    });

    it("ensures multisig membership validation", async () => {
        const newClient = await createFundedKeypair();
        const newFreelancer = await createFundedKeypair();
        const newRefSeed = 44;

        const [newMultisigPda, newMultisigBump] = await PublicKey.findProgramAddress(
            [Buffer.from("client_multisig"), newClient.publicKey.toBuffer()],
            program.programId
        );

        const members: PublicKey[] = [
            newClient.publicKey,
            member2.publicKey,
            nonMember.publicKey,
            PublicKey.default,
            PublicKey.default
        ];
        const memberCount = 3;
        const threshold = 2;

        await program.methods
            .initializeMultisigClient(members, memberCount, threshold)
            .accountsPartial({
                client: newClient.publicKey,
                multisig: newMultisigPda,
                systemProgram: SystemProgram.programId,
            })
            .signers([newClient])
            .rpc();

        const anotherClient = await createFundedKeypair();
        const [anotherMultisigPda] = await PublicKey.findProgramAddress(
            [Buffer.from("client_multisig"), anotherClient.publicKey.toBuffer()],
            program.programId
        );

        const anotherMembers: PublicKey[] = [
            anotherClient.publicKey,
            member1.publicKey,
            member2.publicKey,
            PublicKey.default,
            PublicKey.default
        ];

        await program.methods
            .initializeMultisigClient(anotherMembers, 3, 2)
            .accountsPartial({
                client: anotherClient.publicKey,
                multisig: anotherMultisigPda,
                systemProgram: SystemProgram.programId,
            })
            .signers([anotherClient])
            .rpc();

        const escrowPDAs = await deriveEscrowPDAs(newClient.publicKey, newFreelancer.publicKey, newRefSeed);
        const statsPDAs = await deriveUserStatsPDA(newClient.publicKey);

        try {
            await program.methods
                .initializeEscrow(amount, newRefSeed, false, true)
                .accountsPartial({
                    sender: newClient.publicKey,
                    receiver: newFreelancer.publicKey,
                    escrow: escrowPDAs.escrowPda,
                    vault: escrowPDAs.vaultPda,
                    senderStats: statsPDAs.statsPda,
                    clientMultisig: anotherMultisigPda,
                    systemProgram: SystemProgram.programId,
                    tokenProgram: null,
                    senderTokenAccount: null,
                    escrowTokenAccount: null,
                    tokenMint: null,
                    associatedTokenProgram: null,
                })
                .signers([newClient])
                .rpc();
            assert.fail("instruction should have thrown InvalidMultisigConfig");
        } catch (err: any) {
            const errorMessage = err.error?.errorMessage || err.message;
            assert(
                errorMessage.includes("Invalid multisig config") ||
                errorMessage.includes("multisig") ||
                errorMessage.includes("member"),
                `Expected multisig validation error, got: ${errorMessage}`
            );
        }
    });

    it("cannot link a multisig to two pending escrows", async () => {
        const newClient = await createFundedKeypair();
        const newFreelancer1 = await createFundedKeypair();
        const newFreelancer2 = await createFundedKeypair();
        const refSeed1 = 45;
        const refSeed2 = 46;

        const [newMultisigPda, newMultisigBump] = await PublicKey.findProgramAddress(
            [Buffer.from("client_multisig"), newClient.publicKey.toBuffer()],
            program.programId
        );

        // Initialize multisig
        const members: PublicKey[] = [
            newClient.publicKey,
            member1.publicKey,
            member2.publicKey,
            PublicKey.default,
            PublicKey.default
        ];
        const memberCount = 3;
        const threshold = 2;

        await program.methods
            .initializeMultisigClient(members, memberCount, threshold)
            .accountsPartial({
                client: newClient.publicKey,
                multisig: newMultisigPda,
                systemProgram: SystemProgram.programId,
            })
            .signers([newClient])
            .rpc();

        // First escrow - should succeed
        const escrowPDAs1 = await deriveEscrowPDAs(newClient.publicKey, newFreelancer1.publicKey, refSeed1);
        const statsPDAs = await deriveUserStatsPDA(newClient.publicKey);

        await program.methods
            .initializeEscrow(amount, refSeed1, false, true)
            .accountsPartial({
                sender: newClient.publicKey,
                receiver: newFreelancer1.publicKey,
                escrow: escrowPDAs1.escrowPda,
                vault: escrowPDAs1.vaultPda,
                senderStats: statsPDAs.statsPda,
                clientMultisig: newMultisigPda,
                systemProgram: SystemProgram.programId,
                tokenProgram: null,
                senderTokenAccount: null,
                escrowTokenAccount: null,
                tokenMint: null,
                associatedTokenProgram: null,
            })
            .signers([newClient])
            .rpc();

        // Second escrow with same multisig - should fail
        const escrowPDAs2 = await deriveEscrowPDAs(newClient.publicKey, newFreelancer2.publicKey, refSeed2);

        try {
            await program.methods
                .initializeEscrow(amount, refSeed2, false, true)
                .accountsPartial({
                    sender: newClient.publicKey,
                    receiver: newFreelancer2.publicKey,
                    escrow: escrowPDAs2.escrowPda,
                    vault: escrowPDAs2.vaultPda,
                    senderStats: statsPDAs.statsPda,
                    clientMultisig: newMultisigPda,
                    systemProgram: SystemProgram.programId,
                    tokenProgram: null,
                    senderTokenAccount: null,
                    escrowTokenAccount: null,
                    tokenMint: null,
                    associatedTokenProgram: null,
                })
                .signers([newClient])
                .rpc();
            assert.fail("instruction should have thrown MultisigBusy");
        } catch (err: any) {
            const errorMessage = err.error?.errorMessage || err.message;
            assert.strictEqual(errorMessage, "Multisig is already busy");
        }
    });

    it("fails when is_multisig=false but multisig account is provided", async () => {
        const newClient = await createFundedKeypair();
        const newFreelancer = await createFundedKeypair();
        const newRefSeed = 47;

        const escrowPDAs = await deriveEscrowPDAs(newClient.publicKey, newFreelancer.publicKey, newRefSeed);
        const statsPDAs = await deriveUserStatsPDA(newClient.publicKey);

        try {
            await program.methods
                .initializeEscrow(amount, newRefSeed, false, false)
                .accountsPartial({
                    sender: newClient.publicKey,
                    receiver: newFreelancer.publicKey,
                    escrow: escrowPDAs.escrowPda,
                    vault: escrowPDAs.vaultPda,
                    senderStats: statsPDAs.statsPda,
                    clientMultisig: multisigPda, // Provided but is_multisig=false
                    systemProgram: SystemProgram.programId,
                    tokenProgram: null,
                    senderTokenAccount: null,
                    escrowTokenAccount: null,
                    tokenMint: null,
                    associatedTokenProgram: null,
                })
                .signers([newClient])
                .rpc();
            assert.fail("instruction should have thrown InvalidMultisigConfig");
        } catch (err: any) {
            const errorMessage = err.error?.errorMessage || err.message;
            assert.strictEqual(errorMessage, "Invalid multisig config");
        }
    });

    it("succeeds with is_multisig=false and no multisig account provided", async () => {
        const newClient = await createFundedKeypair();
        const newFreelancer = await createFundedKeypair();
        const newRefSeed = 48;

        const escrowPDAs = await deriveEscrowPDAs(newClient.publicKey, newFreelancer.publicKey, newRefSeed);
        const statsPDAs = await deriveUserStatsPDA(newClient.publicKey);

        // If clientMultisig is required in the account structure, provide null or default
        // Check your IDL to see if clientMultisig is marked as optional
        await program.methods
            .initializeEscrow(amount, newRefSeed, false, false)
            .accountsPartial({
                sender: newClient.publicKey,
                receiver: newFreelancer.publicKey,
                escrow: escrowPDAs.escrowPda,
                vault: escrowPDAs.vaultPda,
                senderStats: statsPDAs.statsPda,
                clientMultisig: null, // Explicitly set to null
                systemProgram: SystemProgram.programId,
                tokenProgram: null,
                senderTokenAccount: null,
                escrowTokenAccount: null,
                tokenMint: null,
                associatedTokenProgram: null,
            })
            .signers([newClient])
            .rpc();

        // Verify escrow was created without multisig
        const escrow = await program.account.escrow.fetch(escrowPDAs.escrowPda);
        assert.strictEqual(escrow.clientMultisig, null, "escrow should not have multisig when is_multisig=false");
    });
});

