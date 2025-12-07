import { useQuery } from "@tanstack/react-query";
import { Timestamp } from "firebase/firestore";
import { getTradesForCalendar } from "@/lib/firestoreService";
import type { Trade } from "@/types/trading";

export interface CalendarDayStats {
  dateKey: string; // "YYYY-MM-DD"
  date: Date;
  profit: number;
  tradesCount: number;
  winCount: number;
  lossCount: number;
}

export interface TradingCalendarStats {
  days: CalendarDayStats[];
  totalTrades: number;
  totalProfit: number;
  totalWins: number;
  totalLosses: number;
  bestDay?: CalendarDayStats | null;
  worstDay?: CalendarDayStats | null;
}

export interface UseTradingCalendarParams {
  userId: string;
  accountId: string;
  month: number; // 0-11
  year: number; // full year number, e.g. 2025
  symbol?: string | "ALL";
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
 * Get effective date for a trade (closedAt if present, else openTime)
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
 * Aggregate trades into daily statistics
 */
function aggregateTrades(trades: Trade[]): TradingCalendarStats {
  const dayMap = new Map<string, CalendarDayStats>();

  // Process each trade
  for (const trade of trades) {
    const effectiveDate = getEffectiveDate(trade);
    if (!effectiveDate) continue;

    const dateKey = formatDateKey(effectiveDate);
    const profit = trade.pnlCurrency ?? 0;

    // Get or create day stats
    let dayStats = dayMap.get(dateKey);
    if (!dayStats) {
      dayStats = {
        dateKey,
        date: new Date(effectiveDate.getFullYear(), effectiveDate.getMonth(), effectiveDate.getDate()),
        profit: 0,
        tradesCount: 0,
        winCount: 0,
        lossCount: 0,
      };
      dayMap.set(dateKey, dayStats);
    }

    // Aggregate
    dayStats.profit += profit;
    dayStats.tradesCount += 1;

    // Count wins/losses (ignore breakeven/zero PnL)
    if (profit > 0) {
      dayStats.winCount += 1;
    } else if (profit < 0) {
      dayStats.lossCount += 1;
    }
  }

  // Convert map to array and sort by date
  const days = Array.from(dayMap.values()).sort((a, b) => a.date.getTime() - b.date.getTime());

  // Calculate totals
  const totalTrades = days.reduce((sum, day) => sum + day.tradesCount, 0);
  const totalProfit = days.reduce((sum, day) => sum + day.profit, 0);
  const totalWins = days.reduce((sum, day) => sum + day.winCount, 0);
  const totalLosses = days.reduce((sum, day) => sum + day.lossCount, 0);

  // Find best and worst days
  let bestDay: CalendarDayStats | null = null;
  let worstDay: CalendarDayStats | null = null;

  for (const day of days) {
    if (!bestDay || day.profit > bestDay.profit) {
      bestDay = day;
    }
    if (!worstDay || day.profit < worstDay.profit) {
      worstDay = day;
    }
  }

  return {
    days,
    totalTrades,
    totalProfit,
    totalWins,
    totalLosses,
    bestDay: bestDay || null,
    worstDay: worstDay || null,
  };
}

/**
 * Hook to fetch and aggregate trading calendar data for a given month
 */
export function useTradingCalendar(params: UseTradingCalendarParams): {
  data: TradingCalendarStats | null;
  isLoading: boolean;
  error: Error | null;
} {
  const { userId, accountId, month, year, symbol = "ALL" } = params;

  // Calculate start and end of month
  const startOfMonth = new Date(year, month, 1);
  const endOfMonth = new Date(year, month + 1, 0, 23, 59, 59, 999);

  // Format as YYYY-MM-DD
  const startDate = formatDateKey(startOfMonth);
  const endDate = formatDateKey(endOfMonth);

  const { data: trades, isLoading, error } = useQuery<Trade[]>({
    queryKey: ["tradingCalendar", userId, accountId, year, month, symbol, startDate, endDate],
    queryFn: async () => {
      if (!userId || !accountId) {
        throw new Error("userId and accountId are required");
      }
      return await getTradesForCalendar(userId, accountId, startDate, endDate, symbol);
    },
    enabled: !!userId && !!accountId,
  });

  // Aggregate trades into daily stats
  const aggregatedData = trades ? aggregateTrades(trades) : null;

  return {
    data: aggregatedData,
    isLoading,
    error: error ? (error instanceof Error ? error : new Error(String(error))) : null,
  };
}

