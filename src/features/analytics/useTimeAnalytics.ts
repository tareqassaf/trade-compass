import { useQuery } from "@tanstack/react-query";
import { getTradesForCalendar } from "@/lib/firestoreService";
import { aggregateTimeAnalytics, type TimeAnalyticsResult } from "./timeAnalytics";
import type { Trade } from "@/types/trading";

export interface UseTimeAnalyticsParams {
  userId: string;
  accountId: string;
  days?: number; // default 90
  symbol?: string; // optional filter
}

export interface UseTimeAnalyticsResult {
  data: TimeAnalyticsResult | null;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Format date as YYYY-MM-DD
 */
function formatDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Hook to fetch and aggregate time analytics
 */
export function useTimeAnalytics(
  params: UseTimeAnalyticsParams
): UseTimeAnalyticsResult {
  const { userId, accountId, days = 90, symbol } = params;

  // Calculate date range for querying trades
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  const start = new Date(today);
  start.setDate(start.getDate() - days);
  start.setHours(0, 0, 0, 0);

  const startDateStr = formatDateKey(start);
  const endDateStr = formatDateKey(today);

  // Fetch trades using React Query
  const { data: trades, isLoading, error } = useQuery<Trade[]>({
    queryKey: ["timeAnalytics", userId, accountId, days, symbol],
    queryFn: async () => {
      if (!userId || !accountId) {
        throw new Error("userId and accountId are required");
      }
      // getTradesForCalendar currently ignores date range in Firestore
      // and filters client-side. That's fine; we can still pass the string range.
      return await getTradesForCalendar(
        userId,
        accountId,
        startDateStr,
        endDateStr,
        symbol
      );
    },
    enabled: !!userId && !!accountId,
  });

  // Aggregate trades into time analytics
  const aggregatedData = trades ? aggregateTimeAnalytics(trades) : null;

  return {
    data: aggregatedData,
    isLoading,
    error: error ? (error instanceof Error ? error : new Error(String(error))) : null,
  };
}

