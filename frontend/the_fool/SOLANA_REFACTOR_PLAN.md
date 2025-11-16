# SOLANA INTEGRATION REFACTORING PLAN

> **Goal**: Shrink and harden the "chain boundary" so we can swap in-memory storage for Solana PDAs without rewriting the game logic.

---

## CORE PRINCIPLE: Minimal On-Chain Surface Area

The future Solana program should be **boring and small**:
- Only 4 instructions (placeBet, playRound, cashOut, cancel)
- Only 3 account types (UserBank PDA, GameSession PDA, HouseVault PDA)
- No game logic on-chain (all rules stay in TypeScript)
- Client calculates outcomes, server validates, chain stores state

---

## PHASE 1: CREATE THE ABSTRACTION LAYER

### Task 1.1: Define GameChainPort Interface
**File**: `lib/ports/GameChainPort.ts` (NEW)

```typescript
export type SessionHandle = string; // Currently hex ID, later Solana PDA

export interface GameSessionState {
  sessionId: SessionHandle;
  userPubkey: string;
  betAmountLamports: bigint;
  currentTreasureLamports: bigint;
  roundNumber: number;
  status: "ACTIVE" | "LOST" | "CASHED_OUT" | "EXPIRED";
  reservedPayoutLamports: bigint;
  startTime: number;
}

export interface HouseStatus {
  balanceLamports: bigint;
  reservedLamports: bigint;
  availableLamports: bigint;
}

export interface GameChainPort {
  /**
   * Place a bet and create a new game session
   * On-chain: Transfers lamports from user → house, creates session PDA
   */
  placeBet(params: {
    userPubkey: string;
    amountLamports: bigint;
    maxPayoutLamports: bigint;
  }): Promise<{
    session: SessionHandle;
    state: GameSessionState;
  }>;

  /**
   * Execute a round (dive deeper)
   * On-chain: Validates round number and treasure match, updates session
   */
  playRound(params: {
    session: SessionHandle;
    roundNumber: number;
    currentTreasureLamports: bigint;
    clientOutcome: RoundOutcome; // Client calculates, server validates
    testSeed?: string;
  }): Promise<GameSessionState>;

  /**
   * Cash out and close session
   * On-chain: Transfers winnings from house → user, closes session PDA
   */
  cashOut(params: {
    session: SessionHandle;
    finalTreasureLamports: bigint;
  }): Promise<{
    finalTreasureLamports: bigint;
    session: GameSessionState;
  }>;

  /**
   * Get current house vault status
   */
  getHouseStatus(): Promise<HouseStatus>;

  /**
   * Get session state (for validation)
   */
  getSession(sessionId: SessionHandle): Promise<GameSessionState | null>;
}

export interface RoundOutcome {
  survived: boolean;
  randomRoll: number;
  threshold: number;
  newTreasureLamports: bigint;
  multiplier: number;
  winProbability: number;
}
```

**Why**: This interface is the exact boundary between your game and the blockchain. Everything above it stays the same whether you use in-memory or Solana.

---

### Task 1.2: Define Error Codes
**File**: `lib/ports/GameErrors.ts` (NEW)

```typescript
export enum GameErrorCode {
  // Session errors
  INVALID_OR_INACTIVE_SESSION = "INVALID_OR_INACTIVE_SESSION",
  WRONG_USER_FOR_SESSION = "WRONG_USER_FOR_SESSION",
  SESSION_ALREADY_CLOSED = "SESSION_ALREADY_CLOSED",
  
  // Validation errors
  ROUND_NUMBER_MISMATCH = "ROUND_NUMBER_MISMATCH",
  TREASURE_MISMATCH = "TREASURE_MISMATCH",
  INVALID_ROUND_OUTCOME = "INVALID_ROUND_OUTCOME",
  
  // Funds errors
  INSUFFICIENT_USER_FUNDS = "INSUFFICIENT_USER_FUNDS",
  INSUFFICIENT_HOUSE_FUNDS = "INSUFFICIENT_HOUSE_FUNDS",
  BET_BELOW_MINIMUM = "BET_BELOW_MINIMUM",
  BET_ABOVE_MAXIMUM = "BET_ABOVE_MAXIMUM",
  EXCEEDS_MAX_WIN_LIMIT = "EXCEEDS_MAX_WIN_LIMIT",
  
  // System errors
  INTERNAL_ERROR = "INTERNAL_ERROR",
  NETWORK_ERROR = "NETWORK_ERROR",
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

  static invalidSession(sessionId: string): GameError {
    return new GameError(
      GameErrorCode.INVALID_OR_INACTIVE_SESSION,
      "Invalid or inactive game session",
      { sessionId }
    );
  }

  static wrongUser(sessionId: string, expected: string, got: string): GameError {
    return new GameError(
      GameErrorCode.WRONG_USER_FOR_SESSION,
      "Session does not belong to user",
      { sessionId, expected, got }
    );
  }

  static roundMismatch(expected: number, got: number): GameError {
    return new GameError(
      GameErrorCode.ROUND_NUMBER_MISMATCH,
      `Round mismatch: Expected round ${expected}, received ${got}`,
      { expected, got }
    );
  }

  static treasureMismatch(expected: bigint, got: bigint): GameError {
    return new GameError(
      GameErrorCode.TREASURE_MISMATCH,
      `Treasure mismatch: Expected ${expected}, received ${got}`,
      { expected: expected.toString(), got: got.toString() }
    );
  }

  static insufficientFunds(balance: bigint, required: bigint): GameError {
    return new GameError(
      GameErrorCode.INSUFFICIENT_USER_FUNDS,
      `Insufficient balance. You have ${balance}, need ${required}`,
      { balance: balance.toString(), required: required.toString() }
    );
  }
}
```

