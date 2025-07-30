use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct MintReputationNFT<'info> {
    #[account(mut)]
    pub freelancer: Signer<'info>,
}

impl<'info> MintReputationNFT<'info> {
    pub fn mint_nft(&mut self) -> Result<()> {
        Ok(())
    }
}
