use anchor_lang::prelude::*;

use crate::{ClientMultisig, Escrow, MultisigApprovalAdded};

#[derive(Accounts)]
#[instruction(reference_seed: u8)]
pub struct ApproveMultisigRelease<'info> {
    #[account(mut)]
    pub member: Signer<'info>,

    #[account(
        mut,
        seeds = [b"client_multisig", escrow.sender.key().as_ref()],
        bump = multisig.bump
    )]
    pub multisig: Account<'info, ClientMultisig>,

    #[account(mut,
        seeds = [b"escrow",  escrow.sender.key().as_ref(), escrow.receiver.key().as_ref(), &[reference_seed]],
        bump = escrow.bump
    )]
    pub escrow: Account<'info, Escrow>,

    pub system_program: Program<'info, System>,
}

impl<'info> ApproveMultisigRelease<'info> {
    pub fn approve_multisig(&mut self) -> Result<()> {
        let multisig = &mut self.multisig;

        // 1. checking that pending escrow must match this one
        require_keys_eq!(
            multisig.pending_escrow,
            self.escrow.key(),
            crate::error::BondrError::MultisigPendingEscrowMismatch
        );

        // 2. locating the member's index in the members array
        let mut found = false;
        let mut member_index = 0;
        for i in 0..(multisig.member_count as usize) {
            if multisig.members[i] == self.member.key() {
                found = true;
                member_index = i;
                break;
            }
        }

        require!(found, crate::error::BondrError::NotMultisigMember);

        // 3. preventing double approvals
        require!(
            multisig.approvals[member_index] == 0,
            crate::error::BondrError::AlreadyApproved
        );

        // 4. approving this member -> 1 for approve on that index for that member
        multisig.approvals[member_index] = 1;

        // 5. If threshold is now met, mark the escrow as released.
        //    Transfer still only happens in claim_payment.
        let approvals_met = multisig
            .approvals
            .iter()
            .take(multisig.member_count as usize)
            .filter(|&&a| a == 1)
            .count() as u8;

        if approvals_met >= multisig.threshold {
            self.escrow.is_released = true;
        }

        // 6. Emit event
        emit!(MultisigApprovalAdded {
            multisig: multisig.key(),
            member: self.member.key(),
            escrow: self.escrow.key(),
        });

        msg!(
            "Multisig member {} approved escrow {}",
            self.member.key(),
            self.escrow.key()
        );
        Ok(())
    }
}
