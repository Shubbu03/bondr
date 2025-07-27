use anchor_lang::prelude::*;

use crate::{error::BondrError, Escrow};

#[derive(Accounts)]
pub struct ReleasePayment<'info> {
    #[account(mut)]
    pub client: Signer<'info>,

    #[account(
        mut,
        seeds = [b"escrow", escrow.sender.as_ref(), escrow.receiver.as_ref(), &[escrow.bump]],
        bump = escrow.bump,
    )]
    pub escrow: Account<'info, Escrow>,
}

impl<'info> ReleasePayment<'info> {
    pub fn release_payment(&mut self) -> Result<()> {
        require_keys_eq!(
            self.client.key(),
            self.escrow.sender,
            BondrError::UnauthorizedSender
        );
        // Check if already released
        require!(!self.escrow.is_released, BondrError::AlreadyReleased);

        // Update state
        self.escrow.is_released = true;

        msg!("Payment released by client: {}", self.client.key());

        Ok(())
    }
}
