use crate::state::*;
use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{Mint, Token},
};

#[derive(Accounts)]
pub struct StakeNFT<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        has_one = nfts_vault,
        has_one = mint,
        has_one = collection,
        seeds = [b"config", config.authority.key().as_ref()],
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

    pub mint: Account<'info, Mint>,

    /// CHECK: TODO: Either check it's from collection or check against this account which is
    /// supposed to be in config also
    pub collection: UncheckedAccount<'info>,

    /// CHECK: TODO: Check it's from collection
    pub nft_mint: Account<'info, Mint>,

    #[account(mut)]
    /// CHECK: TODO:
    pub nft_token_account: UncheckedAccount<'info>,

    #[account(mut)]
    /// CHECK: TODO: Add constraints!
    pub nfts_vault: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

impl<'info> StakeNFT<'info> {
    pub fn stake_nft(&mut self) -> Result<()> {
        let amount = self.config.nft_value_in_tokens;

        if self.position.nft_index >= self.config.nfts_limit_per_user {
            return Err(StakingError::MaxCapReached.into());
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
        position.position_type = PositionType::NFT;

        // =====================
        // TODO: Transfer tokens from user to program nfts vault
        // =====================

        // Push nft mint into array
        let position = &mut self.position;
        let index = position.nft_index as usize;
        let nft_mints = &mut position.nft_mints;
        nft_mints[index] = self.nft_mint.key();
        position.nft_index = index as u8 + 1;

        // Update config's total staked amount
        let config = &mut self.config;
        config.total_staked_amount = new_total;

        Ok(())
    }
}
