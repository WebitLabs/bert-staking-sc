use crate::{state::*, StakingError};
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct ProposeAdminTransfer<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        has_one = authority @ StakingError::Unauthorized,
        seeds = [b"config", config.id.to_le_bytes().as_ref()],
        bump = config.bump,
    )]
    pub config: Account<'info, Config>,

    #[account(
        init,
        payer = authority,
        space = 8 + ProposedAdmin::INIT_SPACE,
        seeds = [
            b"propose_admin",
            config.key().as_ref(),
        ],
        bump,
    )]
    pub proposed_admin: Account<'info, ProposedAdmin>,

    pub system_program: Program<'info, System>,
}

impl<'info> ProposeAdminTransfer<'info> {
    pub fn propose_admin(
        &mut self,
        new_admin: &Pubkey,
        bumps: &ProposeAdminTransferBumps,
    ) -> Result<()> {
        let proposed_admin = &mut self.proposed_admin;

        proposed_admin.authority = new_admin.key();
        proposed_admin.bump = bumps.proposed_admin;

        Ok(())
    }
}

#[derive(Accounts)]
pub struct AcceptAdminTransfer<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        mut,
        constraint = old_authority.key() == config.authority @ StakingError::Unauthorized
    )]
    pub old_authority: SystemAccount<'info>,

    #[account(
        mut,
        seeds = [b"config", config.id.to_le_bytes().as_ref()],
        bump = config.bump,
    )]
    pub config: Account<'info, Config>,

    #[account(
        mut,
        close = old_authority,
        has_one = authority @ StakingError::Unauthorized, // only proposed authority can
                                                          // satisfy this condition
                                                          // (aka call call this
                                                          // instruction)
        seeds = [
            b"propose_admin",
            config.key().as_ref(),
        ],
        bump = proposed_admin.bump,
    )]
    pub proposed_admin: Account<'info, ProposedAdmin>,

    pub system_program: Program<'info, System>,
}

impl<'info> AcceptAdminTransfer<'info> {
    pub fn accept_admin(&mut self) -> Result<()> {
        let proposed_admin = &mut self.proposed_admin;

        self.config.authority = proposed_admin.authority;

        Ok(())
    }
}
