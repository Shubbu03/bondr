use crate::{
    error::BondrError,
    utils::{transfer_sol, transfer_spl_tokens, validate_token_accounts},
    ClientMultisig, Escrow, EscrowCreateEvent, UserStats,
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

    // Separate vault PDA for holding SOL funds
    #[account(
        mut,
        seeds = [b"vault", sender.key().as_ref(), receiver.key().as_ref(), &[reference_seed]],
        bump,
    )]
    pub vault: SystemAccount<'info>,

    #[account(
        init_if_needed,
        payer = sender,
        space = 8 + UserStats::INIT_SPACE,
        seeds = [b"user_stats", sender.key().as_ref()],
        bump
    )]
    pub sender_stats: Account<'info, UserStats>,

    /// Optional multisig account (present when is_multisig == true)
    /// CHECK: validated in instruction logic when provided
    #[account(mut)]
    pub client_multisig: Option<Account<'info, ClientMultisig>>,

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
        is_multisig: bool,
        bump: u8,
        vault_bump: u8,
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

        // 2. if is_multisig is true, we check here that it should be present
        if is_multisig {
            require!(
                self.client_multisig.is_some(),
                BondrError::InvalidMultisigConfig
            );
        } else {
            require!(
                self.client_multisig.is_none(),
                BondrError::InvalidMultisigConfig
            );
        }

        // 3. Set initial values for escrow account
        let mut client_multisig_pubkey: Option<Pubkey> = None;
        if is_multisig {
            // we will assign after validating the multisig account
            client_multisig_pubkey = Some(self.client_multisig.as_ref().unwrap().key());
        }

        self.escrow.set_inner(Escrow {
            sender: self.sender.key(),
            receiver: self.receiver.key(),
            amount,
            is_released: false,
            bump,
            vault_bump,
            client_multisig: client_multisig_pubkey,
        });

        // 4. Transfer based on is_token_transfer flag
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
                &self.vault.to_account_info(),
                &self.system_program,
                amount,
                None, // No signer seeds needed for sender
            )?;
        }

        // 5. If multisig, validating and linking pending_escrow on multisig account
        if is_multisig {
            let multisig = self.client_multisig.as_mut().unwrap();

            // Ensure multisig is not already busy
            require!(
                multisig.pending_escrow == Pubkey::default(),
                BondrError::MultisigBusy
            );

            // Ensure sender is part of multisig members (safety)
            let mut found = false;
            let active = multisig.member_count as usize;
            for i in 0..active {
                if multisig.members[i] == self.sender.key() {
                    found = true;
                    break;
                }
            }
            require!(found, BondrError::InvalidMultisigConfig);

            // Linking multisig -> pending escrow
            multisig.pending_escrow = self.escrow.key();
        }

        // 6. init user stats
        if self.sender_stats.user == Pubkey::default() {
            self.sender_stats.set_inner(UserStats {
                user: self.sender.key(),
                completed_escrows: 0,
                bump: stats_bump,
            });
        }

        // 7. Emit events
        emit!(EscrowCreateEvent {
            sender: self.sender.key(),
            receiver: self.receiver.key(),
            amount,
            reference_seed,
            is_token_transfer
        });

        Ok(())
    }
}
