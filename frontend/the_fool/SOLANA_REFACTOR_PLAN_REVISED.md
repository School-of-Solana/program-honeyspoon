# SOLANA REFACTORING PLAN (REVISED)
## Aligned with Actual Contract Implementation

> **Context**: The contract is being implemented independently following the Twitter/Vault pattern. This plan now aligns the frontend refactoring with the **actual contract design**.

---

## KEY CHANGES FROM ORIGINAL PLAN

### What Changed

**ORIGINAL PLAN ASSUMED:**
- 4 instructions: `place_bet`, `play_round`, `cash_out`, `cancel_session`
- Simple validation on-chain
- Client calculates outcomes, server validates
- Generic "game chain port" abstraction

**ACTUAL CONTRACT HAS:**
- 6 instructions: `init_house_vault`, `toggle_house_lock`, `start_session`, `play_round`, `lose_session`, `cash_out`
- Twitter-style PDA patterns with seeds
- Vault-style locked state
- Server **pushes updates** to chain (not just validates)
- Explicit session status enum: `Active | Lost | CashedOut | Expired`

### Critical Differences

| Aspect | Original Plan | Actual Contract |
|--------|--------------|-----------------|
| **House Management** | Implicit, no vault | Explicit `HouseVault` PDA with `locked` flag |
| **Session Creation** | `placeBet()` | `start_session()` with vault transfer |
| **Round Updates** | Client calculates | Server calls `play_round()` with new state |
| **Losing** | Implicit in status | Explicit `lose_session()` instruction |
| **Error Style** | Generic codes | Anchor errors: `HouseLocked`, `RoundMismatch`, etc. |
| **PDA Seeds** | Unspecified | `[SESSION_SEED, user, index/nonce]` |

---

## REVISED ARCHITECTURE

### Contract-First Design

```
┌────────────────────────────────────────────┐
│         Anchor Program (Rust)              │
│   Independent repo: dive-game-chain/       │
├────────────────────────────────────────────┤
│  Instructions:                             │
│  1. init_house_vault                       │
│  2. toggle_house_lock                      │
│  3. start_session                          │
│  4. play_round                             │
│  5. lose_session                           │
│  6. cash_out                               │
│                                            │
│  Accounts (PDAs):                          │
│  • HouseVault [HOUSE_VAULT_SEED, auth]    │
│  • GameSession [SESSION_SEED, user, nonce] │
│                                            │
│  Errors:                                   │
│  • HouseLocked                             │
│  • InvalidSessionStatus                    │
│  • RoundMismatch                           │
│  • TreasureInvalid                         │
│  • Overflow                                │
└────────────────────────────────────────────┘
                    │
                    │ Generate IDL
                    ▼
┌────────────────────────────────────────────┐
│        Frontend Integration                │
│   Main repo: program-honeyspoon/          │
├────────────────────────────────────────────┤
│  SolanaGameChain (implements GameChainPort)│
│  • Imports IDL types                       │
│  • Derives PDAs with same seeds            │
│  • Maps Anchor errors → GameErrorCode      │
│  • Calls contract instructions via RPC    │
└────────────────────────────────────────────┘
```

---

## PHASE 1: ALIGN ERROR CODES WITH CONTRACT

### Contract's GameError Enum

```rust
// In the contract (Rust)
#[error_code]
pub enum GameError {
    #[msg("House is locked")]
    HouseLocked,
    #[msg("Session is not active")]
    InvalidSessionStatus,
    #[msg("Caller is not session user")]
    WrongUser,
    #[msg("Round number mismatch")]
    RoundMismatch,
    #[msg("Treasure invalid (non-monotone or exceeds max payout)")]
    TreasureInvalid,
    #[msg("Insufficient vault balance")]
    InsufficientVaultBalance,
    #[msg("Overflow")]
    Overflow,
}
```

### Frontend GameErrorCode (Must Match!)

**File**: `lib/ports/GameErrors.ts`

