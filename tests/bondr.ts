import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Bondr } from "../target/types/bondr";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { assert } from "chai";
import { describe, it } from "mocha";

//common variables 
anchor.setProvider(anchor.AnchorProvider.local());
const provider = anchor.getProvider();
const connection = provider.connection;
const program = anchor.workspace.Bondr as Program<Bondr>;

const sleep = (ms: number) => new Promise((res) => setTimeout(res, ms)); //simple utility func

describe("bondr - initialize_escrow()", () => {
  const amount = new anchor.BN(1_000_000); // 0.001 SOL
  const refSeed = 42;

  let sender: Keypair;
  let receiver: Keypair;
  let escrowPda: PublicKey;
  let escrowBump: number;
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

    // 3. Derive PDA to be used
    [escrowPda, escrowBump] = await PublicKey.findProgramAddress(
      [
        Buffer.from("escrow"),
        sender.publicKey.toBuffer(),
        receiver.publicKey.toBuffer(),
        Buffer.from([refSeed]),
      ],
      program.programId
    );

    [statsPda, statsBump] = await PublicKey.findProgramAddress(
      [
        Buffer.from("user_stats"),
        sender.publicKey.toBuffer(),
      ],
      program.programId
    );
  });

  it("Initializes an escrow & sender stats correctly", async () => {
    //testing sol transfer first
    await program.methods
      .initializeEscrow(amount, refSeed, false)
      .accountsStrict({
        sender: sender.publicKey,
        receiver: receiver.publicKey,
        escrow: escrowPda,
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
    const escrowAccount = await program.account.escrow.fetch(
      escrowPda
    );
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
    const [wrongEscrowPda] = await PublicKey.findProgramAddress(
      [
        Buffer.from("escrow"),
        sender.publicKey.toBuffer(),
        receiver.publicKey.toBuffer(),
        Buffer.from([43]),
      ],
      program.programId
    );

    try {
      await program.methods
        .initializeEscrow(zeroAmount, 43, false)
        .accountsStrict({
          sender: sender.publicKey,
          receiver: receiver.publicKey,
          escrow: wrongEscrowPda,
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
    const [selfPda] = await PublicKey.findProgramAddress(
      [
        Buffer.from("escrow"),
        sender.publicKey.toBuffer(),
        sender.publicKey.toBuffer(), // same as sender
        Buffer.from([selfSeed]),
      ],
      program.programId,
    );

    try {
      await program.methods
        .initializeEscrow(amount, selfSeed, false)
        .accountsStrict({
          sender: sender.publicKey,
          receiver: sender.publicKey, // same sender
          escrow: selfPda,
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
        .accountsStrict({
          sender: sender.publicKey,
          receiver: receiver.publicKey,
          escrow: escrowPda, // previously initialised in happy-path test
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

describe("bondr - release_payment()", () => {
  let client: Keypair;
  let freelancer: Keypair;
  let escrowPda: PublicKey;
  let escrowBump: number;

  const refSeed = 55;
  const amount = new anchor.BN(2_000_000);

  before(async () => {
    // 1. generate keypairs & fund them
    client = Keypair.generate();
    freelancer = Keypair.generate();

    await Promise.all([
      connection.requestAirdrop(client.publicKey, 2_000_000_000),
      connection.requestAirdrop(freelancer.publicKey, 1_000_000_000),
    ]);
    await sleep(3_000);

    // 2. derive pda
    [escrowPda, escrowBump] = await PublicKey.findProgramAddress(
      [
        Buffer.from("escrow"),
        client.publicKey.toBuffer(),
        freelancer.publicKey.toBuffer(),
        Buffer.from([refSeed]),
      ],
      program.programId
    );

    const [statsPda] = await PublicKey.findProgramAddress(
      [Buffer.from("user_stats"), client.publicKey.toBuffer()],
      program.programId,
    );

    // 3. bootstrap escrow
    await program.methods
      .initializeEscrow(amount, refSeed, false)
      .accountsStrict({
        sender: client.publicKey,
        receiver: freelancer.publicKey,
        escrow: escrowPda,
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
          client: freelancer.publicKey, // NOT the sender
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

