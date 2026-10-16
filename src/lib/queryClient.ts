import { QueryClient } from "@tanstack/react-query"
import { ApiHttpError } from "@/api/client"

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: (failureCount, error) => {
        // Client-side validation/authorization/not-found errors are not
        // transient and should not be retried automatically.
        if (error instanceof ApiHttpError && error.status < 500) {
          return false
        }

        // Retry transient network and server errors with a bounded delay.
        return failureCount < 2
      },
      retryDelay: (attemptIndex) =>
        Math.min(1_000 * 2 ** attemptIndex, 5_000),
      refetchOnWindowFocus: false,
    },
  },
})
