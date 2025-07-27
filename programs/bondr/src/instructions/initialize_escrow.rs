use crate::{
    error::BondrError,
    utils::{transfer_sol, transfer_spl_tokens, validate_token_accounts},
    Escrow, EscrowCreateEvent, UserStats,
};
use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{Mint, Token, TokenAccount},
};

#[derive(Accounts)]
#[instruction(amount:u64, reference_seed: u8)]
pub struct InitializeEscrow<'info> {
    // Sender (client) initiating the escrow
    #[account(mut)]
    pub sender: Signer<'info>,

    // Receiver's public key (not accessed as a program account)
    ///CHECK: Receiver's public key - validated in instruction logic
    pub receiver: AccountInfo<'info>,

    // PDA to store escrow metadata
    #[account(
        init,
        payer = sender,
        space = 8 + Escrow::INIT_SPACE,
        seeds = [b"escrow", sender.key().as_ref(), receiver.key().as_ref(), &[reference_seed]],
        bump,
    )]
    pub escrow: Account<'info, Escrow>,

    #[account(
        init_if_needed,
        payer = sender,
        space = 8 + UserStats::INIT_SPACE,
        seeds = [b"user_stats", sender.key().as_ref()],
        bump
    )]
    pub sender_stats: Account<'info, UserStats>,

    // For SOL transfers
    pub system_program: Program<'info, System>,

    // For SPL token transfers (optional)
    pub token_program: Option<Program<'info, Token>>,

    #[account(mut)]
    pub sender_token_account: Option<Account<'info, TokenAccount>>,

    #[account(
        init_if_needed,
        payer = sender,
        associated_token::mint = token_mint,
        associated_token::authority = escrow,
    )]
    pub escrow_token_account: Option<Account<'info, TokenAccount>>,

    pub token_mint: Option<Account<'info, Mint>>,
    pub associated_token_program: Option<Program<'info, AssociatedToken>>,
}

impl<'info> InitializeEscrow<'info> {
    pub fn init_escrow(
        &mut self,
        amount: u64,
        reference_seed: u8,
        is_token_transfer: bool,
        bump: u8,
        stats_bump: u8,
    ) -> Result<()> {
        // 1. Validate inputs
        require!(amount > 0, BondrError::InvalidAmountZero);
        //max amount check(1000 SOL)
        require!(amount <= 1_000_000_000_000, BondrError::AmountTooLarge);
        //preventing self transfer
        require!(
            self.sender.key() != self.receiver.key(),
            BondrError::SelfTransfer
        );

        // 2. Set initial values for escrow account
        self.escrow.set_inner(Escrow {
            sender: self.sender.key(),
            receiver: self.receiver.key(),
            amount,
            is_released: false,
            bump,
        });

        // 3. Transfer based on is_token_transfer flag
        if is_token_transfer {
            validate_token_accounts(
                &self.token_program,
                &self.sender_token_account,
                &self.escrow_token_account,
                &self.token_mint,
            )?;

            transfer_spl_tokens(
                self.sender_token_account.as_ref().unwrap(),
                self.escrow_token_account.as_ref().unwrap(),
                self.token_mint.as_ref().unwrap(),
                &self.sender.to_account_info(),
                self.token_program.as_ref().unwrap(),
                amount,
                None, // No signer seeds needed for sender
            )?;
        } else {
            transfer_sol(
                &self.sender.to_account_info(),
                &self.escrow.to_account_info(),
                &self.system_program,
                amount,
                None, // No signer seeds needed for sender
            )?;
        }

        // 4. init user stats
        if self.sender_stats.user == Pubkey::default() {
            self.sender_stats.set_inner(UserStats {
                user: self.sender.key(),
                completed_escrows: 0,
                bump: stats_bump,
            });
        }

        // 5. Emit events
        emit!(EscrowCreateEvent {
            sender: self.sender.key(),
            receiver: self.receiver.key(),
            amount,
            reference_seed,
            is_token_transfer
        });

        msg!(
            "Escrow initialized: {} -> {} for {} tokens",
            self.sender.key(),
            self.receiver.key(),
            amount
        );
        Ok(())
    }
}
