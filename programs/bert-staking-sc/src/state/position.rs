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
#[derive(InitSpace, Debug)]
pub struct PositionV4 {
    /// Owner of the position
    pub owner: Pubkey,

    /// Pool this position belongs to
    pub pool: Pubkey,

    /// Time when deposit was made (unix timestamp)
    pub deposit_time: i64,

    /// Amount of tokens staked or value of NFT
    pub amount: u64,

    /// Type of position: NFT or Token
    pub position_type: PositionType,

    /// Time when the position can be unlocked
    pub unlock_time: i64,

    /// Status of position: Unclaimed or Claimed
    pub status: PositionStatus,

    /// NFT mint address (asset) - only used for NFT positions
    pub asset: Pubkey,

    /// PDA bump
    pub bump: u8,

    /// Position identifier
    pub id: u64,

    /// Last time yield was claimed
    pub last_claimed_at: i64,

    /// Padding for future extensions
    pub _padding: [u8; 64],
}
