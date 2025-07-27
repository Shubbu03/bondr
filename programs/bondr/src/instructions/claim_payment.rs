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
    #[account(mut)]
    pub freelancer: Signer<'info>,

    /// CHECK: Used for PDA derivation
    pub client: AccountInfo<'info>,

    #[account(
        mut,
        close = client,
        seeds = [b"escrow", client.key().as_ref(), freelancer.key().as_ref(), &[reference_seed]],
        bump = escrow.bump
    )]
    pub escrow: Account<'info, Escrow>,

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
        is_token_transfer: bool,
        amount: u64,
        _decimals: u8,
        reference_seed: u8,
    ) -> Result<()> {
        // 1. Input validation
        require!(self.escrow.is_released, BondrError::NotReleased);
        require_keys_eq!(self.freelancer.key(), self.escrow.receiver);

        // 2. Creating signer seeds as movement from escrow -> freelancer
        let escrow_seeds = &[
            b"escrow",
            self.client.key.as_ref(),
            self.freelancer.key.as_ref(),
            &[reference_seed],
            &[self.escrow.bump],
        ];
        let seeds = &[&escrow_seeds[..]];

        // 3. transfer based on flag
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
                Some(seeds), // Escrow PDA needs to sign
            )?;
        } else {
            transfer_sol(
                &self.escrow.to_account_info(),
                &self.receiver_sol.to_account_info(),
                &self.system_program,
                amount,
                Some(seeds), // Escrow PDA needs to sign
            )?;
        }

        // 4. Update stats
        self.receiver_stats.completed_escrows += 1;

        Ok(())
    }
}
