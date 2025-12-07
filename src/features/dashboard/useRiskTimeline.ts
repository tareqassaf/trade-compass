import { useQuery } from "@tanstack/react-query";
import { Timestamp } from "firebase/firestore";
import { startOfWeek, format as formatDate, subDays, subWeeks, eachDayOfInterval } from "date-fns";
import { getTradesForCalendar } from "@/lib/firestoreService";
import type { Trade } from "@/types/trading";

export type DailyRiskPoint = {
  date: string;           // ISO date string "YYYY-MM-DD"
  pnlPercent: number;     // e.g. +2.5 or -3.0
};

export type WeeklyRiskPoint = {
  weekLabel: string;      // e.g. "Aug 26–Sep 1" or "2025-W35"
  pnlPercent: number;
};

export type RiskTimelineData = {
  daily: DailyRiskPoint[];
  weekly: WeeklyRiskPoint[];
};

export interface UseRiskTimelineOptions {
  userId: string;
  accountId: string;
  days?: number;  // default 30
  weeks?: number; // default 12
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
 * Calculate risk timeline data from trades
 */
function calculateRiskTimeline(
  trades: Trade[],
  days: number,
  weeks: number
): RiskTimelineData {
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  
  const startDate = subDays(today, days);
  startDate.setHours(0, 0, 0, 0);

  // Build daily PnL map for all trades (for cumulative calculation)
  const allDailyPnlMap = new Map<string, number>();
  trades.forEach((trade) => {
    const effectiveDate = getEffectiveDate(trade);
    if (!effectiveDate) return;
    const dateKey = formatDateKey(effectiveDate);
    const current = allDailyPnlMap.get(dateKey) || 0;
    allDailyPnlMap.set(dateKey, current + (trade.pnlCurrency ?? 0));
  });

  // Calculate daily risk points
  const dailyPoints: DailyRiskPoint[] = [];
  const dateRange = eachDayOfInterval({ start: startDate, end: today });
  
  const DEFAULT_BASE_BALANCE = 10000; // $10,000 default account balance

  dateRange.forEach((date) => {
    const dateKey = formatDateKey(date);
    const dayPnL = allDailyPnlMap.get(dateKey) || 0;

    // Calculate cumulative PnL before this day
    let cumulativePnLBefore = 0;
    for (const [key, profit] of allDailyPnlMap.entries()) {
      if (key < dateKey) {
        cumulativePnLBefore += profit;
      }
    }

    // Calculate base balance
    const baseBalance = cumulativePnLBefore > 0 
      ? cumulativePnLBefore 
      : DEFAULT_BASE_BALANCE;

    // Calculate percentage
    const pnlPercent = baseBalance > 0 ? (dayPnL / baseBalance) * 100 : 0;

    dailyPoints.push({
      date: formatDate(date, "MMM dd"), // Format for display
      pnlPercent,
    });
  });

  // Calculate weekly risk points
  const weeklyPoints: WeeklyRiskPoint[] = [];
  const weekStart = startOfWeek(subWeeks(today, weeks - 1), { weekStartsOn: 1 }); // weeks - 1 to include current week
  const currentWeekStart = startOfWeek(today, { weekStartsOn: 1 });
  
  // Generate week intervals
  const weekIntervals: { start: Date; end: Date }[] = [];
  let currentWeek = new Date(weekStart);
  
  while (currentWeek <= currentWeekStart) {
    const weekEndDate = new Date(currentWeek);
    weekEndDate.setDate(weekEndDate.getDate() + 6); // End of week (Sunday)
    weekIntervals.push({
      start: new Date(currentWeek),
      end: weekEndDate > today ? today : weekEndDate,
    });
    currentWeek = new Date(currentWeek);
    currentWeek.setDate(currentWeek.getDate() + 7);
  }

  weekIntervals.forEach((weekInterval) => {
    const weekStartKey = formatDateKey(weekInterval.start);
    const weekEndKey = formatDateKey(weekInterval.end > today ? today : weekInterval.end);

    // Calculate week PnL
    let weekPnL = 0;
    for (const [dateKey, profit] of allDailyPnlMap.entries()) {
      if (dateKey >= weekStartKey && dateKey <= weekEndKey) {
        weekPnL += profit;
      }
    }

    // Calculate cumulative PnL before this week
    let cumulativePnLBefore = 0;
    for (const [dateKey, profit] of allDailyPnlMap.entries()) {
      if (dateKey < weekStartKey) {
        cumulativePnLBefore += profit;
      }
    }

    // Calculate base balance
    const baseBalance = cumulativePnLBefore > 0 
      ? cumulativePnLBefore 
      : DEFAULT_BASE_BALANCE;

    // Calculate percentage
    const pnlPercent = baseBalance > 0 ? (weekPnL / baseBalance) * 100 : 0;

    // Format week label
    const weekLabel = `${formatDate(weekInterval.start, "MMM d")}–${formatDate(weekInterval.end, "MMM d")}`;

    weeklyPoints.push({
      weekLabel,
      pnlPercent,
    });
  });

  return {
    daily: dailyPoints,
    weekly: weeklyPoints,
  };
}

/**
 * Hook to fetch and calculate risk timeline data
 */
export function useRiskTimeline(options: UseRiskTimelineOptions): {
  data: RiskTimelineData | null;
  loading: boolean;
  error: string | null;
} {
  const { userId, accountId, days = 30, weeks = 12 } = options;

  // Calculate date range for querying trades
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  const startDate = subDays(today, Math.max(days, weeks * 7) + 7); // Add buffer for cumulative calculations
  startDate.setHours(0, 0, 0, 0);

  const startDateStr = formatDateKey(startDate);
  const endDateStr = formatDateKey(today);

  // Fetch trades for the account
  const { data: trades, isLoading, error } = useQuery<Trade[]>({
    queryKey: ["riskTimeline", userId, accountId, days, weeks],
    queryFn: async () => {
      if (!userId || !accountId) {
        throw new Error("userId and accountId are required");
      }
      return await getTradesForCalendar(userId, accountId, startDateStr, endDateStr);
    },
    enabled: !!userId && !!accountId,
  });

  // Calculate risk timeline data
  const timelineData = trades ? calculateRiskTimeline(trades, days, weeks) : null;

  return {
    data: timelineData,
    loading: isLoading,
    error: error ? (error instanceof Error ? error.message : String(error)) : null,
  };
}

