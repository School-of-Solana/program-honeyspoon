use anchor_lang::prelude::*;
use anchor_lang::solana_program::keccak;

/// Random Number Generation using Slot Hashes
///
/// ⚠️ SECURITY NOTE:
/// This implementation uses slot hashes which are:
/// ✅ Safe against normal user manipulation
/// ⚠️ Vulnerable to validator/MEV manipulation
///
/// For production use with high stakes, upgrade to VRF (Switchboard)
/// See: RNG_IMPLEMENTATION_PLAN.md Phase 2
///
/// Generate a base RNG seed from slot hashes and session identifier
///
/// This seed should be generated once per session and stored.
/// Individual rounds derive their randomness from this seed + round number.
///
/// # Arguments
/// * `recent_slot_hash` - Hash from a recent slot (5-10 slots ago recommended)
/// * `session_pda` - The session's PDA (ensures uniqueness per session)
///
/// # Returns
/// 32-byte seed for deterministic PRNG
pub fn generate_seed(recent_slot_hash: &[u8; 32], session_pda: &Pubkey) -> [u8; 32] {
    let mut seed_material = Vec::with_capacity(64);
    seed_material.extend_from_slice(recent_slot_hash);
    seed_material.extend_from_slice(session_pda.as_ref());

    let hash = keccak::hash(&seed_material);
    hash.0
}

/// Generate a random roll for a specific round
///
/// Uses keccak(seed || dive_number) to create a deterministic sequence
/// of random values. Each dive number gets a unique roll.
///
/// # Arguments
/// * `seed` - Base RNG seed (from generate_seed)
/// * `dive_number` - Current dive/round number
///
/// # Returns
/// Random value in range [0, 1_000_000) (basis points)
pub fn random_roll_bps(seed: &[u8; 32], dive_number: u16) -> u32 {
    let mut seed_material = Vec::with_capacity(34);
    seed_material.extend_from_slice(seed);
    seed_material.extend_from_slice(&dive_number.to_le_bytes());

    let hash = keccak::hash(&seed_material);

    // Take first 8 bytes and convert to u64
    let mut buf = [0u8; 8];
    buf.copy_from_slice(&hash.0[0..8]);
    let rand_u64 = u64::from_le_bytes(buf);

    // Map to [0, 1_000_000)
    (rand_u64 % 1_000_000) as u32
}

/// Alternative: Generate random roll directly from slot hashes (stateless)
///
/// This version doesn't store a seed - it derives randomness fresh each time
/// from the current slot hashes. Less efficient but simpler for some use cases.
///
/// ⚠️ More vulnerable to manipulation since validator can choose timing
pub fn random_roll_from_slots(slot_hash: &[u8; 32], session_pda: &Pubkey, dive_number: u16) -> u32 {
    let seed = generate_seed(slot_hash, session_pda);
    random_roll_bps(&seed, dive_number)
}

#[cfg(test)]
mod tests {
    use super::*;
    use rstest::rstest;

    // ============================================================================
    // Seed Generation Tests
    // ============================================================================

    #[test]
    fn test_seed_generation_deterministic() {
        let slot_hash = [1u8; 32];
        let pda = Pubkey::new_unique();

        let seed1 = generate_seed(&slot_hash, &pda);
        let seed2 = generate_seed(&slot_hash, &pda);

        assert_eq!(seed1, seed2, "Same inputs must produce same seed");
    }

    #[rstest]
    #[case([0u8; 32], [1u8; 32])]
    #[case([1u8; 32], [2u8; 32])]
    #[case([255u8; 32], [254u8; 32])]
    #[case([42u8; 32], [43u8; 32])]
    fn test_different_slots_different_seeds(#[case] hash1: [u8; 32], #[case] hash2: [u8; 32]) {
        let pda = Pubkey::new_unique();

        let seed1 = generate_seed(&hash1, &pda);
        let seed2 = generate_seed(&hash2, &pda);

        assert_ne!(
            seed1, seed2,
            "Different slot hashes must produce different seeds"
        );
    }

    #[test]
    fn test_different_sessions_different_seeds() {
        let slot_hash = [1u8; 32];

        // Generate multiple unique PDAs
        let pdas: Vec<Pubkey> = (0..10).map(|_| Pubkey::new_unique()).collect();

        let mut seeds = Vec::new();
        for pda in &pdas {
            seeds.push(generate_seed(&slot_hash, pda));
        }

        // All seeds should be unique
        for i in 0..seeds.len() {
            for j in (i + 1)..seeds.len() {
                assert_ne!(
                    seeds[i], seeds[j],
                    "Different PDAs must produce different seeds (index {} vs {})",
                    i, j
                );
            }
        }
    }

    #[rstest]
    #[case([0u8; 32])]
    #[case([255u8; 32])]
    #[case([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32])]
    fn test_seed_generation_various_inputs(#[case] slot_hash: [u8; 32]) {
        let pda = Pubkey::new_unique();
        let seed = generate_seed(&slot_hash, &pda);

        // Seed should be 32 bytes
        assert_eq!(seed.len(), 32);

        // Seed should be deterministic
        assert_eq!(seed, generate_seed(&slot_hash, &pda));
    }

