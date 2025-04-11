use crate::state::*;
use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{Mint, TokenInterface},
};

#[derive(Accounts)]
#[instruction(id: u64)]
pub struct InitializePosition<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        has_one = mint,
        seeds = [b"config", config.authority.key().as_ref(), config.id.to_le_bytes().as_ref()],
        bump = config.bump,
    )]
    pub config: Account<'info, Config>,

    #[account(
        init,
        payer = owner,
        space = 8 + PositionV2::INIT_SPACE,
        seeds = [b"position", owner.key().as_ref(), mint.key().as_ref(), id.to_le_bytes().as_ref()],
        bump
    )]
    pub position: Account<'info, PositionV2>,

    pub mint: InterfaceAccount<'info, Mint>,

    pub system_program: Program<'info, System>,
    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub rent: Sysvar<'info, Rent>,
}

impl<'info> InitializePosition<'info> {
    pub fn initialize_position(
        &mut self,
        lock_period_yield_index: u8,
        position_type: PositionType,
        bumps: &InitializePositionBumps,
    ) -> Result<()> {
        // Check if position is valid
        if position_type != PositionType::Token && position_type != PositionType::NFT {
            return Err(StakingError::InvalidPositionType.into());
        }

        msg!(
            "[initialize_position] with index: {:?} | type: {:?}",
            lock_period_yield_index,
            position_type
        );

        // Check if period and yield index is valid
        require!(
            self.config.lock_period_yields.len() > lock_period_yield_index as usize,
            StakingError::InvalidLockPeriodAndYield
        );

        // Create a position
        let position = &mut self.position;
        position.owner = self.owner.key();
        position.position_type = PositionType::Token;
        position.lock_period_yield_index = lock_period_yield_index;

        let lock_period_yield = self.config.lock_period_yields[lock_period_yield_index as usize];

        // Calculate unlock time (current time + lock_time in seconds)
        // lock_time is in days, convert to seconds
        let lock_days = match lock_period_yield.lock_period {
            LockPeriod::OneDay => 1,
            LockPeriod::ThreeDays => 3,
            LockPeriod::SevenDays => 7,
            LockPeriod::ThirtyDays => 30,
        };
        position.unlock_time = Clock::get()?.unix_timestamp + (lock_days * 24 * 60 * 60);

        position.status = PositionStatus::Unclaimed;
        position.nft_mints = [Pubkey::default(); 5];

        position.bump = bumps.position;

        Ok(())
    }
}
