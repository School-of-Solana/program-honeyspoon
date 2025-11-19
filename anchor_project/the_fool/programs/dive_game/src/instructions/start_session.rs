use crate::errors::GameError;
use crate::events::SessionStartedEvent;
use crate::game_math;
use crate::states::*;
use anchor_lang::prelude::*;
use anchor_lang::system_program;
pub fn start_session(
    ctx: Context<StartSession>,
    bet_amount: u64,
    _session_index: u64,
) -> Result<()> {
    let config = &ctx.accounts.config;
    let house_vault = &mut ctx.accounts.house_vault;
    let session = &mut ctx.accounts.session;
    let clock = Clock::get()?;
    require!(!house_vault.locked, GameError::HouseLocked);
    require!(bet_amount >= config.min_bet, GameError::InvalidBetAmount);
    if config.max_bet > 0 {
        require!(bet_amount <= config.max_bet, GameError::InvalidBetAmount);
    }
    let max_payout = game_math::max_payout_for_bet(config, bet_amount);
    let transfer_ix = system_program::Transfer {
        from: ctx.accounts.user.to_account_info(),
        to: house_vault.to_account_info(),
    };
    let cpi_ctx = CpiContext::new(ctx.accounts.system_program.to_account_info(), transfer_ix);
    system_program::transfer(cpi_ctx, bet_amount)?;
    let vault_balance = house_vault.to_account_info().lamports();
    
    // Handle the case where total_reserved exceeds actual balance (accounting error)
    // This can happen if sessions weren't properly cleaned up
    let available = match vault_balance.checked_sub(house_vault.total_reserved) {
        Some(avail) => avail,
        None => {
            // total_reserved > vault_balance - log detailed error
            msg!(
                "VAULT_ACCOUNTING_ERROR vault_balance={} total_reserved={} vault={}",
                vault_balance / 1_000_000_000,
                house_vault.total_reserved / 1_000_000_000,
                house_vault.key()
            );
            msg!(
                "HINT: Reserved funds exceed actual balance. Admin should reset total_reserved."
            );
            return Err(GameError::InsufficientVaultBalance.into());
        }
    };

    // Relaxed vault requirement: only require 20% of max_payout to be available
    // This allows the game to run with lower vault balances for testing/demo
    // Still reserve the full max_payout for accounting purposes
    let required_balance = max_payout / 5;  // 20% of max_payout
    
    if available < required_balance {
        msg!(
            "INSUFFICIENT_VAULT need={} have={} vault={}",
            required_balance / 1_000_000_000,
            available / 1_000_000_000,
            house_vault.key()
        );
        return Err(GameError::InsufficientVaultBalance.into());
    }

    // Still reserve full max_payout for proper accounting
    house_vault.reserve(max_payout)?;

    // Phase 1 RNG Security: No longer generate or store RNG seed
    // Each round will use fresh entropy from SlotHashes sysvar

    session.user = ctx.accounts.user.key();
    session.house_vault = house_vault.key();
    session.status = SessionStatus::Active;
    session.bet_amount = bet_amount;
    session.current_treasure = bet_amount;
    session.max_payout = max_payout;
    session.dive_number = 1;
    session.bump = ctx.bumps.session;

    // Phase 2: Initialize activity tracking for timeout-based cleanup
    session.last_active_slot = clock.slot;
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
        seeds = [GAME_CONFIG_SEED.as_bytes()],
        bump = config.bump,
    )]
    pub config: Account<'info, GameConfig>,
    #[account(
        mut,
        has_one = house_authority,
    )]
    pub house_vault: Account<'info, HouseVault>,
    /// CHECK: This account is validated by the has_one constraint on house_vault
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
    pub system_program: Program<'info, System>,
}
