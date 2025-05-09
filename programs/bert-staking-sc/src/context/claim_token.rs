use crate::{state::*, StakingError};
use anchor_lang::prelude::*;
use anchor_spl::{
    associated_token::AssociatedToken,
    token::{Mint, Token, TokenAccount},
};

#[derive(Accounts)]
pub struct ClaimPositionToken<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

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
        seeds = [
            b"pool",
            config.key().as_ref(),
            &pool.index.to_le_bytes(),
        ],
        bump = pool.bump,
    )]
    pub pool: Box<Account<'info, Pool>>,

    #[account(
        mut,
        seeds = [b"user", owner.key().as_ref(), config.key().as_ref()],
        bump = user_account.bump,
    )]
    pub user_account: Box<Account<'info, UserAccountV3>>,

    #[account(
        mut,
        seeds = [
            b"user_pool_stats",
            owner.key().as_ref(),
            pool.key().as_ref(),
        ],
        bump = user_pool_stats.bump,
    )]
    pub user_pool_stats: Box<Account<'info, UserPoolStatsAccount>>,

    #[account(
        mut,
        seeds = [b"position", owner.key().as_ref(), mint.key().as_ref(), position.id.to_le_bytes().as_ref()],
        bump = position.bump,
        constraint = position.owner == owner.key(),
        constraint = position.status == PositionStatus::Unclaimed,
        constraint = position.pool == pool.key() @ StakingError::InvalidPositionType,
    )]
    pub position: Box<Account<'info, PositionV4>>,

    /// CHECK: This is checked in config constraint
    pub collection: UncheckedAccount<'info>,

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

    #[account(
        mut,
        seeds = [b"authority_vault", config.key().as_ref(), mint.key().as_ref()],
        bump = config.authority_vault_bump,
    )]
    pub authority_vault: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

impl<'info> ClaimPositionToken<'info> {
    pub fn claim_token(&mut self) -> Result<()> {
        // Check if position is unlocked
        let current_time = Clock::get()?.unix_timestamp;
        if current_time < self.position.unlock_time {
            return Err(StakingError::PositionLocked.into());
        }

        require!(
            self.position.position_type == PositionType::Token,
            StakingError::InvalidPositionType
        );

        // Get references to main accounts
        let config = &mut self.config;
        let pool = &mut self.pool;
        let user_pool_stats = &mut self.user_pool_stats;
        let position = &mut self.position;

        // Calculate yield based on position type and pool config
        let position_amount = position.amount;
        let yield_rate = pool.yield_rate;
        let base_amount = position_amount;
        let yield_value = base_amount
            .checked_mul(yield_rate)
            .ok_or(StakingError::ArithmeticOverflow)?
            .checked_div(10000) // Basis points conversion (e.g., 500 = 5%)
            .ok_or(StakingError::ArithmeticOverflow)?;

        // Prepare common values for transfers
        let bump = config.bump;
        let authority = config.authority.key();
        let id = config.id.to_le_bytes();
        let seeds = &[b"config".as_ref(), authority.as_ref(), id.as_ref(), &[bump]];
        let signer_seeds = &[&seeds[..]];

        // Check if authority vault has enough tokens for yield
        let authority_vault_balance = self.authority_vault.amount;

        // Ensure the authority vault has enough yield tokens
        require!(
            authority_vault_balance >= yield_value,
            StakingError::InsufficientYieldFunds
        );

        // Implementing two separate transfers:
        // 1. Transfer principal amount from main vault
        anchor_spl::token::transfer(
            CpiContext::new_with_signer(
                self.token_program.to_account_info(),
                anchor_spl::token::Transfer {
                    from: self.vault.to_account_info(),
                    to: self.token_account.to_account_info(),
                    authority: config.to_account_info(),
                },
                signer_seeds,
            ),
            base_amount,
        )?;

        // 2. Transfer yield from authority vault
        anchor_spl::token::transfer(
            CpiContext::new_with_signer(
                self.token_program.to_account_info(),
                anchor_spl::token::Transfer {
                    from: self.authority_vault.to_account_info(),
                    to: self.token_account.to_account_info(),
                    authority: config.to_account_info(),
                },
                signer_seeds,
            ),
            yield_value,
        )?;

        msg!("Yield of {} transferred from authority vault", yield_value);

        // Update position status to claimed
        position.status = PositionStatus::Claimed;

        // Update config's total staked amount
        config.total_staked_amount = config
            .total_staked_amount
            .checked_sub(position_amount)
            .ok_or(ProgramError::ArithmeticOverflow)?;

        // Update pool statistics
        pool.total_tokens_staked = pool
            .total_tokens_staked
            .checked_sub(position_amount)
            .ok_or(StakingError::ArithmeticOverflow)?;

        pool.lifetime_claimed_yield = pool
            .lifetime_claimed_yield
            .checked_add(yield_value)
            .ok_or(StakingError::ArithmeticOverflow)?;

        msg!(
            "pool_stats: lpd: {:?} | tns: {:?} | tss: {:?} | lns: {:?} | lts: {:?} | lcy: {:?}",
            pool.lock_period_days,
            pool.total_nfts_staked,
            pool.total_tokens_staked,
            pool.lifetime_nfts_staked,
            pool.lifetime_tokens_staked,
            pool.lifetime_claimed_yield
        );

        // Update user pool stats
        user_pool_stats.tokens_staked = user_pool_stats
            .tokens_staked
            .checked_sub(position_amount)
            .ok_or(StakingError::ArithmeticOverflow)?;

        user_pool_stats.total_value = user_pool_stats
            .total_value
            .checked_sub(position_amount)
            .ok_or(StakingError::ArithmeticOverflow)?;

        user_pool_stats.claimed_yield = user_pool_stats
            .claimed_yield
            .checked_add(yield_value)
            .ok_or(StakingError::ArithmeticOverflow)?;

        // Update global user stats
        let user_account = &mut self.user_account;
        user_account.total_staked_token_amount = user_account
            .total_staked_token_amount
            .checked_sub(position_amount)
            .ok_or(StakingError::ArithmeticOverflow)?;

        user_account.total_staked_value = user_account
            .total_staked_value
            .checked_sub(position_amount)
            .ok_or(StakingError::ArithmeticOverflow)?;

        user_account.total_claimed_yield = user_account
            .total_claimed_yield
            .checked_add(yield_value)
            .ok_or(StakingError::ArithmeticOverflow)?;

        msg!(
            "user_account: tsta {:?} | tsv: {:?} | tsn: {:?} | tcy: {:?}",
            user_account.total_staked_token_amount,
            user_account.total_staked_value,
            user_account.total_staked_nfts,
            user_account.total_claimed_yield
        );

        msg!(
            "user_pool_stats: tokens: {:?} | value: {:?} | yield: {:?}",
            user_pool_stats.tokens_staked,
            user_pool_stats.total_value,
            user_pool_stats.claimed_yield
        );

        Ok(())
    }
}
