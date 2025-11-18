use anchor_lang::prelude::*;
pub mod errors;
pub mod events;
pub mod game_math;
pub mod instructions;
pub mod rng;
pub mod states;
use instructions::init_config::GameConfigParams;
use instructions::*;
declare_id!("9GxDuBwkkzJWe7ij6xrYv5FFAuqkDW5hjtripZAJgKb7");
#[program]
pub mod dive_game {
    use super::*;
    pub fn init_config(ctx: Context<InitializeConfig>, params: GameConfigParams) -> Result<()> {
        instructions::init_config(ctx, params)
    }
    pub fn init_house_vault(ctx: Context<InitializeHouseVault>, locked: bool) -> Result<()> {
        instructions::init_house_vault(ctx, locked)
    }
    pub fn start_session(
        ctx: Context<StartSession>,
        bet_amount: u64,
        session_index: u64,
    ) -> Result<()> {
        instructions::start_session(ctx, bet_amount, session_index)
    }
    pub fn play_round(ctx: Context<PlayRound>, server_seed: u64) -> Result<()> {
        instructions::play_round(ctx, server_seed)
    }
    pub fn lose_session(ctx: Context<LoseSession>) -> Result<()> {
        instructions::lose_session(ctx)
    }
    pub fn cash_out(ctx: Context<CashOut>) -> Result<()> {
        instructions::cash_out(ctx)
    }
    pub fn toggle_house_lock(ctx: Context<ToggleHouseLock>) -> Result<()> {
        instructions::toggle_house_lock::toggle_house_lock(ctx)
    }
    pub fn clean_expired_session(ctx: Context<CleanExpired>) -> Result<()> {
        instructions::clean_expired_session::clean_expired_session(ctx)
    }
    pub fn withdraw_house(ctx: Context<WithdrawHouse>, amount: u64) -> Result<()> {
        instructions::withdraw_house(ctx, amount)
    }
}
