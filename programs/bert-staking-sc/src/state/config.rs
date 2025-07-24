use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, InitSpace, Debug)]
pub struct PoolConfigArgs {
    pub lock_period_days: u16, // The lock period in days
    pub yield_rate: u64,       // Yield rate in basis points
    pub max_nfts_cap: u32,     // Maximum amount of NFTs that can be staked / user
    pub max_tokens_cap: u64,   // Maximum amount of tokens that can be staked / user
    pub max_value_cap: u64,    // Maximum combined value (tokens + nfts * nft_value) in the pool
}

#[account]
#[derive(InitSpace, Debug)]
pub struct Config {
    pub id: u64,
    pub authority: Pubkey,       // Authority that can update config settings
    pub mint: Pubkey,            // Token Mint
    pub collection: Pubkey,      // NFT Collection
    pub vault: Pubkey,           // Token Vault
    pub authority_vault: Pubkey, // Authority Vault
    pub nfts_vault: Pubkey,      // NFTs Vault
    pub admin_withdraw_destination: Pubkey, // Admin withdraw destination

    pub pool_count: u32, // Track number of pools created

    pub max_cap: u64,             // Maximum tokens that can be staked
    pub nft_value_in_tokens: u64, // Fixed value for each NFT in tokens
    pub nfts_limit_per_user: u8,  // Maximum number of NFTs per user

    pub total_staked_amount: u64, // Total amount of tokens staked in the program
    pub total_nfts_staked: u64,   // Total amount of NFTs staked in the program

    pub bump: u8,                 // PDA bump
    pub authority_vault_bump: u8, // Authority Vault bump

    // Padding
    pub _padding: [u8; 96],
}
