#![allow(unexpected_cfgs)]

pub mod error;
pub mod event;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;

pub use event::*;
use instructions::*;
pub use state::*;

declare_id!("CFXd43mg9TDN5cSHgaUm5ahPSTvLTb9hw3XuASCVL4wh");

#[program]
pub mod bondr {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>, amount: u64, reference_seed: u8) -> Result<()> {
        let stats_bump = ctx.bumps.stats;
        ctx.accounts
            .init_escrow(amount, reference_seed, ctx.bumps.remittance, stats_bump)
    }

    pub fn claim(
        ctx: Context<Claim>,
        reference_seed: u8,
        is_token_transfer: bool,
        amount: u64,
        decimals: u8,
    ) -> Result<()> {
        ctx.accounts.claim(is_token_transfer, amount, decimals)
    }
}
