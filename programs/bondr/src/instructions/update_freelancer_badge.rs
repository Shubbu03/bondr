use anchor_lang::prelude::*;

use crate::{error::BondrError, FreelancerBadge};

#[derive(Accounts)]
pub struct UpdateFreelancerBadge<'info> {
    #[account(mut)]
    pub freelancer: Signer<'info>,

    #[account(
        mut,
        seeds = [b"badge", freelancer.key().as_ref()],
        bump = badge.bump,
    )]
    pub badge: Account<'info, FreelancerBadge>,
}

impl<'info> UpdateFreelancerBadge<'info> {
    pub fn update_badge(&mut self, value: u64) -> Result<()> {
        // 1. Constraint validation
        require_keys_eq!(self.freelancer.key(), self.badge.freelancer);
        require!(value > 0, BondrError::InvalidAmountZero);

        // 2. updating badge stats
        self.badge.completed_escrows += 1;
        self.badge.total_value_completed += value;

        Ok(())
    }
}
