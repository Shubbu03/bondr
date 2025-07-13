use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct RemitStats {
    pub user: Pubkey,
    pub total_sent: u64,
    pub tx_count: u64,
    pub bump: u8,
}
