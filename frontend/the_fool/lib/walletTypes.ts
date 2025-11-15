/**
 * Wallet Management Types
 * Handles user and house wallets with risk limits
 */

export interface UserWallet {
  userId: string;
  balance: number;
  totalWagered: number;
  totalWon: number;
  totalLost: number;
  gamesPlayed: number;
  lastUpdated: number;
}

export interface HouseWallet {
  balance: number;
  totalPaidOut: number;
  totalReceived: number;
  reservedFunds: number; // Funds reserved for active games
  lastUpdated: number;
}

export interface Transaction {
  id: string;
  userId: string;
  type: 'bet' | 'win' | 'loss' | 'surface' | 'cashout' | 'deposit' | 'withdrawal';
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  gameSessionId: string;
  timestamp: number;
  metadata?: {
    // Generic round-based fields
    roundNumber?: number;
    survived?: boolean;
    profit?: number;
    
    // Legacy theme-specific fields (for backward compatibility)
    diveNumber?: number;
    depth?: number;
    multiplier?: number;
  };
}

export interface GameSession {
  sessionId: string;
  userId: string;
  initialBet: number;
  currentTreasure: number; // Current accumulated value (generic name, works for treasure/points/etc)
  diveNumber: number; // Current round number (legacy name for compatibility)
  isActive: boolean;
  reservedPayout: number; // Max potential payout reserved from house
  startTime: number;
  endTime?: number;
}

export interface BetValidation {
  valid: boolean;
  error?: string;
  maxBet?: number;
  userBalance?: number;
  houseCanPay?: boolean;
  maxPotentialPayout?: number;
}

export interface WalletLimits {
  minBet: number;
  maxBet: number;
  maxPotentialWin: number; // House can't pay more than this
  houseReserveRatio: number; // % of house wallet to keep in reserve
}
