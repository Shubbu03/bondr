### Bondr — Escrow + Reputation NFTs on Solana (Anchor)

Bondr is an Anchor program that implements:

- Escrow of SOL or SPL tokens between a client (sender) and a freelancer (receiver)
- Optional client-side multisig approvals before release
- Post-completion badge tracking for freelancers
- Reputation NFT minting via Metaplex Core after milestone completions

Program ID: `CFXd43mg9TDN5cSHgaUm5ahPSTvLTb9hw3XuASCVL4wh`


## Features

- Escrow funding in SOL or SPL tokens
- Two-step payout: client releases → freelancer claims
- Optional client multisig approvals (N-of-M) before release/claim
- On-chain freelancer badge: completed escrows + total value
- Reputation NFTs at completion milestones (Verified, Professional, Elite)
- Strong validation and clear error codes


## High-level Flow

- initialize_escrow(sender, receiver, amount, is_token_transfer, is_multisig)
  - Creates `Escrow` PDA and funds a `vault` PDA (SOL) or an escrow-owned ATA (SPL)
  - Initializes sender `UserStats` if needed (counter remains 0 at this stage)
  - If multisig, links `ClientMultisig.pending_escrow = escrow`
- release_payment(reference_seed)
  - Client marks the escrow released; in multisig mode this flips when threshold approvals are met
- approve_multisig_release(reference_seed)
  - Each member approves; when threshold met, `escrow.is_released = true`
- claim_payment(reference_seed, is_token_transfer)
  - Freelancer claims the funds from `vault` (SOL) or escrow ATA (SPL)
  - Increments freelancer `UserStats.completed_escrows`
  - Resets multisig state and closes escrow (rent returned to client)
- update_freelancer_badge(amount)
  - Increments `FreelancerBadge.completed_escrows` and `total_value_completed`
- mint_reputation_nft()
  - Mints NFT at milestones based on badge completed escrows


## Accounts & PDAs

- Escrow (PDA)
  - Seeds: ["escrow", sender, receiver, reference_seed]
  - Fields: sender, receiver, amount, is_released, bump, vault_bump, client_multisig?
- Vault (PDA, SystemAccount)
  - Seeds: ["vault", sender, receiver, reference_seed]
  - Holds SOL for the escrow path
- UserStats (PDA)
  - Seeds: ["user_stats", user]
  - Tracks completed escrows per user
- FreelancerBadge (PDA)
  - Seeds: ["badge", freelancer]
  - Tracks tier, completed_escrows, total_value_completed
- ClientMultisig (PDA)
  - Seeds: ["client_multisig", client]
  - members[5], member_count, threshold, approvals[5], pending_escrow, bump


## Instructions (Quick Reference)

- initialize_escrow(amount, refSeed, isToken, isMultisig): create escrow, fund vault/ATA, optionally link multisig. See tests in `tests/instructions/initialize-escrow.test.ts` and `tests/integration/*`.
- release_payment(refSeed): sender marks escrow as released; in multisig flows the release flips when threshold approvals are met. See `tests/instructions/release-payment.test.ts`.
- approve_multisig_release(refSeed): a multisig member approves; threshold met → escrow marked released. See `tests/instructions/approve_multisig_release.test.ts`.
- claim_payment(refSeed, isToken): freelancer pulls funds, updates stats, closes escrow, resets multisig. See `tests/instructions/claim-payment.test.ts` and integration suites.
- initialize_freelancer_badge(): create badge (unranked, zeroed counters). See `tests/instructions/initialize-freelancer-badge.test.ts`.
- update_freelancer_badge(amount): increment badge counters post-completion. See `tests/instructions/update-freelancer-badge.test.ts`.
- mint_reputation_nft(): mint tiered NFT based on badge milestones (Verified, Professional, Elite). See `tests/instructions/mint-reputation-nft.test.ts`.


## Events

- EscrowCreateEvent { sender, receiver, amount, reference_seed, is_token_transfer }
- ClientMultisigCreated { client, multisig, member_count, threshold }
- MultisigApprovalAdded { multisig, member, escrow }
- ReputationMilestoneEvent { user, tier } (reserved for potential future use)


## Errors

- InvalidAmount, InvalidAmountZero, SelfTransfer, InvalidReferenceSeed, AmountTooLarge, InsufficientBalance
- MissingTokenAccounts, MissingTokenProgram
- UnauthorizedSender, AlreadyReleased, NotReleased
- InsufficientEscrows, NFTAlreadyMinted, InvalidMplKey
- InvalidMultisigConfig, DuplicateMember, MultisigBusy, NotMultisigMember, AlreadyApproved, MultisigPendingEscrowMismatch, MultisigThresholdNotMet


## PDAs and Seeds (client-side reference)

