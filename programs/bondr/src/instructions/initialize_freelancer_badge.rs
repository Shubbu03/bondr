use anchor_lang::prelude::*;

use crate::{FreelancerBadge, ReputationTier};

#[derive(Accounts)]
pub struct InitializeFreelancerBadge<'info> {
    #[account(mut)]
    pub freelancer: Signer<'info>,

    #[account(
        init,
        payer = freelancer,
        space = 8 + FreelancerBadge::INIT_SPACE,
        seeds = [b"badge", freelancer.key().as_ref()],
        bump
    )]
    pub badge: Account<'info, FreelancerBadge>,

    pub system_program: Program<'info, System>,
}

impl<'info> InitializeFreelancerBadge<'info> {
    pub fn initialize_freelancer_badge(&mut self, bump: u8) -> Result<()> {
        self.badge.set_inner(FreelancerBadge {
            tier: ReputationTier::Verified,
            completed_escrows: 0,
            total_value_completed: 0,
            freelancer: self.freelancer.key(),
            bump,
        });
        
        Ok(())
    }
}
