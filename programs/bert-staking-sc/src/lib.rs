use anchor_lang::prelude::*;

mod context;
mod state;

use context::*;
use state::{LockPeriod, PositionType};

declare_id!("H4B2h3ypQtc1Pwzcskx7ApnSWGj9AeuN2q7WvkjvAgE2");

#[program]
pub mod bert_staking_sc {

    use super::*;

    pub fn initialize(
        ctx: Context<Initialize>,
        lock_period: LockPeriod,
        yield_rate: u64,
        max_cap: u64,
        nft_value_in_tokens: u64,
        nfts_limit_per_user: u8,
    ) -> Result<()> {
        ctx.accounts.initialize(
            lock_period,
            yield_rate,
            max_cap,
            nft_value_in_tokens,
            nfts_limit_per_user,
            &ctx.bumps,
        )
    }

    pub fn initiate_position(ctx: Context<InitializePosition>) -> Result<()> {
        ctx.accounts.process(&ctx.bumps)
    }

    pub fn stake_nft(ctx: Context<StakeNFT>) -> Result<()> {
        ctx.accounts.stake(&ctx.bumps)
    }

    pub fn stake_token(
        ctx: Context<StakeToken>,
        amount: u64,
        lock_period: LockPeriod,
    ) -> Result<()> {
        ctx.accounts.process(amount, lock_period)
    }

    pub fn claim_position(ctx: Context<ClaimPosition>) -> Result<()> {
        ctx.accounts.claim_position(&ctx.bumps)
    }
}
