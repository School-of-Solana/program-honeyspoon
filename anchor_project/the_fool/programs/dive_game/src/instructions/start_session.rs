use anchor_lang::prelude::*;
use anchor_lang::solana_program::sysvar::slot_hashes::SlotHashes;
use anchor_lang::system_program;

use crate::errors::GameError;
use crate::events::SessionStartedEvent;
use crate::game_math;
use crate::rng;
use crate::states::*;

/// Start a new game session with secure on-chain RNG
///
/// This implementation:
/// - Calculates max_payout on-chain (user cannot manipulate)
/// - Generates RNG seed from slot hashes (deterministic outcomes)
///
/// # Security
/// All game parameters are computed on-chain. The user only controls:
/// - bet_amount (how much they wager)
/// - session_index (which session slot to use)
pub fn start_session(
    ctx: Context<StartSession>,
    bet_amount: u64,
    session_index: u64,
) -> Result<()> {
    let house_vault = &mut ctx.accounts.house_vault;
    let session = &mut ctx.accounts.session;
    let clock = Clock::get()?;

    // Check house not locked
    require!(!house_vault.locked, GameError::HouseLocked);

    // Validate bet amount
    require!(bet_amount > 0, GameError::InvalidBetAmount);

    // Calculate max payout on-chain (no user input!)
    let max_payout = game_math::max_payout_for_bet(bet_amount);

    // Transfer bet from user to house vault
    let transfer_ix = system_program::Transfer {
        from: ctx.accounts.user.to_account_info(),
        to: house_vault.to_account_info(),
    };
    let cpi_ctx = CpiContext::new(ctx.accounts.system_program.to_account_info(), transfer_ix);
    system_program::transfer(cpi_ctx, bet_amount)?;

    // Check free liquidity vs new reservation
    let vault_balance = house_vault.to_account_info().lamports();
    let available = vault_balance
        .checked_sub(house_vault.total_reserved)
        .ok_or(GameError::Overflow)?;
    require!(available >= max_payout, GameError::InsufficientVaultBalance);

    // Reserve max_payout in house vault
    house_vault.total_reserved = house_vault
        .total_reserved
        .checked_add(max_payout)
        .ok_or(GameError::Overflow)?;

    // Generate RNG seed from slot hashes
    // We access SlotHashes sysvar to get recent slot hash
    let slot_hashes = SlotHashes::from_account_info(&ctx.accounts.slot_hashes)?;

    // Use a recent slot hash (not the very latest to reduce validator manipulation)
    // Try to get 5 slots back, otherwise use most recent
    let recent_slot = clock.slot.saturating_sub(5);
    let slot_hash = if let Some(hash) = slot_hashes.get(&recent_slot) {
        hash.to_bytes()
    } else if let Some(hash) = slot_hashes.get(&clock.slot.saturating_sub(1)) {
        hash.to_bytes()
    } else {
        // Fallback: use clock slot as seed (less ideal but prevents failure)
        let mut fallback = [0u8; 32];
        fallback[0..8].copy_from_slice(&clock.slot.to_le_bytes());
        fallback
    };

    // Generate seed using slot hash + session PDA
    let rng_seed = rng::generate_seed(&slot_hash, &session.key());

    // Initialize session
    session.user = ctx.accounts.user.key();
    session.house_vault = house_vault.key();
    session.status = SessionStatus::Active;
    session.bet_amount = bet_amount;
    session.current_treasure = bet_amount; // Start with bet amount
    session.max_payout = max_payout;
    session.dive_number = 1;
    session.bump = ctx.bumps.session;
    session.rng_seed = rng_seed; // Fixed-size array, no .to_vec() needed

    emit!(SessionStartedEvent {
        session: session.key(),
        user: session.user,
        house_vault: session.house_vault,
        bet_amount: session.bet_amount,
        max_payout: session.max_payout,
        timestamp: clock.unix_timestamp,
    });

    Ok(())
}

#[derive(Accounts)]
#[instruction(bet_amount: u64, session_index: u64)]
pub struct StartSession<'info> {
    #[account(mut)]
    pub user: Signer<'info>,

    #[account(
        mut,
        has_one = house_authority,
    )]
    pub house_vault: Account<'info, HouseVault>,

    /// CHECK: Only used for seeds verification
    pub house_authority: UncheckedAccount<'info>,

    #[account(
        init,
        payer = user,
        space = 8 + GameSession::INIT_SPACE,
        seeds = [
            SESSION_SEED.as_bytes(),
            user.key().as_ref(),
            session_index.to_le_bytes().as_ref()
        ],
        bump
    )]
    pub session: Account<'info, GameSession>,

    /// Slot hashes sysvar for RNG seed generation
    /// CHECK: This is the slot hashes sysvar
    #[account(address = anchor_lang::solana_program::sysvar::slot_hashes::ID)]
    pub slot_hashes: AccountInfo<'info>,

    pub system_program: Program<'info, System>,
}
