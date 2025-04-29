use crate::state::*;
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
        seeds = [b"user", owner.key().as_ref(), config.key().as_ref()],
        bump = user_account.bump,
    )]
    pub user_account: Box<Account<'info, UserAccountV2>>,

    #[account(
        init,
        payer = owner,
        space = 8 + PositionV3::INIT_SPACE,
        seeds = [b"position", owner.key().as_ref(), mint.key().as_ref(), id.to_le_bytes().as_ref()],
        bump,
    )]
    pub position: Box<Account<'info, PositionV3>>,

    pub mint: Account<'info, Mint>,

    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = owner,
    )]
    pub token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = config,
    )]
    pub vault: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

impl<'info> StakeToken<'info> {
    pub fn stake_token(
        &mut self,
        id: u64,
        pool_index: u8,
        amount: u64,
        bumps: &StakeTokenBumps,
    ) -> Result<()> {
        // Check if amount is valid
        if amount == 0 {
            return Err(StakingError::InvalidAmount.into());
        }

        // Check if pool_index is valid
        require!(
            self.config.pools_config.len() > pool_index as usize,
            StakingError::InvalidLockPeriodAndYield
        );

        // Get a mutable reference to the config
        let config = &mut self.config;

        // Create a copy of the pool config for reading
        let pool_config = config.pools_config[pool_index as usize];

        // Check if pool_index is out of bounds for user pool stats
        require!(
            pool_index < self.user_account.pool_stats.len() as u8,
            StakingError::InvalidLockPeriodAndYield
        );

        // Stake only if pool is not paused
        require!(
            pool_config.is_paused == false,
            StakingError::PoolAlreadyPaused
        );

        // Calculate new per-pool token staked amount
        let new_pool_tokens_staked = self.user_account.pool_stats[pool_index as usize]
            .tokens_staked
            .checked_add(amount)
            .ok_or(StakingError::ArithmeticOverflow)?;

        // Calculate new per-pool total value
        let new_pool_total_value = self.user_account.pool_stats[pool_index as usize]
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
            new_pool_tokens_staked <= pool_config.max_tokens_cap,
            StakingError::UserTokensLimitCapReached
        );

        // Create a position for the staked tokens
        let position = &mut self.position;
        position.owner = self.owner.key();
        position.deposit_time = Clock::get()?.unix_timestamp;
        position.amount = position.amount.checked_add(amount).unwrap();
        position.position_type = PositionType::Token;
        position.lock_period_yield_index = pool_index;
        position.asset = self.system_program.key();
        position.id = id;
        position.bump = bumps.position;

        // Caclulate unlock time (curremt time + lock_time in seconds)
        // Use the days value directly from the pool config
        let lock_days = pool_config.lock_period_days;
        // IMPORTANT
        // lock_days
        // will
        // be
        // rerpesented in minutes

        position.unlock_time = Clock::get()?.unix_timestamp + (lock_days as i64 * 60);
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

        // if new_total > config.max_cap {
        //     return Err(StakingError::MaxCapReached.into());
        // }

        config.total_staked_amount = new_total;

        // Update pool stats directly in the array
        {
            // Create a scoped mutable reference to the pool stats
            let pool_stats = &mut config.pools_stats[pool_index as usize];

            // Update total tokens staked
            pool_stats.total_tokens_staked = pool_stats
                .total_tokens_staked
                .checked_add(amount)
                .ok_or(StakingError::ArithmeticOverflow)?;

            // Update lifetime tokens staked
            pool_stats.lifetime_tokens_staked = pool_stats
                .lifetime_tokens_staked
                .checked_add(amount)
                .ok_or(StakingError::ArithmeticOverflow)?;

            msg!(
                "pool_stats: lpd: {:?} | tns: {:?} | tss: {:?} | lns: {:?} | lts: {:?}",
                pool_stats.lock_period_days,
                pool_stats.total_nfts_staked,
                pool_stats.total_tokens_staked,
                pool_stats.lifetime_nfts_staked,
                pool_stats.lifetime_tokens_staked
            );
        } // The mutable borrow of pool_stats ends here

        // Update user stats
        let user_account = &mut self.user_account;

        // Update per-pool stats
        {
            // Create a scoped mutable reference to the user's pool stats
            let user_pool_stats = &mut user_account.pool_stats[pool_index as usize];

            // Update tokens staked in this pool
            user_pool_stats.tokens_staked = new_pool_tokens_staked;

            // Update total value in this pool
            user_pool_stats.total_value = new_pool_total_value;

            // Ensure lock period days is set correctly
            // user_pool_stats.lock_period_days = pool_config.lock_period_days;
        }

        // Update global user stats
        user_account.total_staked_token_amount = user_account
            .total_staked_token_amount
            .checked_add(amount)
            .ok_or(StakingError::ArithmeticOverflow)?;

        user_account.total_staked_value = new_user_total_value;

        msg!(
            "user_account: tsta {:?} | tsv: {:?} | pool[{}].tokens_staked: {:?}",
            user_account.total_staked_token_amount,
            user_account.total_staked_value,
            pool_index,
            user_account.pool_stats[pool_index as usize].tokens_staked
        );

        Ok(())
    }
}
