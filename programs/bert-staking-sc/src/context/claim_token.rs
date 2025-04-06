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
        has_one = nfts_vault,
        has_one = mint,
        has_one = collection,
        seeds = [b"config", config.authority.key().as_ref()],
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

    /// CHECK: TODO: Either check it's from collection or check against this account which is
    /// supposed to be in config also
    pub collection: UncheckedAccount<'info>,

    /// CHECK: TODO: Check it's from collection
    // pub nft_mint: Account<'info, Mint>,
    pub nft_mint: UncheckedAccount<'info>,

    /// Token mint.
    pub mint: Account<'info, Mint>,

    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = owner,
    )]
    pub token_account: Account<'info, TokenAccount>,

    // #[account(mut)]
    /// CHECK: TODO:
    pub nft_token_account: UncheckedAccount<'info>,

    #[account(mut)]
    /// CHECK: TODO: Add constraints!
    pub nfts_vault: UncheckedAccount<'info>,

    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = config,
    )]
    pub vault: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

impl<'info> ClaimPosition<'info> {
    pub fn claim_position(&mut self) -> Result<()> {
        // Check if position is unlocked
        let current_time = Clock::get()?.unix_timestamp;
        if current_time < self.position.unlock_time {
            return Err(StakingError::PositionLocked.into());
        }

        msg!("[claim_position] 1");
        msg!("position_amount: {:?}", self.position.amount);
        msg!("yeild_rte: {:?}", self.config.yield_rate);

        // Calculate yield based on position type and config
        let position_amount = self.position.amount;
        let yield_rate = self.config.yield_rate;
        let base_amount = position_amount;
        let yield_value = base_amount
            .checked_mul(yield_rate)
            .ok_or(StakingError::ArithmeticOverflow)?
            .checked_div(10000) // Basis points conversion (e.g., 500 = 5%)
            .ok_or(StakingError::ArithmeticOverflow)?;

        msg!("[claim_position] yield_value: {:?}", yield_value);

        let final_amount = base_amount
            .checked_add(yield_value)
            .ok_or(StakingError::ArithmeticOverflow)?;

        msg!("[claim_position] final_amount: {:?}", final_amount);

        // Transfer tokens back to user with yield
        let bump = self.config.bump;
        let authority = self.config.authority.key();
        let seeds = &[b"config".as_ref(), authority.as_ref(), &[bump]];
        let signer_seeds = &[&seeds[..]];

        if self.position.position_type == PositionType::NFT {
            // Transfer yield
            anchor_spl::token::transfer(
                CpiContext::new_with_signer(
                    self.token_program.to_account_info(),
                    anchor_spl::token::Transfer {
                        from: self.vault.to_account_info(),
                        to: self.token_account.to_account_info(),
                        authority: self.config.to_account_info(),
                    },
                    signer_seeds,
                ),
                final_amount,
            )?;

            // TODO Implement NFT Transfer
        } else {
            // For tokens, transfer the original amount plus yield
            anchor_spl::token::transfer(
                CpiContext::new_with_signer(
                    self.token_program.to_account_info(),
                    anchor_spl::token::Transfer {
                        from: self.vault.to_account_info(),
                        to: self.token_account.to_account_info(),
                        authority: self.config.to_account_info(),
                    },
                    signer_seeds,
                ),
                final_amount,
            )?;
        }

        msg!("[claim_position] 2");

        // Update position status to claimed
        let position = &mut self.position;
        position.status = PositionStatus::Claimed;

        // Update config's total staked amount
        let config = &mut self.config;
        config.total_staked_amount = config
            .total_staked_amount
            .checked_sub(position_amount)
            .ok_or(ProgramError::ArithmeticOverflow)?;

        Ok(())
    }
}
