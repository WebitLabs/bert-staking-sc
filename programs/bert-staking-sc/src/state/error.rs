use anchor_lang::prelude::*;

#[error_code]
pub enum StakingError {
    #[msg("The staking position is still locked")]
    PositionLocked,

    #[msg("NFT limit per user for this pool reached")]
    NftLimitReached,

    #[msg("Global NFT limit per user reached")]
    GlobalNftLimitReached,

    #[msg("Invalid staking amount")]
    InvalidAmount,

    #[msg("Arithmetic overflow")]
    ArithmeticOverflow,

    #[msg("Invalid position type")]
    InvalidPositionType,

    #[msg("Tokens limit per user reached")]
    UserTokensLimitCapReached,

    #[msg("Pool paused")]
    PoolAlreadyPaused,

    #[msg("Pool is already active")]
    PoolAlreadyActive,

    #[msg("You can only set pool config if the pool is paused")]
    InvalidPoolPauseState,

    #[msg("Insufficient funds in yield vault for rewards")]
    InsufficientYieldFunds,

    #[msg("Authority vault already initialized")]
    AuthorityVaultAlreadyInitialized,

    #[msg("Authority vault not initialized")]
    AuthorityVaultNotInitialized,

    #[msg("Unauthorized Operation")]
    Unauthorized,

    #[msg("Pool value limit reached")]
    PoolValueLimitReached,
}