**Why**: 
- Structured errors make UI error handling deterministic
- Error codes map cleanly to Anchor's `#[error_code]` enum
- No more brittle `message.includes()` checks

---

### Task 1.3: Create Lamports Utilities
**File**: `lib/utils/lamports.ts` (NEW)

```typescript
/**
 * Solana uses lamports (1 SOL = 1,000,000,000 lamports)
 * We adopt this now to avoid conversion bugs later
 */

export const LAMPORTS_PER_SOL = 1_000_000_000n;

export function solToLamports(sol: number): bigint {
  // Use BigInt for precise integer arithmetic
  return BigInt(Math.round(sol * 1_000_000_000));
}

export function lamportsToSol(lamports: bigint): number {
  return Number(lamports) / 1_000_000_000;
}

export function formatLamports(lamports: bigint): string {
  const sol = lamportsToSol(lamports);
  return `${sol.toFixed(2)} SOL`;
}

// For dollar amounts in game (1 dollar = 1 lamport for now)
export function dollarsToLamports(dollars: number): bigint {
  return BigInt(Math.round(dollars * 1_000_000_000));
}

export function lamportsToDollars(lamports: bigint): number {
  return Number(lamports) / 1_000_000_000;
}
```

**Why**: 
- Solana requires lamports (bigint)
- Starting with lamports now prevents rounding errors
- Makes future conversion to real SOL trivial

---

### Task 1.4: Abstract Randomness
**File**: `lib/ports/RandomSource.ts` (NEW)

```typescript
/**
 * Abstraction for randomness sources
 * Allows swapping between crypto.randomBytes (server) and VRF (Solana)
 */

export interface RandomSource {
  /**
   * Get a random integer in range [0, maxExclusive)
   */
  getRandomInt(maxExclusive: number): number;
  
  /**
   * Get random bytes
   */
  getRandomBytes(length: number): Uint8Array;
}

/**
 * Server-side cryptographic randomness
 */
export class CryptoRandomSource implements RandomSource {
  getRandomInt(maxExclusive: number): number {
    const crypto = require("crypto");
    const bytes = crypto.randomBytes(4);
    const randomValue = bytes.readUInt32BE(0);
    return Math.floor((randomValue / 0xFFFFFFFF) * maxExclusive);
  }

  getRandomBytes(length: number): Uint8Array {
    const crypto = require("crypto");
    return crypto.randomBytes(length);
  }
}

/**
 * Deterministic randomness for testing
 */
export class SeededRandomSource implements RandomSource {
  constructor(private seed: string) {}

  getRandomInt(maxExclusive: number): number {
    // Parse seed as number or hash it
    const value = parseInt(this.seed, 10);
    return value % maxExclusive;
  }

  getRandomBytes(length: number): Uint8Array {
    // Deterministic bytes for testing
    const bytes = new Uint8Array(length);
    const seedValue = parseInt(this.seed, 10) || 0;
    for (let i = 0; i < length; i++) {
      bytes[i] = (seedValue + i) % 256;
    }
    return bytes;
  }
}
```

**Why**:
- Solana programs can't use `crypto.randomBytes()`
- Options: VRF (Chainlink), blockhash-based, or off-chain trusted source
- Abstracting now makes swapping trivial later

---

## PHASE 2: IMPLEMENT LOCAL CHAIN ADAPTER

### Task 2.1: Create LocalGameChain
**File**: `lib/ports/LocalGameChain.ts` (NEW)