```typescript
export enum GameErrorCode {
  // Direct mappings from Anchor GameError
  HOUSE_LOCKED = "HOUSE_LOCKED",
  INVALID_SESSION_STATUS = "INVALID_SESSION_STATUS",
  WRONG_USER = "WRONG_USER",
  ROUND_MISMATCH = "ROUND_MISMATCH",
  TREASURE_INVALID = "TREASURE_INVALID",
  INSUFFICIENT_VAULT_BALANCE = "INSUFFICIENT_VAULT_BALANCE",
  OVERFLOW = "OVERFLOW",
  
  // Additional frontend-only codes
  INSUFFICIENT_USER_FUNDS = "INSUFFICIENT_USER_FUNDS",
  BET_BELOW_MINIMUM = "BET_BELOW_MINIMUM",
  BET_ABOVE_MAXIMUM = "BET_ABOVE_MAXIMUM",
  NETWORK_ERROR = "NETWORK_ERROR",
  INTERNAL_ERROR = "INTERNAL_ERROR",
}

export class GameError extends Error {
  constructor(
    public readonly code: GameErrorCode,
    message: string,
    public readonly details?: Record<string, any>
  ) {
    super(message);
    this.name = "GameError";
  }

  // Factory methods matching contract errors
  static houseLocked(): GameError {
    return new GameError(
      GameErrorCode.HOUSE_LOCKED,
      "House is locked"
    );
  }

  static invalidSessionStatus(): GameError {
    return new GameError(
      GameErrorCode.INVALID_SESSION_STATUS,
      "Session is not active"
    );
  }

  static roundMismatch(expected: number, got: number): GameError {
    return new GameError(
      GameErrorCode.ROUND_MISMATCH,
      `Round number mismatch: expected ${expected}, got ${got}`,
      { expected, got }
    );
  }

  static treasureInvalid(reason: string): GameError {
    return new GameError(
      GameErrorCode.TREASURE_INVALID,
      `Treasure invalid: ${reason}`
    );
  }

  // Helper: Parse Anchor error to GameError
  static fromAnchor(anchorError: any): GameError {
    // Extract error code from Anchor error
    const errorCode = anchorError.error?.errorCode?.code;
    
    switch (errorCode) {
      case "HouseLocked":
        return GameError.houseLocked();
      case "InvalidSessionStatus":
        return GameError.invalidSessionStatus();
      case "RoundMismatch":
        return new GameError(GameErrorCode.ROUND_MISMATCH, anchorError.message);
      case "TreasureInvalid":
        return GameError.treasureInvalid(anchorError.message);
      case "Overflow":
        return new GameError(GameErrorCode.OVERFLOW, "Arithmetic overflow");
      default:
        return new GameError(
          GameErrorCode.INTERNAL_ERROR,
          anchorError.message || "Unknown error"
        );
    }
  }
}
```

---

## PHASE 2: UPDATE GameChainPort TO MATCH CONTRACT

### Revised Interface

**File**: `lib/ports/GameChainPort.ts`

```typescript
export type SessionHandle = string; // Base58 PDA address

// Match contract's SessionStatus enum exactly
export enum SessionStatus {
  Active = "Active",
  Lost = "Lost",
  CashedOut = "CashedOut",
  Expired = "Expired",
}

// Match contract's GameSession account
export interface GameSessionState {
  sessionPda: SessionHandle;
  user: string; // Pubkey as base58
  houseVault: string; // Pubkey as base58
  status: SessionStatus;
  betAmount: bigint; // u64 lamports
  currentTreasure: bigint; // u64 lamports
  maxPayout: bigint; // u64 lamports
  diveNumber: number; // u16
  bump: number; // u8
}

// Match contract's HouseVault account
export interface HouseVaultState {
  vaultPda: string;
  houseAuthority: string;
  locked: boolean;
  totalReserved: bigint;
  bump: number;
}

export interface GameChainPort {
  /**
   * Initialize house vault (admin only, one-time)
   * Maps to: init_house_vault instruction
   */
  initHouseVault(params: {
    houseAuthority: string; // Pubkey
  }): Promise<{
    vaultPda: string;
    state: HouseVaultState;
  }>;

  /**
   * Toggle house lock (admin only)
   * Maps to: toggle_house_lock instruction
   */
  toggleHouseLock(params: {
    vaultPda: string;
    houseAuthority: string;
  }): Promise<HouseVaultState>;

  /**
   * Start a new game session
   * Maps to: start_session instruction
   * 
   * On-chain behavior:
   * - Transfers bet_amount lamports from user → house_vault
   * - Creates GameSession PDA
   * - Increments house_vault.total_reserved by max_payout
   */
  startSession(params: {
    userPubkey: string;
    betAmountLamports: bigint;
    maxPayoutLamports: bigint;
    houseVaultPda: string;
  }): Promise<{
    sessionPda: SessionHandle;
    state: GameSessionState;
  }>;

  /**
   * Play a round (update session state)
   * Maps to: play_round instruction
   * 
   * On-chain behavior:
   * - Validates round number matches session.dive_number + 1
   * - Validates new_treasure >= current_treasure
   * - Validates new_treasure <= max_payout
   * - Updates session fields
   */
  playRound(params: {
    sessionPda: SessionHandle;
    userPubkey: string;
    newTreasureLamports: bigint;
    newDiveNumber: number;
  }): Promise<GameSessionState>;

  /**
   * Mark session as lost
   * Maps to: lose_session instruction
   * 
   * On-chain behavior:
   * - Sets status = Lost
   * - Decrements house_vault.total_reserved by max_payout
   * - House keeps the bet (no transfer)
   */
  loseSession(params: {
    sessionPda: SessionHandle;
    userPubkey: string;
  }): Promise<GameSessionState>;

  /**
   * Cash out winnings
   * Maps to: cash_out instruction
   * 
   * On-chain behavior:
   * - Validates house not locked
   * - Transfers current_treasure from house_vault → user
   * - Decrements house_vault.total_reserved by max_payout
   * - Sets status = CashedOut
   */
  cashOut(params: {
    sessionPda: SessionHandle;
    userPubkey: string;
  }): Promise<{
    finalTreasureLamports: bigint;
    state: GameSessionState;
  }>;

  /**
   * Get house vault state
   */
  getHouseVault(vaultPda: string): Promise<HouseVaultState>;

  /**
   * Get session state
   */
  getSession(sessionPda: SessionHandle): Promise<GameSessionState | null>;
}
```

