"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useState } from "react";

/**
 * TanStack Query Provider
 * 
 * Provides global query client with optimized defaults for our game:
 * - Shorter stale times for real-time balance updates
 * - Automatic refetching on window focus (for wallet balance sync)
 * - Retry logic for failed blockchain requests
 */
export function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Blockchain data can be stale after 3 seconds
            staleTime: 3_000,
            // Keep data in cache for 5 minutes
            gcTime: 5 * 60 * 1000,
            // Retry failed queries (important for blockchain calls)
            retry: 3,
            retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
            // Refetch on window focus (sync wallet balance when user returns)
            refetchOnWindowFocus: true,
            // Don't refetch on mount if data is fresh
            refetchOnMount: false,
          },
          mutations: {
            // Retry mutations once (for transient blockchain errors)
            retry: 1,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {process.env.NODE_ENV === "development" && (
        <ReactQueryDevtools 
          initialIsOpen={false} 
          position="bottom"
          buttonPosition="bottom-right"
        />
      )}
    </QueryClientProvider>
  );
}
