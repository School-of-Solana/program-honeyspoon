use crate::errors::GameError;
use crate::events::{RoundPlayedEvent, SessionLostEvent};
use crate::game_math;
use crate::states::*;
use anchor_lang::prelude::*;
use anchor_lang::solana_program::hash::hash;

/// Server Authoritative RNG: server_seed is generated off-chain by the backend
/// The game_keeper (hot wallet) signs the transaction, proving authenticity
pub fn play_round(ctx: Context<PlayRound>, server_seed: u64) -> Result<()> {
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

    // --- SERVER AUTHORITATIVE RNG ---
    // Combine server entropy (server_seed) + chain entropy (slot/timestamp)
    // + context (session key, dive number)
    // This is secure because:
    // 1. User cannot forge the game_keeper's signature
    // 2. User cannot predict what server_seed the keeper will provide
    // 3. Even if the server is malicious, they can only withhold winning txs (reputation risk)
    let raw_entropy = [
        server_seed.to_le_bytes().as_ref(),
        clock.slot.to_le_bytes().as_ref(),
        session.key().to_bytes().as_ref(),
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

    /// The game keeper (server hot wallet) MUST sign this transaction
    /// This proves the 'server_seed' is authentic and prevents user simulation
    #[account(address = house_vault.game_keeper)]
    pub game_keeper: Signer<'info>,

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
