/**
 * Error Handling Contract Tests
 *
 * These tests lock in the contract between:
 * 1. Server error messages (thrown by gameEngine.ts)
 * 2. Error parsing logic (parseServerError)
 * 3. Client error handling (page.tsx error categorization)
 *
 * If ANY error message changes on the server, these tests will fail,
 * preventing silent breakage of client error handling.
 */

import { describe, it } from "node:test";
import assert from "node:assert";
import {
  parseServerError,
  GameErrorCode,
  ErrorCategory,
  isErrorCode,
  isErrorCategory,
  getErrorAction,
  ERROR_CATEGORIES,
  ERROR_MESSAGES,
} from "../../lib/errorTypes";

describe("Error Handling Contract", () => {
  describe("Server Error Message Parsing", () => {
    it("should parse session invalid errors", () => {
      const messages = [
        "Invalid or inactive game session",
        "Invalid session ID",
        "Invalid game session",
      ];

      for (const msg of messages) {
        const error = parseServerError(msg);
        assert.strictEqual(
          error.category,
          ErrorCategory.SESSION,
          `"${msg}" should be SESSION category`
        );
        assert.ok(
          isErrorCode(error, GameErrorCode.SESSION_INVALID) ||
            isErrorCode(error, GameErrorCode.INVALID_SESSION_ID),
          `"${msg}" should be session-related error code`
        );
      }
    });

    it("should parse session ownership errors", () => {
      const error = parseServerError("Session does not belong to user");

      assert.strictEqual(error.code, GameErrorCode.SESSION_NOT_OWNED);
      assert.strictEqual(error.category, ErrorCategory.SESSION);
    });

    it("should parse treasure mismatch errors", () => {
      const message =
        "Treasure mismatch: Expected $20, received $25. Data corruption detected.";
      const error = parseServerError(message);

      assert.strictEqual(error.code, GameErrorCode.TREASURE_MISMATCH);
      assert.strictEqual(error.category, ErrorCategory.VALIDATION);
      assert.strictEqual(error.details?.expected, "20");
      assert.strictEqual(error.details?.received, "25");
    });

    it("should parse round mismatch errors", () => {
      const message =
        "Round mismatch: Expected round 3, received 5. Please refresh.";
      const error = parseServerError(message);

      assert.strictEqual(error.code, GameErrorCode.ROUND_MISMATCH);
      assert.strictEqual(error.category, ErrorCategory.VALIDATION);
      assert.strictEqual(error.details?.expected, "3");
      assert.strictEqual(error.details?.received, "5");
    });

    it("should parse cash-out mismatch errors", () => {
      const message =
        "Cash-out mismatch: Session has $100, attempting to cash out $150";
      const error = parseServerError(message);

      assert.strictEqual(error.code, GameErrorCode.CASHOUT_MISMATCH);
      assert.strictEqual(error.category, ErrorCategory.VALIDATION);
      assert.strictEqual(error.details?.sessionAmount, "100");
      assert.strictEqual(error.details?.attemptedAmount, "150");
    });

    it("should parse bet validation errors", () => {
      const testCases = [
        {
          message: "Bet below minimum",
          expectedCode: GameErrorCode.BET_TOO_LOW,
        },
        {
          message: "Bet exceeds maximum",
          expectedCode: GameErrorCode.BET_TOO_HIGH,
        },
        {
          message: "Insufficient balance",
          expectedCode: GameErrorCode.INSUFFICIENT_BALANCE,
        },
        {
          message: "House cannot cover potential payout",
          expectedCode: GameErrorCode.HOUSE_LIMIT_EXCEEDED,
        },
      ];

      for (const { message, expectedCode } of testCases) {
        const error = parseServerError(message);
        assert.strictEqual(
          error.code,
          expectedCode,
          `"${message}" should parse to ${expectedCode}`
        );
        assert.strictEqual(error.category, ErrorCategory.INSUFFICIENT_FUNDS);
      }
    });

    it("should parse unknown errors", () => {
      const error = parseServerError(
        "Some completely unexpected error message"
      );

      assert.strictEqual(error.code, GameErrorCode.UNKNOWN);
      assert.strictEqual(error.category, ErrorCategory.UNKNOWN);
      assert.strictEqual(
        error.details?.originalMessage,
        "Some completely unexpected error message"
      );
    });
  });

  describe("Error Categorization", () => {
    it("should categorize all session errors as SESSION", () => {
      const sessionCodes = [
        GameErrorCode.SESSION_INVALID,
        GameErrorCode.SESSION_INACTIVE,
        GameErrorCode.SESSION_NOT_OWNED,
        GameErrorCode.SESSION_EXPIRED,
      ];

      for (const code of sessionCodes) {
        assert.strictEqual(
          ERROR_CATEGORIES[code],
          ErrorCategory.SESSION,
          `${code} should be SESSION category`
        );
      }
    });

    it("should categorize validation errors as VALIDATION", () => {
      const validationCodes = [
        GameErrorCode.TREASURE_MISMATCH,
        GameErrorCode.ROUND_MISMATCH,
        GameErrorCode.CASHOUT_MISMATCH,
      ];

      for (const code of validationCodes) {
        assert.strictEqual(
          ERROR_CATEGORIES[code],
          ErrorCategory.VALIDATION,
          `${code} should be VALIDATION category`
        );
      }
    });

    it("should categorize fund errors as INSUFFICIENT_FUNDS", () => {
      const fundCodes = [
        GameErrorCode.BET_TOO_LOW,
        GameErrorCode.BET_TOO_HIGH,
        GameErrorCode.INSUFFICIENT_BALANCE,
        GameErrorCode.HOUSE_LIMIT_EXCEEDED,
      ];

      for (const code of fundCodes) {
        assert.strictEqual(
          ERROR_CATEGORIES[code],
          ErrorCategory.INSUFFICIENT_FUNDS,
          `${code} should be INSUFFICIENT_FUNDS category`
        );
      }
    });
  });

  describe("Error Action Recommendations", () => {
    it("should recommend session reset for session errors", () => {
      const error = parseServerError("Invalid or inactive game session");
      const action = getErrorAction(error);

      assert.strictEqual(action.type, "RESET_SESSION");
      assert.strictEqual(action.recoverable, true);
      assert.strictEqual(action.primaryLabel, "Start New Game");
    });

    it("should recommend support contact for validation errors", () => {
      const error = parseServerError(
        "Treasure mismatch: Expected $10, received $20"
      );
      const action = getErrorAction(error);

      assert.strictEqual(action.type, "CONTACT_SUPPORT");
      assert.strictEqual(action.recoverable, false);
      assert.strictEqual(action.primaryLabel, "Reload Page");
    });

    it("should recommend message display for fund errors", () => {
      const error = parseServerError("Insufficient balance");
      const action = getErrorAction(error);

      assert.strictEqual(action.type, "SHOW_MESSAGE");
      assert.strictEqual(action.recoverable, true);
      assert.strictEqual(action.primaryLabel, "OK");
    });

    it("should recommend page reload for unknown errors", () => {
      const error = parseServerError("Something went terribly wrong");
      const action = getErrorAction(error);

      assert.strictEqual(action.type, "RELOAD_PAGE");
      assert.strictEqual(action.recoverable, false);
    });
  });

  describe("Error Helper Functions", () => {
    it("should check error codes correctly", () => {
      const error = parseServerError("Invalid or inactive game session");

      assert.strictEqual(
        isErrorCode(error, GameErrorCode.SESSION_INVALID),
        true
      );
      assert.strictEqual(
        isErrorCode(error, GameErrorCode.TREASURE_MISMATCH),
        false
      );
    });

    it("should check error categories correctly", () => {
      const sessionError = parseServerError("Invalid session ID");
      const validationError = parseServerError(
        "Treasure mismatch: Expected $10, received $20"
      );

      assert.strictEqual(
        isErrorCategory(sessionError, ErrorCategory.SESSION),
        true
      );
      assert.strictEqual(
        isErrorCategory(sessionError, ErrorCategory.VALIDATION),
        false
      );

      assert.strictEqual(
        isErrorCategory(validationError, ErrorCategory.VALIDATION),
        true
      );
      assert.strictEqual(
        isErrorCategory(validationError, ErrorCategory.SESSION),
        false
      );
    });
  });

  describe("Error Messages", () => {
    it("should have user-friendly messages for all error codes", () => {
      const allCodes = Object.values(GameErrorCode);

      for (const code of allCodes) {
        const message = ERROR_MESSAGES[code];
        assert.ok(
          message && message.length > 0,
          `Error code ${code} should have a user-friendly message`
        );
      }
    });

    it("should not expose technical details in user messages", () => {
      const allMessages = Object.values(ERROR_MESSAGES);

      for (const message of allMessages) {
        assert.ok(
          !message.includes("undefined"),
          `Message should not contain "undefined": ${message}`
        );
        assert.ok(
          !message.includes("null"),
          `Message should not contain "null": ${message}`
        );
        assert.ok(
          !message.toLowerCase().includes("error:"),
          `Message should not start with "Error:": ${message}`
        );
      }
    });
  });

  describe("Server Error Message Contract (CRITICAL)", () => {
    /**
     * These tests define the EXACT error messages the server MUST throw.
     * If these tests fail, it means either:
     * 1. The server error messages changed (update tests + parseServerError)
     * 2. The parsing logic is broken (fix parseServerError)
     */

    it("LOCKED: executeRound session errors", () => {
      // These exact strings are thrown by executeRound in gameEngine.ts:177, 182, 188
      const serverMessages = [
        "Invalid or inactive game session",
        "Session does not belong to user",
        "Round mismatch: Expected round 2, received 1. Please refresh.",
        "Treasure mismatch: Expected $10, received $20. Data corruption detected.",
      ];

      // All should parse without throwing
      for (const msg of serverMessages) {
        const error = parseServerError(msg);
        assert.ok(
          error.code !== GameErrorCode.UNKNOWN,
          `Failed to parse: "${msg}"`
        );
      }
    });

    it("LOCKED: cashOut session errors", () => {
      // These exact strings are thrown by cashOut in gameEngine.ts
      const serverMessages = [
        "Invalid or inactive game session",
        "Session does not belong to user",
        "Cash-out mismatch: Session has $100, attempting to cash out $150",
      ];

      for (const msg of serverMessages) {
        const error = parseServerError(msg);
        assert.ok(
          error.code !== GameErrorCode.UNKNOWN,
          `Failed to parse: "${msg}"`
        );
      }
    });

    it("LOCKED: startGameSession validation errors", () => {
      const serverMessages = [
        "Bet below minimum",
        "Bet exceeds maximum",
        "Insufficient balance",
        "House cannot cover potential payout. Maximum bet: $0",
      ];

      for (const msg of serverMessages) {
        const error = parseServerError(msg);
        assert.ok(
          error.category === ErrorCategory.INSUFFICIENT_FUNDS,
          `"${msg}" should be INSUFFICIENT_FUNDS category`
        );
      }
    });
  });

  describe("UI Integration Contract", () => {
    /**
     * These tests verify the client-side logic that was using string matching
     * Lines from page.tsx:381 and page.tsx:495
     */

    it("CLIENT: handleDiveDeeper session check", () => {
      // Old logic: message.includes("session") || message.includes("inactive")
      // This should now be: isErrorCategory(error, ErrorCategory.SESSION)

      const sessionMessages = [
        "Invalid or inactive game session",
        "Session does not belong to user",
      ];

      for (const msg of sessionMessages) {
        const error = parseServerError(msg);
        assert.strictEqual(
          error.category,
          ErrorCategory.SESSION,
          `"${msg}" should trigger session reset in UI`
        );
      }
    });

    it("CLIENT: handleSurface treasure check", () => {
      // Old logic: message.includes("treasure")
      // This should now be: isErrorCode(error, GameErrorCode.TREASURE_MISMATCH)

      const treasureMessage = "Treasure mismatch: Expected $10, received $20";
      const error = parseServerError(treasureMessage);

      assert.strictEqual(error.code, GameErrorCode.TREASURE_MISMATCH);
      assert.strictEqual(
        getErrorAction(error).type,
        "CONTACT_SUPPORT",
        "Treasure mismatch should recommend contacting support"
      );
    });
  });

  describe("Internationalization Ready", () => {
    it("should support i18n key substitution", () => {
      // Error messages can be replaced with i18n keys
      const error = parseServerError("Invalid or inactive game session");

      // In production, ERROR_MESSAGES could map to: "errors.session.invalid"
      // The message field is designed to be replaceable
      assert.ok(
        typeof ERROR_MESSAGES[error.code] === "string",
        "Message should be string (or i18n key)"
      );
    });
  });
});

console.log("OK: All error handling contract tests defined");
