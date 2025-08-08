use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct Escrow {
    pub sender: Pubkey,
    pub receiver: Pubkey,
    pub amount: u64,
    pub is_released: bool,
    pub bump: u8,
    pub vault_bump: u8,
    pub client_multisig: Option<Pubkey>, //optional field if multisig present
}
