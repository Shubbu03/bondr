use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct UserStats {
    pub user: Pubkey,
    pub completed_escrows: u32,
    pub bump: u8,
}
