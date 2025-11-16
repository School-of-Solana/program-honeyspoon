use anchor_lang::prelude::*;
use anchor_lang::system_program;

use crate::errors::GameError;
use crate::events::SessionStartedEvent;
use crate::states::*;

pub fn start_session(
    ctx: Context<StartSession>,
    bet_amount: u64,
    max_payout: u64,
    session_index: u64,
) -> Result<()> {
    let house_vault = &mut ctx.accounts.house_vault;
    let session = &mut ctx.accounts.session;
    let clock = Clock::get()?;

    // Check house not locked
    require!(!house_vault.locked, GameError::HouseLocked);

    // Validate bet / payout relationship
    require!(bet_amount > 0, GameError::InvalidBetAmount);
    require!(max_payout >= bet_amount, GameError::TreasureInvalid);

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
    require!(
        available >= max_payout,
        GameError::InsufficientVaultBalance
    );

    // Reserve max_payout in house vault
    house_vault.total_reserved = house_vault
        .total_reserved
        .checked_add(max_payout)
        .ok_or(GameError::Overflow)?;

    // Initialize session
    session.user = ctx.accounts.user.key();
    session.house_vault = house_vault.key();
    session.status = SessionStatus::Active;
    session.bet_amount = bet_amount;
    session.current_treasure = bet_amount;
    session.max_payout = max_payout;
    session.dive_number = 1;
    session.bump = ctx.bumps.session;

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
#[instruction(bet_amount: u64, max_payout: u64, session_index: u64)]
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

    pub system_program: Program<'info, System>,
}
