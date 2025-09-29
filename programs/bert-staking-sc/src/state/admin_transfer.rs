use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct ProposedAdmin {
    pub authority: Pubkey, // Authority that is proposed as new admin
    pub bump: u8,          // PDA bump
    // Padding
    pub _padding: [u8; 30],
}
