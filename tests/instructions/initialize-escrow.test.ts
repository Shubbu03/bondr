import * as anchor from "@coral-xyz/anchor";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { assert } from "chai";
import { describe, it } from "mocha";

import { program, connection, sleep } from "../utils/setup";
import { deriveEscrowPDAs, deriveUserStatsPDA } from "../utils/helpers";

describe("initialize_escrow()", () => {
    const amount = new anchor.BN(1_000_000); // 0.001 SOL
    const refSeed = 42;

    let sender: Keypair;
    let receiver: Keypair;
    let escrowPda: PublicKey;
    let escrowBump: number;
    let vaultPda: PublicKey;
    let vaultBump: number;
    let statsPda: PublicKey;
    let statsBump: number;

    before(async () => {
        // 1. generating fresh keypairs so tests are deterministic & isolated.
        sender = Keypair.generate();
        receiver = Keypair.generate();

        // 2. adding funds to both accounts, waiting for finalising
        await Promise.all([
            connection.requestAirdrop(sender.publicKey, 2_000_000_000),  // 2 SOL
            connection.requestAirdrop(receiver.publicKey, 1_000_000_000) // 1 SOL
        ]);
        await sleep(3_000);

        // 3. Derive PDAs using helpers
        const escrowPDAs = await deriveEscrowPDAs(sender.publicKey, receiver.publicKey, refSeed);
        escrowPda = escrowPDAs.escrowPda;
        escrowBump = escrowPDAs.escrowBump;
        vaultPda = escrowPDAs.vaultPda;
        vaultBump = escrowPDAs.vaultBump;

        const statsPDAs = await deriveUserStatsPDA(sender.publicKey);
        statsPda = statsPDAs.statsPda;
        statsBump = statsPDAs.statsBump;
    });

    it("Initializes an escrow & sender stats correctly", async () => {
        //testing sol transfer first
        await program.methods
            .initializeEscrow(amount, refSeed, false)
            .accountsPartial({
                sender: sender.publicKey,
                receiver: receiver.publicKey,
                escrow: escrowPda,
                vault: vaultPda,
                senderStats: statsPda,
                systemProgram: SystemProgram.programId,
                // Passing `null` for optional token accounts because this is SOL
                tokenProgram: null,
                senderTokenAccount: null,
                escrowTokenAccount: null,
                tokenMint: null,
                associatedTokenProgram: null,
            })
            .signers([sender])
            .rpc();

        // validating on chain data
        const escrowAccount = await program.account.escrow.fetch(escrowPda);
        assert.ok(escrowAccount.sender.equals(sender.publicKey));
        assert.ok(escrowAccount.receiver.equals(receiver.publicKey));
        assert.strictEqual(Number(escrowAccount.amount), amount.toNumber());
        assert.isFalse(escrowAccount.isReleased, "escrow should not be released");
        assert.strictEqual(escrowAccount.bump, escrowBump);

        const statsAccount = await program.account.userStats.fetch(statsPda);
        assert.ok(statsAccount.user.equals(sender.publicKey));
        assert.strictEqual(Number(statsAccount.completedEscrows), 0);
        assert.strictEqual(statsAccount.bump, statsBump);
    });

    it("fails if amount is zero", async () => {
        const zeroAmount = new anchor.BN(0);
        const testSeed = 43;
        const { escrowPda: wrongEscrowPda, vaultPda: wrongVaultPda } = await deriveEscrowPDAs(
            sender.publicKey,
            receiver.publicKey,
            testSeed
        );

        try {
            await program.methods
                .initializeEscrow(zeroAmount, testSeed, false)
                .accountsPartial({
                    sender: sender.publicKey,
                    receiver: receiver.publicKey,
                    escrow: wrongEscrowPda,
                    vault: wrongVaultPda,
                    senderStats: statsPda,
                    systemProgram: SystemProgram.programId,
                    tokenProgram: null,
                    senderTokenAccount: null,
                    escrowTokenAccount: null,
                    tokenMint: null,
                    associatedTokenProgram: null,
                })
                .signers([sender])
                .rpc();
            assert.fail("instruction should have thrown");
        } catch (err) {
            // Access the error message correctly for Anchor programs
            const errorMessage = err.error?.errorMessage || err.message;
            assert.strictEqual(errorMessage, "Amount can't be 0");
        }
    });

    it("fails on self-transfer (sender == receiver)", async () => {
        const selfSeed = 44;
        const { escrowPda: selfPda, vaultPda: selfVaultPda } = await deriveEscrowPDAs(
            sender.publicKey,
            sender.publicKey, // same as sender
            selfSeed
        );

        try {
            await program.methods
                .initializeEscrow(amount, selfSeed, false)
                .accountsPartial({
                    sender: sender.publicKey,
                    receiver: sender.publicKey, // same sender
                    escrow: selfPda,
                    vault: selfVaultPda,
                    senderStats: statsPda,
                    systemProgram: SystemProgram.programId,
                    tokenProgram: null,
                    senderTokenAccount: null,
                    escrowTokenAccount: null,
                    tokenMint: null,
                    associatedTokenProgram: null,
                })
                .signers([sender])
                .rpc();
            assert.fail("instruction should have thrown");
        } catch (err: any) {
            const msg = err.error?.errorMessage || err.message;
            assert.strictEqual(msg, "Can't send money to self");
        }
    });

    it("fails if escrow PDA already exists (duplicate escrow)", async () => {
        try {
            await program.methods
                .initializeEscrow(amount, refSeed, false)
                .accountsPartial({
                    sender: sender.publicKey,
                    receiver: receiver.publicKey,
                    escrow: escrowPda, // previously initialised in happy-path test
                    vault: vaultPda,   // vault from original test
                    senderStats: statsPda,
                    systemProgram: SystemProgram.programId,
                    tokenProgram: null,
                    senderTokenAccount: null,
                    escrowTokenAccount: null,
                    tokenMint: null,
                    associatedTokenProgram: null,
                })
                .signers([sender])
                .rpc();
            assert.fail("should have failed due to account already in use");
        } catch (err) {
            assert.match(err.message, /already in use/i);
        }
    });
}); 