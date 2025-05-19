#![allow(unexpected_cfgs)]
use anchor_lang::prelude::*;

mod admin;
mod context;
mod state;

use admin::*;
use context::*;
use state::*;

// declare_id!("G4ZJJ4vytqbUsUiGst52seNZ48t2EQMxJ6eQ4sQcBrYZ");
declare_id!("5SBAWmpeag75vcgPvnSxbibQQoKguZaa5KDdR8TBjC1N");

// Re-export StakingError for use in the program
pub use state::StakingError;

#[program]
pub mod bert_staking_sc {

    use super::*;

    pub fn initialize(
        ctx: Context<Initialize>,
        id: u64,
        max_cap: u64,
        nft_value_in_tokens: u64,
        nfts_limit_per_user: u8,
    ) -> Result<()> {
        ctx.accounts.initialize(
            id,
            max_cap,
            nft_value_in_tokens,
            nfts_limit_per_user,
            &ctx.bumps,
        )
    }

    pub fn initialize_auth_vault(ctx: Context<InitializeAuthVault>) -> Result<()> {
        ctx.accounts.initialize_auth_vault(&ctx.bumps)
    }

    pub fn initiate_user(ctx: Context<InitializeUser>) -> Result<()> {
        ctx.accounts.initialize_user(&ctx.bumps)
    }

    pub fn initialize_pool(
        ctx: Context<InitializePool>,
        index: u32,
        lock_period_days: u16,
        yield_rate: u64,
        max_nfts_cap: u32,
        max_tokens_cap: u64,
        max_value_cap: u64,
    ) -> Result<()> {
        ctx.accounts.initialize(
            index,
            lock_period_days,
            yield_rate,
            max_nfts_cap,
            max_tokens_cap,
            max_value_cap,
            &ctx.bumps,
        )
    }

    // pub fn initialize_user_pool_stats(ctx: Context<InitializeUserPoolStats>) -> Result<()> {
    //     ctx.accounts
    //         .initialize(*ctx.bumps.get("user_pool_stats").unwrap())
    // }

    pub fn stake_nft(ctx: Context<StakeNFT>, id: u64) -> Result<()> {
        ctx.accounts.stake_nft(id, &ctx.bumps)
    }

    pub fn stake_token(ctx: Context<StakeToken>, id: u64, amount: u64) -> Result<()> {
        ctx.accounts.stake_token(id, amount, &ctx.bumps)
    }

    pub fn claim_position_nft(ctx: Context<ClaimPositionNft>) -> Result<()> {
        ctx.accounts.claim_nft()
    }

    pub fn claim_position_token(ctx: Context<ClaimPositionToken>) -> Result<()> {
        ctx.accounts.claim_token()
    }

    pub fn admin_pause_pool(ctx: Context<AdminSetPoolConfig>) -> Result<()> {
        ctx.accounts.admin_pause_pool()
    }

    pub fn admin_activate_pool(ctx: Context<AdminSetPoolConfig>) -> Result<()> {
        ctx.accounts.admin_activate_pool()
    }

    pub fn admin_withdraw_tokens(ctx: Context<AdminWithdrawToken>, amount: u64) -> Result<()> {
        ctx.accounts.admin_withdraw_token(amount)
    }

    pub fn admin_set_pool_config(
        ctx: Context<AdminSetPoolConfig>,
        config_params: PoolConfigArgs,
    ) -> Result<()> {
        ctx.accounts.admin_set_pool_config(config_params)
    }
}