**Key Changes:**
- Added `initHouseVault()` and `toggleHouseLock()` - match contract
- `startSession()` now takes `houseVaultPda` parameter
- `playRound()` takes explicit `newTreasure` and `newDiveNumber` - no client outcome calculation
- Added explicit `loseSession()` instruction
- All state types match contract's Rust structs exactly

---

## PHASE 3: CREATE PDA DERIVATION HELPERS

**File**: `lib/solana/pdas.ts`

These must match the contract's seed logic **exactly**:

```typescript
import { PublicKey } from "@solana/web3.js";

// Seeds must match contract exactly
export const HOUSE_VAULT_SEED = "HOUSE_VAULT";
export const SESSION_SEED = "SESSION_SEED";

/**
 * Derive HouseVault PDA
 * Contract seeds: [HOUSE_VAULT_SEED.as_bytes(), house_authority.key().as_ref()]
 */
export function getHouseVaultAddress(
  houseAuthority: PublicKey,
  programId: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from(HOUSE_VAULT_SEED),
      houseAuthority.toBuffer(),
    ],
    programId
  );
}

/**
 * Derive GameSession PDA
 * Contract seeds: [SESSION_SEED.as_bytes(), user.key().as_ref(), index/nonce]
 * 
 * NOTE: If contract uses index or nonce, must match here!
 */
export function getSessionAddress(
  user: PublicKey,
  sessionNonce: Buffer, // 8 bytes for u64, or hash
  programId: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [
      Buffer.from(SESSION_SEED),
      user.toBuffer(),
      sessionNonce, // Must match contract's seed design
    ],
    programId
  );
}

/**
 * Helper: Generate session nonce (if contract uses sequential index)
 */
export function sessionNonceFromIndex(index: number): Buffer {
  const buf = Buffer.alloc(8);
  buf.writeBigUInt64LE(BigInt(index));
  return buf;
}
```

**CRITICAL:** These helpers **must** produce the exact same PDAs as the contract. Test by comparing with `anchor.workspace.DiveGame.account.gameSession.all()`.

---

## PHASE 4: IMPLEMENT LocalGameChain TO SIMULATE CONTRACT

**File**: `lib/ports/LocalGameChain.ts` (UPDATED)

The local implementation must **mimic contract behavior exactly**:

