use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, Debug, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum PositionType {
    NFT,
    Token,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace, Debug)]
pub enum PositionStatus {
    Unclaimed,
    Claimed,
}

#[account]
#[derive(InitSpace)]
pub struct Position {
    pub owner: Pubkey,               // Owner of the position
    pub deposit_time: i64,           // Time when deposit was made (unix timestamp)
    pub amount: u64,                 // Amount of tokens staked or value of NFT
    pub position_type: PositionType, // Type of position: NFT or Token
    pub lock_period_yield_index: u8,
    pub unlock_time: i64,       // Time when the position can be unlocked
    pub status: PositionStatus, // Status of position: Unclaimed or Claimed
    pub nft_mints: [Pubkey; 5], // NFT mint addresses (only used for NFT positions)
    pub nft_index: u8,          // Number of NFTs staked (acts alos as index in nft_mints)
    pub bump: u8,               // PDA bump
}

#[account]
#[derive(InitSpace, Debug)]
pub struct PositionV2 {
    pub owner: Pubkey,               // Owner of the position
    pub deposit_time: i64,           // Time when deposit was made (unix timestamp)
    pub amount: u64,                 // Amount of tokens staked or value of NFT
    pub position_type: PositionType, // Type of position: NFT or Token
    pub lock_period_yield_index: u8,
    pub unlock_time: i64,       // Time when the position can be unlocked
    pub status: PositionStatus, // Status of position: Unclaimed or Claimed
    pub asset: Pubkey,          // NFT mint addresses (only used for NFT positions)
    pub nft_index: u8,          // Number of NFTs staked (acts alos as index in nft_mints)
    pub bump: u8,               // PDA bump
    pub id: u64,                // id
}
