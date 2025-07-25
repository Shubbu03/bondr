use anchor_lang::prelude::*;

use crate::ReputationTier;


#[account]
#[derive(InitSpace)]
pub struct FreelancerBadge{
	pub tier: ReputationTier,
	pub completed_escrow: u64,
	pub total_value_completed: u64,
	pub freelancer: Pubkey,
	pub bump: u8
}
