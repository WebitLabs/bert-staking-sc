use anchor_lang::prelude::*;

declare_id!("H4B2h3ypQtc1Pwzcskx7ApnSWGj9AeuN2q7WvkjvAgE2");

#[program]
pub mod bert_staking_sc {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
