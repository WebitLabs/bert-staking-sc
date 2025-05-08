use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{Token, TokenAccount},
};

use crate::state::*;

#[derive(Accounts)]
#[instruction(id: u64)]
pub struct AdminWithdrawToken<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        has_one = authority,
        has_one = authority_vault,
        seeds = [b"config", config.authority.key().as_ref(), config.id.to_le_bytes().as_ref()],
        bump = config.bump,
    )]
    pub config: Account<'info, Config>,

    #[account(
        mut,
        seeds = [b"authority_vault", config.key().as_ref(), config.mint.key().as_ref()],
        bump = config.authority_vault_bump
    )]
    pub authority_vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        associated_token::mint = config.mint,
        associated_token::authority = config.admin_withdraw_destination,
    )]
    pub admin_withdraw_destination: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

impl<'info> AdminWithdrawToken<'info> {
    pub fn admin_withdraw_token(&mut self, amount: u64) -> Result<()> {
        let config = &self.config;

        require!(
            config.authority_vault.key() != Pubkey::default(),
            StakingError::AuthorityVaultNotInitialized
        );

        let bump = config.bump;
        let authority = config.authority.key();

        let id = config.id.to_le_bytes();
        let seeds = &[b"config".as_ref(), authority.as_ref(), id.as_ref(), &[bump]];
        let signer_seeds = &[&seeds[..]];

        // Transfer from authority vault to destination
        anchor_spl::token::transfer(
            CpiContext::new_with_signer(
                self.token_program.to_account_info(),
                anchor_spl::token::Transfer {
                    from: self.authority_vault.to_account_info(),
                    to: self.admin_withdraw_destination.to_account_info(),
                    authority: self.config.to_account_info(),
                },
                signer_seeds,
            ),
            amount,
        )?;

        Ok(())
    }
}
