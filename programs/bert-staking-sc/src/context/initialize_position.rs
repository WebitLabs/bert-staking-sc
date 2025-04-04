use crate::state::*;
use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{Mint, TokenInterface},
};

#[derive(Accounts)]
pub struct InitializePosition<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        seeds = [b"config", config.authority.key().as_ref()],
        bump = config.bump,
    )]
    pub config: Account<'info, Config>,

    #[account(
        init,
        payer = owner,
        space = 8 + Position::INIT_SPACE,
        seeds = [b"position", owner.key().as_ref(), token_mint.key().as_ref()],
        bump
    )]
    pub position: Account<'info, Position>,

    pub token_mint: InterfaceAccount<'info, Mint>,

    pub system_program: Program<'info, System>,
    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub rent: Sysvar<'info, Rent>,
}

impl<'info> InitializePosition<'info> {
    pub fn process(&mut self, bumps: &InitializePositionBumps) -> Result<()> {
        // Create a position
        let position = &mut self.position;
        position.owner = self.owner.key();
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

        position.status = PositionStatus::Unclaimed;
        position.nft_mint = Pubkey::default(); // Not applicable for token positions

        position.bump = bumps.position;

        Ok(())
    }
}