```typescript
import { GameChainPort, SessionStatus, GameSessionState, HouseVaultState } from "./GameChainPort";
import { GameError, GameErrorCode } from "./GameErrors";
import { lamportsToDollars, dollarsToLamports } from "../utils/lamports";

/**
 * Local in-memory implementation that simulates the Anchor contract
 */
export class LocalGameChain implements GameChainPort {
  
  // In-memory state mimicking on-chain accounts
  private houseVaults = new Map<string, HouseVaultState>();
  private sessions = new Map<string, GameSessionState>();
  private userBalances = new Map<string, bigint>(); // Simulate SOL balances

  constructor(
    private readonly initialHouseBalance: bigint = 500_000_000_000_000n // 500k SOL in lamports
  ) {}

  async initHouseVault(params: {
    houseAuthority: string;
  }): Promise<{ vaultPda: string; state: HouseVaultState }> {
    
    // Simulate PDA derivation (just use authority as key for local)
    const vaultPda = `vault_${params.houseAuthority}`;
    
    if (this.houseVaults.has(vaultPda)) {
      // Mimic "account already in use" error
      throw new Error("Account already in use");
    }
    
    const state: HouseVaultState = {
      vaultPda,
      houseAuthority: params.houseAuthority,
      locked: false,
      totalReserved: 0n,
      bump: 255, // Simulated bump
    };
    
    this.houseVaults.set(vaultPda, state);
    
    // Initialize vault balance
    this.userBalances.set(vaultPda, this.initialHouseBalance);
    
    return { vaultPda, state };
  }

  async toggleHouseLock(params: {
    vaultPda: string;
    houseAuthority: string;
  }): Promise<HouseVaultState> {
    
    const vault = this.houseVaults.get(params.vaultPda);
    if (!vault) {
      throw new Error("Account does not exist");
    }
    
    // Mimic has_one constraint
    if (vault.houseAuthority !== params.houseAuthority) {
      throw GameError.fromAnchor({ error: { errorCode: { code: "ConstraintHasOne" } } });
    }
    
    vault.locked = !vault.locked;
    return vault;
  }

  async startSession(params: {
    userPubkey: string;
    betAmountLamports: bigint;
    maxPayoutLamports: bigint;
    houseVaultPda: string;
  }): Promise<{ sessionPda: SessionHandle; state: GameSessionState }> {
    
    const vault = this.houseVaults.get(params.houseVaultPda);
    if (!vault) {
      throw new Error("Account does not exist");
    }
    
    // Mimic contract check: !house_vault.locked
    if (vault.locked) {
      throw GameError.houseLocked();
    }
    
    // Check user has sufficient balance
    const userBalance = this.userBalances.get(params.userPubkey) || 0n;
    if (userBalance < params.betAmountLamports) {
      throw new GameError(
        GameErrorCode.INSUFFICIENT_USER_FUNDS,
        `Insufficient balance: need ${params.betAmountLamports}, have ${userBalance}`
      );
    }
    
    // Simulate PDA derivation
    const sessionPda = `session_${params.userPubkey}_${Date.now()}`;
    
    if (this.sessions.has(sessionPda)) {
      throw new Error("Account already in use");
    }
    
    // Transfer: user → vault (mimic contract)
    this.userBalances.set(params.userPubkey, userBalance - params.betAmountLamports);
    const vaultBalance = this.userBalances.get(params.houseVaultPda) || 0n;
    this.userBalances.set(params.houseVaultPda, vaultBalance + params.betAmountLamports);
    
    // Update vault reserved (mimic contract)
    vault.totalReserved += params.maxPayoutLamports;
    
    // Create session
    const state: GameSessionState = {
      sessionPda,
      user: params.userPubkey,
      houseVault: params.houseVaultPda,
      status: SessionStatus.Active,
      betAmount: params.betAmountLamports,
      currentTreasure: params.betAmountLamports, // Starts equal to bet
      maxPayout: params.maxPayoutLamports,
      diveNumber: 1, // First dive
      bump: 255,
    };
    
    this.sessions.set(sessionPda, state);
    
    return { sessionPda, state };
  }

  async playRound(params: {
    sessionPda: SessionHandle;
    userPubkey: string;
    newTreasureLamports: bigint;
    newDiveNumber: number;
  }): Promise<GameSessionState> {
    
    const session = this.sessions.get(params.sessionPda);
    if (!session) {
      throw new Error("Account does not exist");
    }
    
    // Mimic has_one = user constraint
    if (session.user !== params.userPubkey) {
      throw new GameError(GameErrorCode.WRONG_USER, "Caller is not session user");
    }
    
    // Mimic contract validation: status == Active
    if (session.status !== SessionStatus.Active) {
      throw GameError.invalidSessionStatus();
    }
    
    // Mimic contract validation: round number
    if (params.newDiveNumber !== session.diveNumber + 1) {
      throw GameError.roundMismatch(session.diveNumber + 1, params.newDiveNumber);
    }
    
    // Mimic contract validation: treasure must be monotonic
    if (params.newTreasureLamports < session.currentTreasure) {
      throw GameError.treasureInvalid("treasure decreased");
    }
    
    // Mimic contract validation: treasure <= max_payout
    if (params.newTreasureLamports > session.maxPayout) {
      throw GameError.treasureInvalid("exceeds max payout");
    }
    
    // Update session (mimic contract)
    session.currentTreasure = params.newTreasureLamports;
    session.diveNumber = params.newDiveNumber;
    
    return session;
  }

  async loseSession(params: {
    sessionPda: SessionHandle;
    userPubkey: string;
  }): Promise<GameSessionState> {
    
    const session = this.sessions.get(params.sessionPda);
    if (!session) {
      throw new Error("Account does not exist");
    }
    
    if (session.user !== params.userPubkey) {
      throw new GameError(GameErrorCode.WRONG_USER, "Caller is not session user");
    }
    
    if (session.status !== SessionStatus.Active) {
      throw GameError.invalidSessionStatus();
    }
    
    const vault = this.houseVaults.get(session.houseVault);
    if (!vault) {
      throw new Error("Vault does not exist");
    }
    
    // Mimic contract: checked_sub
    if (vault.totalReserved < session.maxPayout) {
      throw new GameError(GameErrorCode.OVERFLOW, "Underflow in total_reserved");
    }
    
    // Update state (mimic contract)
    session.status = SessionStatus.Lost;
    vault.totalReserved -= session.maxPayout;
    
    // House keeps the bet (no transfer)
    
    return session;
  }

  async cashOut(params: {
    sessionPda: SessionHandle;
    userPubkey: string;
  }): Promise<{ finalTreasureLamports: bigint; state: GameSessionState }> {
    
    const session = this.sessions.get(params.sessionPda);
    if (!session) {
      throw new Error("Account does not exist");
    }
    
    if (session.user !== params.userPubkey) {
      throw new GameError(GameErrorCode.WRONG_USER, "Caller is not session user");
    }
    
    const vault = this.houseVaults.get(session.houseVault);
    if (!vault) {
      throw new Error("Vault does not exist");
    }
    
    // Mimic contract check: !locked
    if (vault.locked) {
      throw GameError.houseLocked();
    }
    
    // Mimic contract check: status == Active
    if (session.status !== SessionStatus.Active) {
      throw GameError.invalidSessionStatus();
    }
    
    // Mimic contract validation: current_treasure > bet_amount (optional check)
    if (session.currentTreasure <= session.betAmount) {
      throw GameError.treasureInvalid("no profit");
    }
    
    // Transfer: vault → user (mimic contract)
    const vaultBalance = this.userBalances.get(session.houseVault) || 0n;
    if (vaultBalance < session.currentTreasure) {
      throw new GameError(
        GameErrorCode.INSUFFICIENT_VAULT_BALANCE,
        "Vault has insufficient balance"
      );
    }
    
    this.userBalances.set(session.houseVault, vaultBalance - session.currentTreasure);
    const userBalance = this.userBalances.get(params.userPubkey) || 0n;
    this.userBalances.set(params.userPubkey, userBalance + session.currentTreasure);
    
    // Update vault reserved (mimic contract)
    vault.totalReserved -= session.maxPayout;
    
    // Update session status (mimic contract)
    session.status = SessionStatus.CashedOut;
    
    return {
      finalTreasureLamports: session.currentTreasure,
      state: session,
    };
  }

  async getHouseVault(vaultPda: string): Promise<HouseVaultState> {
    const vault = this.houseVaults.get(vaultPda);
    if (!vault) {
      throw new Error("Account does not exist");
    }
    return vault;
  }

  async getSession(sessionPda: SessionHandle): Promise<GameSessionState | null> {
    return this.sessions.get(sessionPda) || null;
  }
}
```

