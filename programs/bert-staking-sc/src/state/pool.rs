use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace, Debug)]
pub struct Pool {
    /// Parent config reference
    pub config: Pubkey,

    /// Pool index for reference
    pub index: u32,

    /// The lock period in days
    pub lock_period_days: u16,

    /// Yield rate in basis points (e.g., 500 = 5%)
    pub yield_rate: u64,

    /// Maximum NFTs per user in this pool
    pub max_nfts_cap: u32,

    /// Maximum tokens per user in this pool
    pub max_tokens_cap: u64,

    /// Maximum total value in this pool (tokens + nfts * nft_value)
    pub max_value_cap: u64,

    /// Whether the pool is paused
    pub is_paused: bool,

    /// Current total NFTs staked in this pool
    pub total_nfts_staked: u32,

    /// Current total tokens staked in this pool
    pub total_tokens_staked: u64,

    /// All-time NFTs staked in this pool
    pub lifetime_nfts_staked: u32,

    /// All-time tokens staked in this pool
    pub lifetime_tokens_staked: u64,

    /// All-time yield claimed from this pool
    pub lifetime_claimed_yield: u64,

    /// PDA bump
    pub bump: u8,

    /// Padding for future extensions
    pub _padding: [u8; 56],
}
