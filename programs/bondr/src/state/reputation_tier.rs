use anchor_lang::prelude::*;

//can't use InitSpace here as it is not an struct and also Initspace is mostly used with #[account]
#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq, PartialOrd, Ord, Debug)]
pub enum ReputationTier {
    Unranked = 0,     // default before any NFT is minted
    Verified = 1,     // 3-9 escrows completed (requires first NFT)
    Professional = 2, // 10-24 escrows completed
    Elite = 3,        // 25+ escrows completed
}

impl Space for ReputationTier {
    const INIT_SPACE: usize = 1;
}
