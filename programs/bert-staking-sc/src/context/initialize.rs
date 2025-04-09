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

    //pub collection: InterfaceAccount<'info, Mint>,
    /// CHECK:
    pub collection: UncheckedAccount<'info>,

    #[account(
        init,
        payer = authority,
        associated_token::mint = mint,
        associated_token::authority = config,
    )]
    pub vault: Box<InterfaceAccount<'info, TokenAccount>>,

    // #[account(
    //     init,
    //     payer = authority,
    //     token::mint = mint,
    //     token::authority = config,
    //     seeds = [b"authority_vault", config.key().as_ref(), mint.key().as_ref()],
    //     bump
    // )]
    // pub authority_vault: Box<InterfaceAccount<'info, TokenAccount>>,
    /// CHECK: TODO: will add type later!
    pub nfts_vault: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

impl<'info> Initialize<'info> {
    pub fn initialize(
        &mut self,
        id: u64,
        lock_period_yields: [LockPeriodYield; 4],
        max_cap: u64,
        nft_value_in_tokens: u64,
        nfts_limit_per_user: u8,
        bumps: &InitializeBumps,
    ) -> Result<()> {
        let config = &mut self.config;

        config.set_inner(Config {
            id,
            authority: self.authority.key(),
            mint: self.mint.key(),
            collection: self.collection.key(),
            vault: self.vault.key(),
            nfts_vault: self.nfts_vault.key(),
            authority_vault: self.vault.key(),
            lock_period_yields,
            max_cap,
            nft_value_in_tokens,
            nfts_limit_per_user,
            total_staked_amount: 0,
            bump: bumps.config,
            authority_vault_bump: bumps.config,
        });

        Ok(())
    }
}
