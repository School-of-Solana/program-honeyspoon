use anchor_lang::prelude::*;

pub mod errors;
pub mod events;
pub mod instructions;
pub mod states;

use instructions::*;

declare_id!("5f9Gn6yLcMPqZfFPM9pBYQV1f1h6EBDCSs8jynjfoEQ3");

#[program]
pub mod dive_game {
    use super::*;

    pub fn init_house_vault(ctx: Context<InitializeHouseVault>, locked: bool) -> Result<()> {
        instructions::init_house_vault(ctx, locked)
    }

    pub fn start_session(
        ctx: Context<StartSession>,
        bet_amount: u64,
        max_payout: u64,
        session_index: u64,
    ) -> Result<()> {
        instructions::start_session(ctx, bet_amount, max_payout, session_index)
    }

    pub fn play_round(
        ctx: Context<PlayRound>,
        new_treasure: u64,
        new_dive_number: u16,
    ) -> Result<()> {
        instructions::play_round(ctx, new_treasure, new_dive_number)
    }

    pub fn lose_session(ctx: Context<LoseSession>) -> Result<()> {
        instructions::lose_session(ctx)
    }

    pub fn cash_out(ctx: Context<CashOut>) -> Result<()> {
        instructions::cash_out(ctx)
    }

    pub fn toggle_house_lock(ctx: Context<ToggleHouseLock>) -> Result<()> {
        instructions::toggle_house_lock(ctx)
    }
}