This wraps your existing `walletStore` + `gameEngine` logic behind the `GameChainPort` interface:

```typescript
import { GameChainPort, GameSessionState, HouseStatus, SessionHandle, RoundOutcome } from "./GameChainPort";
import { GameError, GameErrorCode } from "./GameErrors";
import { dollarsTola mports, lamportsToDollars } from "../utils/lamports";
import { RandomSource, CryptoRandomSource } from "./RandomSource";
import {
  getUserWallet,
  updateUserWallet,
  getHouseWallet,
  updateHouseWallet,
  setGameSession,
  getGameSession,
  deleteGameSession,
  addTransaction,
} from "../walletStore";
import { simulateRound, calculateRoundStats } from "../gameEngine";
import type { GameConfig } from "../gameEngine";

/**
 * Local in-memory implementation of GameChainPort
 * This is the current behavior, wrapped in the port interface
 */
export class LocalGameChain implements GameChainPort {
  constructor(
    private readonly gameConfig: GameConfig,
    private readonly randomSource: RandomSource = new CryptoRandomSource()
  ) {}

  async placeBet(params: {
    userPubkey: string;
    amountLamports: bigint;
    maxPayoutLamports: bigint;
  }): Promise<{ session: SessionHandle; state: GameSessionState }> {
    
    const { userPubkey, amountLamports, maxPayoutLamports } = params;
    const betAmount = lamportsToDollars(amountLamports);
    
    // Get wallets (in-memory)
    const userWallet = getUserWallet(userPubkey);
    const houseWallet = getHouseWallet();

    // Validate bet amount
    if (betAmount < this.gameConfig.minBet) {
      throw GameError.insufficientFunds(
        dollarsToLamports(userWallet.balance),
        amountLamports
      );
    }

    if (betAmount > userWallet.balance) {
      throw GameError.insufficientFunds(
        dollarsToLamports(userWallet.balance),
        amountLamports
      );
    }

    // Validate house can cover
    const maxPayout = lamportsToDollars(maxPayoutLamports);
    const availableHouse = houseWallet.balance - houseWallet.reservedFunds;
    if (maxPayout > availableHouse) {
      throw new GameError(
        GameErrorCode.INSUFFICIENT_HOUSE_FUNDS,
        "House cannot cover potential payout"
      );
    }

    // Generate session ID
    const sessionId = this.randomSource.getRandomBytes(16).toString("hex");

    // Update wallets
    userWallet.balance -= betAmount;
    userWallet.totalWagered += betAmount;
    updateUserWallet(userWallet);

    houseWallet.balance += betAmount;
    houseWallet.totalReceived += betAmount;
    houseWallet.reservedFunds += maxPayout;
    updateHouseWallet(houseWallet);

    // Create session
    const session = {
      sessionId,
      userId: userPubkey,
      initialBet: betAmount,
      currentTreasure: 0,
      diveNumber: 1,
      isActive: true,
      status: "ACTIVE" as const,
      reservedPayout: maxPayout,
      startTime: Date.now(),
    };
    setGameSession(session);

    // Log transaction
    addTransaction({
      id: this.randomSource.getRandomBytes(8).toString("hex"),
      userId: userPubkey,
      type: "bet",
      amount: betAmount,
      balanceBefore: userWallet.balance + betAmount,
      balanceAfter: userWallet.balance,
      gameSessionId: sessionId,
      timestamp: Date.now(),
    });

    return {
      session: sessionId,
      state: {
        sessionId,
        userPubkey,
        betAmountLamports: amountLamports,
        currentTreasureLamports: 0n,
        roundNumber: 1,
        status: "ACTIVE",
        reservedPayoutLamports: maxPayoutLamports,
        startTime: session.startTime,
      },
    };
  }

  async playRound(params: {
    session: SessionHandle;
    roundNumber: number;
    currentTreasureLamports: bigint;
    clientOutcome: RoundOutcome;
    testSeed?: string;
  }): Promise<GameSessionState> {
    
    const { session: sessionId, roundNumber, currentTreasureLamports, testSeed } = params;
    
    // Get session
    const session = getGameSession(sessionId);
    if (!session || session.status !== "ACTIVE") {
      throw GameError.invalidSession(sessionId);
    }

    // Validate round number
    if (roundNumber !== session.diveNumber) {
      throw GameError.roundMismatch(session.diveNumber, roundNumber);
    }

    // Validate treasure value
    const expectedTreasure = session.diveNumber === 1 
      ? dollarsToLamports(session.initialBet)
      : dollarsToLamports(session.currentTreasure);
    
    if (currentTreasureLamports !== expectedTreasure) {
      throw GameError.treasureMismatch(expectedTreasure, currentTreasureLamports);
    }

    // Simulate round (server-authoritative)
    const currentValue = lamportsToDollars(currentTreasureLamports);
    const result = simulateRound(
      roundNumber,
      currentValue,
      this.gameConfig,
      testSeed ? parseInt(testSeed) : undefined
    );

    // Update session
    if (result.survived) {
      session.currentTreasure = result.totalValue;
      session.diveNumber += 1;
      setGameSession(session);
    } else {
      // Player lost - end session
      session.status = "LOST";
      session.isActive = false;
      session.endTime = Date.now();
      setGameSession(session);

      // Release reserved funds
      const houseWallet = getHouseWallet();
      houseWallet.reservedFunds -= session.reservedPayout;
      updateHouseWallet(houseWallet);

      // Log loss
      const userWallet = getUserWallet(session.userId);
      userWallet.totalLost += session.initialBet;
      userWallet.gamesPlayed += 1;
      updateUserWallet(userWallet);

      addTransaction({
        id: this.randomSource.getRandomBytes(8).toString("hex"),
        userId: session.userId,
        type: "loss",
        amount: session.initialBet,
        balanceBefore: userWallet.balance,
        balanceAfter: userWallet.balance,
        gameSessionId: sessionId,
        timestamp: Date.now(),
        metadata: {
          roundNumber,
          survived: false,
        },
      });
    }

    return {
      sessionId,
      userPubkey: session.userId,
      betAmountLamports: dollarsToLamports(session.initialBet),
      currentTreasureLamports: dollarsToLamports(session.currentTreasure),
      roundNumber: session.diveNumber,
      status: session.status,
      reservedPayoutLamports: dollarsToLamports(session.reservedPayout),
      startTime: session.startTime,
    };
  }

  async cashOut(params: {
    session: SessionHandle;
    finalTreasureLamports: bigint;
  }): Promise<{ finalTreasureLamports: bigint; session: GameSessionState }> {
    
    const { session: sessionId, finalTreasureLamports } = params;
    
    // Get session
    const session = getGameSession(sessionId);
    if (!session || session.status !== "ACTIVE") {
      throw GameError.invalidSession(sessionId);
    }

    // Validate treasure matches
    const expectedTreasure = dollarsToLamports(session.currentTreasure);
    if (finalTreasureLamports !== expectedTreasure) {
      throw GameError.treasureMismatch(expectedTreasure, finalTreasureLamports);
    }

    const finalAmount = lamportsToDollars(finalTreasureLamports);

    // Get wallets
    const userWallet = getUserWallet(session.userId);
    const houseWallet = getHouseWallet();

    // Transfer winnings
    const profit = finalAmount - session.initialBet;
    userWallet.balance += finalAmount;
    userWallet.totalWon += profit;
    userWallet.gamesPlayed += 1;
    updateUserWallet(userWallet);

    houseWallet.balance -= finalAmount;
    houseWallet.totalPaidOut += finalAmount;
    houseWallet.reservedFunds -= session.reservedPayout;
    updateHouseWallet(houseWallet);

    // Close session
    session.status = "CASHED_OUT";
    session.isActive = false;
    session.endTime = Date.now();
    setGameSession(session);

    // Log transaction
    addTransaction({
      id: this.randomSource.getRandomBytes(8).toString("hex"),
      userId: session.userId,
      type: "cashout",
      amount: finalAmount,
      balanceBefore: userWallet.balance - finalAmount,
      balanceAfter: userWallet.balance,
      gameSessionId: sessionId,
      timestamp: Date.now(),
      metadata: {
        profit,
        roundNumber: session.diveNumber - 1,
      },
    });

    return {
      finalTreasureLamports,
      session: {
        sessionId,
        userPubkey: session.userId,
        betAmountLamports: dollarsToLamports(session.initialBet),
        currentTreasureLamports: finalTreasureLamports,
        roundNumber: session.diveNumber,
        status: session.status,
        reservedPayoutLamports: dollarsToLamports(session.reservedPayout),
        startTime: session.startTime,
      },
    };
  }

  async getHouseStatus(): Promise<HouseStatus> {
    const house = getHouseWallet();
    return {
      balanceLamports: dollarsToLamports(house.balance),
      reservedLamports: dollarsToLamports(house.reservedFunds),
      availableLamports: dollarsToLamports(house.balance - house.reservedFunds),
    };
  }

  async getSession(sessionId: SessionHandle): Promise<GameSessionState | null> {
    const session = getGameSession(sessionId);
    if (!session) return null;

    return {
      sessionId,
      userPubkey: session.userId,
      betAmountLamports: dollarsToLamports(session.initialBet),
      currentTreasureLamports: dollarsToLamports(session.currentTreasure),
      roundNumber: session.diveNumber,
      status: session.status,
      reservedPayoutLamports: dollarsToLamports(session.reservedPayout),
      startTime: session.startTime,
    };
  }
}
```