**Key Points:**
- Every validation mirrors contract's `require!()` checks
- Error messages match contract's `#[msg(...)]`
- State updates follow exact contract logic
- Simulates lamport transfers
- Simulates PDA existence checks

---

## PHASE 5: UPDATE SERVER ACTIONS

**File**: `app/actions/gameEngine.ts` (MAJOR REFACTOR)

```typescript
"use server";

import { getGameChain } from "@/lib/ports";
import { GameError } from "@/lib/ports/GameErrors";
import { dollarsToLamports, lamportsToDollars } from "@/lib/utils/lamports";

const chain = getGameChain();

// Note: We need house vault PDA - either from env or derive it
const HOUSE_VAULT_PDA = process.env.HOUSE_VAULT_PDA || "vault_house_authority";

export async function startGameSession(
  betAmount: number,
  userId: string,
  _sessionId: string // Ignored - PDA is deterministic
): Promise<{ success: boolean; error?: string; sessionId?: string }> {
  
  try {
    const betLamports = dollarsToLamports(betAmount);
    
    // Calculate max payout (off-chain, like before)
    const maxPayoutDollars = calculateMaxPayout(betAmount);
    const maxPayoutLamports = dollarsToLamports(maxPayoutDollars);
    
    // Call contract instruction: start_session
    const result = await chain.startSession({
      userPubkey: userId,
      betAmountLamports: betLamports,
      maxPayoutLamports,
      houseVaultPda: HOUSE_VAULT_PDA,
    });
    
    return {
      success: true,
      sessionId: result.sessionPda, // PDA address, not our generated ID
    };
    
  } catch (error) {
    if (error instanceof GameError) {
      return { success: false, error: error.message };
    }
    console.error("[startGameSession]", error);
    return { success: false, error: "Internal error" };
  }
}

export async function executeRound(
  roundNumber: number,
  currentValue: number,
  sessionPda: string, // Now it's a PDA, not our sessionId
  userId: string,
  testSeed?: string
): Promise<RoundResult> {
  
  try {
    // Get current session state
    const session = await chain.getSession(sessionPda);
    if (!session) {
      throw GameError.invalidSessionStatus();
    }
    
    // Server-side: calculate outcome
    const outcome = simulateRound(
      roundNumber,
      currentValue,
      gameConfig,
      testSeed
    );
    
    if (outcome.survived) {
      // Call contract instruction: play_round
      const newState = await chain.playRound({
        sessionPda,
        userPubkey: userId,
        newTreasureLamports: dollarsToLamports(outcome.totalValue),
        newDiveNumber: roundNumber + 1,
      });
      
      return {
        success: true,
        survived: true,
        roundNumber: newState.diveNumber,
        totalValue: lamportsToDollars(newState.currentTreasure),
        // ... other fields
      };
      
    } else {
      // Player died - call lose_session
      await chain.loseSession({
        sessionPda,
        userPubkey: userId,
      });
      
      return {
        success: true,
        survived: false,
        roundNumber,
        totalValue: 0,
        // ... other fields
      };
    }
    
  } catch (error) {
    if (error instanceof GameError) {
      throw error;
    }
    console.error("[executeRound]", error);
    throw new Error("Internal error");
  }
}

export async function cashOut(
  finalValue: number,
  sessionPda: string,
  userId: string
): Promise<{ success: boolean; finalAmount: number; profit: number }> {
  
  try {
    // Call contract instruction: cash_out
    const result = await chain.cashOut({
      sessionPda,
      userPubkey: userId,
    });
    
    const finalAmount = lamportsToDollars(result.finalTreasureLamports);
    const profit = finalAmount - lamportsToDollars(result.state.betAmount);
    
    return {
      success: true,
      finalAmount,
      profit,
    };
    
  } catch (error) {
    if (error instanceof GameError) {
      throw error;
    }
    console.error("[cashOut]", error);
    throw new Error("Internal error");
  }
}
```

