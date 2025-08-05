import * as anchor from "@coral-xyz/anchor";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { assert } from "chai";
import { describe, it, before } from "mocha";

import { program, connection, sleep, createFundedKeypair } from "../utils/setup";

describe("initialize_multisig_client()", () => {
    const MAX_MULTISIG_MEMBERS = 5;

    let creator: Keypair;
    let member1: Keypair;
    let member2: Keypair;
    let member3: Keypair;
    let member4: Keypair;
    let multisigPda: PublicKey;
    let multisigBump: number;

    before(async () => {
        creator = await createFundedKeypair();
        member1 = Keypair.generate();
        member2 = Keypair.generate();
        member3 = Keypair.generate();
        member4 = Keypair.generate();

        [multisigPda, multisigBump] = await PublicKey.findProgramAddress(
            [Buffer.from("client_multisig"), creator.publicKey.toBuffer()],
            program.programId
        );
    });

    it("succeeds to initialize multisig", async () => {
        const members: PublicKey[] = [
            creator.publicKey,
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
                client: creator.publicKey,
                multisig: multisigPda,
                systemProgram: SystemProgram.programId,
            })
            .signers([creator])
            .rpc();

        const multisigAccount = await program.account.clientMultisig.fetch(multisigPda);

        assert.strictEqual(multisigAccount.memberCount, memberCount);
        assert.strictEqual(multisigAccount.threshold, threshold);

        assert.ok(multisigAccount.members[0].equals(creator.publicKey));
        assert.ok(multisigAccount.members[1].equals(member1.publicKey));
        assert.ok(multisigAccount.members[2].equals(member2.publicKey));

        for (let i = 0; i < MAX_MULTISIG_MEMBERS; i++) {
            assert.strictEqual(multisigAccount.approvals[i], 0);
        }

        assert.ok(multisigAccount.pendingEscrow.equals(PublicKey.default));
        assert.strictEqual(multisigAccount.bump, multisigBump);
    });

    it("fails when invalid threshold", async () => {
        const newCreator = Keypair.generate();
        await connection.requestAirdrop(newCreator.publicKey, 1_000_000_000);
        await sleep(3_000);

        const [newMultisigPda, newMultisigBump] = await PublicKey.findProgramAddress(
            [Buffer.from("client_multisig"), newCreator.publicKey.toBuffer()],
            program.programId
        );

        const members: PublicKey[] = [
            newCreator.publicKey,
            member3.publicKey,
            member4.publicKey,
            PublicKey.default,
            PublicKey.default
        ];

        const memberCount = 3;
        const invalidThreshold = memberCount + 1;

        try {
            await program.methods
                .initializeMultisigClient(members, memberCount, invalidThreshold)
                .accountsPartial({
                    client: newCreator.publicKey,
                    multisig: newMultisigPda,
                    systemProgram: SystemProgram.programId,
                })
                .signers([newCreator])
                .rpc();
            assert.fail("instruction should have thrown InvalidMultisigConfig");
        } catch (err: any) {
            const errorMessage = err.error?.errorMessage || err.message;
            assert.strictEqual(errorMessage, "Invalid multisig config");
        }
    });

    it("should fail when duplicate members", async () => {
        const newCreator = await createFundedKeypair();

        const [newMultisigPda, newMultisigBump] = await PublicKey.findProgramAddress(
            [Buffer.from("client_multisig"), newCreator.publicKey.toBuffer()],
            program.programId
        );

        const members: PublicKey[] = [
            newCreator.publicKey,
            member1.publicKey,
            member1.publicKey,
            PublicKey.default,
            PublicKey.default
        ];

        const memberCount = 3;
        const threshold = 2;

        try {
            await program.methods
                .initializeMultisigClient(members, memberCount, threshold)
                .accountsPartial({
                    client: newCreator.publicKey,
                    multisig: newMultisigPda,
                    systemProgram: SystemProgram.programId,
                })
                .signers([newCreator])
                .rpc();
            assert.fail("instruction should have thrown DuplicateMember");
        } catch (err: any) {
            const errorMessage = err.error?.errorMessage || err.message;
            assert.strictEqual(errorMessage, "Duplicate member in multisig");
        }
    });

    it("should fail if creator not included", async () => {
        const newCreator = await createFundedKeypair();

        const [newMultisigPda, newMultisigBump] = await PublicKey.findProgramAddress(
            [Buffer.from("client_multisig"), newCreator.publicKey.toBuffer()],
            program.programId
        );

        const members: PublicKey[] = [
            member1.publicKey,
            member2.publicKey,
            member3.publicKey,
            PublicKey.default,
            PublicKey.default
        ];

        const memberCount = 3;
        const threshold = 2;

        try {
            await program.methods
                .initializeMultisigClient(members, memberCount, threshold)
                .accountsPartial({
                    client: newCreator.publicKey,
                    multisig: newMultisigPda,
                    systemProgram: SystemProgram.programId,
                })
                .signers([newCreator])
                .rpc();
            assert.fail("instruction should have thrown InvalidMultisigConfig");
        } catch (err: any) {
            const errorMessage = err.error?.errorMessage || err.message;
            assert.strictEqual(errorMessage, "Invalid multisig config");
        }
    });

    it("fails with zero member count", async () => {
        const newCreator = await createFundedKeypair();

        const [newMultisigPda, newMultisigBump] = await PublicKey.findProgramAddress(
            [Buffer.from("client_multisig"), newCreator.publicKey.toBuffer()],
            program.programId
        );

        const members: PublicKey[] = Array(MAX_MULTISIG_MEMBERS).fill(PublicKey.default);
        const memberCount = 0;
        const threshold = 1;

        try {
            await program.methods
                .initializeMultisigClient(members, memberCount, threshold)
                .accountsPartial({
                    client: newCreator.publicKey,
                    multisig: newMultisigPda,
                    systemProgram: SystemProgram.programId,
                })
                .signers([newCreator])
                .rpc();
            assert.fail("instruction should have thrown InvalidMultisigConfig");
        } catch (err: any) {
            const errorMessage = err.error?.errorMessage || err.message;
            assert.strictEqual(errorMessage, "Invalid multisig config");
        }
    });

    it("fails with zero threshold", async () => {
        const newCreator = await createFundedKeypair();

        const [newMultisigPda, newMultisigBump] = await PublicKey.findProgramAddress(
            [Buffer.from("client_multisig"), newCreator.publicKey.toBuffer()],
            program.programId
        );

        const members: PublicKey[] = [
            newCreator.publicKey,
            member1.publicKey,
            PublicKey.default,
            PublicKey.default,
            PublicKey.default
        ];
        const memberCount = 2;
        const threshold = 0;

        try {
            await program.methods
                .initializeMultisigClient(members, memberCount, threshold)
                .accountsPartial({
                    client: newCreator.publicKey,
                    multisig: newMultisigPda,
                    systemProgram: SystemProgram.programId,
                })
                .signers([newCreator])
                .rpc();
            assert.fail("instruction should have thrown InvalidMultisigConfig");
        } catch (err: any) {
            const errorMessage = err.error?.errorMessage || err.message;
            assert.strictEqual(errorMessage, "Invalid multisig config");
        }
    });

    it("fails with member count exceeding MAX_MULTISIG_MEMBERS", async () => {
        const newCreator = await createFundedKeypair();

        const [newMultisigPda, newMultisigBump] = await PublicKey.findProgramAddress(
            [Buffer.from("client_multisig"), newCreator.publicKey.toBuffer()],
            program.programId
        );

        const members: PublicKey[] = [
            newCreator.publicKey,
            member1.publicKey,
            member2.publicKey,
            member3.publicKey,
            member4.publicKey,
        ];
        const memberCount = MAX_MULTISIG_MEMBERS + 1;
        const threshold = 3;

        try {
            await program.methods
                .initializeMultisigClient(members, memberCount, threshold)
                .accountsPartial({
                    client: newCreator.publicKey,
                    multisig: newMultisigPda,
                    systemProgram: SystemProgram.programId,
                })
                .signers([newCreator])
                .rpc();
            assert.fail("instruction should have thrown InvalidMultisigConfig");
        } catch (err: any) {
            const errorMessage = err.error?.errorMessage || err.message;
            assert.strictEqual(errorMessage, "Invalid multisig config");
        }
    });

    it("fails if multisig PDA already exists", async () => {
        const members: PublicKey[] = [
            creator.publicKey,
            member1.publicKey,
            member2.publicKey,
            PublicKey.default,
            PublicKey.default
        ];

        const memberCount = 3;
        const threshold = 2;

        try {
            await program.methods
                .initializeMultisigClient(members, memberCount, threshold)
                .accountsPartial({
                    client: creator.publicKey,
                    multisig: multisigPda,
                    systemProgram: SystemProgram.programId,
                })
                .signers([creator])
                .rpc();
            assert.fail("should have failed due to account already in use");
        } catch (err: any) {
            assert.match(err.message, /already in use/i);
        }
    });
});

