import * as anchor from "@coral-xyz/anchor";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { assert } from "chai";
import { describe, it } from "mocha";

import { program, connection, sleep } from "../utils/setup";
import { deriveFreelancerBadgePDA } from "../utils/helpers";

describe("update_freelancer_badge()", () => {
    let freelancer: Keypair;
    let badgePda: PublicKey;

    before(async () => {
        freelancer = Keypair.generate();

        await connection.requestAirdrop(freelancer.publicKey, 2_000_000_000);
        await sleep(3000);

        // Initialize badge
        const { badgePda: derivedBadgePda } = await deriveFreelancerBadgePDA(freelancer.publicKey);
        badgePda = derivedBadgePda;

        await program.methods
            .initializeFreelancerBadge()
            .accountsStrict({
                freelancer: freelancer.publicKey,
                badge: badgePda,
                systemProgram: SystemProgram.programId,
            })
            .signers([freelancer])
            .rpc();
    });

    it("updates badge after first escrow", async () => {
        const amount = new anchor.BN(5_000_000);

        await program.methods
            .updateFreelancerBadge(amount)
            .accountsStrict({
                freelancer: freelancer.publicKey,
                badge: badgePda,
            })
            .signers([freelancer])
            .rpc();

        const badge = await program.account.freelancerBadge.fetch(badgePda);
        assert.strictEqual(badge.completedEscrows, 1);
        assert.strictEqual(badge.totalValueCompleted.toNumber(), amount.toNumber());
        assert.deepStrictEqual(badge.tier, { verified: {} });
    });

    it("upgrades tier to professional", async () => {
        const additionalEscrows = 9;
        const amountPerEscrow = new anchor.BN(1_000_000);

        for (let i = 0; i < additionalEscrows; i++) {
            await program.methods
                .updateFreelancerBadge(amountPerEscrow)
                .accountsStrict({
                    freelancer: freelancer.publicKey,
                    badge: badgePda,
                })
                .signers([freelancer])
                .rpc();
        }

        const badge = await program.account.freelancerBadge.fetch(badgePda);
        assert.strictEqual(badge.completedEscrows, 10);
        assert.deepStrictEqual(badge.tier, { professional: {} });
    });

    it("upgrades tier to elite", async () => {
        const additionalEscrows = 15;
        const amountPerEscrow = new anchor.BN(1_000_000);

        for (let i = 0; i < additionalEscrows; i++) {
            await program.methods
                .updateFreelancerBadge(amountPerEscrow)
                .accountsStrict({
                    freelancer: freelancer.publicKey,
                    badge: badgePda,
                })
                .signers([freelancer])
                .rpc();
        }

        const badge = await program.account.freelancerBadge.fetch(badgePda);
        assert.strictEqual(badge.completedEscrows, 25);
        assert.deepStrictEqual(badge.tier, { elite: {} });
    });

    it("fails with zero amount", async () => {
        const zeroAmount = new anchor.BN(0);

        try {
            await program.methods
                .updateFreelancerBadge(zeroAmount)
                .accountsStrict({
                    freelancer: freelancer.publicKey,
                    badge: badgePda,
                })
                .signers([freelancer])
                .rpc();

            assert.fail("should have failed with zero amount");
        } catch (err: any) {
            const msg = err.error?.errorMessage || err.message;
            assert.strictEqual(msg, "Amount can't be 0");
        }
    });

    it("fails when wrong freelancer tries to update badge", async () => {
        const wrongFreelancer = Keypair.generate();
        await connection.requestAirdrop(wrongFreelancer.publicKey, 1_000_000_000);
        await sleep(3000);

        const amount = new anchor.BN(1_000_000);

        try {
            await program.methods
                .updateFreelancerBadge(amount)
                .accountsStrict({
                    freelancer: wrongFreelancer.publicKey, // Wrong signer
                    badge: badgePda, // Original freelancer's badge
                })
                .signers([wrongFreelancer])
                .rpc();

            assert.fail("should have failed due to authorization");
        } catch (err: any) {
            const msg = err.error?.errorMessage || err.message;
            // Should fail because badge doesn't belong to wrong freelancer
            assert.match(msg, /(constraint|seeds|unauthorized)/i);
        }
    });

    it("badge stays elite after reaching 25+ escrows", async () => {
        // Add a few more escrows to verify it stays Elite
        const additionalEscrows = 5;
        const amountPerEscrow = new anchor.BN(1_000_000);

        for (let i = 0; i < additionalEscrows; i++) {
            await program.methods
                .updateFreelancerBadge(amountPerEscrow)
                .accountsStrict({
                    freelancer: freelancer.publicKey,
                    badge: badgePda,
                })
                .signers([freelancer])
                .rpc();
        }

        const badge = await program.account.freelancerBadge.fetch(badgePda);
        assert.strictEqual(badge.completedEscrows, 30);
        assert.deepStrictEqual(badge.tier, { elite: {} }); // Should still be Elite
    });
});

