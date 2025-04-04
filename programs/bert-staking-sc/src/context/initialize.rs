use anchor_lang::prelude::*;
use anchor_spl::token_interface::Mint;

use crate::state::*;

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        space = 8 + Config::INIT_SPACE,
        seeds = [b"config", authority.key().as_ref()],
        bump
    )]
    pub config: Account<'info, Config>,

    pub mint: InterfaceAccount<'info, Mint>,

    pub system_program: Program<'info, System>,
}

impl<'info> Initialize<'info> {
    pub fn initialize(
        &mut self,
        lock_time: u64,
        yield_rate: u64,
        max_cap: u64,
        nft_value_in_tokens: u64,
        nfts_limit_per_user: u8,
        bumps: &InitializeBumps,
    ) -> Result<()> {
        let config = &mut self.config;

        config.set_inner(Config {
            authority: self.authority.key(),
            mint: self.mint.key(),
            lock_time,
            yield_rate,
            max_cap,
            nft_value_in_tokens,
            nfts_limit_per_user,
            total_staked_amount: 0,
            bump: bumps.config,
        });

        Ok(())
    }
}
