use anchor_lang::prelude::*;

/// Stats for a specific pool for a user
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, InitSpace, Debug)]
pub struct UserPoolStats {
    /// Total amount of tokens staked by the user in this pool
    pub tokens_staked: u64,

    /// Number of NFTs staked by the user in this pool
    pub nfts_staked: u32,

    /// Total value staked by the user in this pool (in tokens)
    pub total_value: u64,

    /// Lock period in days for this pool (to easily identify which pool this is)
    pub lock_period_days: u16,

    /// Claimed yield from this pool
    pub claimed_yield: u64,

    /// Padding for future extensions
    pub _padding: [u8; 32],
}

// OLD
#[account]
#[derive(InitSpace, Debug)]
pub struct UserAccount {
    /// Stats for each pool (matches the pools in Config)
    pub pool_stats: [UserPoolStats; 4],

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
    pub _padding: [u8; 32],
}

#[account]
#[derive(InitSpace, Debug)]
pub struct UserAccountV2 {
    /// Stats for each pool (matches the pools in Config)
    pub pool_stats: [UserPoolStats; 4],

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
    pub _padding: [u8; 32],
}
