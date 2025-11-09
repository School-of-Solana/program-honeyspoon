/**
 * Wallet Management Logic
 * Handles balance validation and risk calculations
 */

import type { 
  UserWallet, 
  HouseWallet, 
  BetValidation, 
  WalletLimits, 
  GameSession 
} from './walletTypes';
import { calculateDiveStats } from './gameLogic';

// Default limits
export const DEFAULT_LIMITS: WalletLimits = {
  minBet: 10,
  maxBet: 500,
  maxPotentialWin: 10000, // House won't risk more than this per game
  houseReserveRatio: 0.2, // Keep 20% of house wallet in reserve
};

/**
 * Calculate the maximum potential payout for a game session
 * This is what the house needs to reserve when a bet is placed
 */
export function calculateMaxPotentialPayout(
  initialBet: number,
  maxDives: number = 10
): number {
  let maxPayout = initialBet;
  
  // Calculate the theoretical maximum if player survives all dives
  for (let dive = 1; dive <= maxDives; dive++) {
    const stats = calculateDiveStats(dive);
    maxPayout *= stats.multiplier;
  }
  
  return Math.floor(maxPayout);
}

/**
 * Calculate maximum bet user can make based on house wallet
 * The house must be able to pay out the maximum potential win
 */
export function calculateMaxBetFromHouseWallet(
  houseWallet: HouseWallet,
  limits: WalletLimits = DEFAULT_LIMITS
): number {
  const availableFunds = houseWallet.balance - houseWallet.reservedFunds;
  const houseReserve = houseWallet.balance * limits.houseReserveRatio;
  const canRisk = Math.max(0, availableFunds - houseReserve);
  
  // Maximum bet where max potential payout doesn't exceed what house can risk
  const maxBetForHouse = Math.min(
    canRisk / 50, // Conservative: assume max payout is 50x initial bet
    limits.maxPotentialWin / 50
  );
  
  return Math.floor(Math.min(maxBetForHouse, limits.maxBet));
}

/**
 * Validate if a bet is allowed
 */
export function validateBet(
  betAmount: number,
  userWallet: UserWallet,
  houseWallet: HouseWallet,
  limits: WalletLimits = DEFAULT_LIMITS
): BetValidation {
  // Check minimum bet
  if (betAmount < limits.minBet) {
    return {
      valid: false,
      error: `Minimum bet is $${limits.minBet}`,
      userBalance: userWallet.balance,
    };
  }
  
  // Check user has sufficient balance
  if (betAmount > userWallet.balance) {
    return {
      valid: false,
      error: `Insufficient balance. You have $${userWallet.balance}`,
      maxBet: userWallet.balance,
      userBalance: userWallet.balance,
    };
  }
  
  // Calculate max potential payout
  const maxPayout = calculateMaxPotentialPayout(betAmount);
  
  // Check house can afford the potential payout
  const availableHouseFunds = houseWallet.balance - houseWallet.reservedFunds;
  const houseReserve = houseWallet.balance * limits.houseReserveRatio;
  const houseCanRisk = availableHouseFunds - houseReserve;
  
  if (maxPayout > houseCanRisk) {
    const safeBet = calculateMaxBetFromHouseWallet(houseWallet, limits);
    return {
      valid: false,
      error: `House cannot cover potential payout. Maximum bet: $${safeBet}`,
      maxBet: Math.min(safeBet, userWallet.balance),
      userBalance: userWallet.balance,
      houseCanPay: false,
      maxPotentialPayout: maxPayout,
    };
  }
  
  // Check against absolute maximum
  if (betAmount > limits.maxBet) {
    return {
      valid: false,
      error: `Maximum bet is $${limits.maxBet}`,
      maxBet: Math.min(limits.maxBet, userWallet.balance),
      userBalance: userWallet.balance,
    };
  }
  
  // Check against maximum potential win
  if (maxPayout > limits.maxPotentialWin) {
    const safeBet = Math.floor(limits.maxPotentialWin / 50);
    return {
      valid: false,
      error: `Bet would exceed maximum win limit. Maximum bet: $${safeBet}`,
      maxBet: Math.min(safeBet, userWallet.balance),
      userBalance: userWallet.balance,
    };
  }
  
  // All checks passed
  return {
    valid: true,
    userBalance: userWallet.balance,
    houseCanPay: true,
    maxPotentialPayout: maxPayout,
  };
}

/**
 * Validate if user can dive deeper
 * Check if the potential payout increase would exceed house limits
 */
