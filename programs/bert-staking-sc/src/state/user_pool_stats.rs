use anchor_lang::prelude::*;

/// A separate PDA for each user's stats for a specific pool
#[account]
#[derive(InitSpace, Debug)]
pub struct UserPoolStatsAccount {
    /// The user this stats belongs to
    pub user: Pubkey,

    /// The pool this stats is for
    pub pool: Pubkey,

    /// Total amount of tokens staked by the user in this pool
    pub tokens_staked: u64,

    /// Number of NFTs staked by the user in this pool
    pub nfts_staked: u32,

    /// Total value staked by the user in this pool (in tokens)
    pub total_value: u64,

    /// Claimed yield from this pool
    pub claimed_yield: u64,

    /// PDA bump
    pub bump: u8,

    /// Padding for future extensions
    pub _padding: [u8; 64],
}
