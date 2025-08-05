use anchor_lang::prelude::*;

use crate::ReputationTier;

#[event]
pub struct EscrowCreateEvent {
    pub sender: Pubkey,
    pub receiver: Pubkey,
    pub amount: u64,
    pub reference_seed: u8,
    pub is_token_transfer: bool,
}

#[event]
pub struct ReputationMilestoneEvent {
    pub user: Pubkey,
    pub tier: ReputationTier,
}

#[event]
pub struct ClientMultisigCreated {
    pub client: Pubkey,
    pub multisig: Pubkey,
    pub member_count: u8,
    pub threshold: u8,
}