**Key Changes:**
- Server now **drives the contract** (calls instructions)
- Session ID is now the PDA address
- Round updates call `play_round` instruction
- Losses call `lose_session` instruction
- All contract validations happen on-chain

---

## PHASE 6: IMPLEMENT SolanaGameChain

**File**: `lib/ports/SolanaGameChain.ts`

```typescript
import { 
  Connection, 
  PublicKey, 
  Transaction,
  SystemProgram,
} from "@solana/web3.js";
import { Program, AnchorProvider, BN } from "@coral-xyz/anchor";
import { GameChainPort, SessionStatus, GameSessionState, HouseVaultState } from "./GameChainPort";
import { GameError } from "./GameErrors";
import { getHouseVaultAddress, getSessionAddress } from "../solana/pdas";
import type { DiveGame } from "../solana/idl/dive_game"; // Generated from IDL

export class SolanaGameChain implements GameChainPort {
  
  private program: Program<DiveGame>;
  
  constructor(
    connection: Connection,
    wallet: any, // Wallet adapter
    programId: PublicKey
  ) {
    const provider = new AnchorProvider(connection, wallet, {
      commitment: "confirmed",
    });
    this.program = new Program(IDL, programId, provider);
  }

  async initHouseVault(params: {
    houseAuthority: string;
  }): Promise<{ vaultPda: string; state: HouseVaultState }> {
    
    const houseAuthority = new PublicKey(params.houseAuthority);
    const [vaultPda, bump] = getHouseVaultAddress(houseAuthority, this.program.programId);
    
    try {
      // Call contract instruction: init_house_vault
      await this.program.methods
        .initHouseVault()
        .accounts({
          houseAuthority,
          houseVault: vaultPda,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      
      // Fetch created account
      const account = await this.program.account.houseVault.fetch(vaultPda);
      
      return {
        vaultPda: vaultPda.toBase58(),
        state: {
          vaultPda: vaultPda.toBase58(),
          houseAuthority: account.houseAuthority.toBase58(),
          locked: account.locked,
          totalReserved: BigInt(account.totalReserved.toString()),
          bump: account.bump,
        },
      };
      
    } catch (error) {
      throw this.handleAnchorError(error);
    }
  }

  async toggleHouseLock(params: {
    vaultPda: string;
    houseAuthority: string;
  }): Promise<HouseVaultState> {
    
    const vaultPda = new PublicKey(params.vaultPda);
    const houseAuthority = new PublicKey(params.houseAuthority);
    
    try {
      await this.program.methods
        .toggleHouseLock()
        .accounts({
          houseAuthority,
          houseVault: vaultPda,
        })
        .rpc();
      
      const account = await this.program.account.houseVault.fetch(vaultPda);
      
      return {
        vaultPda: vaultPda.toBase58(),
        houseAuthority: account.houseAuthority.toBase58(),
        locked: account.locked,
        totalReserved: BigInt(account.totalReserved.toString()),
        bump: account.bump,
      };
      
    } catch (error) {
      throw this.handleAnchorError(error);
    }
  }

  async startSession(params: {
    userPubkey: string;
    betAmountLamports: bigint;
    maxPayoutLamports: bigint;
    houseVaultPda: string;
  }): Promise<{ sessionPda: string; state: GameSessionState }> {
    
    const user = new PublicKey(params.userPubkey);
    const houseVault = new PublicKey(params.houseVaultPda);
    
    // Generate session nonce (could be sequential index or hash)
    const sessionNonce = Buffer.from(crypto.randomBytes(8));
    const [sessionPda, bump] = getSessionAddress(user, sessionNonce, this.program.programId);
    
    try {
      // Call contract instruction: start_session
      await this.program.methods
        .startSession(
          new BN(params.betAmountLamports.toString()),
          new BN(params.maxPayoutLamports.toString())
        )
        .accounts({
          user,
          houseVault,
          session: sessionPda,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      
      // Fetch created session
      const account = await this.program.account.gameSession.fetch(sessionPda);
      
      return {
        sessionPda: sessionPda.toBase58(),
        state: this.parseSessionAccount(sessionPda, account),
      };
      
    } catch (error) {
      throw this.handleAnchorError(error);
    }
  }

  async playRound(params: {
    sessionPda: string;
    userPubkey: string;
    newTreasureLamports: bigint;
    newDiveNumber: number;
  }): Promise<GameSessionState> {
    
    const sessionPda = new PublicKey(params.sessionPda);
    const user = new PublicKey(params.userPubkey);
    
    // Fetch session to get house_vault
    const session = await this.program.account.gameSession.fetch(sessionPda);
    
    try {
      // Call contract instruction: play_round
      await this.program.methods
        .playRound(
          new BN(params.newTreasureLamports.toString()),
          params.newDiveNumber
        )
        .accounts({
          user,
          session: sessionPda,
          houseVault: session.houseVault,
        })
        .rpc();
      
      // Fetch updated session
      const updated = await this.program.account.gameSession.fetch(sessionPda);
      
      return this.parseSessionAccount(sessionPda, updated);
      
    } catch (error) {
      throw this.handleAnchorError(error);
    }
  }

  async loseSession(params: {
    sessionPda: string;
    userPubkey: string;
  }): Promise<GameSessionState> {
    
    const sessionPda = new PublicKey(params.sessionPda);
    const user = new PublicKey(params.userPubkey);
    
    const session = await this.program.account.gameSession.fetch(sessionPda);
    
    try {
      await this.program.methods
        .loseSession()
        .accounts({
          user,
          session: sessionPda,
          houseVault: session.houseVault,
        })
        .rpc();
      
      const updated = await this.program.account.gameSession.fetch(sessionPda);
      
      return this.parseSessionAccount(sessionPda, updated);
      
    } catch (error) {
      throw this.handleAnchorError(error);
    }
  }

  async cashOut(params: {
    sessionPda: string;
    userPubkey: string;
  }): Promise<{ finalTreasureLamports: bigint; state: GameSessionState }> {
    
    const sessionPda = new PublicKey(params.sessionPda);
    const user = new PublicKey(params.userPubkey);
    
    const session = await this.program.account.gameSession.fetch(sessionPda);
    
    try {
      await this.program.methods
        .cashOut()
        .accounts({
          user,
          session: sessionPda,
          houseVault: session.houseVault,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
      
      const updated = await this.program.account.gameSession.fetch(sessionPda);
      
      return {
        finalTreasureLamports: BigInt(session.currentTreasure.toString()),
        state: this.parseSessionAccount(sessionPda, updated),
      };
      
    } catch (error) {
      throw this.handleAnchorError(error);
    }
  }

  async getHouseVault(vaultPda: string): Promise<HouseVaultState> {
    const vault = new PublicKey(vaultPda);
    const account = await this.program.account.houseVault.fetch(vault);
    
    return {
      vaultPda: vault.toBase58(),
      houseAuthority: account.houseAuthority.toBase58(),
      locked: account.locked,
      totalReserved: BigInt(account.totalReserved.toString()),
      bump: account.bump,
    };
  }

  async getSession(sessionPda: string): Promise<GameSessionState | null> {
    try {
      const session = new PublicKey(sessionPda);
      const account = await this.program.account.gameSession.fetch(session);
      return this.parseSessionAccount(session, account);
    } catch (error) {
      // Account doesn't exist
      return null;
    }
  }

  // Helper: Parse session account to our type
  private parseSessionAccount(pda: PublicKey, account: any): GameSessionState {
    return {
      sessionPda: pda.toBase58(),
      user: account.user.toBase58(),
      houseVault: account.houseVault.toBase58(),
      status: this.parseStatus(account.status),
      betAmount: BigInt(account.betAmount.toString()),
      currentTreasure: BigInt(account.currentTreasure.toString()),
      maxPayout: BigInt(account.maxPayout.toString()),
      diveNumber: account.diveNumber,
      bump: account.bump,
    };
  }

  // Helper: Parse Anchor enum to our enum
  private parseStatus(anchorStatus: any): SessionStatus {
    if (anchorStatus.active) return SessionStatus.Active;
    if (anchorStatus.lost) return SessionStatus.Lost;
    if (anchorStatus.cashedOut) return SessionStatus.CashedOut;
    if (anchorStatus.expired) return SessionStatus.Expired;
    throw new Error("Unknown session status");
  }

  // Helper: Convert Anchor errors to GameError
  private handleAnchorError(error: any): GameError {
    // Use AnchorError.parse if available
    if (error.logs) {
      const parsed = AnchorError.parse(error.logs);
      if (parsed) {
        return GameError.fromAnchor(parsed);
      }
    }
    
    // Check for "already in use" string
    if (error.message?.includes("already in use")) {
      return new GameError(
        GameErrorCode.INTERNAL_ERROR,
        "Account already exists"
      );
    }
    
    // Default
    return new GameError(
      GameErrorCode.NETWORK_ERROR,
      error.message || "Transaction failed"
    );
  }
}
```

