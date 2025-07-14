use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum LoyaltyTier {
    Novice,
    Expert,
    Elite,
}
