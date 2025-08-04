import * as anchor from "@coral-xyz/anchor";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { assert } from "chai";
import { describe, it } from "mocha";
import { MPL_CORE_PROGRAM_ID } from "@metaplex-foundation/mpl-core";

import { program, connection, sleep } from "../utils/setup";
import { deriveFreelancerBadgePDA, deriveBadgeAuthorityPDA } from "../utils/helpers";

describe("mint_reputation_nft()", () => {
    let freelancer: Keypair;
    let badgePda: PublicKey;
    let badgeAuthorityPda: PublicKey;
    let badgeAuthorityBump: number;

    // MPL Core program ID
    const MPL_PROGRAM_ID = new PublicKey(MPL_CORE_PROGRAM_ID);

    before(async () => {
        freelancer = Keypair.generate();

        await connection.requestAirdrop(freelancer.publicKey, 2_000_000_000);
        await sleep(3000);

        const { badgePda: derivedBadgePda } = await deriveFreelancerBadgePDA(freelancer.publicKey);
        badgePda = derivedBadgePda;

        const { authorityPda, authorityBump } = await deriveBadgeAuthorityPDA();
        badgeAuthorityPda = authorityPda;
        badgeAuthorityBump = authorityBump;

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

    describe("Positive scenarios", () => {

        it("successfully mints Verified NFT with 3 completed escrows", async function () {
            const freelancer = Keypair.generate();
            await connection.requestAirdrop(freelancer.publicKey, 2_000_000_000);
            await sleep(3000);

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

            for (let i = 0; i < 3; i++) {
                await program.methods
                    .updateFreelancerBadge(new anchor.BN(1_000_000))
                    .accountsStrict({
                        freelancer: freelancer.publicKey,
                        badge: badgePda,
                    })
                    .signers([freelancer])
                    .rpc();
            }

            let badge = await program.account.freelancerBadge.fetch(badgePda);

            const asset = Keypair.generate();
            const collection = Keypair.generate();

            await program.methods
                .mintReputationNft()
                .accountsPartial({
                    freelancer: freelancer.publicKey,
                    badge: badgePda,
                    asset: asset.publicKey,
                    collection: collection.publicKey,
                    mplCoreProgram: MPL_PROGRAM_ID,
                    systemProgram: SystemProgram.programId,
                })
                .signers([freelancer, asset])
                .rpc();

            badge = await program.account.freelancerBadge.fetch(badgePda);
            assert.deepStrictEqual(badge.tier, { verified: {} });
        });

        it("successfully mints Professional NFT with 10 completed escrows", async () => {
            const freelancer2 = Keypair.generate();
            await connection.requestAirdrop(freelancer2.publicKey, 2_000_000_000);
            await sleep(3000);

            const { badgePda: badge2Pda } = await deriveFreelancerBadgePDA(freelancer2.publicKey);

            await program.methods
                .initializeFreelancerBadge()
                .accountsStrict({
                    freelancer: freelancer2.publicKey,
                    badge: badge2Pda,
                    systemProgram: SystemProgram.programId,
                })
                .signers([freelancer2])
                .rpc();

            for (let i = 0; i < 10; i++) {
                await program.methods
                    .updateFreelancerBadge(new anchor.BN(1_000_000))
                    .accountsStrict({
                        freelancer: freelancer2.publicKey,
                        badge: badge2Pda,
                    })
                    .signers([freelancer2])
                    .rpc();
            }

            let badge = await program.account.freelancerBadge.fetch(badge2Pda);
            assert.strictEqual(badge.completedEscrows, 10);

            const asset = Keypair.generate();
            const collection = Keypair.generate();

            await program.methods
                .mintReputationNft()
                .accountsStrict({
                    freelancer: freelancer2.publicKey,
                    badge: badge2Pda,
                    asset: asset.publicKey,
                    collection: collection.publicKey,
                    mplCoreProgram: MPL_CORE_PROGRAM_ID,
                    systemProgram: SystemProgram.programId,
                })
                .signers([freelancer2, asset])
                .rpc();

            badge = await program.account.freelancerBadge.fetch(badge2Pda);
            assert.deepStrictEqual(badge.tier, { professional: {} });
        });

        it("successfully mints Elite NFT with 25 completed escrows", async () => {
            const freelancer3 = Keypair.generate();
            await connection.requestAirdrop(freelancer3.publicKey, 2_000_000_000);
            await sleep(3000);

            const { badgePda: badge3Pda } = await deriveFreelancerBadgePDA(freelancer3.publicKey);

            await program.methods
                .initializeFreelancerBadge()
                .accountsStrict({
                    freelancer: freelancer3.publicKey,
                    badge: badge3Pda,
                    systemProgram: SystemProgram.programId,
                })
                .signers([freelancer3])
                .rpc();

            for (let i = 0; i < 25; i++) {
                await program.methods
                    .updateFreelancerBadge(new anchor.BN(1_000_000))
                    .accountsStrict({
                        freelancer: freelancer3.publicKey,
                        badge: badge3Pda,
                    })
                    .signers([freelancer3])
                    .rpc();
            }

            let badge = await program.account.freelancerBadge.fetch(badge3Pda);
            assert.strictEqual(badge.completedEscrows, 25);

            const asset = Keypair.generate();
            const collection = Keypair.generate();

            await program.methods
                .mintReputationNft()
                .accountsStrict({
                    freelancer: freelancer3.publicKey,
                    badge: badge3Pda,
                    asset: asset.publicKey,
                    collection: collection.publicKey,
                    mplCoreProgram: MPL_CORE_PROGRAM_ID,
                    systemProgram: SystemProgram.programId,
                })
                .signers([freelancer3, asset])
                .rpc();

            badge = await program.account.freelancerBadge.fetch(badge3Pda);
            assert.deepStrictEqual(badge.tier, { elite: {} });
        });

        it("successfully upgrades from Verified to Professional NFT", async () => {
            let badge = await program.account.freelancerBadge.fetch(badgePda);
            assert.deepStrictEqual(badge.tier, { unranked: {} });

            for (let i = 0; i < 3; i++) {
                await program.methods
                    .updateFreelancerBadge(new anchor.BN(1_000_000))
                    .accountsStrict({
                        freelancer: freelancer.publicKey,
                        badge: badgePda,
                    })
                    .signers([freelancer])
                    .rpc();
            }

            const firstAsset = Keypair.generate();
            const firstCollection = Keypair.generate();

            await program.methods
                .mintReputationNft()
                .accountsStrict({
                    freelancer: freelancer.publicKey,
                    badge: badgePda,
                    asset: firstAsset.publicKey,
                    collection: firstCollection.publicKey,
                    mplCoreProgram: MPL_PROGRAM_ID,
                    systemProgram: SystemProgram.programId,
                })
                .signers([freelancer, firstAsset])
                .rpc();

            badge = await program.account.freelancerBadge.fetch(badgePda);
            assert.deepStrictEqual(badge.tier, { verified: {} });

            for (let i = 0; i < 7; i++) {
                await program.methods
                    .updateFreelancerBadge(new anchor.BN(1_000_000))
                    .accountsStrict({
                        freelancer: freelancer.publicKey,
                        badge: badgePda,
                    })
                    .signers([freelancer])
                    .rpc();
            }

            badge = await program.account.freelancerBadge.fetch(badgePda);
            assert.strictEqual(badge.completedEscrows, 10);

            const secondAsset = Keypair.generate();
            const secondCollection = Keypair.generate();

            await program.methods
                .mintReputationNft()
                .accountsStrict({
                    freelancer: freelancer.publicKey,
                    badge: badgePda,
                    asset: secondAsset.publicKey,
                    collection: secondCollection.publicKey,
                    mplCoreProgram: MPL_PROGRAM_ID,
                    systemProgram: SystemProgram.programId,
                })
                .signers([freelancer, secondAsset])
                .rpc();

            badge = await program.account.freelancerBadge.fetch(badgePda);
            assert.deepStrictEqual(badge.tier, { professional: {} });
        });
    });

    describe("Negative scenarios", () => {
        it("fails with insufficient escrows (0 escrows)", async () => {
            const freelancerNew = Keypair.generate();
            await connection.requestAirdrop(freelancerNew.publicKey, 2_000_000_000);
            await sleep(3000);

            const { badgePda: newBadgePda } = await deriveFreelancerBadgePDA(freelancerNew.publicKey);

            await program.methods
                .initializeFreelancerBadge()
                .accountsStrict({
                    freelancer: freelancerNew.publicKey,
                    badge: newBadgePda,
                    systemProgram: SystemProgram.programId,
                })
                .signers([freelancerNew])
                .rpc();

            const asset = Keypair.generate();
            const collection = Keypair.generate();

            try {
                await program.methods
                    .mintReputationNft()
                    .accountsStrict({
                        freelancer: freelancerNew.publicKey,
                        badge: newBadgePda,
                        asset: asset.publicKey,
                        collection: collection.publicKey,
                        mplCoreProgram: MPL_CORE_PROGRAM_ID,
                        systemProgram: SystemProgram.programId,
                    })
                    .signers([freelancerNew, asset])
                    .rpc();

                assert.fail("Expected InsufficientEscrows error");
            } catch (error) {
                assert.isTrue(error.message.includes("InsufficientEscrows") || error.message.includes("Error Code:"));
            }
        });

        it("fails with insufficient escrows (2 escrows)", async () => {
            const freelancerNew = Keypair.generate();
            await connection.requestAirdrop(freelancerNew.publicKey, 2_000_000_000);
            await sleep(3000);

            const { badgePda: newBadgePda } = await deriveFreelancerBadgePDA(freelancerNew.publicKey);

            await program.methods
                .initializeFreelancerBadge()
                .accountsStrict({
                    freelancer: freelancerNew.publicKey,
                    badge: newBadgePda,
                    systemProgram: SystemProgram.programId,
                })
                .signers([freelancerNew])
                .rpc();

            for (let i = 0; i < 2; i++) {
                await program.methods
                    .updateFreelancerBadge(new anchor.BN(1_000_000))
                    .accountsStrict({
                        freelancer: freelancerNew.publicKey,
                        badge: newBadgePda,
                    })
                    .signers([freelancerNew])
                    .rpc();
            }

            const asset = Keypair.generate();
            const collection = Keypair.generate();

            try {
                await program.methods
                    .mintReputationNft()
                    .accountsStrict({
                        freelancer: freelancerNew.publicKey,
                        badge: newBadgePda,
                        asset: asset.publicKey,
                        collection: collection.publicKey,
                        mplCoreProgram: MPL_CORE_PROGRAM_ID,
                        systemProgram: SystemProgram.programId,
                    })
                    .signers([freelancerNew, asset])
                    .rpc();

                assert.fail("Expected InsufficientEscrows error");
            } catch (error) {
                assert.isTrue(error.message.includes("InsufficientEscrows") || error.message.includes("Error Code:"));
            }
        });

        it("fails when trying to mint same tier NFT again", async () => {
            const freelancer = Keypair.generate();
            await connection.requestAirdrop(freelancer.publicKey, 2_000_000_000);
            await sleep(3000);

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

            for (let i = 0; i < 10; i++) {
                await program.methods
                    .updateFreelancerBadge(new anchor.BN(1_000_000))
                    .accountsStrict({
                        freelancer: freelancer.publicKey,
                        badge: badgePda,
                    })
                    .signers([freelancer])
                    .rpc();
            }

            let badge = await program.account.freelancerBadge.fetch(badgePda);
            console.log("Badge state before first mint:", {
                tier: badge.tier,
                completedEscrows: badge.completedEscrows
            });
            assert.strictEqual(badge.completedEscrows, 10);
            assert.deepStrictEqual(badge.tier, { unranked: {} });

            const firstAsset = Keypair.generate();
            const firstCollection = Keypair.generate();
            let firstMintSucceeded = false;

            try {
                await program.methods
                    .mintReputationNft()
                    .accountsStrict({
                        freelancer: freelancer.publicKey,
                        badge: badgePda,
                        asset: firstAsset.publicKey,
                        collection: firstCollection.publicKey,
                        mplCoreProgram: MPL_CORE_PROGRAM_ID,
                        systemProgram: SystemProgram.programId,
                    })
                    .signers([freelancer, firstAsset])
                    .rpc();

                firstMintSucceeded = true;
            } catch (error: any) {
                console.error("First mint failed unexpectedly:", error.message);
                console.error("Full error:", error);
                throw new Error(`First mint should have succeeded but failed: ${error.message}`);
            }

            assert.isTrue(firstMintSucceeded, "First mint should have succeeded");

            badge = await program.account.freelancerBadge.fetch(badgePda);
            assert.deepStrictEqual(badge.tier, { professional: {} });
            assert.strictEqual(badge.completedEscrows, 10);

            const secondAsset = Keypair.generate();
            const secondCollection = Keypair.generate();
            let secondMintFailed = false;
            let caughtError = null;

            try {
                await program.methods
                    .mintReputationNft()
                    .accountsStrict({
                        freelancer: freelancer.publicKey,
                        badge: badgePda,
                        asset: secondAsset.publicKey,
                        collection: secondCollection.publicKey,
                        mplCoreProgram: MPL_CORE_PROGRAM_ID,
                        systemProgram: SystemProgram.programId,
                    })
                    .signers([freelancer, secondAsset])
                    .rpc();

                assert.fail("Second mint should have failed but succeeded");

            } catch (error: any) {
                secondMintFailed = true;
                caughtError = error;
                console.log("Second mint failed as expected");
                console.log("Error message:", error.message);

                if (error.error && error.error.errorCode) {
                    console.log("Error code:", error.error.errorCode.code);
                    console.log("Error number:", error.error.errorCode.number);
                }
            }

            assert.isTrue(secondMintFailed, "Second mint should have failed");
            assert.isNotNull(caughtError, "Should have caught an error on second mint");

            const errorMessage = caughtError.message || "";
            const hasCorrectError = errorMessage.includes("NFTAlreadyMinted") ||
                errorMessage.includes("6012") ||
                (caughtError.error && caughtError.error.errorCode && caughtError.error.errorCode.code === "NFTAlreadyMinted");

            assert.isTrue(
                hasCorrectError,
                `Expected NFTAlreadyMinted error, got: ${errorMessage}`
            );

            const finalBadge = await program.account.freelancerBadge.fetch(badgePda);
            console.log("Final badge state:", {
                tier: finalBadge.tier,
                completedEscrows: finalBadge.completedEscrows
            });

            assert.deepStrictEqual(finalBadge.tier, { professional: {} });
            assert.strictEqual(finalBadge.completedEscrows, 10);
        });

        it("fails with wrong freelancer account", async () => {
            const wrongFreelancer = Keypair.generate();
            await connection.requestAirdrop(wrongFreelancer.publicKey, 1_000_000_000);
            await sleep(3000);

            const asset = Keypair.generate();
            const collection = Keypair.generate();

            try {
                await program.methods
                    .mintReputationNft()
                    .accountsStrict({
                        freelancer: wrongFreelancer.publicKey, // Wrong freelancer
                        badge: badgePda, // Badge belongs to different freelancer
                        asset: asset.publicKey,
                        collection: collection.publicKey,
                        mplCoreProgram: MPL_CORE_PROGRAM_ID,
                        systemProgram: SystemProgram.programId,
                    })
                    .signers([wrongFreelancer, asset])
                    .rpc();

                assert.fail("Expected constraint error");
            } catch (error) {
                assert.isTrue(error.message.includes("Error Code:") || error.message.includes("Constraint"));
            }
        });
    });
});