---

## SUMMARY: WHAT CHANGED

### Original Plan vs Revised Plan

| Aspect | Original | Revised |
|--------|----------|---------|
| **Instructions** | 4 generic | 6 specific (matching contract) |
| **House Management** | None | Explicit vault + locking |
| **Session Status** | String enum | Rust enum (4 variants) |
| **Round Logic** | Client calculates | Server pushes to chain |
| **Losing** | Implicit | Explicit instruction |
| **Error Codes** | Generic | Match Anchor errors exactly |
| **PDA Seeds** | Unspecified | Exact match with contract |

### Next Steps

1. ✅ **Contract is being built independently** (you're doing this)
2. ⏳ **Frontend refactoring** (align with this revised plan)
3. 🔜 **Integration** (import IDL, test on devnet)

### Files to Create/Update

**NEW:**
- `lib/solana/pdas.ts` - PDA derivation helpers
- `lib/solana/idl/dive_game.ts` - Generated from Anchor
- `lib/ports/SolanaGameChain.ts` - Real implementation

**UPDATE:**
- `lib/ports/GameChainPort.ts` - Match contract instructions
- `lib/ports/GameErrors.ts` - Match contract errors
- `lib/ports/LocalGameChain.ts` - Simulate contract exactly
- `app/actions/gameEngine.ts` - Call new instruction set

### Testing Strategy

1. **Unit tests**: `LocalGameChain` simulates contract behavior
2. **Integration tests**: `SolanaGameChain` against devnet
3. **Contract tests**: Twitter-style comprehensive suite
4. **Both implementations pass the same black-box tests**

The key insight: **The contract IS the source of truth.** The frontend refactoring must conform to the contract's design, not the other way around.
