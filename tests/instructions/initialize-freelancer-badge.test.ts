import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { assert } from "chai";
import { describe, it } from "mocha";

import { program, connection, sleep } from "../utils/setup";
import { deriveFreelancerBadgePDA } from "../utils/helpers";

describe("initialize_freelancer_badge()", () => {
    let freelancer: Keypair;
    let badgePda: PublicKey;
    let badgeBump: number;

    before(async () => {
        freelancer = Keypair.generate();

        await connection.requestAirdrop(freelancer.publicKey, 1_000_000_000);
        await sleep(3000);

        const badgePDAs = await deriveFreelancerBadgePDA(freelancer.publicKey);
        badgePda = badgePDAs.badgePda;
        badgeBump = badgePDAs.badgeBump;
    });

    it("initializes freelancer badge successfully", async () => {
        await program.methods
            .initializeFreelancerBadge()
            .accountsStrict({
                freelancer: freelancer.publicKey,
                badge: badgePda,
                systemProgram: SystemProgram.programId,
            })
            .signers([freelancer])
            .rpc();

        const badge = await program.account.freelancerBadge.fetch(badgePda);
        assert.strictEqual(badge.freelancer.toBase58(), freelancer.publicKey.toBase58());
        assert.strictEqual(badge.completedEscrows, 0);
        assert.strictEqual(badge.totalValueCompleted.toNumber(), 0);
    });

    it("fails if badge already exists", async () => {
        try {
            await program.methods
                .initializeFreelancerBadge()
                .accountsStrict({
                    freelancer: freelancer.publicKey,
                    badge: badgePda,
                    systemProgram: SystemProgram.programId,
                })
                .signers([freelancer])
                .rpc();

            assert.fail("should have thrown");
        } catch (err: any) {
            const msg = err.error?.errorMessage || err.message;
            assert.match(msg, /already in use/i);
        }
    });

    it("fails when wrong freelancer tries to initialize badge for someone else", async () => {
        const wrongFreelancer = Keypair.generate();
        const targetFreelancer = Keypair.generate();

        await Promise.all([
            connection.requestAirdrop(wrongFreelancer.publicKey, 1_000_000_000),
            connection.requestAirdrop(targetFreelancer.publicKey, 1_000_000_000),
        ]);
        await sleep(3000);

        const { badgePda: targetBadgePda } = await deriveFreelancerBadgePDA(targetFreelancer.publicKey);

        try {
            await program.methods
                .initializeFreelancerBadge()
                .accountsStrict({
                    freelancer: wrongFreelancer.publicKey,
                    badge: targetBadgePda,
                    systemProgram: SystemProgram.programId,
                })
                .signers([wrongFreelancer])
                .rpc();

            assert.fail("should have failed due to PDA mismatch");
        } catch (err: any) {
            const msg = err.error?.errorMessage || err.message;
            assert.match(msg, /(constraint|seeds)/i);
        }
    });

    it("verifies bump is set correctly", async () => {
        const newFreelancer = Keypair.generate();
        await connection.requestAirdrop(newFreelancer.publicKey, 1_000_000_000);
        await sleep(3000);

        const { badgePda: newBadgePda, badgeBump: expectedBump } = await deriveFreelancerBadgePDA(newFreelancer.publicKey);

        await program.methods
            .initializeFreelancerBadge()
            .accountsStrict({
                freelancer: newFreelancer.publicKey,
                badge: newBadgePda,
                systemProgram: SystemProgram.programId,
            })
            .signers([newFreelancer])
            .rpc();

        const badge = await program.account.freelancerBadge.fetch(newBadgePda);
        assert.strictEqual(badge.bump, expectedBump);
    });
}); 