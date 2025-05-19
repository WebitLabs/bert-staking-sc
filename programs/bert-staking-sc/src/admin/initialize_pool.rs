use crate::{
    state::{Config, Pool},
    StakingError,
};
use anchor_lang::prelude::*;

#[derive(Accounts)]
#[instruction(
    index: u32,
    lock_period_days: u16,
    yield_rate: u64,
    max_nfts_cap: u32,
    max_tokens_cap: u64,
    max_value_cap: u64
)]
pub struct InitializePool<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        mut,
        has_one = authority @ StakingError::Unauthorized
    )]
    pub config: Account<'info, Config>,

    #[account(
        init,
        payer = authority,
        space = 8 + Pool::INIT_SPACE,
        seeds = [
            b"pool",
            config.key().as_ref(),
            &index.to_le_bytes(),
        ],
        bump
    )]
    pub pool: Account<'info, Pool>,

    pub system_program: Program<'info, System>,
}

impl<'info> InitializePool<'info> {
    pub fn initialize(
        &mut self,
        index: u32,
        lock_period_days: u16,
        yield_rate: u64,
        max_nfts_cap: u32,
        max_tokens_cap: u64,
        max_value_cap: u64,
        bumps: &InitializePoolBumps,
    ) -> Result<()> {
        let pool = &mut self.pool;

        pool.config = self.config.key();
        pool.index = index;
        pool.lock_period_days = lock_period_days;
        pool.yield_rate = yield_rate;
        pool.max_nfts_cap = max_nfts_cap;
        pool.max_tokens_cap = max_tokens_cap;
        pool.max_value_cap = max_value_cap;
        pool.is_paused = false;

        // Initialize statistics
        pool.total_nfts_staked = 0;
        pool.total_tokens_staked = 0;
        pool.lifetime_nfts_staked = 0;
        pool.lifetime_tokens_staked = 0;
        pool.lifetime_claimed_yield = 0;

        pool.bump = bumps.pool;

        // Update pool count in config
        self.config.pool_count = self
            .config
            .pool_count
            .checked_add(1)
            .ok_or(StakingError::ArithmeticOverflow)?;

        Ok(())
    }
}