**Why**: This is your existing logic, just packaged to match the interface. No behavior changes, pure refactor.

---

### Task 2.2: Create Chain Factory
**File**: `lib/ports/index.ts` (NEW)

```typescript
import { GameChainPort } from "./GameChainPort";
import { LocalGameChain } from "./LocalGameChain";
import { GAME_CONFIG } from "../constants";
import { DEFAULT_CONFIG } from "../gameEngine";

let _chainInstance: GameChainPort | null = null;

export function getGameChain(): GameChainPort {
  if (!_chainInstance) {
    const mode = process.env.BLOCKCHAIN_MODE || "local";
    
    switch (mode) {
      case "local":
      case "memory":
        _chainInstance = new LocalGameChain({
          ...DEFAULT_CONFIG,
          houseEdge: GAME_CONFIG.HOUSE_EDGE,
          baseWinProbability: GAME_CONFIG.BASE_WIN_PROB,
          decayConstant: GAME_CONFIG.DECAY_CONSTANT,
          minBet: GAME_CONFIG.MIN_BET,
          maxBet: GAME_CONFIG.MAX_BET,
          maxPotentialWin: 100000,
          maxRounds: 50,
        });
        break;
      
      case "solana":
        throw new Error("Solana implementation not yet available");
        // _chainInstance = new SolanaGameChain(...);
        break;
      
      default:
        throw new Error(`Unknown blockchain mode: ${mode}`);
    }
  }
  
  return _chainInstance;
}

// For testing: allow resetting the instance
export function resetGameChain() {
  _chainInstance = null;
}
```

