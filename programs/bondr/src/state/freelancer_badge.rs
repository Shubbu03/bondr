use anchor_lang::prelude::*;

use crate::ReputationTier;

#[account]
#[derive(InitSpace)]
pub struct FreelancerBadge{
	pub tier: ReputationTier, //enum - Verified -> Professional -> Elite
	pub completed_escrows: u32,
	pub total_value_completed: u64,
	pub freelancer: Pubkey,
	pub bump: u8
}
