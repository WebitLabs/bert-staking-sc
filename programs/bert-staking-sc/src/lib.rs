#![allow(unexpected_cfgs)]
use anchor_lang::prelude::*;

mod context;
mod state;

use context::*;
use state::*;

declare_id!("G4ZJJ4vytqbUsUiGst52seNZ48t2EQMxJ6eQ4sQcBrYZ");

#[program]
pub mod bert_staking_sc {

    use super::*;

    pub fn initialize(
        ctx: Context<Initialize>,
        id: u64,
        lock_period_yields: [PoolConfig; 4],
        max_cap: u64,
        nft_value_in_tokens: u64,
        nfts_limit_per_user: u8,
    ) -> Result<()> {
        ctx.accounts.initialize(
            id,
            lock_period_yields,
            max_cap,
            nft_value_in_tokens,
            nfts_limit_per_user,
            &ctx.bumps,
        )
    }

    pub fn initiate_user(ctx: Context<InitializeUser>) -> Result<()> {
        ctx.accounts.initialize_user(&ctx.bumps)
    }

    pub fn stake_nft(ctx: Context<StakeNFT>, pool_index: u8) -> Result<()> {
        ctx.accounts.stake_nft(pool_index, &ctx.bumps)
    }

    pub fn stake_token(
        ctx: Context<StakeToken>,
        id: u64,
        pool_index: u8,
        amount: u64,
    ) -> Result<()> {
        ctx.accounts.stake_token(id, pool_index, amount, &ctx.bumps)
    }

    pub fn claim_position_nft(ctx: Context<ClaimPositionNft>) -> Result<()> {
        ctx.accounts.claim_nft()
    }

    pub fn claim_position_token(ctx: Context<ClaimPositionToken>) -> Result<()> {
        ctx.accounts.claim_token()
    }
}
