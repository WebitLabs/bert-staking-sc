use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
pub enum PositionType {
    NFT,
    Token,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace)]
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
    pub unlock_time: i64,            // Time when the position can be unlocked
    pub status: PositionStatus,      // Status of position: Unclaimed or Claimed
    pub nft_mint: Pubkey,            // NFT mint address (only used for NFT positions)
    pub bump: u8,                    // PDA bump
}
