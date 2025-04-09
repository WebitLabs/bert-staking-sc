use crate::state::*;
use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{Mint, Token},
};

use mpl_core::{
    accounts::{BaseAssetV1, BaseCollectionV1},
    fetch_plugin,
    instructions::{AddPluginV1CpiBuilder, RemovePluginV1CpiBuilder, UpdatePluginV1CpiBuilder},
    types::{
        Attribute, Attributes, FreezeDelegate, Plugin, PluginAuthority, PluginType, UpdateAuthority,
    },
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
        seeds = [b"config", config.authority.key().as_ref()],
        bump = config.bump,
    )]
    pub config: Account<'info, Config>,

    #[account(
        mut,
        seeds = [b"position", owner.key().as_ref(), mint.key().as_ref(), id.to_le_bytes().as_ref()],
        bump,
    )]
    pub position: Account<'info, Position>,

    pub update_authority: Signer<'info>,

    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(
        mut,
        has_one = owner,
        constraint = asset.update_authority == UpdateAuthority::Collection(collection.key()),
    )]
    pub asset: Account<'info, BaseAssetV1>,

    #[account(
        mut,
        has_one = update_authority
    )]
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
    pub fn stake_nft(&mut self) -> Result<()> {
        require!(
            self.position.nft_index < self.config.nfts_limit_per_user,
            StakingError::MaxCapReached
        );

        let index = self.position.lock_period_yield_index;
        // Check if period and yield index is valid
        require!(
            self.config.lock_period_yields.len() > index as usize,
            StakingError::InvalidLockPeriodAndYield
        );

        // Check if staking would exceed the max cap
        let new_total = self
            .config
            .total_staked_amount
            .checked_add(self.config.nft_value_in_tokens)
            .ok_or(StakingError::ArithmeticOverflow)?;

        require!(new_total < self.config.max_cap, StakingError::MaxCapReached);

        // Create a position for the staked tokens
        let position = &mut self.position;
        //position.deposit_time = Clock::get()?.unix_timestamp;
        position.amount = self.config.nft_value_in_tokens;
        position.position_type = PositionType::NFT;

        self.stake()?;

        // Push nft mint into array
        let position = &mut self.position;
        let index = position.nft_index as usize;
        let nft_mints = &mut position.nft_mints;
        nft_mints[index] = self.asset.key();
        position.nft_index = index as u8 + 1;

        // Update config's total staked amount
        let config = &mut self.config;
        config.total_staked_amount = new_total;

        Ok(())
    }

    pub fn stake(&self) -> Result<()> {
        // Check if the asset has the attribute plugin already on
        match fetch_plugin::<BaseAssetV1, Attributes>(
            &self.asset.to_account_info(),
            mpl_core::types::PluginType::Attributes,
        ) {
            Ok((_, fetched_attribute_list, _)) => {
                // If yes, check if the asset is already staked, and if the staking attribute are already initialized
                let mut attribute_list: Vec<Attribute> = Vec::new();
                let mut is_initialized: bool = false;

                for attribute in fetched_attribute_list.attribute_list {
                    if attribute.key == "staked" {
                        require!(attribute.value == "0", StakingError::AlreadyStaked);
                        attribute_list.push(Attribute {
                            key: "staked".to_string(),
                            value: Clock::get()?.unix_timestamp.to_string(),
                        });
                        is_initialized = true;
                    } else {
                        attribute_list.push(attribute);
                    }
                }

                if !is_initialized {
                    attribute_list.push(Attribute {
                        key: "staked".to_string(),
                        value: Clock::get()?.unix_timestamp.to_string(),
                    });
                    attribute_list.push(Attribute {
                        key: "staked_time".to_string(),
                        value: 0.to_string(),
                    });
                }

                UpdatePluginV1CpiBuilder::new(&self.core_program.to_account_info())
                    .asset(&self.asset.to_account_info())
                    .collection(Some(&self.collection.to_account_info()))
                    .payer(&self.payer.to_account_info())
                    .authority(Some(&self.update_authority.to_account_info()))
                    .system_program(&self.system_program.to_account_info())
                    .plugin(Plugin::Attributes(Attributes { attribute_list }))
                    .invoke()?;
            }
            Err(_) => {
                // If not, add the attribute plugin to the asset
                AddPluginV1CpiBuilder::new(&self.core_program.to_account_info())
                    .asset(&self.asset.to_account_info())
                    .collection(Some(&self.collection.to_account_info()))
                    .payer(&self.payer.to_account_info())
                    .authority(Some(&self.update_authority.to_account_info()))
                    .system_program(&self.system_program.to_account_info())
                    .plugin(Plugin::Attributes(Attributes {
                        attribute_list: vec![
                            Attribute {
                                key: "staked".to_string(),
                                value: Clock::get()?.unix_timestamp.to_string(),
                            },
                            Attribute {
                                key: "staked_time".to_string(),
                                value: 0.to_string(),
                            },
                        ],
                    }))
                    .init_authority(PluginAuthority::UpdateAuthority)
                    .invoke()?;
            }
        }

        // Freeze the asset
        AddPluginV1CpiBuilder::new(&self.core_program.to_account_info())
            .asset(&self.asset.to_account_info())
            .collection(Some(&self.collection.to_account_info()))
            .payer(&self.payer.to_account_info())
            .authority(Some(&self.owner.to_account_info()))
            .system_program(&self.system_program.to_account_info())
            .plugin(Plugin::FreezeDelegate(FreezeDelegate { frozen: true }))
            .init_authority(PluginAuthority::UpdateAuthority)
            .invoke()?;

        Ok(())
    }
}