    // ============================================================================
    // Random Roll Tests
    // ============================================================================

    #[rstest]
    #[case([42u8; 32], 1)]
    #[case([42u8; 32], 100)]
    #[case([0u8; 32], 1)]
    #[case([255u8; 32], 50)]
    fn test_roll_deterministic(#[case] seed: [u8; 32], #[case] dive: u16) {
        let roll1 = random_roll_bps(&seed, dive);
        let roll2 = random_roll_bps(&seed, dive);
        let roll3 = random_roll_bps(&seed, dive);

        assert_eq!(roll1, roll2, "Same inputs must produce same roll");
        assert_eq!(roll2, roll3, "Consistently deterministic");
    }

    #[rstest]
    #[case([1u8; 32])]
    #[case([42u8; 32])]
    #[case([123u8; 32])]
    #[case([255u8; 32])]
    fn test_different_dives_produce_different_rolls(#[case] seed: [u8; 32]) {
        let rolls: Vec<u32> = (1..=20).map(|dive| random_roll_bps(&seed, dive)).collect();

        // Count unique rolls
        let unique_count = rolls.iter().collect::<std::collections::HashSet<_>>().len();

        // Should have at least 15 unique rolls out of 20 (allowing some collisions)
        assert!(
            unique_count >= 15,
            "Expected mostly unique rolls, got {} unique out of 20",
            unique_count
        );
    }

    #[rstest]
    #[case([1u8; 32], 0)]
    #[case([1u8; 32], 1)]
    #[case([1u8; 32], 100)]
    #[case([1u8; 32], u16::MAX)]
    #[case([0u8; 32], 50)]
    #[case([255u8; 32], 50)]
    fn test_roll_always_in_range(#[case] seed: [u8; 32], #[case] dive: u16) {
        let roll = random_roll_bps(&seed, dive);
        assert!(
            roll < 1_000_000,
            "Roll {} must be < 1,000,000 for dive {}",
            roll,
            dive
        );
    }

    #[test]
    fn test_roll_range_comprehensive() {
        let seed = [42u8; 32];

        for dive in 0..=1000 {
            let roll = random_roll_bps(&seed, dive);
            assert!(
                roll < 1_000_000,
                "Roll must be < 1,000,000 (got {} at dive {})",
                roll,
                dive
            );
        }
    }

    // ============================================================================
    // Statistical Distribution Tests
    // ============================================================================

    #[rstest]
    #[case([1u8; 32], 1000)]
    #[case([42u8; 32], 1000)]
    #[case([123u8; 32], 1000)]
    fn test_roll_distribution_uniform(#[case] seed: [u8; 32], #[case] num_samples: u16) {
        const NUM_BUCKETS: usize = 10;
        let mut counts = [0u32; NUM_BUCKETS];

        for dive in 0..num_samples {
            let roll = random_roll_bps(&seed, dive);
            let bucket = (roll / 100_000) as usize;
            if bucket < NUM_BUCKETS {
                counts[bucket] += 1;
            }
        }

        let expected_per_bucket = num_samples as f64 / NUM_BUCKETS as f64;
        let tolerance = expected_per_bucket * 0.5; // ±50% tolerance

        for (i, &count) in counts.iter().enumerate() {
            let diff = (count as f64 - expected_per_bucket).abs();
            assert!(
                diff <= tolerance,
                "Bucket {} has {} rolls (expected ~{} ±{})",
                i,
                count,
                expected_per_bucket,
                tolerance
            );
        }
    }

    #[test]
    fn test_roll_coverage() {
        // Test that we can generate rolls across the full range
        let seed = [99u8; 32];
        let num_samples = 10_000;

        let mut min_roll = u32::MAX;
        let mut max_roll = 0u32;

        for dive in 0..num_samples {
            let roll = random_roll_bps(&seed, dive);
            min_roll = min_roll.min(roll);
            max_roll = max_roll.max(roll);
        }

        // Should cover a significant range
        assert!(
            min_roll < 100_000,
            "Should have some low rolls (got min {})",
            min_roll
        );
        assert!(
            max_roll > 900_000,
            "Should have some high rolls (got max {})",
            max_roll
        );
    }

    // ============================================================================
    // Edge Cases and Robustness Tests
    // ============================================================================

    #[rstest]
    #[case([0u8; 32], Pubkey::default(), 0)]
    #[case([0u8; 32], Pubkey::default(), u16::MAX)]
    #[case([255u8; 32], Pubkey::default(), 0)]
    #[case([255u8; 32], Pubkey::new_unique(), u16::MAX)]
    fn test_no_panic_edge_cases(
        #[case] slot_hash: [u8; 32],
        #[case] pda: Pubkey,
        #[case] dive: u16,
    ) {
        // Should not panic on any edge case
        let seed = generate_seed(&slot_hash, &pda);
        let _ = random_roll_bps(&seed, dive);
        let _ = random_roll_from_slots(&slot_hash, &pda, dive);
    }

