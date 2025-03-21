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
        seeds = [b"config"],
        bump = config.bump,
    )]
    pub config: Account<'info, Config>,

    #[account(
        init,
        payer = owner,
        space = Position::INIT_SPACE,
        seeds = [b"position", owner.key().as_ref(), token_mint.key().as_ref()],
        bump,
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
        associated_token::authority = program_authority,
    )]
    pub program_token_account: Account<'info, TokenAccount>,

    /// CHECK: This is the PDA that will own the tokens while staked
    #[account(
        seeds = [b"authority"],
        bump,
    )]
    pub program_authority: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

impl<'info> StakeToken<'info> {
    pub fn process(&mut self, amount: u64, bumps: &StakeTokenBumps) -> Result<()> {
        // Check if amount is valid
        if amount == 0 {
            return Err(StakingError::InvalidAmount.into());
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
        position.owner = self.owner.key();
        position.deposit_time = Clock::get()?.unix_timestamp;
        position.amount = amount;
        position.position_type = PositionType::Token;

        // Calculate unlock time (current time + lock_time in seconds)
        // lock_time is in days, convert to seconds
        position.unlock_time =
            Clock::get()?.unix_timestamp + (self.config.lock_time as i64 * 24 * 60 * 60);

        position.status = PositionStatus::Unclaimed;
        position.nft_mint = Pubkey::default(); // Not applicable for token positions
        position.bump = bumps.position;

        // Transfer tokens from user to program
        anchor_spl::token::transfer(
            CpiContext::new(
                self.token_program.to_account_info(),
                anchor_spl::token::Transfer {
                    from: self.token_account.to_account_info(),
                    to: self.program_token_account.to_account_info(),
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

