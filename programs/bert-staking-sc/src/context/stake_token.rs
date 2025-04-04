use crate::state::*;
use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{Mint, Token, TokenAccount},
};

#[derive(Accounts)]
pub struct StakeToken<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        seeds = [b"config", config.authority.key().as_ref()],
        bump = config.bump,
    )]
    pub config: Account<'info, Config>,

    #[account(
        mut,
        seeds = [b"position", owner.key().as_ref(), token_mint.key().as_ref()],
        bump = position.bump,
    )]
    pub position: Account<'info, Position>,

    pub token_mint: Account<'info, Mint>,

    #[account(
        mut,
        associated_token::mint = token_mint,
        associated_token::authority = owner,
    )]
    pub token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        associated_token::mint = token_mint,
        associated_token::authority = config,
    )]
    pub vault: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

impl<'info> StakeToken<'info> {
    pub fn process(&mut self, amount: u64, period: LockPeriod) -> Result<()> {
        // Check if amount is valid
        if amount == 0 {
            return Err(StakingError::InvalidAmount.into());
        }

        // Check if period is valid
        if period != self.config.lock_period {
            return Err(StakingError::InvalidLockPeriod.into());
        }

        // Check if staking would exceed the max cap
        let new_total = self
            .config
            .total_staked_amount
            .checked_add(amount)
            .ok_or(StakingError::ArithmeticOverflow)?;

        if new_total > self.config.max_cap {
            return Err(StakingError::MaxCapReached.into());
        }

        // Create a position for the staked tokens
        let position = &mut self.position;
        position.deposit_time = Clock::get()?.unix_timestamp;
        position.amount = position.amount.checked_add(amount).unwrap();
        position.position_type = PositionType::Token;

        // Calculate unlock time (current time + lock_time in seconds)
        // lock_time is in days, convert to seconds
        let lock_days = match self.config.lock_period {
            LockPeriod::OneDay => 1,
            LockPeriod::ThreeDays => 3,
            LockPeriod::SevenDays => 7,
            LockPeriod::ThirtyDays => 30,
        };
        position.unlock_time = Clock::get()?.unix_timestamp + (lock_days * 24 * 60 * 60);

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
        let config = &mut self.config;
        config.total_staked_amount = new_total;

        Ok(())
    }
}
