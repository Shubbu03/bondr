#![allow(unexpected_cfgs, deprecated)]

pub mod error;
pub mod event;
pub mod instructions;
pub mod state;
pub mod utils;

use anchor_lang::prelude::*;

pub use event::*;
use instructions::*;
pub use state::*;

declare_id!("CFXd43mg9TDN5cSHgaUm5ahPSTvLTb9hw3XuASCVL4wh");

#[program]
pub mod bondr {
    use super::*;

    pub fn initialize_escrow(
        ctx: Context<InitializeEscrow>,
        amount: u64,
        reference_seed: u8,
        is_token_transfer: bool,
    ) -> Result<()> {
        ctx.accounts.init_escrow(
            amount,
            reference_seed,
            is_token_transfer,
            ctx.bumps.escrow,
            ctx.bumps.sender_stats,
        )
    }

    pub fn release_payment(ctx: Context<ReleasePayment>) -> Result<()> {
        ctx.accounts.release_payment()
    }

    pub fn claim_payment(
        ctx: Context<ClaimPayment>,
        is_token_transfer: bool,
        amount: u64,
        decimals: u8,
        reference_seed: u8,
    ) -> Result<()> {
        ctx.accounts
            .claim_payment(is_token_transfer, amount, decimals, reference_seed)
    }
}
