use anchor_lang::{prelude::*, system_program::{transfer,Transfer}};
use anchor_spl::token::{transfer_checked, TransferChecked, Token, TokenAccount, Mint};

use crate::{error::BondrError, Escrow};

#[derive(Accounts)]
#[instruction(reference_seed:u8)]
pub struct Claim<'info> {
    #[account(mut)]
    pub sender: Signer<'info>,
    #[account(mut)]
    pub receiver: SystemAccount<'info>,

    #[account(
        mut,
        close = sender,
        has_one = sender,
        has_one = receiver,
        seeds = [b"remittance", sender.key().as_ref(), receiver.key().as_ref(), &[reference_seed]],
        bump = remittance.bump
    )]
    pub remittance: Account<'info, Escrow>,

    #[account(mut)]
    pub sender_token: Option<Account<'info, TokenAccount>>,
    #[account(mut)]
    pub receiver_token: Option<Account<'info, TokenAccount>>,

    pub token_mint: Option<Account<'info, Mint>>,
    pub token_program: Option<Program<'info, Token>>,
    pub system_program: Program<'info, System>,
}

impl<'info> Claim<'info> {
    fn transfer_sol(&mut self, amount: u64) -> Result<()> {
        require!(
            self.sender.lamports() >= amount,
            BondrError::InsufficientBalance
        );

        let cpi_program = self.system_program.to_account_info();

        let cpi_accounts = Transfer {
                from: self.sender.to_account_info(),
                to: self.receiver.to_account_info(),
            };

        let cpi_context = CpiContext::new(
            cpi_program,
            cpi_accounts
        );

        transfer(cpi_context,amount)?;
        Ok(())
    }

    fn transfer_token(&mut self, amount: u64, decimals: u8) -> Result<()> {
        require!(
            self.sender_token.is_some()
            && self.receiver_token.is_some()
            && self.token_mint.is_some()
            && self.token_program.is_some(),
            BondrError::MissingTokenAccounts
        );

        let cpi_accounts = TransferChecked {
            from: self.sender_token.as_ref().unwrap().to_account_info(),
            mint: self.token_mint.as_ref().unwrap().to_account_info(),
            to: self.receiver_token.as_ref().unwrap().to_account_info(),
            authority: self.sender.to_account_info(),
        };

        let cpi_ctx = CpiContext::new(
            self.token_program.as_ref().unwrap().to_account_info(),
            cpi_accounts,
        );

        transfer_checked(cpi_ctx, amount, decimals)?;
        Ok(())
    }

    pub fn claim(&mut self,is_token_transfer: bool, amount: u64,decimals: u8) -> Result<()> {
        match is_token_transfer {
            true => self.transfer_token(amount, decimals),
            false => self.transfer_sol(amount),
        }
    }
}
