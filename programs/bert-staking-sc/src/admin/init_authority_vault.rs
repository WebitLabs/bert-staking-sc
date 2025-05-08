use anchor_lang::prelude::*;
use anchor_spl::token_interface::{Mint, TokenAccount, TokenInterface};

use crate::{state::Config, StakingError};

#[derive(Accounts)]
pub struct InitializeAuthVault<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        mut,
        has_one = mint,
        has_one = authority,
        seeds = [b"config", config.authority.key().as_ref(), config.id.to_le_bytes().as_ref()],
        bump = config.bump,
    )]
    pub config: Box<Account<'info, Config>>,

    pub mint: Box<InterfaceAccount<'info, Mint>>,

    #[account(
        init,
        payer = authority,
        token::mint = mint,
        token::authority = config,
        token::token_program = token_program,
        seeds = [b"authority_vault", config.key().as_ref(), mint.key().as_ref()],
        bump
    )]
    pub authority_vault: InterfaceAccount<'info, TokenAccount>,

    pub system_program: Program<'info, System>,
    pub token_program: Interface<'info, TokenInterface>,
}

impl<'info> InitializeAuthVault<'info> {
    pub fn initialize_auth_vault(&mut self, bumps: &InitializeAuthVaultBumps) -> Result<()> {
        let config = &mut self.config;

        require!(
            config.authority_vault.key() == Pubkey::default(),
            StakingError::AuthorityVaultAlreadyInitialized
        );

        config.authority_vault = self.authority_vault.key();
        config.authority_vault_bump = bumps.authority_vault;

        Ok(())
    }
}
