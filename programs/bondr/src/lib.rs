#![allow(unexpected_cfgs)]

pub mod error;
pub mod event;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;

pub use event::*;
use instructions::*;
pub use state::*;

declare_id!("6UxuwCfAsMhLMozd3cYr4vvZVQHS1eKiw8JtoBXLxLWp");

#[program]
pub mod bondr {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>, amount: u64, reference_seed: u8) -> Result<()> {
        let stats_bump = ctx.bumps.stats;
        ctx.accounts
            .init_remittance(amount, reference_seed, ctx.bumps.remittance, stats_bump)?;
        Ok(())
    }
}
