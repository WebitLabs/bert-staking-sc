use crate::state::*;
use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{Mint, Token},
};

use mpl_core::{
    accounts::{BaseAssetV1, BaseCollectionV1},
    fetch_plugin,
    instructions::{AddPluginV1CpiBuilder, TransferV1CpiBuilder, UpdatePluginV1CpiBuilder},
    types::{Attribute, Attributes, FreezeDelegate, Plugin, PluginAuthority, UpdateAuthority},
    ID as CORE_PROGRAM_ID,
};

#[derive(Accounts)]
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
        seeds = [b"user", owner.key().as_ref(), config.key().as_ref()],
        bump = user_account.bump,
    )]
    pub user_account: Box<Account<'info, UserAccount>>,

    #[account(
        init,
        payer = owner,
        space = 8 + PositionV2::INIT_SPACE,
        seeds = [b"position", owner.key().as_ref(), mint.key().as_ref(), asset.key().as_ref()],
        bump,
    )]
    pub position: Box<Account<'info, PositionV2>>,

    /// CHECK: Will be
    // pub update_authority: UncheckedAccount<'info>,

    // #[account(mut)]
    // pub payer: Signer<'info>,

    #[account(
        mut,
        has_one = owner,
        constraint = asset.update_authority == UpdateAuthority::Collection(collection.key()),
    )]
    pub asset: Account<'info, BaseAssetV1>,

    ///CHECK: UNUSED!
    // #[account(mut)]
    pub nft_vault_owner: UncheckedAccount<'info>,

    #[account(mut)]
    pub collection: Account<'info, BaseCollectionV1>,

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
    pub fn stake_nft(&mut self, pool_index: u8, bumps: &StakeNFTBumps) -> Result<()> {
        // Check if pool_index is valid
        require!(
            self.config.pools_config.len() > pool_index as usize,
            StakingError::InvalidLockPeriodAndYield
        );

        let config_account_info = &self.config.to_account_info().clone();
        let config = &mut self.config;
        let pool_config = config.pools_config[pool_index as usize];

        // Check if pool_index is out of bounds for user pool stats
        require!(
            pool_index < self.user_account.pool_stats.len() as u8,
            StakingError::InvalidLockPeriodAndYield
        );

        // Calculate new per-pool NFT count
        let new_pool_nfts_staked = self.user_account.pool_stats[pool_index as usize]
            .nfts_staked
            .checked_add(1)
            .ok_or(StakingError::ArithmeticOverflow)?;

        // Calculate new per-pool total value
        let new_pool_total_value = self.user_account.pool_stats[pool_index as usize]
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
            new_pool_total_value <= pool_config.max_tokens_cap,
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
            new_pool_nfts_staked <= pool_config.max_nfts_cap,
            StakingError::NftLimitReached
        );

        // Check if staking would exceed the max cap
        let new_total = config
            .total_staked_amount
            .checked_add(config.nft_value_in_tokens)
            .ok_or(StakingError::ArithmeticOverflow)?;

        // if new_total > config.max_cap {
        //     return Err(StakingError::MaxCapReached.into());
        // }

        // Create a position for the staked tokens
        let position = &mut self.position;
        position.owner = self.owner.key();
        position.deposit_time = Clock::get()?.unix_timestamp;
        position.amount = config.nft_value_in_tokens;
        position.position_type = PositionType::NFT;
        position.lock_period_yield_index = pool_index;
        position.asset = self.asset.key();
        position.bump = bumps.position;

        // Caclulate unlock time (curremt time + lock_time in seconds)
        // Use the days value directly from the pool config
        let lock_days = pool_config.lock_period_days;
        // IMPORTANT
        // lock_days
        // will
        // be
        // rerpesented in minutes

        position.unlock_time = Clock::get()?.unix_timestamp + (lock_days as i64 * 60);
        position.status = PositionStatus::Unclaimed;

        // self.stake()?;

        // Check if the asset has the attribute plugin already on
        // match fetch_plugin::<BaseAssetV1, Attributes>(
        //     &self.asset.to_account_info(),
        //     mpl_core::types::PluginType::Attributes,
        // ) {
        //     Ok((_, fetched_attribute_list, _)) => {
        //         // If yes, check if the asset is already staked, and if the staking attribute are already initialized
        //         let mut attribute_list: Vec<Attribute> = Vec::new();
        //         let mut is_initialized: bool = false;
        //
        //         for attribute in fetched_attribute_list.attribute_list {
        //             if attribute.key == "staked" {
        //                 require!(attribute.value == "0", StakingError::AlreadyStaked);
        //                 attribute_list.push(Attribute {
        //                     key: "staked".to_string(),
        //                     value: Clock::get()?.unix_timestamp.to_string(),
        //                 });
        //                 is_initialized = true;
        //             } else {
        //                 attribute_list.push(attribute);
        //             }
        //         }
        //
        //         if !is_initialized {
        //             attribute_list.push(Attribute {
        //                 key: "staked".to_string(),
        //                 value: Clock::get()?.unix_timestamp.to_string(),
        //             });
        //             attribute_list.push(Attribute {
        //                 key: "staked_time".to_string(),
        //                 value: 0.to_string(),
        //             });
        //         }
        //
        //         UpdatePluginV1CpiBuilder::new(&self.core_program.to_account_info())
        //             .asset(&self.asset.to_account_info())
        //             .collection(Some(&self.collection.to_account_info()))
        //             .payer(&self.payer.to_account_info())
        //             .authority(Some(&self.update_authority.to_account_info()))
        //             .system_program(&self.system_program.to_account_info())
        //             .plugin(Plugin::Attributes(Attributes { attribute_list }))
        //             .invoke()?;
        //     }
        //     Err(_) => {
        //         // If not, add the attribute plugin to the asset
        //         AddPluginV1CpiBuilder::new(&self.core_program.to_account_info())
        //             .asset(&self.asset.to_account_info())
        //             .collection(Some(&self.collection.to_account_info()))
        //             .payer(&self.payer.to_account_info())
        //             .authority(Some(&self.update_authority.to_account_info()))
        //             .system_program(&self.system_program.to_account_info())
        //             .plugin(Plugin::Attributes(Attributes {
        //                 attribute_list: vec![
        //                     Attribute {
        //                         key: "staked".to_string(),
        //                         value: Clock::get()?.unix_timestamp.to_string(),
        //                     },
        //                     Attribute {
        //                         key: "staked_time".to_string(),
        //                         value: 0.to_string(),
        //                     },
        //                 ],
        //             }))
        //             .init_authority(PluginAuthority::UpdateAuthority)
        //             .invoke()?;
        //     }
        // }

        // Freeze the asset
        // AddPluginV1CpiBuilder::new(&self.core_program.to_account_info())
        //     .asset(&self.asset.to_account_info())
        //     .collection(Some(&self.collection.to_account_info()))
        //     .payer(&self.payer.to_account_info())
        //     .authority(Some(&self.owner.to_account_info()))
        //     .system_program(&self.system_program.to_account_info())
        //     .plugin(Plugin::FreezeDelegate(FreezeDelegate { frozen: true }))
        //     .init_authority(PluginAuthority::UpdateAuthority)
        //     .invoke()?;

        // Transfer The asset:
        TransferV1CpiBuilder::new(&self.core_program.to_account_info())
            .asset(&self.asset.to_account_info())
            .payer(&self.owner.to_account_info())
            .collection(Some(&self.collection.to_account_info()))
            .new_owner(&config_account_info)
            .invoke()?;

        // Update config's total staked amount
        config.total_staked_amount = new_total;

        // Update pool stats
        {
            let pool_stats = &mut config.pools_stats[pool_index as usize];

            pool_stats.total_nfts_staked = pool_stats
                .total_nfts_staked
                .checked_add(1)
                .ok_or(StakingError::ArithmeticOverflow)?;
            pool_stats.lifetime_nfts_staked = pool_stats
                .lifetime_nfts_staked
                .checked_add(1)
                .ok_or(StakingError::ArithmeticOverflow)?;

            msg!(
                "pool_stats: lpd: {:?} | tns: {:?} | tss: {:?} | lns: {:?} | lts: {:?}",
                pool_stats.lock_period_days,
                pool_stats.total_nfts_staked,
                pool_stats.total_tokens_staked,
                pool_stats.lifetime_nfts_staked,
                pool_stats.lifetime_tokens_staked
            );
        }

        // Update user stats
        let user_account = &mut self.user_account;

        // Update per-pool stats
        {
            // Create a scoped mutable reference to the user's pool stats
            let user_pool_stats = &mut user_account.pool_stats[pool_index as usize];

            // Update NFTs staked in this pool
            user_pool_stats.nfts_staked = new_pool_nfts_staked;

            // Update total value in this pool
            user_pool_stats.total_value = new_pool_total_value;

            // Ensure lock period days is set correctly
            user_pool_stats.lock_period_days = pool_config.lock_period_days;
        }

        // Update global user stats
        user_account.total_staked_nfts = new_user_nfts_staked;
        user_account.total_staked_value = new_user_total_value;

        msg!(
            "user_account: tsv: {:?} | tsn: {:?} | pool[{}].nfts_staked: {:?}",
            user_account.total_staked_value,
            user_account.total_staked_nfts,
            pool_index,
            user_account.pool_stats[pool_index as usize].nfts_staked
        );

        Ok(())
    }

    // pub fn stake(&self) -> Result<()> {
    //     // Check if the asset has the attribute plugin already on
    //     match fetch_plugin::<BaseAssetV1, Attributes>(
    //         &self.asset.to_account_info(),
    //         mpl_core::types::PluginType::Attributes,
    //     ) {
    //         Ok((_, fetched_attribute_list, _)) => {
    //             // If yes, check if the asset is already staked, and if the staking attribute are already initialized
    //             let mut attribute_list: Vec<Attribute> = Vec::new();
    //             let mut is_initialized: bool = false;
    //
    //             for attribute in fetched_attribute_list.attribute_list {
    //                 if attribute.key == "staked" {
    //                     require!(attribute.value == "0", StakingError::AlreadyStaked);
    //                     attribute_list.push(Attribute {
    //                         key: "staked".to_string(),
    //                         value: Clock::get()?.unix_timestamp.to_string(),
    //                     });
    //                     is_initialized = true;
    //                 } else {
    //                     attribute_list.push(attribute);
    //                 }
    //             }
    //
    //             if !is_initialized {
    //                 attribute_list.push(Attribute {
    //                     key: "staked".to_string(),
    //                     value: Clock::get()?.unix_timestamp.to_string(),
    //                 });
    //                 attribute_list.push(Attribute {
    //                     key: "staked_time".to_string(),
    //                     value: 0.to_string(),
    //                 });
    //             }
    //
    //             UpdatePluginV1CpiBuilder::new(&self.core_program.to_account_info())
    //                 .asset(&self.asset.to_account_info())
    //                 .collection(Some(&self.collection.to_account_info()))
    //                 .payer(&self.payer.to_account_info())
    //                 .authority(Some(&self.update_authority.to_account_info()))
    //                 .system_program(&self.system_program.to_account_info())
    //                 .plugin(Plugin::Attributes(Attributes { attribute_list }))
    //                 .invoke()?;
    //         }
    //         Err(_) => {
    //             // If not, add the attribute plugin to the asset
    //             AddPluginV1CpiBuilder::new(&self.core_program.to_account_info())
    //                 .asset(&self.asset.to_account_info())
    //                 .collection(Some(&self.collection.to_account_info()))
    //                 .payer(&self.payer.to_account_info())
    //                 .authority(Some(&self.update_authority.to_account_info()))
    //                 .system_program(&self.system_program.to_account_info())
    //                 .plugin(Plugin::Attributes(Attributes {
    //                     attribute_list: vec![
    //                         Attribute {
    //                             key: "staked".to_string(),
    //                             value: Clock::get()?.unix_timestamp.to_string(),
    //                         },
    //                         Attribute {
    //                             key: "staked_time".to_string(),
    //                             value: 0.to_string(),
    //                         },
    //                     ],
    //                 }))
    //                 .init_authority(PluginAuthority::UpdateAuthority)
    //                 .invoke()?;
    //         }
    //     }
    //
    //     // Freeze the asset
    //     AddPluginV1CpiBuilder::new(&self.core_program.to_account_info())
    //         .asset(&self.asset.to_account_info())
    //         .collection(Some(&self.collection.to_account_info()))
    //         .payer(&self.payer.to_account_info())
    //         .authority(Some(&self.owner.to_account_info()))
    //         .system_program(&self.system_program.to_account_info())
    //         .plugin(Plugin::FreezeDelegate(FreezeDelegate { frozen: true }))
    //         .init_authority(PluginAuthority::UpdateAuthority)
    //         .invoke()?;
    //
    //     Ok(())
    // }
}
