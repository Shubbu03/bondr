import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Bondr } from "../target/types/bondr";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { assert } from "chai";
import {
  createMint,
  createAssociatedTokenAccount,
  getAccount,
  mintTo,
  TOKEN_PROGRAM_ID,
} from "@solana/spl-token";

describe("bondr", () => {
  anchor.setProvider(anchor.AnchorProvider.env());
  const provider = anchor.getProvider();
  const connection = provider.connection;
  const program = anchor.workspace.Bondr as Program<Bondr>;
  const sender = provider.wallet;
  let receiver: Keypair;
  const amount = new anchor.BN(1_000_000); // 0.001 SOL

  const referenceSeed = 42;
  let remittancePda: PublicKey;
  let remittanceBump: number;
  let statsPda: PublicKey;
  let statsBump: number;

  before(async () => {
    receiver = Keypair.generate();

    // Derive remittance PDA
    [remittancePda, remittanceBump] = await PublicKey.findProgramAddress(
      [
        Buffer.from("remittance"),
        sender.publicKey.toBuffer(),
        receiver.publicKey.toBuffer(),
        Buffer.from([referenceSeed]),
      ],
      program.programId
    );

    // Derive stats PDA
    [statsPda, statsBump] = await PublicKey.findProgramAddress(
      [
        Buffer.from("remit_stats"),
        sender.publicKey.toBuffer(),
      ],
      program.programId
    );

    console.log("Remittance PDA:", remittancePda.toBase58());
    console.log("Stats PDA:", statsPda.toBase58());
  });

  it("Initializes a remittance", async () => {
    await provider.connection.requestAirdrop(receiver.publicKey, 1_000_000_000);
    await new Promise(resolve => setTimeout(resolve, 3000)); // wait for it to finalize

    await program.methods
      .initialize(amount, referenceSeed)
      .accountsStrict({
        sender: sender.publicKey,
        receiver: receiver.publicKey,
        remittance: remittancePda,
        stats: statsPda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    const remittanceAccount = await program.account.remittance.fetch(
      remittancePda
    );

    // Assert remittance account data
    assert.ok(remittanceAccount.sender.equals(sender.publicKey));
    assert.ok(remittanceAccount.receiver.equals(receiver.publicKey));
    assert.strictEqual(remittanceAccount.amount.toNumber(), amount.toNumber());
    assert.strictEqual(remittanceAccount.bump, remittanceBump);

    // Assert stats account data
    const statsAccount = await program.account.remitStats.fetch(statsPda);
    assert.ok(statsAccount.user.equals(sender.publicKey));
    assert.strictEqual(statsAccount.totalSent.toNumber(), amount.toNumber());
    assert.strictEqual(statsAccount.txCount.toNumber(), 1);
    assert.strictEqual(statsAccount.bump, statsBump);
  });

  it("Fails if amount is zero", async () => {
    const referenceSeedFail = 99;
    const [failRemittancePda] = await PublicKey.findProgramAddress(
      [
        Buffer.from("remittance"),
        sender.publicKey.toBuffer(),
        receiver.publicKey.toBuffer(),
        Buffer.from([referenceSeedFail]),
      ],
      program.programId
    );

    try {
      await program.methods
        .initialize(new anchor.BN(0), referenceSeedFail)
        .accountsStrict({
          sender: sender.publicKey,
          receiver: receiver.publicKey,
          remittance: failRemittancePda,
          stats: statsPda,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      throw new Error("Test should have failed but didn't");
    } catch (err) {
      // Access the error message correctly for Anchor programs
      const errorMessage = err.error?.errorMessage || err.message;
      assert.strictEqual(errorMessage, "Amount can't be 0");
    }
  });

  it("Fails if PDA already exists (duplicate remittance)", async () => {
    try {
      await program.methods
        .initialize(amount, referenceSeed)
        .accountsStrict({
          sender: sender.publicKey,
          receiver: receiver.publicKey,
          remittance: remittancePda,
          stats: statsPda,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      throw new Error("Test should have failed but didn't");
    } catch (err) {
      assert.match(err.message, /already in use/i);
    }
  });

  it("Updates RemitStats on second remittance", async () => {
    const secondReferenceSeed = 43; // Different seed for second remittance
    const secondAmount = new anchor.BN(2_000_000); // 0.002 SOL
    const secondReceiver = Keypair.generate();

    // Derive PDA for second remittance
    const [secondRemittancePda, secondRemittanceBump] = await PublicKey.findProgramAddress(
      [
        Buffer.from("remittance"),
        sender.publicKey.toBuffer(),
        secondReceiver.publicKey.toBuffer(),
        Buffer.from([secondReferenceSeed]),
      ],
      program.programId
    );

    // Airdrop to second receiver
    await provider.connection.requestAirdrop(secondReceiver.publicKey, 1_000_000_000);
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Create second remittance
    await program.methods
      .initialize(secondAmount, secondReferenceSeed)
      .accountsStrict({
        sender: sender.publicKey,
        receiver: secondReceiver.publicKey,
        remittance: secondRemittancePda,
        stats: statsPda, // Same stats PDA (based on sender only)
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    // Verify second remittance account
    const secondRemittanceAccount = await program.account.remittance.fetch(
      secondRemittancePda
    );
    assert.ok(secondRemittanceAccount.sender.equals(sender.publicKey));
    assert.ok(secondRemittanceAccount.receiver.equals(secondReceiver.publicKey));
    assert.strictEqual(secondRemittanceAccount.amount.toNumber(), secondAmount.toNumber());
    assert.strictEqual(secondRemittanceAccount.bump, secondRemittanceBump);

    // Verify updated stats account
    const updatedStatsAccount = await program.account.remitStats.fetch(statsPda);
    assert.ok(updatedStatsAccount.user.equals(sender.publicKey)); // User unchanged
    assert.strictEqual(updatedStatsAccount.totalSent.toNumber(), 3_000_000); // 1M + 2M = 3M
    assert.strictEqual(updatedStatsAccount.txCount.toNumber(), 2); // 1 + 1 = 2
    assert.strictEqual(updatedStatsAccount.bump, statsBump); // Bump unchanged
  });

  it("Fails to update RemitStats if passed PDA is incorrect", async () => {
    const maliciousUser = Keypair.generate();
    const wrongReferenceSeed = 55;
    const testReceiver = Keypair.generate();

    // Derive correct remittance PDA for this test
    const [testRemittancePda] = await PublicKey.findProgramAddress(
      [
        Buffer.from("remittance"),
        sender.publicKey.toBuffer(),
        testReceiver.publicKey.toBuffer(),
        Buffer.from([wrongReferenceSeed]),
      ],
      program.programId
    );

    // Derive WRONG stats PDA using different user (not the sender)
    const [wrongStatsPda] = await PublicKey.findProgramAddress(
      [
        Buffer.from("remit_stats"),
        maliciousUser.publicKey.toBuffer(), // Wrong user!
      ],
      program.programId
    );

    // Airdrop to test receiver
    await provider.connection.requestAirdrop(testReceiver.publicKey, 1_000_000_000);
    await new Promise(resolve => setTimeout(resolve, 3000));

    try {
      await program.methods
        .initialize(amount, wrongReferenceSeed)
        .accountsStrict({
          sender: sender.publicKey, // Real sender
          receiver: testReceiver.publicKey,
          remittance: testRemittancePda,
          stats: wrongStatsPda, // Wrong stats PDA (derived from different user)
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      throw new Error("Test should have failed but didn't");
    } catch (err) {
      // Expect constraint seeds error - Anchor prevents PDA spoofing
      assert.match(err.message, /constraint.*seed/i);
    }
  });

  it("Should NOT emit LoyaltyMilestoneEvent before milestone (tx_count = 2)", async () => {
    // Use a fresh sender to have precise control over tx_count
    const freshSender = Keypair.generate();

    // Airdrop to fresh sender
    await provider.connection.requestAirdrop(freshSender.publicKey, 2_000_000_000);
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Derive fresh stats PDA for this sender
    const [freshStatsPda, freshStatsBump] = await PublicKey.findProgramAddress(
      [
        Buffer.from("remit_stats"),
        freshSender.publicKey.toBuffer(),
      ],
      program.programId
    );

    const receivers = [Keypair.generate(), Keypair.generate()];
    const referenceSeeds = [91, 92]; // Valid byte range (1-100, not 101-102)
    const amount = new anchor.BN(1_000_000);
    let lastTxSig: string;

    // Perform exactly 2 remittance transactions
    for (let i = 0; i < 2; i++) {
      const [remittancePda] = await PublicKey.findProgramAddress(
        [
          Buffer.from("remittance"),
          freshSender.publicKey.toBuffer(),
          receivers[i].publicKey.toBuffer(),
          Buffer.from([referenceSeeds[i]]),
        ],
        program.programId
      );

      lastTxSig = await program.methods
        .initialize(amount, referenceSeeds[i])
        .accountsStrict({
          sender: freshSender.publicKey,
          receiver: receivers[i].publicKey,
          remittance: remittancePda,
          stats: freshStatsPda,
          systemProgram: SystemProgram.programId,
        })
        .signers([freshSender])
        .rpc();
    }

    // Verify tx_count is exactly 2
    const statsAccount = await program.account.remitStats.fetch(freshStatsPda);
    assert.strictEqual(statsAccount.txCount.toNumber(), 2, "tx_count should be exactly 2");

    // Fetch and inspect logs of the 2nd (final) transaction
    const tx = await connection.getTransaction(lastTxSig, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0,
    });

    const logs = tx?.meta?.logMessages || [];

    console.log("\n📋 Negative Test - Full Log Output (should NOT contain LoyaltyMilestoneEvent):");
    logs.forEach((log) => console.log(log));

    // Assert that NO LoyaltyMilestoneEvent appears in logs
    const hasEventLog = logs.some((log) =>
      log.toLowerCase().includes("loyaltymilestoneevent")
    );

    assert.isFalse(hasEventLog, "❌ LoyaltyMilestoneEvent should NOT be emitted when tx_count < 3");

    console.log("✅ Confirmed: No LoyaltyMilestoneEvent emitted at tx_count = 2");
  });

  it("Emits LoyaltyMilestoneEvent on 3rd remittance", async () => {
    // Use a fresh sender to have precise control over tx_count progression
    const milestoneSender = Keypair.generate();

    // Airdrop to milestone sender
    await provider.connection.requestAirdrop(milestoneSender.publicKey, 2_000_000_000);
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Derive fresh stats PDA for this sender
    const [milestoneStatsPda] = await PublicKey.findProgramAddress(
      [
        Buffer.from("remit_stats"),
        milestoneSender.publicKey.toBuffer(),
      ],
      program.programId
    );

    const referenceSeeds = [51, 52, 53]; // Different seeds (valid byte range)
    const receivers = [Keypair.generate(), Keypair.generate(), Keypair.generate()];
    const amounts = [1_000_000, 2_000_000, 3_000_000].map(v => new anchor.BN(v));
    let lastTxSig: string;

    // Perform exactly 3 transactions to hit the milestone
    for (let i = 0; i < 3; i++) {
      const [pda] = await PublicKey.findProgramAddress(
        [
          Buffer.from("remittance"),
          milestoneSender.publicKey.toBuffer(),
          receivers[i].publicKey.toBuffer(),
          Buffer.from([referenceSeeds[i]]),
        ],
        program.programId
      );

      lastTxSig = await program.methods
        .initialize(amounts[i], referenceSeeds[i])
        .accountsStrict({
          sender: milestoneSender.publicKey,
          receiver: receivers[i].publicKey,
          remittance: pda,
          stats: milestoneStatsPda,
          systemProgram: SystemProgram.programId,
        })
        .signers([milestoneSender])
        .rpc();
    }

    // Verify tx_count is exactly 3 (milestone reached)
    const statsAccount = await program.account.remitStats.fetch(milestoneStatsPda);
    assert.strictEqual(statsAccount.txCount.toNumber(), 3, "tx_count should be exactly 3 (milestone reached)");

    // // Fetch and inspect logs of 3rd tx
    // const tx = await provider.connection.getTransaction(lastTxSig, {
    //   commitment: "confirmed",
    // });

    // const logs = tx?.meta?.logMessages || [];

    // const matched = logs.some(log =>
    //   log.includes("Program log: LoyaltyMilestoneEvent") &&
    //   log.includes("Novice")
    // );

    // assert.isTrue(matched, "LoyaltyMilestoneEvent with 'Novice' tier should be emitted");

    const tx = await provider.connection.getTransaction(lastTxSig, {
      commitment: "confirmed",
      maxSupportedTransactionVersion: 0,
    });

    const logs = tx?.meta?.logMessages || [];

    console.log("\n📋 Positive Test - Full Log Output (should contain LoyaltyMilestoneEvent):");
    logs.forEach((log) => console.log(log));

    // Check for any sign of the loyalty event
    const hasEventLog = logs.some((log) =>
      log.toLowerCase().includes("loyaltymilestoneevent")
    );

    // Print result clearly
    if (!hasEventLog) {
      throw new Error("❌ LoyaltyMilestoneEvent was NOT found in logs.");
    }

    // Check for specific tier
    const hasNoviceTier = logs.some((log) => log.includes("Novice"));

    if (!hasNoviceTier) {
      throw new Error("❌ 'Novice' tier not found in logs. Logs may contain event, but incorrect tier.");
    }

    console.log("✅ LoyaltyMilestoneEvent with 'Novice' tier was emitted.");

  });

  it("Successfully claims SOL remittance", async () => {
    // Use the original sender (from the first test) instead of creating a new one
    // since remittancePda was created with the original sender
    const refSeed = 42;

    // Pre-claim balance of receiver
    const preBalance = await connection.getBalance(receiver.publicKey);

    // Claim the remittance using the ORIGINAL sender (not a fresh one)
    await program.methods
      .claim(refSeed, false, amount, 0)
      .accountsStrict({
        sender: sender.publicKey, // Use original sender, not fresh keypair
        receiver: receiver.publicKey,
        remittance: remittancePda,
        systemProgram: SystemProgram.programId,
        senderToken: null,
        receiverToken: null,
        tokenMint: null,
        tokenProgram: null,
      })
      .rpc(); // Original sender is already the signer in provider

    // Post-claim balance check
    const postBalance = await connection.getBalance(receiver.publicKey);
    const delta = postBalance - preBalance;

    assert.isAtLeast(delta, amount.toNumber(), "Receiver should receive SOL");

    // Ensure remittance PDA is closed
    const remittanceInfo = await connection.getAccountInfo(remittancePda);
    assert.isNull(remittanceInfo, "Remittance account should be closed");
  });

  it("Fails if receiver tries to claim instead of sender", async () => {
    // Create a new remittance for this test since previous one was claimed
    const testRefSeed = 44;
    const testReceiver = Keypair.generate();

    // Derive PDA for this test
    const [testRemittancePda] = await PublicKey.findProgramAddress(
      [
        Buffer.from("remittance"),
        sender.publicKey.toBuffer(),
        testReceiver.publicKey.toBuffer(),
        Buffer.from([testRefSeed]),
      ],
      program.programId
    );

    // First create the remittance
    await program.methods
      .initialize(amount, testRefSeed)
      .accountsStrict({
        sender: sender.publicKey,
        receiver: testReceiver.publicKey,
        remittance: testRemittancePda,
        stats: statsPda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    try {
      // Try to have receiver claim (wrong person claiming)
      await program.methods
        .claim(testRefSeed, false, amount, 0)
        .accountsStrict({
          sender: testReceiver.publicKey, // ❌ Wrong person as sender
          receiver: testReceiver.publicKey,
          remittance: testRemittancePda,
          systemProgram: SystemProgram.programId,
          senderToken: null,
          receiverToken: null,
          tokenMint: null,
          tokenProgram: null,
        })
        .signers([testReceiver]) // receiver trying to claim
        .rpc();

      throw new Error("Test should have failed but didn't");
    } catch (err) {
      // Should fail due to constraint violation (has_one = sender)
      assert.match(err.message, /constraint|has_one/i);
    }
  });

  it("Fails if remittance already claimed", async () => {
    // Create a fresh remittance and claim it, then try to claim again
    const testRefSeed = 45;
    const testReceiver = Keypair.generate();

    const [testRemittancePda] = await PublicKey.findProgramAddress(
      [
        Buffer.from("remittance"),
        sender.publicKey.toBuffer(),
        testReceiver.publicKey.toBuffer(),
        Buffer.from([testRefSeed]),
      ],
      program.programId
    );

    // Create remittance
    await program.methods
      .initialize(amount, testRefSeed)
      .accountsStrict({
        sender: sender.publicKey,
        receiver: testReceiver.publicKey,
        remittance: testRemittancePda,
        stats: statsPda,
        systemProgram: SystemProgram.programId,
      })
      .rpc();

    // First claim (should succeed)
    await program.methods
      .claim(testRefSeed, false, amount, 0)
      .accountsStrict({
        sender: sender.publicKey,
        receiver: testReceiver.publicKey,
        remittance: testRemittancePda,
        systemProgram: SystemProgram.programId,
        senderToken: null,
        receiverToken: null,
        tokenMint: null,
        tokenProgram: null,
      })
      .rpc();

    try {
      // Try to claim again (should fail - account closed)
      await program.methods
        .claim(testRefSeed, false, amount, 0)
        .accountsStrict({
          sender: sender.publicKey,
          receiver: testReceiver.publicKey,
          remittance: testRemittancePda,
          systemProgram: SystemProgram.programId,
          senderToken: null,
          receiverToken: null,
          tokenMint: null,
          tokenProgram: null,
        })
        .rpc();

      throw new Error("Test should have failed but didn't");
    } catch (err) {
      // Anchor returns specific error when account is closed/doesn't exist
      assert.match(err.message, /AnchorError caused by account.*remittance|Account does not exist|AccountNotFound/i);
    }
  });

  it("Successfully claims SPL token remittance", async () => {
    // Create a keypair for SPL operations (SPL functions need Keypair, not Wallet)
    const tokenSender = Keypair.generate();
    await connection.requestAirdrop(tokenSender.publicKey, 2_000_000_000);
    await new Promise(r => setTimeout(r, 3000));

    const tokenAmount = new anchor.BN(1_000_000); // 1 token (6 decimals)
    const tokenDecimals = 6;
    const refSeed = 77;

    // 1️⃣ Create SPL token mint
    const tokenMint = await createMint(
      connection,
      tokenSender, // Use keypair instead of wallet
      tokenSender.publicKey, // mint authority
      null, // freeze authority
      tokenDecimals
    );

    // 2️⃣ Create sender and receiver ATAs
    const senderTokenAta = await createAssociatedTokenAccount(
      connection,
      tokenSender, // payer
      tokenMint,
      tokenSender.publicKey // owner
    );

    const receiverTokenAta = await createAssociatedTokenAccount(
      connection,
      tokenSender, // payer
      tokenMint,
      receiver.publicKey // owner
    );

    // 3️⃣ Mint tokens to sender
    await mintTo(
      connection,
      tokenSender, // payer
      tokenMint,
      senderTokenAta,
      tokenSender, // mint authority
      tokenAmount.toNumber()
    );

    // 4️⃣ Derive fresh stats PDA for token sender
    const [tokenStatsPda] = await PublicKey.findProgramAddress(
      [
        Buffer.from("remit_stats"),
        tokenSender.publicKey.toBuffer(),
      ],
      program.programId
    );

    // 5️⃣ Derive remittance PDA
    const [remittancePda] = await PublicKey.findProgramAddress(
      [
        Buffer.from("remittance"),
        tokenSender.publicKey.toBuffer(),
        receiver.publicKey.toBuffer(),
        Buffer.from([refSeed]),
      ],
      program.programId
    );

    // 6️⃣ Initialize remittance
    await program.methods
      .initialize(tokenAmount, refSeed)
      .accountsStrict({
        sender: tokenSender.publicKey,
        receiver: receiver.publicKey,
        remittance: remittancePda,
        stats: tokenStatsPda,
        systemProgram: SystemProgram.programId,
      })
      .signers([tokenSender]) // Use keypair
      .rpc();

    // 7️⃣ Execute token claim (is_token_transfer = true)
    await program.methods
      .claim(refSeed, true, tokenAmount, tokenDecimals)
      .accountsStrict({
        sender: tokenSender.publicKey,
        receiver: receiver.publicKey,
        remittance: remittancePda,
        systemProgram: SystemProgram.programId,
        senderToken: senderTokenAta,
        receiverToken: receiverTokenAta,
        tokenMint,
        tokenProgram: TOKEN_PROGRAM_ID,
      })
      .signers([tokenSender]) // Use keypair
      .rpc();

    // ✅ 8️⃣ Validate token transfer
    const receiverTokenAccount = await getAccount(connection, receiverTokenAta);
    assert.strictEqual(
      Number(receiverTokenAccount.amount),
      tokenAmount.toNumber(),
      "Receiver should receive SPL tokens"
    );

    // Verify remittance PDA is closed
    const remittanceInfo = await connection.getAccountInfo(remittancePda);
    assert.isNull(remittanceInfo, "Remittance account should be closed");
  });

  it("Fails if sender has insufficient SPL token balance", async () => {
    const refSeed = 88;
    const lowSender = Keypair.generate();

    const [remitPda] = await PublicKey.findProgramAddress(
      [
        Buffer.from("remittance"),
        lowSender.publicKey.toBuffer(),
        receiver.publicKey.toBuffer(),
        Buffer.from([refSeed]),
      ],
      program.programId
    );

    const [statsPda] = await PublicKey.findProgramAddress(
      [Buffer.from("remit_stats"), lowSender.publicKey.toBuffer()],
      program.programId
    );

    // Airdrop SOL for fees
    await connection.requestAirdrop(lowSender.publicKey, 1_000_000_000);
    await new Promise(res => setTimeout(res, 3000));

    // Create token mint and ATAs
    const mint = await createMint(connection, lowSender, lowSender.publicKey, null, 6);

    // Create ATAs (but don't mint any tokens to sender)
    const lowSenderToken = await createAssociatedTokenAccount(
      connection,
      lowSender,
      mint,
      lowSender.publicKey
    );
    const recvToken = await createAssociatedTokenAccount(
      connection,
      lowSender, // payer
      mint,
      receiver.publicKey // owner
    );

    // Initialize remittance
    await program.methods
      .initialize(amount, refSeed)
      .accountsStrict({
        sender: lowSender.publicKey,
        receiver: receiver.publicKey,
        remittance: remitPda,
        stats: statsPda,
        systemProgram: SystemProgram.programId,
      })
      .signers([lowSender])
      .rpc();

    // Attempt claim (should fail - sender has 0 tokens)
    try {
      await program.methods
        .claim(refSeed, true, amount, 6)
        .accountsStrict({
          sender: lowSender.publicKey,
          receiver: receiver.publicKey,
          remittance: remitPda,
          systemProgram: SystemProgram.programId,
          senderToken: lowSenderToken,
          receiverToken: recvToken,
          tokenMint: mint,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([lowSender])
        .rpc();
      throw new Error("Should have failed due to insufficient tokens");
    } catch (err) {
      assert.match(err.message, /insufficient funds|Program failed to complete/i);
    }
  });

  it("Fails if receiver token account is incorrect", async () => {
    const refSeed = 89;
    const testSender = Keypair.generate();

    // Airdrop for fees  
    await connection.requestAirdrop(testSender.publicKey, 1_000_000_000);
    await new Promise(res => setTimeout(res, 3000));

    // Create fresh token mint for this test
    const testMint = await createMint(connection, testSender, testSender.publicKey, null, 6);

    // Create sender's token account with tokens
    const senderTokenAta = await createAssociatedTokenAccount(
      connection,
      testSender,
      testMint,
      testSender.publicKey
    );

    // Mint tokens to sender
    await mintTo(
      connection,
      testSender,
      testMint,
      senderTokenAta,
      testSender,
      amount.toNumber()
    );

    // Create a DIFFERENT mint and receiver ATA (wrong mint for receiver)
    const wrongMint = await createMint(connection, testSender, testSender.publicKey, null, 6);
    const wrongReceiverToken = await createAssociatedTokenAccount(
      connection,
      testSender,
      wrongMint,        // ❌ different mint (not testMint)
      receiver.publicKey  // ✅ correct owner, but wrong mint
    );

    // Derive PDAs
    const [wrongRemitPda] = await PublicKey.findProgramAddress(
      [
        Buffer.from("remittance"),
        testSender.publicKey.toBuffer(),
        receiver.publicKey.toBuffer(),
        Buffer.from([refSeed]),
      ],
      program.programId
    );

    const [testStatsPda] = await PublicKey.findProgramAddress(
      [Buffer.from("remit_stats"), testSender.publicKey.toBuffer()],
      program.programId
    );

    // Initialize remittance
    await program.methods
      .initialize(amount, refSeed)
      .accountsStrict({
        sender: testSender.publicKey,
        receiver: receiver.publicKey,
        remittance: wrongRemitPda,
        stats: testStatsPda,
        systemProgram: SystemProgram.programId,
      })
      .signers([testSender])
      .rpc();

    // Attempt to claim using wrong receiver token account
    try {
      await program.methods
        .claim(refSeed, true, amount, 6)
        .accountsStrict({
          sender: testSender.publicKey,
          receiver: receiver.publicKey,
          remittance: wrongRemitPda,
          systemProgram: SystemProgram.programId,
          senderToken: senderTokenAta,
          receiverToken: wrongReceiverToken, // ❌ wrong ATA (owned by sender, not receiver)
          tokenMint: testMint,
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([testSender])
        .rpc();
      throw new Error("Should have failed due to invalid receiver ATA");
    } catch (err) {
      assert.match(err.message, /failed to transfer|Invalid account|constraint|token account|Simulation failed/i);
    }
  });

  it("Fails if wrong token mint is passed", async () => {
    const refSeed = 90;
    const testSender = Keypair.generate();

    // Airdrop for fees
    await connection.requestAirdrop(testSender.publicKey, 1_000_000_000);
    await new Promise(res => setTimeout(res, 3000));

    // Create TWO different mints
    const correctMint = await createMint(connection, testSender, testSender.publicKey, null, 6);
    const wrongMint = await createMint(connection, testSender, testSender.publicKey, null, 6);

    // Create token accounts for CORRECT mint
    const senderCorrectAta = await createAssociatedTokenAccount(
      connection,
      testSender,
      correctMint,
      testSender.publicKey
    );

    const receiverCorrectAta = await createAssociatedTokenAccount(
      connection,
      testSender,
      correctMint,
      receiver.publicKey
    );

    // Mint tokens to sender's CORRECT account
    await mintTo(
      connection,
      testSender,
      correctMint,
      senderCorrectAta,
      testSender,
      amount.toNumber()
    );

    // Derive PDAs
    const [badRemitPda] = await PublicKey.findProgramAddress(
      [
        Buffer.from("remittance"),
        testSender.publicKey.toBuffer(),
        receiver.publicKey.toBuffer(),
        Buffer.from([refSeed]),
      ],
      program.programId
    );

    const [testStatsPda] = await PublicKey.findProgramAddress(
      [Buffer.from("remit_stats"), testSender.publicKey.toBuffer()],
      program.programId
    );

    // Initialize remittance
    await program.methods
      .initialize(amount, refSeed)
      .accountsStrict({
        sender: testSender.publicKey,
        receiver: receiver.publicKey,
        remittance: badRemitPda,
        stats: testStatsPda,
        systemProgram: SystemProgram.programId,
      })
      .signers([testSender])
      .rpc();

    try {
      // Use correct token accounts but WRONG mint
      await program.methods
        .claim(refSeed, true, amount, 6)
        .accountsStrict({
          sender: testSender.publicKey,
          receiver: receiver.publicKey,
          remittance: badRemitPda,
          systemProgram: SystemProgram.programId,
          senderToken: senderCorrectAta,    // ✅ correct ATA
          receiverToken: receiverCorrectAta, // ✅ correct ATA  
          tokenMint: wrongMint,              // ❌ wrong mint!
          tokenProgram: TOKEN_PROGRAM_ID,
        })
        .signers([testSender])
        .rpc();
      throw new Error("Should have failed due to wrong token mint");
    } catch (err) {
      assert.match(err.message, /failed to transfer|Invalid account|Simulation failed|constraint/i);
    }
  });

});
