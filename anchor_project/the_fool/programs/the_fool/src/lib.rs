use anchor_lang::prelude::*;

declare_id!("4HMPqfgZTqsB4iecehvxJcmEMS1tevL9Lv9T83bVvUgb");

#[program]
pub mod the_fool {
    use super::*;

    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        msg!("Greetings from: {:?}", ctx.program_id);
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