    #[test]
    fn test_extreme_values() {
        // Test with extreme but valid inputs
        let extreme_seeds = [
            [0u8; 32],
            [255u8; 32],
            [170u8; 32], // 0xAA pattern
            [85u8; 32],  // 0x55 pattern
        ];

        for seed in &extreme_seeds {
            for dive in [0, 1, 100, 1000, u16::MAX].iter() {
                let roll = random_roll_bps(seed, *dive);
                assert!(roll < 1_000_000, "Roll {} out of range", roll);
            }
        }
    }

    // ============================================================================
    // Collision Resistance Tests
    // ============================================================================

    #[test]
    fn test_seed_collision_resistance() {
        // Test that small changes in input produce different seeds
        let base_hash = [100u8; 32];
        let base_pda = Pubkey::new_unique();
        let base_seed = generate_seed(&base_hash, &base_pda);

        // Change one byte of hash
        let mut modified_hash = base_hash;
        modified_hash[0] = 101;
        let modified_seed = generate_seed(&modified_hash, &base_pda);

        assert_ne!(
            base_seed, modified_seed,
            "One byte change should produce different seed"
        );

        // Different PDA
        let different_pda = Pubkey::new_unique();
        let different_seed = generate_seed(&base_hash, &different_pda);

        assert_ne!(
            base_seed, different_seed,
            "Different PDA should produce different seed"
        );
    }

    #[test]
    fn test_roll_collision_resistance() {
        // Sequential dive numbers should not have obvious patterns
        let seed = [77u8; 32];

        let rolls: Vec<u32> = (0..100).map(|dive| random_roll_bps(&seed, dive)).collect();

        // Check no obvious sequential patterns
        let mut sequential_pairs = 0;
        for i in 0..(rolls.len() - 1) {
            let diff = if rolls[i + 1] > rolls[i] {
                rolls[i + 1] - rolls[i]
            } else {
                rolls[i] - rolls[i + 1]
            };

            // If difference is very small, might indicate pattern
            if diff < 1000 {
                sequential_pairs += 1;
            }
        }

        // Should have very few sequential pairs (< 5% by chance)
        assert!(
            sequential_pairs < 5,
            "Too many sequential patterns detected ({})",
            sequential_pairs
        );
    }

    // ============================================================================
    // Integration Tests
    // ============================================================================

    #[test]
    fn test_full_session_simulation() {
        // Simulate a complete game session
        let slot_hash = [77u8; 32];
        let session_pda = Pubkey::new_unique();

        // Generate seed once at session start
        let seed = generate_seed(&slot_hash, &session_pda);

        // Simulate 50 rounds
        let mut rolls = Vec::new();
        for dive in 1..=50 {
            let roll = random_roll_bps(&seed, dive);
            rolls.push(roll);

            // All rolls must be valid
            assert!(roll < 1_000_000);
        }

        // Verify properties
        assert_eq!(rolls.len(), 50);

        // Most rolls should be unique
        let unique_count = rolls.iter().collect::<std::collections::HashSet<_>>().len();
        assert!(unique_count >= 45, "Expected mostly unique rolls");
    }

    #[rstest]
    #[case(10)]
    #[case(50)]
    #[case(100)]
    fn test_multiple_sessions_independent(#[case] num_sessions: usize) {
        let slot_hash = [123u8; 32];

        let mut first_rolls = Vec::new();

        for _ in 0..num_sessions {
            let session_pda = Pubkey::new_unique();
            let seed = generate_seed(&slot_hash, &session_pda);
            let roll = random_roll_bps(&seed, 1);

            first_rolls.push(roll);
        }

        // Sessions should be independent (different first rolls)
        let unique_count = first_rolls
            .iter()
            .collect::<std::collections::HashSet<_>>()
            .len();

        // At least 90% should be unique
        let min_unique = (num_sessions as f64 * 0.9) as usize;
        assert!(
            unique_count >= min_unique,
            "Expected at least {} unique first rolls, got {}",
            min_unique,
            unique_count
        );
    }

    #[test]
    fn test_determinism_across_all_functions() {
        let slot_hash = [42u8; 32];
        let pda = Pubkey::new_unique();

        // Seed generation is deterministic
        let seed1 = generate_seed(&slot_hash, &pda);
        let seed2 = generate_seed(&slot_hash, &pda);
        assert_eq!(seed1, seed2);

        // Roll generation is deterministic
        for dive in 0..=100 {
            let roll1 = random_roll_bps(&seed1, dive);
            let roll2 = random_roll_bps(&seed2, dive);
            assert_eq!(roll1, roll2);
        }

        // Stateless function is also deterministic
        for dive in 0..=10 {
            let roll1 = random_roll_from_slots(&slot_hash, &pda, dive);
            let roll2 = random_roll_from_slots(&slot_hash, &pda, dive);
            assert_eq!(roll1, roll2);
        }
    }
}
