use anchor_lang::prelude::*;

//can't use InitSpace here as it is not an struct and also Initspace is mostly used with #[account]
#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq, Eq)]
pub enum ReputationTier {
    Verified,     //3-9 escrows completed
    Professional, //10-24 escrows completed
    Elite,        //25+ escrows completed
}

impl Space for ReputationTier {
    const INIT_SPACE: usize = 1;
}
