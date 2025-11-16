use anchor_lang::prelude::*;

pub mod errors;
pub mod events;
pub mod game_math;
pub mod instructions;
pub mod rng;
pub mod states;

use instructions::*;

declare_id!("5f9Gn6yLcMPqZfFPM9pBYQV1f1h6EBDCSs8jynjfoEQ3");

#[program]
pub mod dive_game {
    use super::*;

    pub fn init_house_vault(ctx: Context<InitializeHouseVault>, locked: bool) -> Result<()> {
        instructions::init_house_vault(ctx, locked)
    }

    /// Start a new game session with secure on-chain RNG
    /// - max_payout computed on-chain (user cannot manipulate)
    /// - RNG seed generated from slot hashes for deterministic outcomes
    pub fn start_session(
        ctx: Context<StartSession>,
        bet_amount: u64,
        session_index: u64,
    ) -> Result<()> {
        instructions::start_session(ctx, bet_amount, session_index)
    }

    /// Play a round with secure on-chain outcome computation
    /// - Outcome computed from stored RNG seed (user cannot manipulate)
    /// - Treasure calculated deterministically
    /// - Probability curve applied for win/loss
    pub fn play_round(ctx: Context<PlayRound>) -> Result<()> {
        instructions::play_round(ctx)
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
