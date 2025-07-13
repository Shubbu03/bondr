use anchor_lang::prelude::*;

#[event]
pub struct RemittanceEvent {
    pub sender: Pubkey,
    pub receiver: Pubkey,
    pub amount: u64,
    pub reference_seed: u8,
}

#[event]
pub struct LoyaltyMilestoneEvent {
    pub user: Pubkey,
    pub tier: String,
}
