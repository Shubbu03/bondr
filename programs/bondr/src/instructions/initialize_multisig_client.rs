use anchor_lang::prelude::*;

use crate::{ClientMultisig, ClientMultisigCreated, MAX_MULTISIG_MEMBERS};

#[derive(Accounts)]
pub struct InitializeMultisigClient<'info> {
    #[account(mut)]
    pub client: Signer<'info>,

    #[account(
        init,
        payer = client,
        space = 8 + ClientMultisig::INIT_SPACE,
        seeds = [b"client_multisig", client.key().as_ref()],
        bump
    )]
    pub multisig: Account<'info, ClientMultisig>,

    pub system_program: Program<'info, System>,
}

impl<'info> InitializeMultisigClient<'info> {
    fn validate_unique_members(
        &self,
        members: &[Pubkey; MAX_MULTISIG_MEMBERS],
        member_count: u8,
    ) -> Result<()> {
        let active_count = member_count as usize;

        for i in 0..active_count {
            for j in (i + 1)..active_count {
                if members[i] == members[j] {
                    return Err(crate::error::BondrError::DuplicateMember.into());
                }
            }
        }
        Ok(())
    }

    pub fn init_multisig_client(
        &mut self,
        members: [Pubkey; MAX_MULTISIG_MEMBERS],
        member_count: u8,
        threshold: u8,
        bump: u8,
    ) -> Result<()> {
        // 1. basic bounds checks
        require!(
            member_count > 0 && (member_count as usize) <= MAX_MULTISIG_MEMBERS,
            crate::error::BondrError::InvalidMultisigConfig
        );
        require!(
            threshold > 0 && threshold <= member_count,
            crate::error::BondrError::InvalidMultisigConfig
        );

        // 2. checking if client in members[] or not
        require!(
            members
                .iter()
                .take(member_count as usize)
                .any(|&member| member == self.client.key()),
            crate::error::BondrError::InvalidMultisigConfig
        );

        // 3. duplicate check among active members
        self.validate_unique_members(&members, member_count)?;

        // 4. preparing approvals array (all zero)
        let approvals: [u8; MAX_MULTISIG_MEMBERS] = [0u8; MAX_MULTISIG_MEMBERS];

        // 5. setting initial value for multisig account
        self.multisig.set_inner(crate::ClientMultisig {
            members,
            member_count,
            threshold,
            approvals,
            pending_escrow: Pubkey::default(),
            bump,
        });

        // 6. emit events
        emit!(ClientMultisigCreated {
            client: self.client.key(),
            multisig: self.multisig.key(),
            member_count,
            threshold,
        });

        Ok(())
    }
}
