use crate::{state::*, StakingError};
use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{Mint, Token, TokenAccount},
};

#[derive(Accounts)]
#[instruction(id: u64)]
pub struct StakeToken<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        mut,
        has_one = vault,
        seeds = [b"config", config.authority.key().as_ref(), config.id.to_le_bytes().as_ref()],
        bump = config.bump,
    )]
    pub config: Box<Account<'info, Config>>,

    #[account(
        mut,
        seeds = [
            b"pool",
            config.key().as_ref(),
            pool.index.to_le_bytes().as_ref()
        ],
        bump = pool.bump,
    )]
    pub pool: Box<Account<'info, Pool>>,

    #[account(
        mut,
        seeds = [b"user", owner.key().as_ref(), config.key().as_ref()],
        bump = user_account.bump,
    )]
    pub user_account: Box<Account<'info, UserAccountV3>>,

    #[account(
        init_if_needed,
        payer = owner,
        space = 8 + UserPoolStatsAccount::INIT_SPACE,
        seeds = [
            b"user_pool_stats",
            owner.key().as_ref(),
            pool.key().as_ref(),
        ],
        bump
    )]
    pub user_pool_stats: Box<Account<'info, UserPoolStatsAccount>>,

    #[account(
        init,
        payer = owner,
        space = 8 + PositionV4::INIT_SPACE,
        seeds = [b"position", owner.key().as_ref(), mint.key().as_ref(), id.to_le_bytes().as_ref()],
        bump,
    )]
    pub position: Box<Account<'info, PositionV4>>,

    pub mint: Account<'info, Mint>,

    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = owner,
    )]
    pub token_account: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = config,
    )]
    pub vault: Box<Account<'info, TokenAccount>>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

impl<'info> StakeToken<'info> {
    pub fn stake_token(&mut self, id: u64, amount: u64, bumps: &StakeTokenBumps) -> Result<()> {
        // Check if amount is valid
        if amount == 0 {
            return Err(StakingError::InvalidAmount.into());
        }

        // Get references to main accounts
        let config = &mut self.config;
        let pool = &mut self.pool;
        let user_pool_stats = &mut self.user_pool_stats;

        // Stake only if pool is not paused
        require!(!pool.is_paused, StakingError::PoolAlreadyPaused);

        // Calculate new per-pool token staked amount
        let new_pool_tokens_staked = user_pool_stats
            .tokens_staked
            .checked_add(amount)
            .ok_or(StakingError::ArithmeticOverflow)?;

        // Calculate new per-pool total value
        let new_pool_total_value = user_pool_stats
            .total_value
            .checked_add(amount)
            .ok_or(StakingError::ArithmeticOverflow)?;

        // Calculate new total staked value across all pools
        let new_user_total_value = self
            .user_account
            .total_staked_value
            .checked_add(amount)
            .ok_or(StakingError::ArithmeticOverflow)?;

        // Check user has not exceeded the pool's max token cap
        require!(
            new_pool_tokens_staked <= pool.max_tokens_cap,
            StakingError::UserTokensLimitCapReached
        );

        // Calculate new total value for the pool (current + amount being staked)
        let new_pool_total_tokens_staked = pool
            .total_tokens_staked
            .checked_add(amount)
            .ok_or(StakingError::ArithmeticOverflow)?;

        // Add the value from NFTs in the pool
        let nft_value = (pool.total_nfts_staked as u64)
            .checked_mul(config.nft_value_in_tokens)
            .ok_or(StakingError::ArithmeticOverflow)?;

        let total_pool_value = new_pool_total_tokens_staked
            .checked_add(nft_value)
            .ok_or(StakingError::ArithmeticOverflow)?;

        // Check if the new value exceeds the pool's max value cap
        require!(
            total_pool_value <= pool.max_value_cap,
            StakingError::PoolValueLimitReached
        );

        // Create a position for the staked tokens
        let position = &mut self.position;
        position.owner = self.owner.key();
        position.pool = pool.key();
        position.deposit_time = Clock::get()?.unix_timestamp;
        position.amount = amount;
        position.position_type = PositionType::Token;
        position.asset = self.mint.key();
        position.id = id;
        position.bump = bumps.position;
        position.last_claimed_at = Clock::get()?.unix_timestamp;

        // Calculate unlock time (current time + lock_time in seconds)
        let lock_days = pool.lock_period_days;
        position.unlock_time = Clock::get()?.unix_timestamp + (lock_days as i64 * 86400);
        position.status = PositionStatus::Unclaimed;

        // Transfer tokens from user to program
        anchor_spl::token::transfer(
            CpiContext::new(
                self.token_program.to_account_info(),
                anchor_spl::token::Transfer {
                    from: self.token_account.to_account_info(),
                    to: self.vault.to_account_info(),
                    authority: self.owner.to_account_info(),
                },
            ),
            amount,
        )?;

        // Update config's total staked amount
        let new_total = config
            .total_staked_amount
            .checked_add(amount)
            .ok_or(StakingError::ArithmeticOverflow)?;

        config.total_staked_amount = new_total;

        // Update pool statistics
        pool.total_tokens_staked = new_pool_total_tokens_staked;

        pool.lifetime_tokens_staked = pool
            .lifetime_tokens_staked
            .checked_add(amount)
            .ok_or(StakingError::ArithmeticOverflow)?;

        msg!(
            "pool_stats: lpd: {:?} | tns: {:?} | tss: {:?} | lns: {:?} | lts: {:?}",
            pool.lock_period_days,
            pool.total_nfts_staked,
            pool.total_tokens_staked,
            pool.lifetime_nfts_staked,
            pool.lifetime_tokens_staked
        );

        // Update user stats for this pool
        user_pool_stats.tokens_staked = new_pool_tokens_staked;
        user_pool_stats.total_value = new_pool_total_value;

        user_pool_stats.user = self.owner.key();
        user_pool_stats.pool = pool.key();

        user_pool_stats.bump = bumps.user_pool_stats;

        // Update global user stats
        let user_account = &mut self.user_account;
        user_account.total_staked_token_amount = user_account
            .total_staked_token_amount
            .checked_add(amount)
            .ok_or(StakingError::ArithmeticOverflow)?;

        user_account.total_staked_value = new_user_total_value;

        msg!(
            "user_account: tsta {:?} | tsv: {:?} | pool[{}].tokens_staked: {:?}",
            user_account.total_staked_token_amount,
            user_account.total_staked_value,
            pool.key(),
            pool.total_tokens_staked
        );

        Ok(())
    }
}
