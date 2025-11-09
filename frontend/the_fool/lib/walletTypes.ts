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
  type: 'bet' | 'win' | 'loss' | 'surface' | 'deposit' | 'withdrawal';
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  gameSessionId: string;
  timestamp: number;
  metadata?: {
    diveNumber?: number;
    depth?: number;
    multiplier?: number;
    survived?: boolean;
  };
}

export interface GameSession {
  sessionId: string;
  userId: string;
  initialBet: number;
  currentTreasure: number;
  diveNumber: number;
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
