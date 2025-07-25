use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct UserStats {
    pub user: Pubkey,
    pub completed_escrow: u64,
    pub bump: u8,
}
