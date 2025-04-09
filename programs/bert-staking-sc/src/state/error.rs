use anchor_lang::prelude::*;

#[error_code]
pub enum StakingError {
    #[msg("The staking position is still locked")]
    PositionLocked,

    #[msg("The staking position has already been claimed")]
    PositionAlreadyClaimed,

    #[msg("Maximum staking capacity reached")]
    MaxCapReached,

    #[msg("NFT limit per user reached")]
    NftLimitReached,

    #[msg("Invalid staking amount")]
    InvalidAmount,

    #[msg("Arithmetic overflow")]
    ArithmeticOverflow,

    #[msg("Invalid lock period")]
    InvalidLockPeriod,

    #[msg("Invalid position type")]
    InvalidPositionType,

    #[msg("Invalid Nft Mint")]
    InvalidNftMint,

    #[msg("Already staked")]
    AlreadyStaked,
}
