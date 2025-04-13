use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{Mint, TokenAccount, TokenInterface},
};

use crate::state::*;

#[derive(Accounts)]
#[instruction(id: u64)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        space = 8 + Config::INIT_SPACE,
        seeds = [b"config", authority.key().as_ref(), id.to_le_bytes().as_ref()],
        bump
    )]
    pub config: Box<Account<'info, Config>>,

    pub mint: InterfaceAccount<'info, Mint>,

    /// CHECK:
    pub collection: UncheckedAccount<'info>,

    #[account(
        init,
        payer = authority,
        associated_token::mint = mint,
        associated_token::authority = config,
    )]
    pub vault: InterfaceAccount<'info, TokenAccount>,

    // #[account(
    //     init,
    //     payer = authority,
    //     token::mint = mint,
    //     token::authority = config,
    //     seeds = [b"authority_vault", config.key().as_ref(), mint.key().as_ref()],
    //     bump
    // )]
    // pub authority_vault: InterfaceAccount<'info, TokenAccount>,
    pub system_program: Program<'info, System>,
    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

impl<'info> Initialize<'info> {
    pub fn initialize(
        &mut self,
        id: u64,
        pools_config: [PoolConfig; 4],
        max_cap: u64,
        nft_value_in_tokens: u64,
        nfts_limit_per_user: u8,
        bumps: &InitializeBumps,
    ) -> Result<()> {
        let config = &mut self.config;

        let pools_stats = pools_config.map(|pool| PoolStats {
            lock_period: pool.lock_period,

            total_nfts_staked: 0,
            total_tokens_staked: 0,

            lifetime_nfts_staked: 0,
            lifetime_tokens_staked: 0,
            lifetime_claimed_yield: 0,

            _padding: [0; 64],
        });

        config.set_inner(Config {
            id,
            authority: self.authority.key(),
            mint: self.mint.key(),
            collection: self.collection.key(),
            vault: self.vault.key(),
            authority_vault: self.vault.key(),

            pools_config,
            pools_stats,

            max_cap,
            nft_value_in_tokens,
            nfts_limit_per_user,

            total_staked_amount: 0,
            total_nfts_staked: 0,

            bump: bumps.config,
            authority_vault_bump: bumps.config,

            _padding: [0; 128],
        });

        Ok(())
    }
}
