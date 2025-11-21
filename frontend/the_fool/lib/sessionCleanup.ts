/**
 * Session Cleanup Manager
 * Handles abandoned session cleanup to prevent vault accounting issues
 */

import { Connection, PublicKey } from "@solana/web3.js";

interface AbandonedSession {
  sessionPda: string;
  userPubkey: string;
  sessionIndex: number;
  timestamp: number;
}

const ABANDONED_SESSION_KEY = "dive_game_active_session";
const CLEANUP_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

export class SessionCleanupManager {
  /**
   * Store active session info when game starts
   */
  static trackSession(
    sessionPda: string,
    userPubkey: string,
    sessionIndex: number
  ): void {
    const session: AbandonedSession = {
      sessionPda,
      userPubkey,
      sessionIndex,
      timestamp: Date.now(),
    };

    if (typeof window !== "undefined") {
      localStorage.setItem(ABANDONED_SESSION_KEY, JSON.stringify(session));
    }
  }

  /**
   * Clear session tracking when game ends normally
   */
  static clearSession(): void {
    if (typeof window !== "undefined") {
      localStorage.removeItem(ABANDONED_SESSION_KEY);
    }
  }

  /**
   * Check for abandoned session on app load
   * Returns session info if found and needs cleanup
   */
  static getAbandonedSession(): AbandonedSession | null {
    if (typeof window === "undefined") return null;

    const stored = localStorage.getItem(ABANDONED_SESSION_KEY);
    if (!stored) return null;

    try {
      const session: AbandonedSession = JSON.parse(stored);

      // Check if session is old enough to be considered abandoned
      const age = Date.now() - session.timestamp;
      if (age > CLEANUP_TIMEOUT_MS) {
        return session;
      }

      return null;
    } catch (_error) {
      console.error("[SessionCleanup] Failed to parse stored session:", _error);
      localStorage.removeItem(ABANDONED_SESSION_KEY);
      return null;
    }
  }

  /**
   * Attempt to cleanup an abandoned session
   */
  static async cleanupAbandonedSession(
    connection: Connection,
    sessionPda: string
  ): Promise<boolean> {
    try {
      const pubkey = new PublicKey(sessionPda);
      const accountInfo = await connection.getAccountInfo(pubkey);

      if (!accountInfo) {
        // Session already cleaned up
        console.log("[SessionCleanup] Session already cleaned:", sessionPda);
        this.clearSession();
        return true;
      }

      // Session still exists - parse to check status
      // If status is Lost or CashedOut, can be safely cleared from tracking
      // If Active, needs proper cleanup (lose_session or clean_expired)

      const data = accountInfo.data;
      const statusOffset = 8 + 32 + 32; // discriminator + user + house_vault
      const status = data[statusOffset]; // 0=Active, 1=Lost, 2=CashedOut

      if (status !== 0) {
        // Session is already terminal (Lost/CashedOut)
        console.log("[SessionCleanup] Session already terminal:", sessionPda);
        this.clearSession();
        return true;
      }

      // Session is still Active - needs cleanup
      console.warn(
        "[SessionCleanup] Active abandoned session found:",
        sessionPda
      );
      console.warn(
        "[SessionCleanup] Manual cleanup required - call lose_session or wait for timeout"
      );

      return false;
    } catch (_error) {
      console.error("[SessionCleanup] Failed to check session:", _error);
      return false;
    }
  }

  /**
   * Get current session index for user
   */
  static getCurrentSessionIndex(): number {
    if (typeof window === "undefined") return 0;

    const stored = localStorage.getItem(ABANDONED_SESSION_KEY);
    if (!stored) return 0;

    try {
      const session: AbandonedSession = JSON.parse(stored);
      return session.sessionIndex + 1; // Use next index
    } catch {
      return 0;
    }
  }

  /**
   * Initialize cleanup check on app load
   */
  static async initialize(connection: Connection): Promise<void> {
    const abandoned = this.getAbandonedSession();

    if (!abandoned) {
      console.log("[SessionCleanup] No abandoned sessions found");
      return;
    }

    console.log("[SessionCleanup] Found abandoned session:", abandoned);

    const cleaned = await this.cleanupAbandonedSession(
      connection,
      abandoned.sessionPda
    );

    if (cleaned) {
      console.log(
        "[SessionCleanup] ✅ Successfully cleaned up abandoned session"
      );
    } else {
      console.warn(
        "[SessionCleanup] ⚠️ Abandoned session still active - may need manual cleanup"
      );
    }
  }
}

// Export for use in React hooks
export const useSessionCleanup = () => {
  return {
    trackSession: SessionCleanupManager.trackSession,
    clearSession: SessionCleanupManager.clearSession,
    getAbandonedSession: SessionCleanupManager.getAbandonedSession,
    getCurrentSessionIndex: SessionCleanupManager.getCurrentSessionIndex,
  };
};
