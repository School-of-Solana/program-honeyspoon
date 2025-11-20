"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  performDive,
  surfaceWithTreasure,
  getWalletInfo,
  startGame,
} from "@/app/actions/gameActions";
import type { DiveResult } from "@/lib/types";

/**
 * Query Keys for TanStack Query
 * Centralized to avoid typos and enable easy refactoring
 */
export const gameQueryKeys = {
  wallet: (userId: string) => ["wallet", userId] as const,
  gameConfig: ["gameConfig"] as const,
  gameSession: (sessionId: string) => ["gameSession", sessionId] as const,
};

/**
 * Query Hook: Get Wallet Balance
 * 
 * Fetches user wallet balance with automatic refetching every 5 seconds
 * and on window focus (for wallet sync when user returns to tab)
 */
export function useWalletBalance(userId: string | null) {
  return useQuery({
    queryKey: gameQueryKeys.wallet(userId || ""),
    queryFn: async () => {
      if (!userId) {
        return {
          userBalance: 0,
          houseBalance: 0,
          houseReserved: 0,
          houseAvailable: 0,
        };
      }
      return await getWalletInfo(userId);
    },
    enabled: !!userId,
    // Refetch balance every 5 seconds (while component is mounted)
    refetchInterval: 5000,
    // Keep showing old data while refetching
    placeholderData: (previousData) => previousData,
  });
}

/**
 * Mutation Hook: Start Game
 * 
 * Creates a new game session and places initial bet
 * Invalidates wallet balance on success to trigger refetch
 */
export function useStartGame() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      userId,
      sessionId,
    }: {
      userId: string;
      sessionId: string;
    }) => {
      return await startGame(userId, sessionId);
    },
    onSuccess: (_data, variables) => {
      // Invalidate wallet balance to refetch after bet placed
      queryClient.invalidateQueries({
        queryKey: gameQueryKeys.wallet(variables.userId),
      });
    },
  });
}

/**
 * Mutation Hook: Perform Dive
 * 
 * Executes a dive attempt (round) in the game
 * Updates wallet balance on success or failure
 */
export function usePerformDive() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      diveNumber,
      currentTreasure,
      sessionId,
      userId,
      testSeed,
    }: {
      diveNumber: number;
      currentTreasure: number;
      sessionId: string;
      userId: string;
      testSeed?: string;
    }): Promise<DiveResult> => {
      return await performDive(
        diveNumber,
        currentTreasure,
        sessionId,
        userId,
        testSeed
      );
    },
    onSuccess: (_data, variables) => {
      // Invalidate wallet on success (balance might change)
      queryClient.invalidateQueries({
        queryKey: gameQueryKeys.wallet(variables.userId),
      });
    },
  });
}

/**
 * Mutation Hook: Cash Out (Surface with Treasure)
 * 
 * Ends game session and transfers winnings to wallet
 * Invalidates wallet balance on success to show updated balance
 */
export function useCashOut() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      finalTreasure,
      sessionId,
      userId,
    }: {
      finalTreasure: number;
      sessionId: string;
      userId: string;
    }) => {
      return await surfaceWithTreasure(finalTreasure, sessionId, userId);
    },
    onSuccess: (_data, variables) => {
      // Invalidate wallet to show updated balance after cashout
      queryClient.invalidateQueries({
        queryKey: gameQueryKeys.wallet(variables.userId),
      });
    },
  });
}
