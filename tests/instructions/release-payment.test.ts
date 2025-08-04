import * as anchor from "@coral-xyz/anchor";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { assert } from "chai";
import { describe, it } from "mocha";

import { program, connection, sleep } from "../utils/setup";
import { deriveEscrowPDAs, deriveUserStatsPDA } from "../utils/helpers";

describe("release_payment()", () => {
    let client: Keypair;
    let freelancer: Keypair;
    let escrowPda: PublicKey;
    let escrowBump: number;
    let vaultPda: PublicKey;
    let vaultBump: number;

    const refSeed = 55;
    const amount = new anchor.BN(2_000_000);

    before(async () => {
        client = Keypair.generate();
        freelancer = Keypair.generate();

        await Promise.all([
            connection.requestAirdrop(client.publicKey, 2_000_000_000),
            connection.requestAirdrop(freelancer.publicKey, 1_000_000_000),
        ]);
        await sleep(3_000);

        const escrowPDAs = await deriveEscrowPDAs(client.publicKey, freelancer.publicKey, refSeed);
        escrowPda = escrowPDAs.escrowPda;
        escrowBump = escrowPDAs.escrowBump;
        vaultPda = escrowPDAs.vaultPda;
        vaultBump = escrowPDAs.vaultBump;

        const { statsPda } = await deriveUserStatsPDA(client.publicKey);

        await program.methods
            .initializeEscrow(amount, refSeed, false)
            .accountsPartial({
                sender: client.publicKey,
                receiver: freelancer.publicKey,
                escrow: escrowPda,
                vault: vaultPda,
                senderStats: statsPda,
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

    it("releases payment successfully", async () => {
        await program.methods
            .releasePayment(refSeed)
            .accountsStrict({
                client: client.publicKey,
                escrow: escrowPda,
            })
            .signers([client])
            .rpc();

        const escrowAccount = await program.account.escrow.fetch(escrowPda);
        assert.isTrue(escrowAccount.isReleased, "escrow should now be released");
    });

    it("fails when called by an unauthorised signer", async () => {
        try {
            await program.methods
                .releasePayment(refSeed)
                .accountsStrict({
                    client: freelancer.publicKey,
                    escrow: escrowPda,
                })
                .signers([freelancer])
                .rpc();
            assert.fail("instruction should have thrown");
        } catch (err: any) {
            const msg = err.error?.errorMessage || err.message;
            assert.strictEqual(msg, "Unauthorised sender");
        }
    });

    it("fails if payment is released twice", async () => {
        try {
            await program.methods
                .releasePayment(refSeed)
                .accountsStrict({
                    client: client.publicKey,
                    escrow: escrowPda,
                })
                .signers([client])
                .rpc();
            assert.fail("second release should have thrown");
        } catch (err: any) {
            const msg = err.error?.errorMessage || err.message;
            assert.strictEqual(msg, "Payment already released");
        }
    });
}); 