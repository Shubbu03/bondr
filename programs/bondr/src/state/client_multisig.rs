use anchor_lang::prelude::*;

use crate::MAX_MULTISIG_MEMBERS;

#[account]
#[derive(InitSpace)]
pub struct ClientMultisig {
    pub members: [Pubkey; MAX_MULTISIG_MEMBERS], // max 5 members allowed as per now
    pub member_count: u8,                        // how many active entries in `members`
    pub threshold: u8,                           // approvals required
    pub approvals: [u8; MAX_MULTISIG_MEMBERS], // 0 = not approved, 1 = approved; parallel to members
    pub pending_escrow: Pubkey,                // escrow PDA tied to this multisig
    pub bump: u8,
}

// space it will take -
// INIT_SPACE = 32*8 + 1 + 1 + 8 + 32 + 1 = 256 + 1 + 1 + 8 + 32 + 1 = 299 bytes
// space = 8 + ClientMultisig::INIT_SPACE  // 8 + 299 = 307