**Why**: Single entry point. Swap implementations by changing env var.

---

## PHASE 3: REFACTOR SERVER ACTIONS

### Task 3.1: Update gameEngine.ts Server Actions
**File**: `app/actions/gameEngine.ts` (REFACTOR)

Replace all direct `walletStore` calls with `getGameChain()`:

```typescript
"use server";

import { getGameChain } from "@/lib/ports";
import { GameError } from "@/lib/ports/GameErrors";
import { dollarsToLamports, lamportsToDollars } from "@/lib/utils/lamports";
import { calculateMaxPotentialPayout, GAME_CONFIG } from "@/lib/gameEngine";

const chain = getGameChain();

export async function startGameSession(
  betAmount: number,
  userId: string,
  sessionId: string // Not used in chain, but kept for API compatibility
): Promise<{ success: boolean; error?: string; sessionId?: string }> {
  
  try {
    // Convert to lamports
    const betLamports = dollarsToLamports(betAmount);
    
    // Calculate max payout (server-side, off-chain)
    const maxPayoutDollars = calculateMaxPotentialPayout(betAmount, 50, GAME_CONFIG);
    const maxPayoutLamports = dollarsToLamports(maxPayoutDollars);
    
    // Place bet via chain port
    const result = await chain.placeBet({
      userPubkey: userId,
      amountLamports: betLamports,
      maxPayoutLamports,
    });
    
    return {
      success: true,
      sessionId: result.session,
    };
    
  } catch (error) {
    if (error instanceof GameError) {
      return { success: false, error: error.message };
    }
    console.error("[startGameSession] Unexpected error:", error);
    return { success: false, error: "Internal error" };
  }
}

export async function executeRound(
  roundNumber: number,
  currentValue: number,
  sessionId: string,
  userId: string,
  testSeed?: string
): Promise<RoundResult> {
  
  try {
    // Convert to lamports
    const currentTreasureLamports = dollarsToLamports(currentValue);
    
    // Client doesn't pre-calculate outcome anymore - server does it all
    // (Later we can move calculation to client)
    const outcome = {
      survived: false,
      randomRoll: 0,
      threshold: 0,
      newTreasureLamports: 0n,
      multiplier: 0,
      winProbability: 0,
    }; // Placeholder - actual logic in LocalGameChain.playRound
    
    // Play round via chain port
    const state = await chain.playRound({
      session: sessionId,
      roundNumber,
      currentTreasureLamports,
      clientOutcome: outcome,
      testSeed,
    });
    
    // Convert response (state now has the result)
    return {
      success: true,
      survived: state.status === "ACTIVE",
      roundNumber: state.roundNumber,
      totalValue: lamportsToDollars(state.currentTreasureLamports),
      // ... other fields
    };
    
  } catch (error) {
    if (error instanceof GameError) {
      throw error; // Let UI handle GameError
    }
    console.error("[executeRound] Unexpected error:", error);
    throw new Error("Internal error");
  }
}

export async function cashOut(
  finalValue: number,
  sessionId: string,
  userId: string
): Promise<{ success: boolean; finalAmount: number; profit: number }> {
  
  try {
    const finalTreasureLamports = dollarsToLamports(finalValue);
    
    const result = await chain.cashOut({
      session: sessionId,
      finalTreasureLamports,
    });
    
    const finalAmount = lamportsToDollars(result.finalTreasureLamports);
    const profit = finalAmount - lamportsToDollars(result.session.betAmountLamports);
    
    return {
      success: true,
      finalAmount,
      profit,
    };
    
  } catch (error) {
    if (error instanceof GameError) {
      throw error;
    }
    console.error("[cashOut] Unexpected error:", error);
    throw new Error("Internal error");
  }
}

export async function getHouseStatus() {
  const status = await chain.getHouseStatus();
  
  return {
    balance: lamportsToDollars(status.balanceLamports),
    reservedFunds: lamportsToDollars(status.reservedLamports),
    availableFunds: lamportsToDollars(status.availableLamports),
    // ... other fields stay the same
  };
}
```

