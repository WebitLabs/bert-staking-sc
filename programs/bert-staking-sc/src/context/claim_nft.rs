use crate::state::*;
use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{Mint, Token, TokenAccount},
};

use mpl_core::{
    accounts::{BaseAssetV1, BaseCollectionV1},
    fetch_plugin,
    instructions::TransferV1CpiBuilder,
    types::{
        Attribute, Attributes, FreezeDelegate, Plugin, PluginAuthority, PluginType, UpdateAuthority,
    },
    ID as CORE_PROGRAM_ID,
};

#[derive(Accounts)]
pub struct ClaimPositionNft<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(mut)]
    pub payer: Signer<'info>,

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
    pub user_account: Box<Account<'info, UserAccountV2>>,

    #[account(
        mut,
        seeds = [b"position", owner.key().as_ref(), mint.key().as_ref(), asset.key().as_ref(), position.id.to_le_bytes().as_ref()],
        bump = position.bump,
        constraint = position.owner == owner.key(),
        constraint = position.status == PositionStatus::Unclaimed,

    )]
    pub position: Box<Account<'info, PositionV3>>,

    /// CHECK: TODO: Either check it's from collection or check against this account which is
    /// supposed to be in config also
    pub collection: UncheckedAccount<'info>,

    /// CHECK: TODO:
    pub update_authority: UncheckedAccount<'info>,

    #[account(
        mut,
        constraint = asset.owner == config.key(),
        constraint = asset.update_authority == UpdateAuthority::Collection(collection.key()),
    )]
    pub asset: Account<'info, BaseAssetV1>,

    /// Token mint.
    pub mint: Account<'info, Mint>,

    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = owner,
    )]
    pub token_account: Account<'info, TokenAccount>,

    #[account(
        mut,
        associated_token::mint = mint,
        associated_token::authority = config,
    )]
    pub vault: Account<'info, TokenAccount>,

    #[account(address = CORE_PROGRAM_ID)]
    /// CHECK: this will be checked by core
    pub core_program: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

