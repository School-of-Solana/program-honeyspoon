/**
 * useAsyncAction Hook
 *
 * Prevents double-clicks and manages loading states for async operations
 * Uses industry-standard npm packages:
 * - use-debounce: For debouncing clicks
 * - react-use: For async state management
 */

import { useState, useCallback, useRef } from "react";
import { useAsyncFn } from "react-use";
import { useDebouncedCallback } from "use-debounce";
import { logger } from "@/lib/logger";

interface UseAsyncActionOptions {
  /**
   * Debounce delay in milliseconds
   * Prevents multiple rapid clicks
   * @default 300
   */
  debounceMs?: number;

  /**
   * Log action execution (for debugging)
   * @default true
   */
  logExecution?: boolean;

  /**
   * Action name for logging
   */
  actionName?: string;
}

/**
 * Hook to wrap async actions with debouncing and loading states
 *
 * @example
 * ```tsx
 * const { execute, isLoading, error } = useAsyncAction(
 *   async () => {
 *     await gameChain.startSession({ ... });
 *   },
 *   { debounceMs: 2000, actionName: 'Start Game' }
 * );
 *
 * <button onClick={execute} disabled={isLoading}>
 *   {isLoading ? 'Starting...' : 'Start Game'}
 * </button>
 * ```
 */
export function useAsyncAction<T = void>(
  action: () => Promise<T>,
  options: UseAsyncActionOptions = {}
) {
  const {
    debounceMs = 300,
    logExecution = true,
    actionName = "Action",
  } = options;

  // Track if action is in flight to prevent concurrent executions
  const isExecutingRef = useRef(false);

  // Use react-use's useAsyncFn for state management
  const [state, doAction] = useAsyncFn(async () => {
    // Prevent concurrent executions
    if (isExecutingRef.current) {
      if (logExecution) {
        logger.game.warn(
          `[${actionName}] Already executing, ignoring duplicate call`
        );
      }
      return;
    }

    try {
      isExecutingRef.current = true;

      if (logExecution) {
        logger.game.info(`[${actionName}] Starting...`);
      }

      const result = await action();

      if (logExecution) {
        logger.game.info(`[${actionName}] Completed successfully`);
      }

      return result;
    } catch (error) {
      if (logExecution) {
        logger.game.error(`[${actionName}] Failed:`, error);
      }
      throw error;
    } finally {
      isExecutingRef.current = false;
    }
  }, [action, actionName, logExecution]);

  // Debounce the action to prevent rapid clicks
  const debouncedAction = useDebouncedCallback(
    doAction,
    debounceMs,
    { leading: true, trailing: false } // Execute on leading edge, ignore trailing
  );

  return {
    /**
     * Execute the async action (debounced)
     */
    execute: debouncedAction,

    /**
     * Is the action currently executing?
     */
    isLoading: state.loading,

    /**
     * Error from last execution (if any)
     */
    error: state.error,

    /**
     * Result from last successful execution
     */
    value: state.value,
  };
}

/**
 * Simpler version without debouncing - just prevents concurrent executions
 */
export function useAsyncActionSimple<T = void>(
  action: () => Promise<T>,
  actionName = "Action"
) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | undefined>();
  const isExecutingRef = useRef(false);

  const execute = useCallback(async () => {
    // Prevent concurrent executions
    if (isExecutingRef.current) {
      logger.game.warn(
        `[${actionName}] Already executing, ignoring duplicate call`
      );
      return;
    }

    try {
      isExecutingRef.current = true;
      setIsLoading(true);
      setError(undefined);

      logger.game.info(`[${actionName}] Starting...`);
      const result = await action();
      logger.game.info(`[${actionName}] Completed successfully`);

      return result;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      logger.game.error(`[${actionName}] Failed:`, error);
      throw error;
    } finally {
      isExecutingRef.current = false;
      setIsLoading(false);
    }
  }, [action, actionName]);

  return {
    execute,
    isLoading,
    error,
  };
}