```ts
// Escrow
findProgramAddress([
  Buffer.from("escrow"), sender.toBuffer(), receiver.toBuffer(), Buffer.from([refSeed])
])

// Vault (SOL path)
findProgramAddress([
  Buffer.from("vault"), sender.toBuffer(), receiver.toBuffer(), Buffer.from([refSeed])
])

// User stats
findProgramAddress([Buffer.from("user_stats"), user.toBuffer()])

// Freelancer badge
findProgramAddress([Buffer.from("badge"), freelancer.toBuffer()])

// Client multisig
findProgramAddress([Buffer.from("client_multisig"), client.toBuffer()])
```


## SOL vs SPL Transfers

- SOL path:
  - initialize_escrow: transfer from sender → vault (SystemProgram::transfer)
  - claim_payment: transfer from vault → receiver_sol with vault PDA signer seeds
- SPL path:
  - initialize_escrow: transfer_checked from sender_token_account → escrow_token_account (ATA owned by escrow PDA)
  - claim_payment: transfer_checked from escrow_token_account → receiver_token_account with escrow PDA signer seeds


## Multisig Details

- Initialize multisig with up to 5 members
- `member_count` defines how many entries in `members` are active
- `threshold` must be 1..member_count
- Client must be included among active members
- Only one pending escrow per multisig; attempting to link a second before completion errors with MultisigBusy


## Local Development

Prereqs (install manually):
- Solana CLI (v1.18+)
- Anchor CLI (matching `@coral-xyz/anchor` ^0.31.x)
- Node 18+ / npm or Yarn
- Rust toolchain

Install JS deps:
```bash
yarn install
```

Build program:
```bash
anchor build
```

Run tests:
```bash
anchor test
```

Notes:
- `Anchor.toml` sets provider cluster to `localnet` for dev, and configures a devnet validator for tests that need to clone external programs. Adjust if needed.
- Tests use `ts-mocha` with a large timeout; they request airdrops for keypairs.


## Using From a Client (Anchor TS)

```ts
await program.methods
  .initializeEscrow(new BN(5_000_000), 67, false, false)
  .accountsPartial({
    sender, receiver, escrow, vault, senderStats,
    clientMultisig: null,
    systemProgram: SystemProgram.programId,
    tokenProgram: null,
    senderTokenAccount: null,
    escrowTokenAccount: null,
    tokenMint: null,
    associatedTokenProgram: null,
  })
  .signers([senderKeypair])
  .rpc();
```


## Design Choices & Gotchas

- Two-step payout: prevents accidental payout; release intent is explicit and auditable
- Stats increment on claim only: escrow creation does not imply completion
- Badge vs Stats: `UserStats` track global completions for a user; `FreelancerBadge` is an opt-in on-chain profile with counters used for NFT milestones
- NFT mint gating: NFT can only be minted once per tier progression; prevents duplicates
- Multisig reuse: contract resets `pending_escrow` and approvals after claim; ensures sequential processing
- Reference seed: unique per escrow between a sender–receiver pair; using the same seed collides (account already in use)
- Amount cap: 1,000 SOL (in lamports) safeguard
- Token transfers: all SPL movements use `transfer_checked` with mint decimals


## Required Packages (manual install)

- Runtime/dev:
  - `@coral-xyz/anchor@^0.31.1`
  - `@metaplex-foundation/mpl-core@^1.6.0`
  - `@metaplex-foundation/umi@^1.2.0`
  - `@solana/spl-token@^0.4.13`
- Dev/test:
  - `typescript@^5.7.3`
  - `ts-mocha@^10.0.0`
  - `mocha@^9.0.3`
  - `chai@^4.3.4`
  - `@types/*` for mocha/chai/bn.js
  - `prettier@^2.6.2`


## Directory Layout

- `programs/bondr/src/` — Anchor program
  - `instructions/` — all instruction handlers
  - `state/` — on-chain account types and enums
  - `utils/` — SOL/SPL transfer helpers
  - `event.rs`, `error.rs`, `constants.rs`
- `tests/` — mocha + Anchor TS tests (unit + integration)
- `migrations/` — Anchor deploy script placeholder


## Security Considerations

- Escrow funds leave program only to the declared receiver and only after explicit release + claim
- Multisig prevents unilateral release in team contexts
- SPL token paths validate program and accounts before transfers
- Program is not audited; use at your own risk

## Contributing

- Open an issue describing the change and rationale
- Fork → branch → edits with tests → PR
- Coding standards:
  - Rust: clear naming, early returns, explicit errors, avoid unsafe casts
  - TS: prefer explicit types in public APIs, keep tests deterministic and isolated
  - No drive-by reformatting; keep diffs minimal and focused
- Run `yarn lint` and `anchor test` locally before opening a PR
- For new instructions, include:
  - Unit tests under `tests/instructions/`
  - If applicable, an integration test covering end-to-end flow
  - README updates for any new accounts or flows

