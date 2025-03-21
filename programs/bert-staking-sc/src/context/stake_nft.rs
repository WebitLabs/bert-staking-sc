use crate::state::*;
use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{Mint, Token, TokenAccount},
};

#[derive(Accounts)]
pub struct StakeNFT<'info> {
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
        space = 8 + Position::INIT_SPACE,
        seeds = [b"position", owner.key().as_ref(), nft_mint.key().as_ref()],
        bump,
    )]
    pub position: Account<'info, Position>,

    pub nft_mint: Account<'info, Mint>,

    #[account(
        mut,
        associated_token::mint = nft_mint,
        associated_token::authority = owner,
    )]
    pub nft_token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        associated_token::mint = nft_mint,
        associated_token::authority = program_authority,
    )]
    pub program_nft_account: Account<'info, TokenAccount>,

    /// CHECK: This is the PDA that will own the NFT while staked
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

impl<'info> StakeNFT<'info> {
    pub fn stake(&mut self, bumps: &StakeNFTBumps) -> Result<()> {
        // Check NFT limit per user
        // TODO: Add check for NFT limit per user

        // Create a position for the staked NFT
        let position = &mut self.position;
        position.owner = self.owner.key();
        position.deposit_time = Clock::get()?.unix_timestamp;
        position.amount = self.config.nft_value_in_tokens;
        position.position_type = PositionType::NFT;

        // Calculate unlock time (current time + lock_time in seconds)
        // lock_time is in days, convert to seconds
        position.unlock_time =
            Clock::get()?.unix_timestamp + (self.config.lock_time as i64 * 24 * 60 * 60);

        position.status = PositionStatus::Unclaimed;
        position.nft_mint = self.nft_mint.key();
        position.bump = bumps.position;

        // TODO: Transfer NFT from user to program

        // Update config's total staked amount
        let config = &mut self.config;
        config.total_staked_amount = config
            .total_staked_amount
            .checked_add(position.amount)
            .ok_or(ProgramError::ArithmeticOverflow)?;

        Ok(())
    }
}

