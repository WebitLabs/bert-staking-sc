use crate::state::*;
use anchor_lang::prelude::*;
use anchor_spl::token_interface::Mint;

#[derive(Accounts)]
pub struct InitializeUser<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        has_one = mint,
        seeds = [b"config", config.authority.key().as_ref(), config.id.to_le_bytes().as_ref()],
        bump = config.bump,
    )]
    pub config: Account<'info, Config>,

    #[account(
        seeds = [
            b"pool",
            config.key().as_ref(),
            pool.index.to_le_bytes().as_ref()
        ],
        bump = pool.bump,
    )]
    pub pool: Account<'info, Pool>,

    #[account(
        init,
        payer = owner,
        space = 8 + UserAccountV3::INIT_SPACE,
        seeds = [b"user", owner.key().as_ref(), config.key().as_ref()],
        bump
    )]
    pub user_account: Account<'info, UserAccountV3>,

    pub mint: InterfaceAccount<'info, Mint>,

    pub system_program: Program<'info, System>,
}

impl<'info> InitializeUser<'info> {
    pub fn initialize_user(&mut self, bumps: &InitializeUserBumps) -> Result<()> {
        // Initialize the user account
        self.user_account.set_inner(UserAccountV3 {
            config: self.config.key(),
            total_staked_value: 0,
            total_staked_nfts: 0,
            total_staked_token_amount: 0,
            total_claimed_yield: 0,
            bump: bumps.user_account,
            _padding: [0; 64],
        });

        Ok(())
    }
}
