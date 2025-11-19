# Deployment Guide - Fixed Program

## Current Status

✅ **Code Fixed & Committed**
- Enhanced overflow error handling  
- New `reset_vault_reserved` admin instruction
- Better error logging for vault accounting issues

❌ **Not Yet Deployed**
- Insufficient devnet SOL for deployment (~2.5 SOL needed)
- Currently have: 0.09 SOL

## The Problem We Fixed

### Overflow Error (Error 6006)
**Root Cause:** Vault's `total_reserved` (10 SOL) exceeded actual balance (6.84 SOL), causing arithmetic overflow.

**Why It Happened:** Active sessions that crashed or timed out didn't properly release their reservations.

**How We Fixed It:**
1. Better error handling with detailed logging
2. New admin instruction to reset `total_reserved`
3. Clear error messages for debugging

## How to Deploy (When SOL is Available)

### Option 1: Automated Script
```bash
# Get devnet SOL first (see below)
cd /Users/abder/school_of_solana/program-honeyspoon
bash scripts/deploy-and-fix-vault.sh
```

This script will:
1. Check SOL balance
2. Deploy the fixed program
3. Sync IDL to frontend
4. Reset vault's `total_reserved` to 0
5. Display vault state

### Option 2: Manual Steps

**Step 1: Deploy Program**
```bash
cd anchor_project/the_fool
anchor deploy --provider.cluster devnet
```

**Step 2: Sync IDL**
```bash
cd ../..
bash scripts/sync-idl.sh
```

**Step 3: Reset Vault Reserved**
```bash
cd anchor_project/the_fool
# Create a script or use anchor CLI to call:
# program.methods.resetVaultReserved().accounts({...}).rpc()
```

## Getting Devnet SOL

### Web Faucets (Manual)
1. **Official Solana Faucet**: https://faucet.solana.com  
   - Enter wallet: `7qdd7r1CJdnXVcr3bFD5CyBRyDF9eW4taoJqABhN5hXW`
   - Request 5 SOL (may be rate limited)

2. **SolFaucet**: https://solfaucet.com
   - Alternative faucet
   - May have different rate limits

3. **QuickNode Faucet**: https://faucet.quicknode.com/solana/devnet
   - Another option

### CLI (Currently Rate Limited)
```bash
solana airdrop 5 --url https://api.devnet.solana.com
```

## Temporary Workaround (Without Deployment)

Since the vault has 6.84 SOL but needs 10 SOL to cover reserved funds:

```bash
# Send 4 more SOL to vault
solana transfer EF6u3Zw2tv8w5ao6KeqpDbnFxzh2mt4DN6PLEzEnwVoV 4 \
  --url https://api.devnet.solana.com \
  --allow-unfunded-recipient
```

This brings vault to ~11 SOL, allowing `vault_balance (11) > total_reserved (10)` ✅

**Note:** This is a temporary fix. The accounting will still be wrong, but transactions won't fail with overflow.

## What Changed in the Code

### 1. Enhanced Error Handling (`start_session.rs`)
**Before:**
```rust
let available = vault_balance
    .checked_sub(house_vault.total_reserved)
    .ok_or(GameError::Overflow)?;  // Silent failure
```

**After:**
```rust
let available = match vault_balance.checked_sub(house_vault.total_reserved) {
    Some(avail) => avail,
    None => {
        msg!("VAULT_ACCOUNTING_ERROR vault_balance={} total_reserved={} vault={}",
            vault_balance / 1_000_000_000,
            house_vault.total_reserved / 1_000_000_000,
            house_vault.key()
        );
        msg!("HINT: Reserved funds exceed actual balance. Admin should reset total_reserved.");
        return Err(GameError::InsufficientVaultBalance.into());
    }
};
```

### 2. New Admin Instruction
**File:** `programs/dive_game/src/instructions/reset_vault_reserved.rs`

Allows house authority to reset `total_reserved` to 0 when accounting gets out of sync.

**Safety:** Should only be used when there are NO active sessions.

## Verification After Deployment

```bash
# Check vault state
solana account EF6u3Zw2tv8w5ao6KeqpDbnFxzh2mt4DN6PLEzEnwVoV \
  --url https://api.devnet.solana.com

# Expected after reset:
# - Balance: ~6.84 SOL
# - Reserved: 0 SOL
# - Available: ~6.84 SOL
```

## Testing Checklist

After deployment:
- [ ] Start a new game (0.1 SOL bet)
- [ ] Verify no overflow errors
- [ ] Check vault reserved increases correctly
- [ ] Cash out successfully
- [ ] Verify vault reserved decreases correctly
- [ ] Monitor error logs for any issues

## Contact & Support

If you encounter issues:
1. Check the error parser output (now includes detailed logging)
2. Verify vault state with the commands above
3. Check recent transactions on Solana Explorer
4. Review program logs for detailed error messages

## Files Modified

- `programs/dive_game/src/instructions/start_session.rs` - Enhanced error handling
- `programs/dive_game/src/instructions/reset_vault_reserved.rs` - New admin instruction
- `programs/dive_game/src/instructions/mod.rs` - Export new instruction
- `programs/dive_game/src/lib.rs` - Add new instruction to program
- `scripts/deploy-and-fix-vault.sh` - Automated deployment script

All changes committed to git: `03490b6`
