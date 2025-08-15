#![allow(unexpected_cfgs, deprecated)]

pub mod constants;
pub mod error;
pub mod event;
pub mod instructions;
pub mod state;
pub mod utils;

use anchor_lang::prelude::*;

pub use constants::*;
pub use event::*;
use instructions::*;
pub use state::*;

declare_id!("CFXd43mg9TDN5cSHgaUm5ahPSTvLTb9hw3XuASCVL4wh");

// devent explorer link -> https://explorer.solana.com/address/CFXd43mg9TDN5cSHgaUm5ahPSTvLTb9hw3XuASCVL4wh?cluster=devnet

#[program]
pub mod bondr {
    use super::*;

    pub fn initialize_escrow(
        ctx: Context<InitializeEscrow>,
        amount: u64,
        reference_seed: u8,
        is_token_transfer: bool,
        is_multisig: bool,
    ) -> Result<()> {
        ctx.accounts.init_escrow(
            amount,
            reference_seed,
            is_token_transfer,
            is_multisig,
            ctx.bumps.escrow,
            ctx.bumps.vault,
            ctx.bumps.sender_stats,
        )
    }

    pub fn release_payment(ctx: Context<ReleasePayment>, reference_seed: u8) -> Result<()> {
        ctx.accounts.release_payment(reference_seed)
    }

    pub fn claim_payment(
        ctx: Context<ClaimPayment>,
        reference_seed: u8,
        is_token_transfer: bool,
    ) -> Result<()> {
        ctx.accounts
            .claim_payment(reference_seed, is_token_transfer, ctx.bumps.receiver_stats)
    }

    pub fn initialize_freelancer_badge(ctx: Context<InitializeFreelancerBadge>) -> Result<()> {
        ctx.accounts.initialize_freelancer_badge(ctx.bumps.badge)
    }

    pub fn update_freelancer_badge(ctx: Context<UpdateFreelancerBadge>, amount: u64) -> Result<()> {
        ctx.accounts.update_badge(amount)
    }

    pub fn mint_reputation_nft(ctx: Context<MintReputationNFT>) -> Result<()> {
        ctx.accounts.mint_nft()
    }

    pub fn initialize_multisig_client(
        ctx: Context<InitializeMultisigClient>,
        members: [Pubkey; MAX_MULTISIG_MEMBERS],
        member_count: u8,
        threshold: u8,
    ) -> Result<()> {
        ctx.accounts
            .init_multisig_client(members, member_count, threshold, ctx.bumps.multisig)
    }

    pub fn approve_multisig_release(
        ctx: Context<ApproveMultisigRelease>,
        _reference_seed: u8,
    ) -> Result<()> {
        ctx.accounts.approve_multisig()
    }
}
