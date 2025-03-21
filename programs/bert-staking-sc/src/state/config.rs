use anchor_lang::prelude::*;

#[account]
#[derive(InitSpace)]
pub struct Config {
    pub authority: Pubkey,        // Authority that can update config settings
    pub lock_time: u64,           // Lock period in days
    pub yield_rate: u64,          // Yield rate in basis points (e.g., 500 = 5%)
    pub max_cap: u64,             // Maximum tokens that can be staked
    pub nft_value_in_tokens: u64, // Fixed value for each NFT in tokens
    pub nfts_limit_per_user: u8,  // Maximum number of NFTs per user
    pub total_staked_amount: u64, // Total amount of tokens staked in the program
    pub bump: u8,                 // PDA bump
}
