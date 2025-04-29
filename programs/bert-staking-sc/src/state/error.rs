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

    #[msg("Invalid lock period and yield")]
    InvalidLockPeriodAndYield,

    #[msg("Invalid position type")]
    InvalidPositionType,

    #[msg("Invalid Nft Mint")]
    InvalidNftMint,

    #[msg("Already staked")]
    AlreadyStaked,

    #[msg("Tokens limit per user reached")]
    UserTokensLimitCapReached,

    #[msg("Asset Not Staked")]
    AssetNotStaked,

    #[msg("Attributes Not Initialized")]
    AttributesNotInitialized,

    #[msg("Invalid Timestamp")]
    InvalidTimestamp,

    #[msg("Invalid Admin Amount")]
    InvalidAdminAmount,

    #[msg("Pool paused")]
    PoolAlreadyPaused,

    #[msg("Pool is already active")]
    PoolAlreadyActive,

    #[msg("You can only set pool config if the pool is paused")]
    InvalidPoolPauseState,
}
