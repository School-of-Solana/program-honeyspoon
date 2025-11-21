"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import {
  performDive,
  surfaceWithTreasure,
  startGame,
} from "@/app/actions/gameActions";
import { getWalletInfo } from "@/app/actions/walletActions";
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
    // Keep showing old data while refetching (no loading flash)
    placeholderData: (previousData) => previousData,
    // Consider data fresh for 2 seconds (reduces redundant fetches)
    staleTime: 2000,
    // Cache for 30 seconds
    gcTime: 30_000,
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
      const toastId = toast.loading("🎮 Starting game session...");
      try {
        const result = await startGame(userId, sessionId);
        toast.success("🚀 Game started! Good luck!", { id: toastId });
        return result;
      } catch (error) {
        toast.error(
          `Failed to start game: ${error instanceof Error ? error.message : "Unknown error"}`,
          { id: toastId }
        );
        throw error;
      }
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
      const toastId = toast.loading(`🤿 Diving to depth ${diveNumber}...`);
      try {
        const result = await performDive(
          diveNumber,
          currentTreasure,
          sessionId,
          userId,
          testSeed
        );

        if (result.survived) {
          toast.success(
            `✅ Survived! Treasure: ${result.totalTreasure.toFixed(2)} SOL`,
            { id: toastId, duration: 2000 }
          );
        } else {
          toast.error(`💀 Lost the dive! Better luck next time`, {
            id: toastId,
            duration: 3000,
          });
        }

        return result;
      } catch (error) {
        toast.error(
          `Dive failed: ${error instanceof Error ? error.message : "Unknown error"}`,
          { id: toastId }
        );
        throw error;
      }
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
      const toastId = toast.loading("🏖️ Surfacing with treasure...");
      try {
        const result = await surfaceWithTreasure(
          finalTreasure,
          sessionId,
          userId
        );

        if (result.success) {
          const profit = result.profit.toFixed(2);
          toast.success(
            `💰 Cashed out ${result.finalAmount.toFixed(2)} SOL! Profit: ${profit} SOL`,
            { id: toastId, duration: 4000 }
          );
        }

        return result;
      } catch (error) {
        toast.error(
          `Cash out failed: ${error instanceof Error ? error.message : "Unknown error"}`,
          { id: toastId }
        );
        throw error;
      }
    },
    onSuccess: (_data, variables) => {
      // Invalidate wallet to show updated balance after cashout
      queryClient.invalidateQueries({
        queryKey: gameQueryKeys.wallet(variables.userId),
      });
    },
  });
}
