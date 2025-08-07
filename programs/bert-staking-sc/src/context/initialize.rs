use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token_interface::{Mint, TokenAccount, TokenInterface},
};

use crate::state::*;

// Hardcoded admin pubkey.
const ADMIN_PUBKEY: Pubkey = pubkey!("5JLFk731zxTAkTbsZMr6YRFqooV9yDbv18gnRwhUoQ2h");

#[derive(Accounts)]
#[instruction(id: u64)]
pub struct Initialize<'info> {
    #[account(
        mut,
        address = ADMIN_PUBKEY @ StakingError::Unauthorized
    )]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        space = 8 + Config::INIT_SPACE,
        seeds = [b"config", authority.key().as_ref(), id.to_le_bytes().as_ref()],
        bump
    )]
    pub config: Box<Account<'info, Config>>,

    pub mint: Box<InterfaceAccount<'info, Mint>>,

    /// CHECK:
    pub collection: UncheckedAccount<'info>,

    #[account(
        init,
        payer = authority,
        associated_token::mint = mint,
        associated_token::authority = config,
    )]
    pub vault: Box<InterfaceAccount<'info, TokenAccount>>,

    /// CHECK:
    pub nfts_vault: UncheckedAccount<'info>,

    /// CHECK: The destination for admin withdrawals. Checked at withdrawal
    pub admin_withdraw_destination: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
    pub token_program: Interface<'info, TokenInterface>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

impl<'info> Initialize<'info> {
    pub fn initialize(
        &mut self,
        id: u64,
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
            authority_vault: Pubkey::default(),
            admin_withdraw_destination: self.admin_withdraw_destination.key(),

            pool_count: 0, // Start with no pools, they'll be created separately

            max_cap,
            nft_value_in_tokens,
            nfts_limit_per_user,

            total_staked_amount: 0,
            total_nfts_staked: 0,

            bump: bumps.config,
            authority_vault_bump: 0,

            _padding: [0; 96],
        });

        Ok(())
    }
}
