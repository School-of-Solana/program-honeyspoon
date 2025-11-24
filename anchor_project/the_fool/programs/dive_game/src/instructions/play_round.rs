use crate::errors::GameError;
use crate::events::{RoundPlayedEvent, SessionLostEvent};
use crate::game_math;
use crate::states::*;
use anchor_lang::prelude::*;
use solana_program::hash::hash;
use solana_program::sysvar::slot_hashes::SlotHashes;

/// Simple On-Chain RNG
/// Uses slot + timestamp + session data for randomness
/// WARNING: This is predictable and suitable only for homework/demo purposes
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

    // --- FIXED RNG: Use XOR of multiple entropy sources ---
    // Combine slot, session PDA, user pubkey, and dive number
    // This approach avoids concat() which may have caused issues
    let slot_bytes = clock.slot.to_le_bytes();
    let session_bytes = session.key().to_bytes();
    let user_bytes = session.user.to_bytes();
    let dive_bytes = session.dive_number.to_le_bytes();
    
    // Create entropy by XOR-ing bytes together (simpler than concat)
    let mut entropy_seed = [0u8; 32];
    for i in 0..8 {
        entropy_seed[i] = slot_bytes[i % 8];
        entropy_seed[i + 8] = session_bytes[i];
        entropy_seed[i + 16] = user_bytes[i];
        entropy_seed[i + 24] = dive_bytes[i % 2];
    }
    
    // Add more entropy from later bytes
    for i in 0..24 {
        entropy_seed[i] ^= session_bytes[i + 8];
    }
    
    msg!("ENTROPY_SEED first_8_bytes=[{},{},{},{},{},{},{},{}]", 
        entropy_seed[0], entropy_seed[1], entropy_seed[2], entropy_seed[3],
        entropy_seed[4], entropy_seed[5], entropy_seed[6], entropy_seed[7]);

    let hash_result = hash(&entropy_seed).to_bytes();

    // Convert first 8 bytes of hash to u64, then mod 1,000,000
    let mut random_bytes = [0u8; 8];
    random_bytes.copy_from_slice(&hash_result[0..8]);
    let raw_u64 = u64::from_le_bytes(random_bytes);
    let roll = (raw_u64 % 1_000_000) as u32;
    
    msg!(
        "RNG_DEBUG slot={} ts={} dive={} hash_first_8_bytes=[{},{},{},{},{},{},{},{}] raw_u64={} roll_after_mod={}",
        clock.slot,
        clock.unix_timestamp,
        session.dive_number,
        random_bytes[0], random_bytes[1], random_bytes[2], random_bytes[3],
        random_bytes[4], random_bytes[5], random_bytes[6], random_bytes[7],
        raw_u64,
        roll
    );
    // ---------------------------------

    let survival_prob = game_math::survival_probability_bps(config, session.dive_number);

    msg!(
        "RNG_COMPARE base_survival={} decay={} min_survival={} dive={} calculated_survival={}",
        config.base_survival_ppm,
        config.decay_per_dive_ppm,
        config.min_survival_ppm,
        session.dive_number,
        survival_prob
    );

    msg!(
        "RNG_ROLL dive={} roll={} threshold={} comparison={}_{} survived={}",
        session.dive_number,
        roll,
        survival_prob,
        roll,
        survival_prob,
        roll < survival_prob
    );

    // EXPLICIT DEBUG: manually check the comparison
    let should_survive = roll < survival_prob;
    msg!("SURVIVAL_CHECK: roll={} < threshold={} = {}", roll, survival_prob, should_survive);

    if should_survive {
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

#[cfg(test)]
mod tests {
    use super::*;
    use solana_program::hash::hash;

    #[test]
    fn test_rng_distribution() {
        println!("\nTesting RNG hash distribution:");
        
        let mut rolls = Vec::new();
        let mut survivors = 0;
        let mut deaths = 0;
        
        for i in 0..1000 {
            // Simulate the RNG logic
            let entropy = format!("slot_{}_ts_{}_session_{}", 
                100000 + i, 
                1700000000 + i,
                i
            );
            
            let hash_result = hash(entropy.as_bytes()).to_bytes();
            
            let mut random_bytes = [0u8; 8];
            random_bytes.copy_from_slice(&hash_result[0..8]);
            let raw_u64 = u64::from_le_bytes(random_bytes);
            let roll = (raw_u64 % 1_000_000) as u32;
            
            rolls.push(roll);
            
            if roll < 700000 {
                survivors += 1;
            } else {
                deaths += 1;
            }
        }
        
        println!("  Total rolls: 1000");
        println!("  Survivors (roll < 700k): {}", survivors);
        println!("  Deaths (roll >= 700k): {}", deaths);
        println!("  Survival rate: {:.1}%", survivors as f64 / 10.0);
        println!("  Min roll: {}", rolls.iter().min().unwrap());
        println!("  Max roll: {}", rolls.iter().max().unwrap());
        
        // Should be around 70% survival
        assert!(survivors > 600, "Too few survivors: {}", survivors);
        assert!(survivors < 800, "Too many survivors: {}", survivors);
    }
}
