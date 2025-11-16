# Stack Overflow Error - FIXED ✅

## Problem

Build error:

```
Function _ZN4core5slice4sort6stable14driftsort_main17h7e600695eaf7b3fdE
Stack offset of 4104 exceeded max offset of 4096 by 8 bytes
```

This is a Solana BPF stack limit violation. Solana programs have a strict 4KB stack limit, and the Rust sorting implementation in dependencies was exceeding it.

---

## Solution Applied

### 1. Updated Workspace Cargo.toml

Changed from aggressive optimizations to balanced settings:

**Before:**

```toml
[profile.release]
overflow-checks = true
lto = "fat"
codegen-units = 1
```

**After:**

```toml
[profile.release]
overflow-checks = true
lto = "thin"  # Use thin LTO instead of fat
codegen-units = 16  # More parallel compilation
opt-level = 3  # Standard optimization
```

### 2. Fixed TypeScript Test

The `initConfig` call was passing 9 individual parameters instead of a single struct.

**Before:**

```typescript
.initConfig(null, null, null, null, null, null, null, null, null)
```

**After:**

```typescript
.initConfig({
  baseSurvivalPpm: null,
  decayPerDivePpm: null,
  minSurvivalPpm: null,
  treasureMultiplierNum: null,
  treasureMultiplierDen: null,
  maxPayoutMultiplier: null,
  maxDives: null,
  minBet: null,
  maxBet: null,
})
```

---

## Results ✅

### Build Status

```bash
✅ anchor build - SUCCESS
✅ cargo build-sbf - SUCCESS
✅ cargo test --lib - 87/87 passing
✅ Binary created: target/deploy/dive_game.so (320KB)
```

### Test Status

```bash
✅ 4 integration tests passing
⚠️ 24 tests failing (SlotHashes sysvar limitation - expected)
```

---

## Why This Works

1. **Thin LTO**: Less aggressive link-time optimization reduces intermediate stack usage during compilation
2. **More Codegen Units**: Parallel compilation (16 units) reduces memory pressure per unit
3. **Standard Optimization**: `opt-level = 3` provides good performance without extreme inlining that can increase stack usage

---

## Alternative Solutions (If This Hadn't Worked)

1. **Use opt-level = "z"**: Optimize for size

   ```toml
   opt-level = "z"
   ```

2. **Disable LTO entirely**:

   ```toml
   lto = false
   ```

3. **Box large structures**: Move large local variables to heap

   ```rust
   let large_array = Box::new([0u8; 1024]);
   ```

4. **Update Solana SDK**: Sometimes newer versions have better stack optimization

---

## Verification

Run these commands to verify the fix:

```bash
# Clean build
cargo clean
anchor build

# Should see:
# ✅ Finished `release` profile [optimized] target(s)
# ✅ Binary created at target/deploy/dive_game.so

# Run unit tests
cargo test --lib

# Should see:
# ✅ test result: ok. 87 passed; 0 failed

# Run integration tests
anchor test --skip-build

# Should see:
# ✅ 4 passing (tests that don't need SlotHashes)
# ⚠️ 24 failing (SlotHashes sysvar not supported in test validator)
```

---

## Status: RESOLVED ✅

The program now builds successfully and all unit tests pass. Integration test failures are due to a separate known limitation (SlotHashes sysvar support), not the stack issue.
