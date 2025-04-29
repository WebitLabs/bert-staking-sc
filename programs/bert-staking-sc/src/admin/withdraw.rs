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

    #[account(mut)]
    pub destination: Signer<'info>,

    #[account(
        has_one = authority,
        seeds = [b"config", config.authority.key().as_ref(), config.id.to_le_bytes().as_ref()],
        bump = config.bump,
    )]
    pub config: Account<'info, Config>,

    #[account(
        mut,
        associated_token::mint = config.mint,
        associated_token::authority = config,
    )]
    pub vault: Account<'info, TokenAccount>,

    #[account(
        mut,
        associated_token::mint = config.mint,
        associated_token::authority = destination,
    )]
    pub destination_token_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
}

impl<'info> AdminWithdrawToken<'info> {
    pub fn admin_withdraw_token(&mut self, amount: u64) -> Result<()> {
        let config = &self.config;

        let vault_amount = self.vault.amount;
        let admin_funds = vault_amount - config.total_staked_amount;

        // Ensure we don't go into users staked funds
        require!(amount <= admin_funds, StakingError::InvalidAdminAmount);

        let bump = config.bump;
        let authority = config.authority.key();

        let id = config.id.to_le_bytes();
        let seeds = &[b"config".as_ref(), authority.as_ref(), id.as_ref(), &[bump]];
        let signer_seeds = &[&seeds[..]];

        anchor_spl::token::transfer(
            CpiContext::new_with_signer(
                self.token_program.to_account_info(),
                anchor_spl::token::Transfer {
                    from: self.vault.to_account_info(),
                    to: self.destination_token_account.to_account_info(),
                    authority: self.config.to_account_info(),
                },
                signer_seeds,
            ),
            amount,
        )?;

        Ok(())
    }
}
