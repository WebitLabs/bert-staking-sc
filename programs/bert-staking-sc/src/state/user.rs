use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace, Debug)]
pub struct UserAccount {
    pub total_staked_token_amount: u64,
    pub total_staked_nfts: u32,

    pub total_staked_value: u64,

    pub bump: u8, // PDA bump

    pub _padding: [u8; 64],
}
