use crate::errors::GameError;
use crate::events::{RoundPlayedEvent, SessionLostEvent};
use crate::game_math;
use crate::states::*;
use anchor_lang::prelude::*;
use solana_program::hash::hash;

/// Simple On-Chain RNG
/// Uses slot + timestamp + session data for randomness
/// ⚠️ Note: This is predictable and suitable only for homework/demo purposes
/// For production, use SlotHashes sysvar or Switchboard VRF
pub fn play_round(ctx: Context<PlayRound>) -> Result<()> {
    let config = &ctx.accounts.config;
    let session = &mut ctx.accounts.session;
    let house_vault = &mut ctx.accounts.house_vault;
    let clock = Clock::get()?;

    // Strict lock: house lock blocks all operations except lose_session
    require!(!house_vault.locked, GameError::HouseLocked);

    // Manual check that session is active (more efficient than helper method)
    require!(
        session.status == SessionStatus::Active,
        GameError::InvalidSessionStatus
    );

    require!(
        session.dive_number < config.max_dives,
        GameError::MaxDivesReached
    );

    // --- SIMPLE ON-CHAIN RNG ---
    // Combine various on-chain data for pseudo-randomness
    // This is deterministic but unpredictable enough for homework/demo
    let raw_entropy = [
        clock.slot.to_le_bytes().as_ref(),
        clock.unix_timestamp.to_le_bytes().as_ref(),
        session.key().to_bytes().as_ref(),
        session.user.to_bytes().as_ref(),
        session.dive_number.to_le_bytes().as_ref(),
    ]
    .concat();

    let hash_result = hash(&raw_entropy).to_bytes();

    // Convert first 8 bytes of hash to u64, then mod 1,000,000
    let mut random_bytes = [0u8; 8];
    random_bytes.copy_from_slice(&hash_result[0..8]);
    let roll = (u64::from_le_bytes(random_bytes) % 1_000_000) as u32;
    // ---------------------------------

    let survival_prob = game_math::survival_probability_bps(config, session.dive_number);

    if roll < survival_prob {
        // --- PLAYER SURVIVED ---
        session.dive_number += 1;
        session.current_treasure =
            game_math::treasure_for_dive(config, session.bet_amount, session.dive_number);

        // Update activity tracking
        session.last_active_slot = clock.slot;

        emit!(RoundPlayedEvent {
            session: session.key(),
            user: session.user,
            dive_number: session.dive_number,
            current_treasure: session.current_treasure,
            timestamp: clock.unix_timestamp,
        });
    } else {
        // --- PLAYER LOST (ATOMIC CLEANUP) ---
        // Release the reservation
        house_vault.release(session.max_payout)?;

        emit!(SessionLostEvent {
            session: session.key(),
            user: session.user,
            house_vault: session.house_vault,
            bet_amount: session.bet_amount,
            final_dive_number: session.dive_number,
            timestamp: clock.unix_timestamp,
        });

        // ATOMIC CLOSE: Refund rent to user immediately
        let user_lamports = ctx.accounts.user.lamports();
        let session_lamports = session.to_account_info().lamports();

        // Transfer all lamports from session to user
        **ctx.accounts.user.try_borrow_mut_lamports()? = user_lamports
            .checked_add(session_lamports)
            .ok_or(GameError::Overflow)?;

        **session.to_account_info().try_borrow_mut_lamports()? = 0;

        // Account is now closed and will be garbage collected by runtime
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
}