**Why**: Server actions are now just thin wrappers around `GameChainPort`. Swapping to Solana changes ZERO lines here.

---

### Task 3.2: Update gameActions.ts Theme Wrapper
**File**: `app/actions/gameActions.ts` (MINOR UPDATES)

Keep the theme wrapper but ensure error handling works with `GameError`:

```typescript
// Add at top
import { GameError } from "@/lib/ports/GameErrors";

export async function performDive(...) {
  try {
    const result = await executeRound(...);
    // ... theme additions
    return result;
  } catch (error) {
    // Re-throw GameError so UI can handle it properly
    if (error instanceof GameError) {
      throw error;
    }
    throw new Error("Internal error");
  }
}
```

---

## PHASE 4: UPDATE UI ERROR HANDLING

### Task 4.1: Update Error Handling in page.tsx
**File**: `app/page.tsx` (REFACTOR)

Replace all `message.includes()` checks with `error.code`:

```typescript
import { GameError, GameErrorCode } from "@/lib/ports/GameErrors";

// OLD CODE:
try {
  await startGame(betAmount, userId, sessionId);
} catch (error) {
  if (error.message.includes("session")) {
    showError("Session expired");
  }
}

// NEW CODE:
try {
  await startGame(betAmount, userId, sessionId);
} catch (error) {
  if (error instanceof GameError) {
    switch (error.code) {
      case GameErrorCode.INVALID_OR_INACTIVE_SESSION:
        showError("Session expired. Please start a new game.");
        break;
      case GameErrorCode.INSUFFICIENT_USER_FUNDS:
        showError("Insufficient balance");
        break;
      case GameErrorCode.TREASURE_MISMATCH:
        showError("Data corruption detected. Please contact support.");
        break;
      default:
        showError(error.message);
    }
  } else {
    showError("An unexpected error occurred");
  }
}
```

**Why**: No more brittle string matching. Error handling is now type-safe.

---

## PHASE 5: ADD TESTS

### Task 5.1: Create Contract Tests
**File**: `tests/unit/ports/GameChainPort.test.ts` (NEW)

Black-box tests that work for ANY implementation:

