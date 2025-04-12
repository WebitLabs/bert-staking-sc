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
    pub user_account: Box<Account<'info, UserAccount>>,

    #[account(
        init,
        payer = owner,
        space = 8 + PositionV2::INIT_SPACE,
        seeds = [b"position", owner.key().as_ref(), mint.key().as_ref(), id.to_le_bytes().as_ref()],
        bump,
    )]
    pub position: Box<Account<'info, PositionV2>>,

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
    pub fn stake_token(&mut self, pool_index: u8, amount: u64) -> Result<()> {
        // Check if amount is valid
        if amount == 0 {
            return Err(StakingError::InvalidAmount.into());
        }

        // Check if pool_index is valid
        require!(
            self.config.pools_config.len() > pool_index as usize,
            StakingError::InvalidLockPeriodAndYield
        );

        let config = &mut self.config;
        let pool_config = config.pools_config[pool_index as usize];
        let mut pool_stats = config.pools_stats[pool_index as usize];

        // Check if staking would exceed the max cap / user / pool
        let new_pool_total_staked = pool_stats
            .total_tokens_staked
            .checked_add(amount)
            .ok_or(StakingError::ArithmeticOverflow)?;

        // Check user has not exceed its caps
        require!(
            new_pool_total_staked > pool_config.max_tokens_cap,
            StakingError::UserTokensLimitCapReached
        );

        // Check if staking would exceed the max cap
        let new_total = config
            .total_staked_amount
            .checked_add(amount)
            .ok_or(StakingError::ArithmeticOverflow)?;

        if new_total > config.max_cap {
            return Err(StakingError::MaxCapReached.into());
        }

        // Create a position for the staked tokens
        let position = &mut self.position;
        position.deposit_time = Clock::get()?.unix_timestamp;
        position.amount = position.amount.checked_add(amount).unwrap();
        position.position_type = PositionType::Token;
        position.lock_period_yield_index = pool_index;

        // Caclulate unlock time (curremt time + lock_time in seconds)
        let lock_days = match pool_config.lock_period {
            LockPeriod::OneDay => 1,
            LockPeriod::ThreeDays => 3,
            LockPeriod::SevenDays => 7,
            LockPeriod::ThirtyDays => 30,
        };
        position.unlock_time = Clock::get()?.unix_timestamp + (lock_days * 24 * 60 * 60);
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
        config.total_staked_amount = new_total;

        // Update pool config
        pool_stats.total_tokens_staked = new_pool_total_staked;
        pool_stats.lifetime_tokens_staked = pool_stats
            .lifetime_tokens_staked
            .checked_add(amount)
            .ok_or(StakingError::ArithmeticOverflow)?;

        // Update user stats
        let user_account = &mut self.user_account;
        user_account
            .total_staked_token_amount
            .checked_add(amount)
            .ok_or(StakingError::ArithmeticOverflow)?;
        user_account
            .total_staked_value
            .checked_add(amount)
            .ok_or(StakingError::ArithmeticOverflow)?;

        Ok(())
    }
}
