/**
 * Server-Sent Events (SSE) endpoint for real-time wallet updates
 *
 * This replaces polling with push-based updates for:
 * - User wallet balance changes
 * - House vault balance changes
 * - Transaction confirmations
 * - Game config updates
 *
 * Usage:
 *   const eventSource = new EventSource('/api/wallet-events?userId=xxx');
 *   eventSource.addEventListener('balance-update', (e) => {
 *     const data = JSON.parse(e.data);
 *     console.log('Balance updated:', data);
 *   });
 */

import { NextRequest } from "next/server";
import { getGameChain } from "@/lib/ports";
import { lamportsToSol } from "@/lib/utils/solana";

// Keep track of active connections
const connections = new Set<ReadableStreamDefaultController>();

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const userId = searchParams.get("userId");
  const houseAuthority = process.env.NEXT_PUBLIC_HOUSE_AUTHORITY;

  console.log("[SSE] New connection request:", {
    userId,
    hasHouseAuth: !!houseAuthority,
  });

  // Create a ReadableStream for SSE
  const stream = new ReadableStream({
    start(controller) {
      connections.add(controller);
      console.log(
        "[SSE] Connection established. Active connections:",
        connections.size
      );

      // Send initial connection message
      const encoder = new TextEncoder();
      controller.enqueue(
        encoder.encode(
          `data: ${JSON.stringify({ type: "connected", timestamp: Date.now() })}\n\n`
        )
      );

      // Function to send wallet updates
      const sendUpdate = async () => {
        try {
          const chain = getGameChain();
          const updates: any = {
            type: "balance-update",
            timestamp: Date.now(),
          };

          // Fetch user balance if userId provided
          if (userId) {
            try {
              const userBalanceLamports = await chain.getUserBalance(userId);
              updates.userBalance = lamportsToSol(userBalanceLamports);
            } catch (error) {
              console.error("[SSE] Failed to fetch user balance:", error);
              updates.userBalance = 0;
            }
          }

          // Fetch house vault balance
          if (houseAuthority) {
            try {
              // Get house vault PDA
              const useSolana = process.env.NEXT_PUBLIC_USE_SOLANA === "true";
              let vaultPda: string;

              if (useSolana) {
                const { PublicKey } = await import("@solana/web3.js");
                const { getHouseVaultAddress } = await import(
                  "@/lib/solana/pdas"
                );
                const programId = new PublicKey(
                  process.env.NEXT_PUBLIC_PROGRAM_ID!
                );
                const houseAuthPubkey = new PublicKey(houseAuthority);
                const [vaultPdaPubkey] = getHouseVaultAddress(
                  houseAuthPubkey,
                  programId
                );
                vaultPda = vaultPdaPubkey.toBase58();
              } else {
                const { mockHouseVaultPDA } = await import("@/lib/solana/pdas");
                vaultPda = mockHouseVaultPDA(houseAuthority);
              }

              const vaultState = await chain.getHouseVault(vaultPda);
              if (vaultState) {
                const vaultBalanceLamports =
                  await chain.getVaultBalance(vaultPda);
                updates.houseVaultBalance = lamportsToSol(vaultBalanceLamports);
                updates.houseVaultReserved = lamportsToSol(
                  vaultState.totalReserved
                );
              }
            } catch (error) {
              console.error(
                "[SSE] Failed to fetch house vault balance:",
                error
              );
            }
          }

          // Send update
          const message = `data: ${JSON.stringify(updates)}\n\n`;
          controller.enqueue(encoder.encode(message));
        } catch (error) {
          console.error("[SSE] Error sending update:", error);
        }
      };

      // Send initial update immediately
      sendUpdate();

      // WARNING: DO NOT poll! SSE should only send updates when triggered by events
      // Polling defeats the purpose of SSE and wastes resources
      // Updates should be triggered by:
      // - Airdrops (via broadcastEvent)
      // - Game transactions (via broadcastEvent)
      // - Admin actions (via broadcastEvent)

      // Store the sendUpdate function so it can be called by broadcastEvent
      (controller as any).sendUpdate = sendUpdate;

      // Cleanup on connection close
      request.signal.addEventListener("abort", () => {
        console.log("[SSE] Connection closed by client");
        connections.delete(controller);
        console.log("[SSE] Active connections:", connections.size);
        try {
          controller.close();
        } catch (e) {
          // Already closed
        }
      });
    },

    cancel() {
      console.log("[SSE] Stream cancelled");
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // Disable nginx buffering
    },
  });
}

/**
 * Broadcast an event to all connected clients
 * This triggers a fresh balance fetch for all clients
 */
export function broadcastBalanceUpdate() {
  console.log(
    "[SSE] 📢 Broadcasting balance update to",
    connections.size,
    "clients"
  );

  connections.forEach((controller) => {
    try {
      // Call the stored sendUpdate function to fetch fresh balances
      const sendUpdate = (controller as any).sendUpdate;
      if (sendUpdate) {
        sendUpdate();
      }
    } catch (error) {
      console.error("[SSE] Failed to send update to client:", error);
    }
  });
}

/**
 * Broadcast a custom event to all connected clients
 * Use this for non-balance events (e.g., game state changes)
 */
export function broadcastEvent(event: any) {
  const encoder = new TextEncoder();
  const message = `data: ${JSON.stringify(event)}\n\n`;
  const encoded = encoder.encode(message);

  connections.forEach((controller) => {
    try {
      controller.enqueue(encoded);
    } catch (error) {
      console.error("[SSE] Failed to send to client:", error);
    }
  });
}