export function validateDiveDeeper(
  gameSession: GameSession,
  houseWallet: HouseWallet,
  limits: WalletLimits = DEFAULT_LIMITS
): BetValidation {
  const nextDiveNumber = gameSession.diveNumber + 1;
  const stats = calculateDiveStats(nextDiveNumber);
  
  // Calculate what the new treasure value would be if they survive
  const potentialNewTreasure = Math.floor(
    gameSession.currentTreasure * stats.multiplier
  );
  
  // Calculate the increase in potential payout
  const payoutIncrease = potentialNewTreasure - gameSession.currentTreasure;
  
  // Check if house can afford this increased risk
  const availableHouseFunds = houseWallet.balance - houseWallet.reservedFunds;
  const houseReserve = houseWallet.balance * limits.houseReserveRatio;
  const houseCanRisk = availableHouseFunds - houseReserve;
  
  if (payoutIncrease > houseCanRisk) {
    return {
      valid: false,
      error: 'House cannot cover potential payout increase. You must surface.',
      houseCanPay: false,
      maxPotentialPayout: potentialNewTreasure,
    };
  }
  
  // Check against maximum win limit
  if (potentialNewTreasure > limits.maxPotentialWin) {
    return {
      valid: false,
      error: `Potential win exceeds maximum ($${limits.maxPotentialWin}). You must surface.`,
      maxPotentialPayout: potentialNewTreasure,
    };
  }
  
  return {
    valid: true,
    houseCanPay: true,
    maxPotentialPayout: potentialNewTreasure,
  };
}

/**
 * Reserve funds from house wallet for active game
 */
export function reserveHouseFunds(
  houseWallet: HouseWallet,
  amount: number
): HouseWallet {
  return {
    ...houseWallet,
    reservedFunds: houseWallet.reservedFunds + amount,
    lastUpdated: Date.now(),
  };
}

/**
 * Release reserved funds back to house wallet
 */
export function releaseHouseFunds(
  houseWallet: HouseWallet,
  amount: number
): HouseWallet {
  return {
    ...houseWallet,
    reservedFunds: Math.max(0, houseWallet.reservedFunds - amount),
    lastUpdated: Date.now(),
  };
}

/**
 * Process user bet (deduct from wallet)
 */
export function processBet(
  userWallet: UserWallet,
  amount: number
): UserWallet {
  return {
    ...userWallet,
    balance: userWallet.balance - amount,
    totalWagered: userWallet.totalWagered + amount,
    lastUpdated: Date.now(),
  };
}

/**
 * Process user win (add to wallet)
 */
export function processWin(
  userWallet: UserWallet,
  amount: number,
  betAmount: number
): UserWallet {
  const profit = amount - betAmount;
  return {
    ...userWallet,
    balance: userWallet.balance + amount,
    totalWon: userWallet.totalWon + profit,
    gamesPlayed: userWallet.gamesPlayed + 1,
    lastUpdated: Date.now(),
  };
}

/**
 * Process user loss (already deducted at bet time)
 */
export function processLoss(
  userWallet: UserWallet,
  betAmount: number
): UserWallet {
  return {
    ...userWallet,
    totalLost: userWallet.totalLost + betAmount,
    gamesPlayed: userWallet.gamesPlayed + 1,
    lastUpdated: Date.now(),
  };
}

/**
 * Process house payout
 */
export function processHousePayout(
  houseWallet: HouseWallet,
  amount: number,
  reservedAmount: number
): HouseWallet {
  return {
    ...houseWallet,
    balance: houseWallet.balance - amount,
    totalPaidOut: houseWallet.totalPaidOut + amount,
    reservedFunds: Math.max(0, houseWallet.reservedFunds - reservedAmount),
    lastUpdated: Date.now(),
  };
}

/**
 * Process house receiving bet
 */
export function processHouseReceiveBet(
  houseWallet: HouseWallet,
  amount: number
): HouseWallet {
  return {
    ...houseWallet,
    balance: houseWallet.balance + amount,
    totalReceived: houseWallet.totalReceived + amount,
    lastUpdated: Date.now(),
  };
}

/**
 * Get current house risk exposure
 */
export function getHouseRiskExposure(
  houseWallet: HouseWallet,
  limits: WalletLimits = DEFAULT_LIMITS
): {
  totalReserved: number;
  availableFunds: number;
  reserveRequired: number;
  canAcceptNewBets: boolean;
  maxNewBet: number;
} {
  const reserveRequired = houseWallet.balance * limits.houseReserveRatio;
  const availableFunds = houseWallet.balance - houseWallet.reservedFunds - reserveRequired;
  const maxNewBet = calculateMaxBetFromHouseWallet(houseWallet, limits);
  
  return {
    totalReserved: houseWallet.reservedFunds,
    availableFunds: Math.max(0, availableFunds),
    reserveRequired,
    canAcceptNewBets: availableFunds > limits.minBet * 50, // Can cover at least one min bet's max payout
    maxNewBet: Math.max(0, maxNewBet),
  };
}
