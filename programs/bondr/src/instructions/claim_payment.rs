use anchor_lang::prelude::*;
use anchor_spl::token::{Mint, Token, TokenAccount};

use crate::{
    error::BondrError,
    utils::{transfer_sol, transfer_spl_tokens, validate_token_accounts},
    Escrow, UserStats,
};

#[derive(Accounts)]
#[instruction(reference_seed:u8)]
pub struct ClaimPayment<'info> {
    // sender who initially funded the escrow – receives the rent-refund when we close it
    #[account(mut)]
    pub client: SystemAccount<'info>,

    #[account(mut)]
    pub freelancer: Signer<'info>,

    #[account(
        mut,
        close = client,
        seeds = [b"escrow", client.key().as_ref(), freelancer.key().as_ref(), &[reference_seed]],
        bump = escrow.bump
    )]
    pub escrow: Account<'info, Escrow>,

    // Vault PDA that holds the actual SOL funds
    #[account(
        mut,
        seeds = [b"vault", client.key().as_ref(), freelancer.key().as_ref(), &[reference_seed]],
        bump = escrow.vault_bump
    )]
    pub vault: SystemAccount<'info>,

    #[account(
        init_if_needed,
        payer = freelancer,
        space = 8 + UserStats::INIT_SPACE,
        seeds = [b"user_stats", freelancer.key().as_ref()],
        bump
    )]
    pub receiver_stats: Account<'info, UserStats>,

    // SOL claim
    #[account(mut)]
    pub receiver_sol: SystemAccount<'info>,

    // SPL claim
    #[account(mut)]
    pub escrow_token_account: Option<Account<'info, TokenAccount>>,

    #[account(mut)]
    pub receiver_token_account: Option<Account<'info, TokenAccount>>,

    pub token_mint: Option<Account<'info, Mint>>,
    pub token_program: Option<Program<'info, Token>>,
    pub system_program: Program<'info, System>,
}

impl<'info> ClaimPayment<'info> {
    pub fn claim_payment(
        &mut self,
        reference_seed: u8,
        is_token_transfer: bool,
        receiver_stats_bump: u8,
    ) -> Result<()> {
        // 1. Input validation
        require!(self.escrow.is_released, BondrError::NotReleased);
        require_keys_eq!(self.freelancer.key(), self.escrow.receiver);

        // 2. using amount from escrow state
        let amount = self.escrow.amount;

        // 3. Creating signer seeds as movement from escrow -> freelancer
        let client_key = self.client.key();
        let freelancer_key = self.freelancer.key();
        let vault_seeds = &[
            b"vault",
            client_key.as_ref(),     // sender
            freelancer_key.as_ref(), // receiver
            &[reference_seed],
            &[self.escrow.vault_bump],
        ];
        let vault_signer_seeds = &[&vault_seeds[..]];

        // Escrow seeds for token transfers (if needed)
        let escrow_seeds = &[
            b"escrow",
            client_key.as_ref(),
            freelancer_key.as_ref(),
            &[reference_seed],
            &[self.escrow.bump],
        ];
        let escrow_signer_seeds = &[&escrow_seeds[..]];

        // 4. transfer based on flag
        if is_token_transfer {
            validate_token_accounts(
                &self.token_program,
                &self.escrow_token_account,
                &self.receiver_token_account,
                &self.token_mint,
            )?;

            transfer_spl_tokens(
                self.escrow_token_account.as_ref().unwrap(),
                self.receiver_token_account.as_ref().unwrap(),
                self.token_mint.as_ref().unwrap(),
                &self.escrow.to_account_info(),
                self.token_program.as_ref().unwrap(),
                amount,
                Some(escrow_signer_seeds), // Escrow PDA signs for tokens
            )?;
        } else {
            transfer_sol(
                &self.vault.to_account_info(),
                &self.receiver_sol.to_account_info(),
                &self.system_program,
                amount,
                Some(vault_signer_seeds),
            )?;
        }

        // 5. Update stats (create-then-update safe)
        if self.receiver_stats.user == Pubkey::default() {
            self.receiver_stats.set_inner(UserStats {
                user: self.freelancer.key(),
                completed_escrows: 1, // This is the first completion
                bump: receiver_stats_bump,
            });
        } else {
            self.receiver_stats.completed_escrows += 1;
        }

        Ok(())
    }
}
