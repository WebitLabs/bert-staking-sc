use anchor_lang::prelude::*;

mod context;
mod state;

use context::*;
use state::{LockPeriodYield, PositionType};

declare_id!("H4B2h3ypQtc1Pwzcskx7ApnSWGj9AeuN2q7WvkjvAgE2");

#[program]
pub mod bert_staking_sc {

    use super::*;

    pub fn initialize(
        ctx: Context<Initialize>,
        _id: u64,
        lock_period_yields: [LockPeriodYield; 4],
        max_cap: u64,
        nft_value_in_tokens: u64,
        nfts_limit_per_user: u8,
    ) -> Result<()> {
        ctx.accounts.initialize(
            lock_period_yields,
            max_cap,
            nft_value_in_tokens,
            nfts_limit_per_user,
            &ctx.bumps,
        )
    }

    pub fn initiate_position(
        ctx: Context<InitializePosition>,
        _id: u64,
        lock_period_yield_index: u8,
        position_type: PositionType,
    ) -> Result<()> {
        ctx.accounts
            .initialize_position(lock_period_yield_index, position_type, &ctx.bumps)
    }

    pub fn stake_nft(ctx: Context<StakeNFT>, _id: u64) -> Result<()> {
        ctx.accounts.stake_nft()
    }

    pub fn stake_token(ctx: Context<StakeToken>, _id: u64, amount: u64) -> Result<()> {
        ctx.accounts.stake_token(amount)
    }

    pub fn claim_position(ctx: Context<ClaimPosition>, _id: u64) -> Result<()> {
        ctx.accounts.claim_position()
    }
}
