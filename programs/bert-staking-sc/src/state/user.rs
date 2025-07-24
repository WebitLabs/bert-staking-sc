use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace, Debug)]
pub struct UserAccountV3 {
    /// The config this user account is associated with
    pub config: Pubkey,

    /// Total staked token amount across all pools
    pub total_staked_token_amount: u64,

    /// Total staked NFTs across all pools
    pub total_staked_nfts: u32,

    /// Total staked value across all pools (in tokens)
    pub total_staked_value: u64,

    /// Total claimed yield across all pools
    pub total_claimed_yield: u64,

    /// PDA bump
    pub bump: u8,

    /// Padding for future extensions
    pub _padding: [u8; 64],
}
