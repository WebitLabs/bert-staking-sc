use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace, Debug)]
pub enum LockPeriod {
    OneDay = 1,
    ThreeDays = 3,
    SevenDays = 7,
    ThirtyDays = 30,
}

#[account]
#[derive(InitSpace, Debug)]
pub struct Config {
    pub authority: Pubkey,            // Authority that can update config settings
    pub mint: Pubkey,                 // Token Mint
    pub collection: Pubkey,           // NFT Collection
    pub vault: Pubkey,                // Token Vault
    pub nfts_vault: Pubkey,           // NFTs Vault
    pub authority_vault: Pubkey,      // Authority Vault
    pub lock_period: [LockPeriod; 4], // Lock period in days
    pub yield_rate: u64,              // Yield rate in basis points (e.g., 500 = 5%)
    pub max_cap: u64,                 // Maximum tokens that can be staked
    pub nft_value_in_tokens: u64,     // Fixed value for each NFT in tokens
    pub nfts_limit_per_user: u8,      // Maximum number of NFTs per user
    pub total_staked_amount: u64,     // Total amount of tokens staked in the program
    pub bump: u8,                     // PDA bump
    pub authority_vault_bump: u8,     // Authority Vault bump
}