impl<'info> ClaimPositionNft<'info> {
    pub fn claim_nft(&mut self) -> Result<()> {
        // Check if position is unlocked
        let current_time = Clock::get()?.unix_timestamp;
        if current_time < self.position.unlock_time {
            return Err(StakingError::PositionLocked.into());
        }

        require!(
            self.position.position_type == PositionType::NFT,
            StakingError::InvalidPositionType
        );

        // This require is trivial - should not happen!
        let pool_index = self.position.lock_period_yield_index;
        require!(
            self.config.pools_config.len() > pool_index as usize,
            StakingError::InvalidLockPeriodAndYield
        );

        let lock_period_yield = self.config.pools_config[pool_index as usize];

        // Calculate yield based on position type and config
        let position_amount = self.position.amount;
        let yield_rate = lock_period_yield.yield_rate;
        let base_amount = position_amount;
        let yield_value = base_amount
            .checked_mul(yield_rate)
            .ok_or(StakingError::ArithmeticOverflow)?
            .checked_div(10000) // Basis points conversion (e.g., 500 = 5%)
            .ok_or(StakingError::ArithmeticOverflow)?;

        // let final_amount = base_amount
        //     .checked_add(yield_value)
        //     .ok_or(StakingError::ArithmeticOverflow)?;

        // Transfer tokens back to user with yield
        let bump = self.config.bump;
        let authority = self.config.authority.key();

        let id = self.config.id.to_le_bytes();
        let seeds = &[b"config".as_ref(), authority.as_ref(), id.as_ref(), &[bump]];
        let signer_seeds = &[&seeds[..]];

        // TODO: it's possible here to implement 2 transfers.
        // 1. yield from authority vault
        // 2. principal from vault

        // For tokens, transfer the original amount plus yield
        anchor_spl::token::transfer(
            CpiContext::new_with_signer(
                self.token_program.to_account_info(),
                anchor_spl::token::Transfer {
                    from: self.vault.to_account_info(), // TODO: This is not 100% correct if we
                    // want to have separation between yield
                    // vault and regular vault. FIX
                    to: self.token_account.to_account_info(),
                    authority: self.config.to_account_info(),
                },
                signer_seeds,
            ),
            yield_value,
        )?;

        // TODO: UNSTAKE
        // Check if the asset has the attribute plugin already on
        // match fetch_plugin::<BaseAssetV1, Attributes>(
        //     &self.asset.to_account_info(),
        //     mpl_core::types::PluginType::Attributes,
        // ) {
        //     Ok((_, fetched_attribute_list, _)) => {
        //         let mut attribute_list: Vec<Attribute> = Vec::new();
        //         let mut is_initialized: bool = false;
        //         let mut staked_time: i64 = 0;
        //
        //         for attribute in fetched_attribute_list.attribute_list.iter() {
        //             if attribute.key == "staked" {
        //                 require!(attribute.value != "0", StakingError::AssetNotStaked);
        //                 attribute_list.push(Attribute {
        //                     key: "staked".to_string(),
        //                     value: 0.to_string(),
        //                 });
        //                 staked_time = staked_time
        //                     .checked_add(
        //                         Clock::get()?
        //                             .unix_timestamp
        //                             .checked_sub(
        //                                 attribute
        //                                     .value
        //                                     .parse::<i64>()
        //                                     .map_err(|_| StakingError::InvalidTimestamp)?,
        //                             )
        //                             .ok_or(StakingError::ArithmeticOverflow)?,
        //                     )
        //                     .ok_or(StakingError::ArithmeticOverflow)?;
        //                 is_initialized = true;
        //             } else if attribute.key == "staked_time" {
        //                 staked_time = staked_time
        //                     .checked_add(
        //                         attribute
        //                             .value
        //                             .parse::<i64>()
        //                             .map_err(|_| StakingError::InvalidTimestamp)?,
        //                     )
        //                     .ok_or(StakingError::ArithmeticOverflow)?;
        //             } else {
        //                 attribute_list.push(attribute.clone());
        //             }
        //         }
        //
        //         attribute_list.push(Attribute {
        //             key: "staked_time".to_string(),
        //             value: staked_time.to_string(),
        //         });
        //
        //         // require!(is_initialized, StakingError::StakingNotInitialized);
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
        //         return Err(StakingError::AttributesNotInitialized.into());
        //     }
        // }
        //
        // // Unfreeze the asset
        // UpdatePluginV1CpiBuilder::new(&self.core_program.to_account_info())
        //     .asset(&self.asset.to_account_info())
        //     .collection(Some(&self.collection.to_account_info()))
        //     .payer(&self.payer.to_account_info())
        //     .authority(Some(&self.update_authority.to_account_info()))
        //     .system_program(&self.system_program.to_account_info())
        //     .plugin(Plugin::FreezeDelegate(FreezeDelegate { frozen: false }))
        //     .invoke()?;
        //
        // // Remove the FreezeDelegate Plugin
        // RemovePluginV1CpiBuilder::new(&self.core_program)
        //     .asset(&self.asset.to_account_info())
        //     .collection(Some(&self.collection.to_account_info()))
        //     .payer(&self.payer)
        //     .authority(Some(&self.owner))
        //     .system_program(&self.system_program)
        //     .plugin_type(PluginType::FreezeDelegate)
        //     .invoke()?;

        let id = self.config.id.to_le_bytes();
        let seeds = &[b"config".as_ref(), authority.as_ref(), id.as_ref(), &[bump]];
        let signer_seeds = &[&seeds[..]];

        // Transfer The asset:
        TransferV1CpiBuilder::new(&self.core_program.to_account_info())
            .asset(&self.asset.to_account_info())
            .authority(Some(&self.config.to_account_info()))
            .new_owner(&self.owner.to_account_info())
            .payer(&self.payer.to_account_info())
            .collection(Some(&self.collection.to_account_info()))
            .system_program(Some(&self.system_program.to_account_info()))
            .invoke_signed(signer_seeds)?;

        // Update position status to claimed
        let position = &mut self.position;
        position.status = PositionStatus::Claimed;

        let config = &mut self.config;

        // Update config's total staked amount
        config.total_staked_amount = config
            .total_staked_amount
            .checked_sub(config.nft_value_in_tokens)
            .ok_or(ProgramError::ArithmeticOverflow)?;

        // Update pool stats directly in the array
        {
            // Create a scoped mutable reference to the pool stats
            let pool_stats = &mut config.pools_stats[pool_index as usize];

            // Update pool config
            pool_stats.total_nfts_staked = pool_stats
                .total_nfts_staked
                .checked_sub(1)
                .ok_or(StakingError::ArithmeticOverflow)?;
            pool_stats.lifetime_claimed_yield = pool_stats
                .lifetime_claimed_yield
                .checked_add(yield_value)
                .ok_or(StakingError::ArithmeticOverflow)?;

            msg!(
                "pool_stats: lpd: {:?} | tns: {:?} | tss: {:?} | lns: {:?} | lts: {:?} | lcy: {:?}",
                pool_stats.lock_period_days,
                pool_stats.total_nfts_staked,
                pool_stats.total_tokens_staked,
                pool_stats.lifetime_nfts_staked,
                pool_stats.lifetime_tokens_staked,
                pool_stats.lifetime_claimed_yield
            );
        }

        // Update user stats
        let user_account = &mut self.user_account;

        // Check if pool_index is valid for user pool stats
        require!(
            pool_index < user_account.pool_stats.len() as u8,
            StakingError::InvalidLockPeriodAndYield
        );

        // Update per-pool stats
        {
            // Create a scoped mutable reference to the user's pool stats
            let user_pool_stats = &mut user_account.pool_stats[pool_index as usize];

            // Update NFTs staked in this pool
            user_pool_stats.nfts_staked = user_pool_stats
                .nfts_staked
                .checked_sub(1)
                .ok_or(StakingError::ArithmeticOverflow)?;

            // Update total value in this pool
            user_pool_stats.total_value = user_pool_stats
                .total_value
                .checked_sub(self.config.nft_value_in_tokens)
                .ok_or(StakingError::ArithmeticOverflow)?;

            // Update claimed yield for this pool
            user_pool_stats.claimed_yield = user_pool_stats
                .claimed_yield
                .checked_add(yield_value)
                .ok_or(StakingError::ArithmeticOverflow)?;
        }

        // Update global user stats
        user_account.total_staked_nfts = user_account
            .total_staked_nfts
            .checked_sub(1)
            .ok_or(StakingError::ArithmeticOverflow)?;

        user_account.total_staked_value = user_account
            .total_staked_value
            .checked_sub(self.config.nft_value_in_tokens)
            .ok_or(StakingError::ArithmeticOverflow)?;

        user_account.total_claimed_yield = user_account
            .total_claimed_yield
            .checked_add(yield_value)
            .ok_or(StakingError::ArithmeticOverflow)?;

        msg!(
            "user_account: tsv: {:?} | tsn: {:?} | tcy: {:?}",
            user_account.total_staked_value,
            user_account.total_staked_nfts,
            user_account.total_claimed_yield
        );

        msg!(
            "user_pool_stats[{}]: nfts: {:?} | value: {:?} | yield: {:?}",
            pool_index,
            user_account.pool_stats[pool_index as usize].nfts_staked,
            user_account.pool_stats[pool_index as usize].total_value,
            user_account.pool_stats[pool_index as usize].claimed_yield
        );

        Ok(())
    }
}
