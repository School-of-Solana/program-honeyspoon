use crate::errors::GameError;
use crate::events::{RoundPlayedEvent, SessionLostEvent};
use crate::game_math;
use crate::rng;
use crate::states::*;
use anchor_lang::prelude::*;
use anchor_lang::solana_program::sysvar::slot_hashes::{SlotHashes, ID as SLOT_HASHES_ID};
pub fn play_round(ctx: Context<PlayRound>) -> Result<()> {
    let config = &ctx.accounts.config;
    let session = &mut ctx.accounts.session;
    let house_vault = &mut ctx.accounts.house_vault;
    let clock = Clock::get()?;

    // Strict lock: house lock blocks all operations except lose_session
    require!(!house_vault.locked, GameError::HouseLocked);

    // Use helper method to ensure session is active
    session.ensure_active()?;

    require!(
        session.dive_number < config.max_dives,
        GameError::MaxDivesReached
    );

    // Phase 1 RNG Security: Use SlotHashes for per-round entropy
    let slot_hashes = SlotHashes::from_account_info(&ctx.accounts.slot_hashes)?;

    // Get the most recent slot hash (or use a recent one)
    let slot1 = clock.slot.saturating_sub(1);
    let slot2 = clock.slot.saturating_sub(2);
    let slot3 = clock.slot.saturating_sub(3);

    let recent_slot_hash = slot_hashes
        .get(&slot1)
        .or_else(|| slot_hashes.get(&slot2))
        .or_else(|| slot_hashes.get(&slot3))
        .ok_or(GameError::InvalidSlotHash)?;

    let roll = rng::random_roll_from_slots(
        &recent_slot_hash.to_bytes(),
        &session.key(),
        session.dive_number,
    );
    let survival_prob = game_math::survival_probability_bps(config, session.dive_number);
    if roll < survival_prob {
        session.dive_number += 1;
        session.current_treasure =
            game_math::treasure_for_dive(config, session.bet_amount, session.dive_number);
        emit!(RoundPlayedEvent {
            session: session.key(),
            user: session.user,
            dive_number: session.dive_number,
            current_treasure: session.current_treasure,
            timestamp: clock.unix_timestamp,
        });
    } else {
        // Use helper methods for state transition and fund release
        session.mark_lost()?;
        house_vault.release(session.max_payout)?;

        emit!(SessionLostEvent {
            session: session.key(),
            user: session.user,
            house_vault: session.house_vault,
            bet_amount: session.bet_amount,
            final_dive_number: session.dive_number,
            timestamp: clock.unix_timestamp,
        });
    }
    Ok(())
}
#[derive(Accounts)]
pub struct PlayRound<'info> {
    #[account(mut)]
    pub user: Signer<'info>,
    #[account(
        seeds = [GAME_CONFIG_SEED.as_bytes()],
        bump = config.bump,
    )]
    pub config: Account<'info, GameConfig>,
    #[account(
        mut,
        has_one = user,
        has_one = house_vault,
    )]
    pub session: Account<'info, GameSession>,
    #[account(mut)]
    pub house_vault: Account<'info, HouseVault>,
    /// SlotHashes sysvar for per-round entropy
    /// CHECK: This is the SlotHashes sysvar account
    #[account(address = SLOT_HASHES_ID)]
    pub slot_hashes: AccountInfo<'info>,
}
