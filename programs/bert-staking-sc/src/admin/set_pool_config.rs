use crate::{state::*, StakingError};
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct AdminSetPoolConfig<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        mut,
        has_one = authority,
        seeds = [b"config", config.authority.key().as_ref(), config.id.to_le_bytes().as_ref()],
        bump = config.bump,
    )]
    pub config: Account<'info, Config>,

    #[account(
        mut,
        seeds = [
            b"pool",
            config.key().as_ref(),
            pool.index.to_le_bytes().as_ref()
        ],
        bump = pool.bump,
    )]
    pub pool: Account<'info, Pool>,
}

impl<'info> AdminSetPoolConfig<'info> {
    pub fn admin_pause_pool(&mut self) -> Result<()> {
        let pool = &mut self.pool;
        require!(!pool.is_paused, StakingError::PoolAlreadyPaused);

        pool.is_paused = true;

        Ok(())
    }

    pub fn admin_activate_pool(&mut self) -> Result<()> {
        let pool = &mut self.pool;
        require!(pool.is_paused, StakingError::PoolAlreadyActive);

        pool.is_paused = false;

        Ok(())
    }

    pub fn admin_set_pool_config(&mut self, pool_config_args: PoolConfigArgs) -> Result<()> {
        let pool = &mut self.pool;
        require!(pool.is_paused, StakingError::InvalidPoolPauseState);

        pool.max_tokens_cap = pool_config_args.max_tokens_cap;
        pool.max_nfts_cap = pool_config_args.max_nfts_cap;
        pool.max_value_cap = pool_config_args.max_value_cap;
        pool.yield_rate = pool_config_args.yield_rate;
        pool.lock_period_days = pool_config_args.lock_period_days;

        Ok(())
    }
}
