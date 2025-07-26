use crate::{error::BondrError, Escrow, EscrowCreateEvent, UserStats};
use anchor_lang::{
    prelude::*,
    system_program::{transfer, Transfer},
};
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{transfer_checked, Mint, Token, TokenAccount, TransferChecked},
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
    fn transfer_sol(&mut self, amount: u64) -> Result<()> {
        let transfer_instruction = Transfer {
            from: self.sender.to_account_info(),
            to: self.escrow.to_account_info(),
        };
        let cpi_ctx = CpiContext::new(self.system_program.to_account_info(), transfer_instruction);

        transfer(cpi_ctx, amount)?;

        Ok(())
    }

    fn transfer_spl(&mut self, amount: u64) -> Result<()> {
        let token_program = self
            .token_program
            .as_ref()
            .ok_or(BondrError::MissingTokenProgram)?;
        let sender_token_account = self
            .sender_token_account
            .as_ref()
            .ok_or(BondrError::MissingTokenAccounts)?;
        let escrow_token_account = self
            .escrow_token_account
            .as_ref()
            .ok_or(BondrError::MissingTokenAccounts)?;
        let token_mint = self
            .token_mint
            .as_ref()
            .ok_or(BondrError::MissingTokenAccounts)?;

        let cpi_accounts = TransferChecked {
            from: sender_token_account.to_account_info(),
            mint: token_mint.to_account_info(),
            to: escrow_token_account.to_account_info(),
            authority: self.sender.to_account_info(),
        };
        let cpi_program = token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);

        transfer_checked(cpi_ctx, amount, token_mint.decimals)?;

        Ok(())
    }

    // Main logic to populate escrow PDA
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
        match is_token_transfer {
            true => self.transfer_spl(amount)?,
            false => self.transfer_sol(amount)?,
        };

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