```typescript
import { describe, it, beforeEach } from "node:test";
import assert from "node:assert";
import { GameChainPort } from "@/lib/ports/GameChainPort";
import { LocalGameChain } from "@/lib/ports/LocalGameChain";
import { GameError, GameErrorCode } from "@/lib/ports/GameErrors";
import { dollarsToLamports, lamportsToDollars } from "@/lib/utils/lamports";
import { resetWalletStore } from "@/lib/walletStore";

describe("GameChainPort Contract Tests", () => {
  
  let chain: GameChainPort;
  let userId: string;
  
  beforeEach(() => {
    resetWalletStore();
    chain = new LocalGameChain(/* config */);
    userId = `user_${Date.now()}`;
  });
  
  it("should place a bet and create session", async () => {
    const betLamports = dollarsToLamports(50);
    const maxPayoutLamports = dollarsToLamports(100000);
    
    const result = await chain.placeBet({
      userPubkey: userId,
      amountLamports: betLamports,
      maxPayoutLamports,
    });
    
    assert.ok(result.session, "Should return session ID");
    assert.strictEqual(result.state.status, "ACTIVE");
    assert.strictEqual(result.state.betAmountLamports, betLamports);
    assert.strictEqual(result.state.roundNumber, 1);
  });
  
  it("should reject insufficient funds", async () => {
    const betLamports = dollarsToLamports(10000); // More than user has
    const maxPayoutLamports = dollarsToLamports(100000);
    
    await assert.rejects(
      async () => chain.placeBet({
        userPubkey: userId,
        amountLamports: betLamports,
        maxPayoutLamports,
      }),
      (error: GameError) => {
        assert.strictEqual(error.code, GameErrorCode.INSUFFICIENT_USER_FUNDS);
        return true;
      }
    );
  });
  
  it("should execute a round and update state", async () => {
    // Place bet
    const bet = await chain.placeBet({
      userPubkey: userId,
      amountLamports: dollarsToLamports(50),
      maxPayoutLamports: dollarsToLamports(100000),
    });
    
    // Play round (use deterministic seed for test)
    const state = await chain.playRound({
      session: bet.session,
      roundNumber: 1,
      currentTreasureLamports: dollarsToLamports(50),
      clientOutcome: {} as any, // Not used in LocalGameChain
      testSeed: "99", // High roll = survival
    });
    
    if (state.status === "ACTIVE") {
      assert.ok(state.currentTreasureLamports > bet.state.betAmountLamports, "Treasure should grow");
      assert.strictEqual(state.roundNumber, 2, "Should advance to round 2");
    } else {
      // Lost on round 1
      assert.strictEqual(state.status, "LOST");
    }
  });
  
  it("should enforce round number validation", async () => {
    const bet = await chain.placeBet({
      userPubkey: userId,
      amountLamports: dollarsToLamports(50),
      maxPayoutLamports: dollarsToLamports(100000),
    });
    
    // Try to play round 2 when we're on round 1
    await assert.rejects(
      async () => chain.playRound({
        session: bet.session,
        roundNumber: 2, // Wrong!
        currentTreasureLamports: dollarsToLamports(50),
        clientOutcome: {} as any,
      }),
      (error: GameError) => {
        assert.strictEqual(error.code, GameErrorCode.ROUND_NUMBER_MISMATCH);
        return true;
      }
    );
  });
  
  it("should enforce treasure validation", async () => {
    const bet = await chain.placeBet({
      userPubkey: userId,
      amountLamports: dollarsToLamports(50),
      maxPayoutLamports: dollarsToLamports(100000),
    });
    
    // Try to play with wrong treasure amount
    await assert.rejects(
      async () => chain.playRound({
        session: bet.session,
        roundNumber: 1,
        currentTreasureLamports: dollarsToLamports(100), // Wrong! Should be 50
        clientOutcome: {} as any,
      }),
      (error: GameError) => {
        assert.strictEqual(error.code, GameErrorCode.TREASURE_MISMATCH);
        return true;
      }
    );
  });
  
  it("should cash out successfully", async () => {
    // Place bet and win a round
    const bet = await chain.placeBet({
      userPubkey: userId,
      amountLamports: dollarsToLamports(50),
      maxPayoutLamports: dollarsToLamports(100000),
    });
    
    const round1 = await chain.playRound({
      session: bet.session,
      roundNumber: 1,
      currentTreasureLamports: dollarsToLamports(50),
      clientOutcome: {} as any,
      testSeed: "99", // Survive
    });
    
    if (round1.status === "ACTIVE") {
      // Cash out
      const cashout = await chain.cashOut({
        session: bet.session,
        finalTreasureLamports: round1.currentTreasureLamports,
      });
      
      assert.strictEqual(cashout.session.status, "CASHED_OUT");
      assert.ok(cashout.finalTreasureLamports > bet.state.betAmountLamports, "Should win money");
    }
  });
  
  it("should reject operations on closed session", async () => {
    const bet = await chain.placeBet({
      userPubkey: userId,
      amountLamports: dollarsToLamports(50),
      maxPayoutLamports: dollarsToLamports(100000),
    });
    
    // Play round and lose
    const round1 = await chain.playRound({
      session: bet.session,
      roundNumber: 1,
      currentTreasureLamports: dollarsToLamports(50),
      clientOutcome: {} as any,
      testSeed: "0", // Low roll = death
    });
    
    assert.strictEqual(round1.status, "LOST");
    
    // Try to play another round
    await assert.rejects(
      async () => chain.playRound({
        session: bet.session,
        roundNumber: 1,
        currentTreasureLamports: dollarsToLamports(50),
        clientOutcome: {} as any,
      }),
      (error: GameError) => {
        assert.strictEqual(error.code, GameErrorCode.INVALID_OR_INACTIVE_SESSION);
        return true;
      }
    );
  });
  
  it("should maintain house balance invariants", async () => {
    const initialHouse = await chain.getHouseStatus();
    const initialBalance = initialHouse.balanceLamports;
    
    // Place bet
    const betAmount = dollarsToLamports(50);
    const bet = await chain.placeBet({
      userPubkey: userId,
      amountLamports: betAmount,
      maxPayoutLamports: dollarsToLamports(100000),
    });
    
    // House should have +50
    const afterBet = await chain.getHouseStatus();
    assert.strictEqual(
      afterBet.balanceLamports,
      initialBalance + betAmount,
      "House should receive bet"
    );
    
    // Play and lose
    const round1 = await chain.playRound({
      session: bet.session,
      roundNumber: 1,
      currentTreasureLamports: betAmount,
      clientOutcome: {} as any,
      testSeed: "0", // Lose
    });
    
    assert.strictEqual(round1.status, "LOST");
    
    // House keeps the bet
    const afterLoss = await chain.getHouseStatus();
    assert.strictEqual(
      afterLoss.balanceLamports,
      initialBalance + betAmount,
      "House should keep lost bet"
    );
  });
});
```

