import { useQuery } from "@tanstack/react-query";
import { Timestamp } from "firebase/firestore";
import { getTradesForCalendar } from "@/lib/firestoreService";
import type { Trade, TagStat } from "@/types/trading";

export interface UseTagAnalyticsParams {
  userId: string;
  accountId: string;
  days?: number; // default 30
  symbol?: string; // optional: filter by symbol
}

export interface UseTagAnalyticsResult {
  data: TagStat[] | null;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Normalize Firestore Timestamp to JavaScript Date
 */
function normalizeTimestamp(
  ts: string | Timestamp | Date | null | undefined
): Date | null {
  if (!ts) return null;
  if (ts instanceof Date) return ts;
  if (ts instanceof Timestamp) return ts.toDate();
  if (typeof ts === "string") {
    const date = new Date(ts);
    return isNaN(date.getTime()) ? null : date;
  }
  return null;
}

/**
 * Get effective date for a trade (closeTime if present, else openTime)
 */
function getEffectiveDate(trade: Trade): Date | null {
  // Try closeTime first
  const closeTime = normalizeTimestamp(trade.closeTime);
  if (closeTime) return closeTime;

  // Fallback to openTime
  const openTime = normalizeTimestamp(trade.openTime);
  if (openTime) return openTime;

  // Fallback to tradeDate string
  if (trade.tradeDate) {
    const date = new Date(trade.tradeDate);
    return isNaN(date.getTime()) ? null : date;
  }

  return null;
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
 * Filter trades by date range
 */
function filterTradesByDateRange(trades: Trade[], days: number): Trade[] {
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - days);
  startDate.setHours(0, 0, 0, 0);

  const startDateStr = formatDateKey(startDate);
  const endDateStr = formatDateKey(today);

  return trades.filter((trade) => {
    const effectiveDate = getEffectiveDate(trade);
    if (!effectiveDate) return false;
    const dateKey = formatDateKey(effectiveDate);
    return dateKey >= startDateStr && dateKey <= endDateStr;
  });
}

/**
 * Aggregate trades by tag
 */
function aggregateTagStats(trades: Trade[]): TagStat[] {
  // Filter out trades with no tags
  const tradesWithTags = trades.filter(
    (trade) => trade.tags && trade.tags.length > 0
  );

  if (tradesWithTags.length === 0) {
    return [];
  }

  // Map to aggregate stats per tag
  const tagMap = new Map<string, {
    tradesCount: number;
    winsCount: number;
    lossesCount: number;
    breakevenCount: number;
    netPnlCurrency: number;
    grossProfit: number;
    grossLossAbs: number;
    sumR: number;
    countR: number;
  }>();

  // Process each trade
  tradesWithTags.forEach((trade) => {
    const pnl = trade.pnlCurrency ?? 0;
    const isWin = pnl > 0;
    const isLoss = pnl < 0;
    const isBE = pnl === 0;

    // Add this trade to each of its tags
    trade.tags?.forEach((tag) => {
      let stats = tagMap.get(tag);
      if (!stats) {
        stats = {
          tradesCount: 0,
          winsCount: 0,
          lossesCount: 0,
          breakevenCount: 0,
          netPnlCurrency: 0,
          grossProfit: 0,
          grossLossAbs: 0,
          sumR: 0,
          countR: 0,
        };
        tagMap.set(tag, stats);
      }

      // Update counts
      stats.tradesCount++;
      if (isWin) stats.winsCount++;
      if (isLoss) stats.lossesCount++;
      if (isBE) stats.breakevenCount++;

      // Update PnL
      stats.netPnlCurrency += pnl;
      if (pnl > 0) {
        stats.grossProfit += pnl;
      }
      if (pnl < 0) {
        stats.grossLossAbs += Math.abs(pnl);
      }

      // Update R multiple
      if (trade.rMultiple != null && trade.rMultiple !== undefined) {
        stats.sumR += trade.rMultiple;
        stats.countR++;
      }
    });
  });

  // Convert map to TagStat array
  const tagStats: TagStat[] = Array.from(tagMap.entries()).map(([tag, stats]) => {
    const tradesWithResult = stats.winsCount + stats.lossesCount;
    const winRate = tradesWithResult > 0 ? stats.winsCount / tradesWithResult : 0;
    const avgRMultiple = stats.countR > 0 ? stats.sumR / stats.countR : null;
    const profitFactor = stats.grossLossAbs > 0 ? stats.grossProfit / stats.grossLossAbs : null;

    return {
      tag,
      tradesCount: stats.tradesCount,
      winsCount: stats.winsCount,
      lossesCount: stats.lossesCount,
      breakevenCount: stats.breakevenCount,
      winRate,
      netPnlCurrency: stats.netPnlCurrency,
      avgRMultiple,
      profitFactor,
    };
  });

  // Sort by netPnlCurrency descending, then tradesCount descending
  tagStats.sort((a, b) => {
    if (b.netPnlCurrency !== a.netPnlCurrency) {
      return b.netPnlCurrency - a.netPnlCurrency;
    }
    return b.tradesCount - a.tradesCount;
  });

  return tagStats;
}

/**
 * Hook to fetch and aggregate tag analytics
 */
export function useTagAnalytics(
  params: UseTagAnalyticsParams
): UseTagAnalyticsResult {
  const { userId, accountId, days = 30, symbol } = params;

  // Calculate date range for querying trades
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - days);
  startDate.setHours(0, 0, 0, 0);

  const startDateStr = formatDateKey(startDate);
  const endDateStr = formatDateKey(today);

  // Fetch all trades for the account (we'll filter by date in aggregation)
  const { data: trades, isLoading, error } = useQuery<Trade[]>({
    queryKey: ["tagAnalytics", userId, accountId, days, symbol],
    queryFn: async () => {
      if (!userId || !accountId) {
        throw new Error("userId and accountId are required");
      }
      // Fetch trades for the account with a wide date range to get all trades
      // We'll filter by date in the aggregation function
      const farPastDate = "2000-01-01";
      return await getTradesForCalendar(userId, accountId, farPastDate, endDateStr, symbol);
    },
    enabled: !!userId && !!accountId,
  });

  // Filter trades by date range and aggregate
  const filteredTrades = trades ? filterTradesByDateRange(trades, days) : null;
  const aggregatedData = filteredTrades ? aggregateTagStats(filteredTrades) : null;

  return {
    data: aggregatedData,
    isLoading,
    error: error ? (error instanceof Error ? error : new Error(String(error))) : null,
  };
}

