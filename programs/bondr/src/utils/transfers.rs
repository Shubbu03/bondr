use anchor_lang::{
    prelude::*,
    system_program::{transfer, Transfer},
};
use anchor_spl::token::{transfer_checked, Mint, Token, TokenAccount, TransferChecked};

use crate::error::BondrError;

// Transfer SOL from one account to another
pub fn transfer_sol<'info>(
    from: &AccountInfo<'info>,
    to: &AccountInfo<'info>,
    system_program: &Program<'info, System>,
    amount: u64,
    signer_seeds: Option<&[&[&[u8]]]>,
) -> Result<()> {
    let cpi_accounts = Transfer {
        from: from.clone(),
        to: to.clone(),
    };

    let cpi_ctx = match signer_seeds {
        Some(seeds) => {
            CpiContext::new_with_signer(system_program.to_account_info(), cpi_accounts, seeds)
        }
        None => CpiContext::new(system_program.to_account_info(), cpi_accounts),
    };

    transfer(cpi_ctx, amount)
}

// Transfer SPL tokens from one account to another
pub fn transfer_spl_tokens<'info>(
    from: &Account<'info, TokenAccount>,
    to: &Account<'info, TokenAccount>,
    mint: &Account<'info, Mint>,
    authority: &AccountInfo<'info>,
    token_program: &Program<'info, Token>,
    amount: u64,
    signer_seeds: Option<&[&[&[u8]]]>,
) -> Result<()> {
    let cpi_accounts = TransferChecked {
        from: from.to_account_info(),
        mint: mint.to_account_info(),
        to: to.to_account_info(),
        authority: authority.clone(),
    };

    let cpi_ctx = match signer_seeds {
        Some(seeds) => {
            CpiContext::new_with_signer(token_program.to_account_info(), cpi_accounts, seeds)
        }
        None => CpiContext::new(token_program.to_account_info(), cpi_accounts),
    };

    transfer_checked(cpi_ctx, amount, mint.decimals)
}

pub fn validate_token_accounts<'info>(
    token_program: &Option<Program<'info, Token>>,
    from_token_account: &Option<Account<'info, TokenAccount>>,
    to_token_account: &Option<Account<'info, TokenAccount>>,
    mint: &Option<Account<'info, Mint>>,
) -> Result<()> {
    token_program
        .as_ref()
        .ok_or(BondrError::MissingTokenProgram)?;
    from_token_account
        .as_ref()
        .ok_or(BondrError::MissingTokenAccounts)?;
    to_token_account
        .as_ref()
        .ok_or(BondrError::MissingTokenAccounts)?;
    mint.as_ref().ok_or(BondrError::MissingTokenAccounts)?;

    Ok(())
}
