use crate::{
    error::BondrError, LoyaltyMilestoneEvent, LoyaltyTier, RemitStats, Remittance, RemittanceEvent,
};
use anchor_lang::prelude::*;

#[derive(Accounts)]
#[instruction(amount:u64 , reference_seed: u8)]
pub struct Initialize<'info> {
    // Sender initiating the remittance
    #[account(mut)]
    pub sender: Signer<'info>,

    // Receiver's public key (not accessed as a program account)
    ///CHECK: This is only stored and emitted
    pub receiver: AccountInfo<'info>,

    // PDA to store remittance metadata
    #[account(
        init,
        payer = sender,
        space = 8 + Remittance::INIT_SPACE,
        seeds = [b"remittance", sender.key().as_ref(), receiver.key().as_ref(), &[reference_seed]],
        bump,
    )]
    pub remittance: Account<'info, Remittance>,

    #[account(
        init_if_needed,
        payer = sender,
        space = 8 + RemitStats::INIT_SPACE,
        seeds = [b"remit_stats", sender.key().as_ref()],
        bump
    )]
    pub stats: Account<'info, RemitStats>,

    pub system_program: Program<'info, System>,
}

impl<'info> Initialize<'info> {
    // Main logic to populate remittance PDA
    pub fn init_remittance(
        &mut self,
        amount: u64,
        reference_seed: u8,
        bump: u8,
        stats_bump: u8,
    ) -> Result<()> {
        require!(amount > 0, BondrError::InvalidAmountZero);
        //max amount check(1000 SOL)
        require!(amount <= 1_000_000_000_000, BondrError::AmountTooLarge);
        //preventing self transfer
        require!(
            self.sender.key() != self.receiver.key(),
            BondrError::SelfTransfer
        );
        //for protecting PDA from spam and collision
        require!(
            reference_seed != 0 && reference_seed <= 100,
            BondrError::InvalidReferenceSeed
        );

        self.remittance.set_inner(Remittance {
            sender: self.sender.key(),
            receiver: self.receiver.key(),
            amount,
            bump,
        });

        // Update or initialize stats
        let prev_total = self.stats.total_sent;
        let prev_count = self.stats.tx_count;

        //for leveling up and upgrading tier
        let new_count = prev_count + 1;

        self.stats.set_inner(RemitStats {
            user: self.sender.key(),
            total_sent: prev_total + amount,
            tx_count: prev_count + 1,
            bump: stats_bump,
        });

        // Loyalty milestone check, for minitng NFT
        match new_count {
            3 => {
                emit!(LoyaltyMilestoneEvent {
                    user: self.sender.key(),
                    tier: LoyaltyTier::Novice,
                });
                msg!(
                    "LoyaltyMilestoneEvent: user={}, tier=Novice",
                    self.sender.key()
                );
            }
            10 => {
                emit!(LoyaltyMilestoneEvent {
                    user: self.sender.key(),
                    tier: LoyaltyTier::Expert,
                });
                msg!(
                    "LoyaltyMilestoneEvent: user={}, tier=Expert",
                    self.sender.key()
                );
            }
            25 => {
                emit!(LoyaltyMilestoneEvent {
                    user: self.sender.key(),
                    tier: LoyaltyTier::Elite,
                });
                msg!(
                    "LoyaltyMilestoneEvent: user={}, tier=Elite",
                    self.sender.key()
                );
            }
            _ => {}
        }

        emit!(RemittanceEvent {
            sender: self.sender.key(),
            receiver: self.receiver.key(),
            amount,
            reference_seed,
        });

        Ok(())
    }
}
