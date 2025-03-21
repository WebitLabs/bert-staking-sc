use anchor_lang::prelude::*;

mod context;
mod state;

use context::*;

declare_id!("H4B2h3ypQtc1Pwzcskx7ApnSWGj9AeuN2q7WvkjvAgE2");

#[program]
pub mod bert_staking_sc {
    use super::*;

    pub fn initialize(
        ctx: Context<Initialize>,
        lock_time: u64,
        yield_rate: u64,
        max_cap: u64,
        nft_value_in_tokens: u64,
        nfts_limit_per_user: u8,
    ) -> Result<()> {
        ctx.accounts.initialize(
            lock_time,
            yield_rate,
            max_cap,
            nft_value_in_tokens,
            nfts_limit_per_user,
            &ctx.bumps,
        )
    }

    pub fn stake_nft(ctx: Context<StakeNFT>) -> Result<()> {
        ctx.accounts.stake(&ctx.bumps)
    }

    pub fn stake_token(ctx: Context<StakeToken>, amount: u64) -> Result<()> {
        ctx.accounts.process(amount, &ctx.bumps)
    }

    pub fn claim_position(ctx: Context<ClaimPosition>) -> Result<()> {
        ctx.accounts.claim_position(&ctx.bumps)
    }
}