**Why**: These tests validate the contract, not the implementation. They'll work for both LocalGameChain and SolanaGameChain.

---

## PHASE 6: CREATE SOLANA STUB (For Future)

### Task 6.1: Stub SolanaGameChain
**File**: `lib/ports/SolanaGameChain.ts` (NEW - STUB ONLY)

```typescript
import { GameChainPort, GameSessionState, HouseStatus, SessionHandle } from "./GameChainPort";
import { GameError, GameErrorCode } from "./GameErrors";

/**
 * Solana implementation of GameChainPort (STUB)
 * 
 * This will use:
 * - @solana/web3.js for connections
 * - @coral-xyz/anchor for program interaction
 * - PDAs for user bank, house vault, game sessions
 */
export class SolanaGameChain implements GameChainPort {
  constructor(
    private readonly rpcUrl: string,
    private readonly programId: string,
    private readonly wallet: any // Wallet adapter
  ) {
    throw new Error("Solana implementation not yet available");
  }

  async placeBet(params: any): Promise<any> {
    throw new Error("Not implemented");
  }

  async playRound(params: any): Promise<any> {
    throw new Error("Not implemented");
  }

  async cashOut(params: any): Promise<any> {
    throw new Error("Not implemented");
  }

  async getHouseStatus(): Promise<HouseStatus> {
    throw new Error("Not implemented");
  }

  async getSession(sessionId: SessionHandle): Promise<GameSessionState | null> {
    throw new Error("Not implemented");
  }
}
```

**Why**: Documents the future shape, prevents accidental use before it's ready.

---

## SUMMARY CHECKLIST

### High Priority (Must Do Before Solana)
- [ ] Task 1.1: Create `GameChainPort` interface
- [ ] Task 1.2: Create `GameError` and error codes
- [ ] Task 1.3: Create lamports utilities
- [ ] Task 2.1: Create `LocalGameChain` wrapping current logic
- [ ] Task 2.2: Create chain factory with env var switch
- [ ] Task 3.1: Refactor `gameEngine.ts` to use `getGameChain()`
- [ ] Task 4.1: Update UI to use `error.code` instead of `message.includes()`
- [ ] Task 5.1: Add black-box contract tests

### Medium Priority (Nice to Have)
- [ ] Task 1.4: Abstract randomness into `RandomSource`
- [ ] Task 3.2: Update theme wrapper error handling
- [ ] Task 6.1: Create `SolanaGameChain` stub

### Low Priority (Future Optimization)
- [ ] Move round calculation to client-side
- [ ] Add settlement batching
- [ ] Implement VRF for Solana randomness

---

## WHEN YOU'RE READY FOR SOLANA

At that point, you'll:

1. **Build the Anchor program** (4 instructions, 3 account types)
2. **Implement `SolanaGameChain`** methods using Anchor client
3. **Deploy to devnet** and test with fake SOL
4. **Switch env var** `BLOCKCHAIN_MODE=solana`
5. **All existing code works unchanged** ✨

Total files created: ~8 new files, ~1200 lines
Total files modified: ~4 existing files
Breaking changes: ZERO (backwards compatible)

The key insight: **Your game logic never changes. Only the storage backend swaps.**
