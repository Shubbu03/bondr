use anchor_lang::prelude::*;
use mpl_core::{instructions::CreateV2CpiBuilder, types::DataState, ID as MPL_CORE_ID};

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

    /// CHECK: This will be the new Asset account created by MPL Core
    #[account(mut)]
    pub asset: Signer<'info>,

    /// CHECK: Collection account
    #[account(mut)]
    pub collection: UncheckedAccount<'info>,

    /// CHECK: MPL Core Program, checked by address constraint
    #[account(address = MPL_CORE_ID)]
    pub mpl_core_program: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

impl<'info> MintReputationNFT<'info> {
    pub fn mint_nft(&mut self) -> Result<()> {
        require_keys_eq!(
            self.mpl_core_program.key(),
            mpl_core::ID,
            BondrError::InvalidMplKey
        );

        // 1. determining tier based on completed escrows
        let tier = match self.badge.completed_escrows {
            0..=2 => {
                return Err(BondrError::InsufficientEscrows.into());
            }
            3..=9 => ReputationTier::Verified,
            10..=24 => ReputationTier::Professional,
            25.. => ReputationTier::Elite,
        };

        // 2. verifying if freelancer already has this tier or higher to prevent duplicate minting
        if self.badge.tier >= tier {
            return Err(BondrError::NFTAlreadyMinted.into());
        }

        // 3. metadata based on tier
        let (name, uri) = match tier {
            ReputationTier::Unranked => {
                return Err(BondrError::InsufficientEscrows.into());
            }
            ReputationTier::Verified => ("Bondr Verified Badge", VERIFIED_METADATA_URI),
            ReputationTier::Professional => ("Bondr Professional Badge", PROFESSIONAL_METADATA_URI),
            ReputationTier::Elite => ("Bondr Elite Badge", ELITE_METADATA_URI),
        };

        // 4. create account info references
        let mpl_core_program = self.mpl_core_program.to_account_info();
        let asset = self.asset.to_account_info();
        let freelancer = self.freelancer.to_account_info();
        let system_program = self.system_program.to_account_info();

        // 5. handle collection if provided
        // let collection_info = self.collection.as_ref().map(|c| c.to_account_info());
        // let collection_info = self.collection.to_account_info();

        // 6. creating the asset using freelancer as authority - NO CPI SIGNING NEEDED
        CreateV2CpiBuilder::new(&mpl_core_program)
            .asset(&asset)
            // .collection(Some(&collection_info)) // commented for now
            .collection(None)
            .authority(Some(&freelancer)) // Freelancer as authority
            .payer(&freelancer) // Freelancer pays
            .owner(Some(&freelancer)) // Freelancer owns
            .system_program(&system_program)
            .data_state(DataState::AccountState)
            .name(name.to_string())
            .uri(uri.to_string())
            .invoke()?;

        // 7. updating badge tier
        self.badge.tier = tier.clone();

        Ok(())
    }
}
