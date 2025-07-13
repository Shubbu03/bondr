use anchor_lang::error_code;

#[error_code]
pub enum BondrError {
    #[msg("Invalid Amount")]
    InvalidAmount,
    #[msg("Amount can't be 0")]
    InvalidAmountZero,
}
