use anchor_lang::error_code;

#[error_code]
pub enum BondrError {
    #[msg("Invalid Amount")]
    InvalidAmount,
    #[msg("Amount can't be 0")]
    InvalidAmountZero,
    #[msg("Can't send money to self")]
    SelfTransfer,
    #[msg("Invalid reference seed")]
    InvalidReferenceSeed,
    #[msg("Amount exceeds maximum limit")]
    AmountTooLarge,
    #[msg("Insufficient balance")]
    InsufficientBalance,
    #[msg("Missing token accounts")]
    MissingTokenAccounts,
    #[msg("Missing token program")]
    MissingTokenProgram,
    #[msg("Unauthorised sender")]
    UnauthorizedSender,
    #[msg("Payment already released")]
    AlreadyReleased,
    #[msg("Payment not released yet")]
    NotReleased,
}
