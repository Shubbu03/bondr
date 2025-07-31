use anchor_lang::prelude::*;
use mpl_core::{instructions::CreateV1CpiBuilder, types::DataState};

use crate::{constants::*, error::BondrError, FreelancerBadge, ReputationTier};

#[derive(Accounts)]
pub struct MintReputationNFT<'info> {
    #[account(mut)]
    pub freelancer: Signer<'info>,

    #[account(
        mut,
        seeds = [b"badge", freelancer.key().as_ref()],
        bump = badge.bump,
        constraint = badge.freelancer == freelancer.key()
    )]
    pub badge: Account<'info, FreelancerBadge>,

    /// CHECK: This will be the new Asset account
    #[account(mut)]
    pub asset: UncheckedAccount<'info>,

    /// CHECK: Collection account
    pub collection: Option<UncheckedAccount<'info>>,

    /// CHECK: Program authority PDA for badge updates
    #[account(
        seeds = [b"badge_authority"],
        bump
    )]
    pub badge_authority: UncheckedAccount<'info>,

    /// CHECK: MPL Core Program
    #[account(address = mpl_core::ID)]
    pub mpl_core_program: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

impl<'info> MintReputationNFT<'info> {
    pub fn mint_nft(&mut self, authority_bump: u8) -> Result<()> {
        // 1. determining tier based on completed escrows
        let tier = match self.badge.completed_escrows {
            0..=2 => return Err(BondrError::InsufficientEscrows.into()),
            3..=9 => ReputationTier::Verified,
            10..=24 => ReputationTier::Professional,
            25.. => ReputationTier::Elite,
        };

        // 2. verifying if freelancer already has this tier to prevent duplicate minting
        if self.badge.tier == tier {
            return Err(BondrError::NFTAlreadyMinted.into());
        }

        // 3. metadata based on tier
        let (name, uri) = match tier {
            ReputationTier::Verified => ("Bondr Verified Badge", VERIFIED_METADATA_URI),
            ReputationTier::Professional => ("Bondr Professional Badge", PROFESSIONAL_METADATA_URI),
            ReputationTier::Elite => ("Bondr Elite Badge", ELITE_METADATA_URI),
        };

        // 4. create account info references
        let mpl_core_program = self.mpl_core_program.to_account_info();
        let asset = self.asset.to_account_info();
        let freelancer = self.freelancer.to_account_info();
        let badge_authority = self.badge_authority.to_account_info();
        let system_program = self.system_program.to_account_info();

        // 5. handle collection if provided, or use None
        let collection_info = self.collection.as_ref().map(|c| c.to_account_info());

        // 6. prepare signer seeds for program authority PDA
        let authority_seeds = &[b"badge_authority".as_ref(), &[authority_bump]];
        let signer_seeds = &[authority_seeds.as_slice()];

        // 7. creating the asset using mpl-core with program authority
        CreateV1CpiBuilder::new(&mpl_core_program)
            .asset(&asset)
            .authority(Some(&freelancer)) // Freelancer creates the NFT
            .payer(&freelancer) // Freelancer pays for creation
            .owner(Some(&freelancer)) // Freelancer owns the NFT
            .update_authority(Some(&badge_authority)) // program controls metadata updates
            .system_program(&system_program)
            .collection(collection_info.as_ref())
            .data_state(DataState::AccountState)
            .name(name.to_string())
            .uri(uri.to_string())
            .invoke_signed(signer_seeds)?; // invoke_signed because program PDA needs to sign as update_authority

        // 8. updating badge tier
        self.badge.tier = tier.clone();

        Ok(())
    }
}
