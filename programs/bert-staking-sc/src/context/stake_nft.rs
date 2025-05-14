use crate::{state::*, StakingError};
use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{Mint, Token},
};

use mpl_core::{
    accounts::{BaseAssetV1, BaseCollectionV1},
    instructions::TransferV1CpiBuilder,
    types::UpdateAuthority,
    ID as CORE_PROGRAM_ID,
};

#[derive(Accounts)]
#[instruction(id: u64)]
pub struct StakeNFT<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        mut,
        has_one = mint,
        has_one = collection,
        seeds = [b"config", config.authority.key().as_ref(), config.id.to_le_bytes().as_ref()],
        bump = config.bump,
    )]
    pub config: Box<Account<'info, Config>>,

    #[account(
        mut,
        seeds = [
            b"pool", 
            config.key().as_ref(),
            &pool.index.to_le_bytes(),
        ],
        bump = pool.bump,
    )]
    pub pool: Box<Account<'info, Pool>>,

    #[account(
        mut,
        seeds = [b"user", owner.key().as_ref(), config.key().as_ref()],
        bump = user_account.bump,
    )]
    pub user_account: Box<Account<'info, UserAccountV3>>,

    #[account(
        init_if_needed,
        payer = owner,
        space = 8 + UserPoolStatsAccount::INIT_SPACE,
        seeds = [
            b"user_pool_stats",
            owner.key().as_ref(),
            pool.key().as_ref(),
        ],
        bump
    )]
    pub user_pool_stats: Box<Account<'info, UserPoolStatsAccount>>,

    #[account(
        init,
        payer = owner,
        space = 8 + PositionV4::INIT_SPACE,
        seeds = [b"position", owner.key().as_ref(), mint.key().as_ref(), asset.key().as_ref(), id.to_le_bytes().as_ref()],
        bump,
    )]
    pub position: Box<Account<'info, PositionV4>>,

    #[account(
        mut,
        has_one = owner,
        constraint = asset.update_authority == UpdateAuthority::Collection(collection.key()),
    )]
    pub asset: Box<Account<'info, BaseAssetV1>>,

    ///CHECK: UNUSED!
    pub nft_vault_owner: UncheckedAccount<'info>,

    #[account(mut)]
    pub collection: Box<Account<'info, BaseCollectionV1>>,

    #[account(address = CORE_PROGRAM_ID)]
    /// CHECK: this will be checked by core
    pub core_program: UncheckedAccount<'info>,

    pub mint: Account<'info, Mint>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

impl<'info> StakeNFT<'info> {
    pub fn stake_nft(&mut self, id: u64, bumps: &StakeNFTBumps) -> Result<()> {
        let config_account_info = &self.config.to_account_info().clone();
        let config = &mut self.config;
        let pool = &mut self.pool;
        let user_pool_stats = &mut self.user_pool_stats;

        // Stake only if pool is not paused
        require!(!pool.is_paused, StakingError::PoolAlreadyPaused);

        // Calculate new per-pool NFT count
        let new_pool_nfts_staked = user_pool_stats
            .nfts_staked
            .checked_add(1)
            .ok_or(StakingError::ArithmeticOverflow)?;

        // Calculate new per-pool total value
        let new_pool_total_value = user_pool_stats
            .total_value
            .checked_add(config.nft_value_in_tokens)
            .ok_or(StakingError::ArithmeticOverflow)?;

        // Calculate new total staked value across all pools
        let new_user_total_value = self
            .user_account
            .total_staked_value
            .checked_add(config.nft_value_in_tokens)
            .ok_or(StakingError::ArithmeticOverflow)?;

        // Check user has not exceed the pool's token value cap
        require!(
            new_pool_total_value <= pool.max_tokens_cap,
            StakingError::UserTokensLimitCapReached
        );

        // Calculate total NFTs staked across all pools
        let new_user_nfts_staked = self
            .user_account
            .total_staked_nfts
            .checked_add(1)
            .ok_or(StakingError::ArithmeticOverflow)?;

        // Check user has not exceed the pool's NFT cap
        require!(
            new_pool_nfts_staked <= pool.max_nfts_cap,
            StakingError::NftLimitReached
        );

        // Check if staking would exceed the max cap
        let new_total = config
            .total_staked_amount
            .checked_add(config.nft_value_in_tokens)
            .ok_or(StakingError::ArithmeticOverflow)?;

        // Create a position for the staked tokens
        let position = &mut self.position;
        position.owner = self.owner.key();
        position.pool = pool.key();
        position.deposit_time = Clock::get()?.unix_timestamp;
        position.amount = config.nft_value_in_tokens;
        position.position_type = PositionType::NFT;
        position.asset = self.asset.key();
        position.id = id;
        position.bump = bumps.position;
        position.last_claimed_at = Clock::get()?.unix_timestamp;

        // Calculate unlock time (current time + lock_time in seconds)
        let lock_days = pool.lock_period_days;
        position.unlock_time = Clock::get()?.unix_timestamp + (lock_days as i64 * 60); // Convert days to seconds
        position.status = PositionStatus::Unclaimed;

        // Transfer The asset:
        TransferV1CpiBuilder::new(&self.core_program.to_account_info())
            .asset(&self.asset.to_account_info())
            .payer(&self.owner.to_account_info())
            .collection(Some(&self.collection.to_account_info()))
            .new_owner(&config_account_info)
            .invoke()?;

        // Update config's total staked amount
        config.total_staked_amount = new_total;

        // Update pool statistics
        pool.total_nfts_staked = pool
            .total_nfts_staked
            .checked_add(1)
            .ok_or(StakingError::ArithmeticOverflow)?;

        pool.lifetime_nfts_staked = pool
            .lifetime_nfts_staked
            .checked_add(1)
            .ok_or(StakingError::ArithmeticOverflow)?;

        msg!(
            "pool_stats: lpd: {:?} | tns: {:?} | tss: {:?} | lns: {:?} | lts: {:?}",
            pool.lock_period_days,
            pool.total_nfts_staked,
            pool.total_tokens_staked,
            pool.lifetime_nfts_staked,
            pool.lifetime_tokens_staked
        );

        // Update user pool stats
        user_pool_stats.nfts_staked = new_pool_nfts_staked;
        user_pool_stats.total_value = new_pool_total_value;

        user_pool_stats.user = self.owner.key();
        user_pool_stats.pool = pool.key();

        user_pool_stats.bump = bumps.user_pool_stats;

        // Update global user stats
        let user_account = &mut self.user_account;
        user_account.total_staked_nfts = new_user_nfts_staked;
        user_account.total_staked_value = new_user_total_value;

        msg!(
            "user_account: tsv: {:?} | tsn: {:?} | pool: {:?}.nfts_staked: {:?}",
            user_account.total_staked_value,
            user_account.total_staked_nfts,
            pool.key(),
            user_pool_stats.nfts_staked
        );

        Ok(())
    }
}
