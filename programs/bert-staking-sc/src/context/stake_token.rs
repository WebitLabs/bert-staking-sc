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
    pub config: Account<'info, Config>,

    #[account(
        mut,
        seeds = [b"position", owner.key().as_ref(), mint.key().as_ref(), id.to_le_bytes().as_ref()],
        bump = position.bump,
    )]
    pub position: Account<'info, Position>,

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
    pub fn stake_token(&mut self, amount: u64) -> Result<()> {
        // Check if amount is valid
        if amount == 0 {
            return Err(StakingError::InvalidAmount.into());
        }

        let index = self.position.lock_period_yield_index;
        // Check if period and yield index is valid
        require!(
            self.config.lock_period_yields.len() > index as usize,
            StakingError::InvalidLockPeriodAndYield
        );

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
