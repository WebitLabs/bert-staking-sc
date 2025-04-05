use crate::state::*;
use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{Mint, Token, TokenAccount},
};

#[derive(Accounts)]
pub struct ClaimPosition<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        mut,
        has_one = mint,
        seeds = [b"config"],
        bump = config.bump,
    )]
    pub config: Account<'info, Config>,

    #[account(
        mut,
        seeds = [b"position", owner.key().as_ref(), mint.key().as_ref()],
        bump = position.bump,
        constraint = position.owner == owner.key(),
        constraint = position.status == PositionStatus::Unclaimed,
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
        associated_token::authority = program_authority,
    )]
    pub program_token_account: Account<'info, TokenAccount>,

    /// CHECK: This is the PDA that owns the staked tokens
    #[account(
        seeds = [b"authority"], //TODO: fix
        bump,
    )]
    pub program_authority: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

impl<'info> ClaimPosition<'info> {
    pub fn claim_position(&mut self, _bumps: &ClaimPositionBumps) -> Result<()> {
        Ok(())
    }

    // pub fn claim_position(&mut self, bumps: &ClaimPositionBumps) -> Result<()> {
    //     // Check if position is unlocked
    //     let current_time = Clock::get()?.unix_timestamp;
    //     if current_time < self.position.unlock_time {
    //         return Err(StakingError::PositionLocked.into());
    //     }
    //
    //     // Calculate yield based on position type and config
    //     let position_amount = self.position.amount;
    //     let yield_amount = match self.position.position_type {
    //         PositionType::NFT => {
    //             // For NFTs, we return the fixed value plus yield
    //             let yield_rate = self.config.yield_rate;
    //             let base_amount = position_amount; // NFT value in tokens
    //             let yield_value = base_amount
    //                 .checked_mul(yield_rate)
    //                 .ok_or(StakingError::ArithmeticOverflow)?
    //                 .checked_div(10000) // Basis points conversion (e.g., 500 = 5%)
    //                 .ok_or(StakingError::ArithmeticOverflow)?;
    //
    //             base_amount
    //                 .checked_add(yield_value)
    //                 .ok_or(StakingError::ArithmeticOverflow)?
    //         }
    //         PositionType::Token => {
    //             // For tokens, we return the staked amount plus yield
    //             let yield_rate = self.config.yield_rate;
    //             let base_amount = position_amount;
    //             let yield_value = base_amount
    //                 .checked_mul(yield_rate)
    //                 .ok_or(StakingError::ArithmeticOverflow)?
    //                 .checked_div(10000) // Basis points conversion (e.g., 500 = 5%)
    //                 .ok_or(StakingError::ArithmeticOverflow)?;
    //
    //             base_amount
    //                 .checked_add(yield_value)
    //                 .ok_or(StakingError::ArithmeticOverflow)?
    //         }
    //     };
    //
    //     // Transfer tokens back to user with yield
    //     let bump = bumps.program_authority; // TODO fix
    //     let seeds = &[b"authority".as_ref(), &[bump]];
    //     let signer = &[&seeds[..]];
    //
    //     if self.position.position_type == PositionType::NFT {
    //
    //         // Transfer yield
    //
    //         // TODO Implement NFT Transfer
    //     } else {
    //         // For tokens, transfer the original amount plus yield
    //         anchor_spl::token::transfer(
    //             CpiContext::new_with_signer(
    //                 self.token_program.to_account_info(),
    //                 anchor_spl::token::Transfer {
    //                     from: self.program_token_account.to_account_info(),
    //                     to: self.token_account.to_account_info(),
    //                     authority: self.program_authority.to_account_info(),
    //                 },
    //                 signer,
    //             ),
    //             yield_amount,
    //         )?;
    //     }
    //
    //     // Update position status to claimed
    //     let position = &mut self.position;
    //     position.status = PositionStatus::Claimed;
    //
    //     // Update config's total staked amount
    //     let config = &mut self.config;
    //     config.total_staked_amount = config
    //         .total_staked_amount
    //         .checked_sub(position_amount)
    //         .ok_or(ProgramError::ArithmeticOverflow)?;
    //
    //     Ok(())
    // }
}