describe("update_freelancer_badge() tier transitions", () => {
    let testFreelancer: Keypair;
    let testBadgePda: PublicKey;

    before(async () => {
        testFreelancer = Keypair.generate();
        await connection.requestAirdrop(testFreelancer.publicKey, 2_000_000_000);
        await sleep(3000);

        const { badgePda: derivedBadgePda } = await deriveFreelancerBadgePDA(testFreelancer.publicKey);
        testBadgePda = derivedBadgePda;

        // Initialize badge
        await program.methods
            .initializeFreelancerBadge()
            .accountsStrict({
                freelancer: testFreelancer.publicKey,
                badge: testBadgePda,
                systemProgram: SystemProgram.programId,
            })
            .signers([testFreelancer])
            .rpc();
    });

    it("transition from verified to professional at 5 escrows", async () => {
        const amount = new anchor.BN(1_000_000);

        // Complete 4 escrows (should stay Verified)
        for (let i = 0; i < 4; i++) {
            await program.methods
                .updateFreelancerBadge(amount)
                .accountsStrict({
                    freelancer: testFreelancer.publicKey,
                    badge: testBadgePda,
                })
                .signers([testFreelancer])
                .rpc();
        }

        let badge = await program.account.freelancerBadge.fetch(testBadgePda);
        assert.strictEqual(badge.completedEscrows, 4);
        assert.deepStrictEqual(badge.tier, { verified: {} });

        // Complete 5th escrow (should become Professional)
        await program.methods
            .updateFreelancerBadge(amount)
            .accountsStrict({
                freelancer: testFreelancer.publicKey,
                badge: testBadgePda,
            })
            .signers([testFreelancer])
            .rpc();

        badge = await program.account.freelancerBadge.fetch(testBadgePda);
        assert.strictEqual(badge.completedEscrows, 5);
        assert.deepStrictEqual(badge.tier, { professional: {} });
    });

    it("transition from professional to elite at 15 escrows", async () => {
        const amount = new anchor.BN(1_000_000);

        // Complete additional 9 escrows (total 14, should stay Professional)
        for (let i = 0; i < 9; i++) {
            await program.methods
                .updateFreelancerBadge(amount)
                .accountsStrict({
                    freelancer: testFreelancer.publicKey,
                    badge: testBadgePda,
                })
                .signers([testFreelancer])
                .rpc();
        }

        let badge = await program.account.freelancerBadge.fetch(testBadgePda);
        assert.strictEqual(badge.completedEscrows, 14);
        assert.deepStrictEqual(badge.tier, { professional: {} });

        // Complete 15th escrow (should become Elite)
        await program.methods
            .updateFreelancerBadge(amount)
            .accountsStrict({
                freelancer: testFreelancer.publicKey,
                badge: testBadgePda,
            })
            .signers([testFreelancer])
            .rpc();

        badge = await program.account.freelancerBadge.fetch(testBadgePda);
        assert.strictEqual(badge.completedEscrows, 15);
        assert.deepStrictEqual(badge.tier, { elite: {} });
    });
});

describe("update_freelancer_badge() error cases", () => {
    it("fails when trying to update non-existent badge", async () => {
        const newFreelancer = Keypair.generate();
        await connection.requestAirdrop(newFreelancer.publicKey, 1_000_000_000);
        await sleep(3000);

        const { badgePda: nonExistentBadgePda } = await deriveFreelancerBadgePDA(newFreelancer.publicKey);

        const amount = new anchor.BN(1_000_000);

        try {
            await program.methods
                .updateFreelancerBadge(amount)
                .accountsStrict({
                    freelancer: newFreelancer.publicKey,
                    badge: nonExistentBadgePda, // Badge doesn't exist
                })
                .signers([newFreelancer])
                .rpc();

            assert.fail("should have failed for non-existent badge");
        } catch (err: any) {
            const msg = err.error?.errorMessage || err.message;
            // Should fail because account doesn't exist
            assert.match(msg, /(account|not found|does not exist)/i);
        }
    });
}); 