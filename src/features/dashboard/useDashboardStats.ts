import { useQuery } from "@tanstack/react-query";
import { Timestamp } from "firebase/firestore";
import { startOfWeek } from "date-fns";
import { getTradesForCalendar } from "@/lib/firestoreService";
import type { Trade } from "@/types/trading";

export interface DashboardKpis {
  totalTrades: number;
  totalProfit: number;
  winCount: number;
  lossCount: number;
  winRate: number; // 0-1 or percentage (0-100)
  avgProfitPerTrade: number;
  avgPositionSize?: number; // Optional: average volume
}

export interface DailyPnlPoint {
  dateKey: string; // "YYYY-MM-DD"
  date: Date;
  profit: number;
}

export interface SymbolStats {
  symbol: string;
  totalProfit: number;
  tradesCount: number;
  winCount: number;
  lossCount: number;
  winRate: number; // 0-1
}

export interface CompassScoreMetric {
  value: number; // raw numeric value (e.g. 0.63, 2.1)
  score: number; // 0–100 normalized score for this metric
}

export interface CompassScore {
  totalScore: number; // 0–100 weighted average
  winRate: CompassScoreMetric;
  profitFactor: CompassScoreMetric;
  avgWinLoss: CompassScoreMetric;
  maxDrawdown: CompassScoreMetric;
  recoveryFactor: CompassScoreMetric;
  consistency: CompassScoreMetric;
}

export type RiskProgress = {
  dailyPnlPercent: number;   // e.g. +2.5 or -3.2
  weeklyPnlPercent: number;  // e.g. +6.1 or -4.0
  todayPnl: number;           // Today's P&L in base currency
  weekPnl: number;           // This week's P&L in base currency
};

export interface DashboardStats {
  kpis: DashboardKpis;
  dailyPnl: DailyPnlPoint[];
  symbols: SymbolStats[];
  compassScore?: CompassScore;
  riskProgress?: RiskProgress;
}

export interface UseDashboardStatsParams {
  userId: string;
  accountId: string;
  days?: number; // default 30 for daily PnL chart
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
 * Generate all date keys for the last N days
 */
function generateDateRange(days: number): string[] {
  const dates: string[] = [];
  const today = new Date();
  today.setHours(23, 59, 59, 999); // End of today

  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    dates.push(formatDateKey(date));
  }

  return dates;
}

/**
 * Clamp a value between min and max
 */
function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Score Win Rate: 0–100% => 0–100 score
 */
function scoreWinRate(winRatePct: number): number {
  if (!isFinite(winRatePct) || winRatePct < 0) return 0;
  return clamp(winRatePct, 0, 100);
}

/**
 * Score Profit Factor: 1.0 ~ 30, 1.5 ~ 60, 2.0 ~ 80, 3.0+ ~ 100
 */
function scoreProfitFactor(pf: number): number {
  if (!isFinite(pf) || pf <= 0) return 0;
  if (pf >= 3) return 100;
  if (pf >= 2) return 80 + (pf - 2) * 20; // 2 -> 80, 3 -> 100
  if (pf >= 1.5) return 60 + (pf - 1.5) * 40; // 1.5 -> 60, 2 -> 80
  if (pf >= 1) return 30 + (pf - 1) * 60; // 1 -> 30, 1.5 -> 60
  return 10; // <1 is unprofitable
}

/**
 * Score Avg Win/Loss ratio: 1.0 ~ 40, 2.0 ~ 70, 3.0 ~ 90, 4.0+ ~ 100
 */
function scoreAvgWinLoss(ratio: number): number {
  if (!isFinite(ratio) || ratio <= 0) return 0;
  if (ratio >= 4) return 100;
  if (ratio >= 3) return 90 + (ratio - 3) * 10; // 3 -> 90, 4 -> 100
  if (ratio >= 2) return 70 + (ratio - 2) * 20; // 2 -> 70, 3 -> 90
  if (ratio >= 1) return 40 + (ratio - 1) * 30; // 1 -> 40, 2 -> 70
  return 10;
}

/**
 * Score Max Drawdown: smaller is better relative to net profit
 */
function scoreMaxDrawdown(maxDD: number, totalProfit: number): number {
  if (!isFinite(maxDD) || maxDD <= 0 || totalProfit <= 0) return 10;
  const ratio = maxDD / (Math.abs(totalProfit) + maxDD); // 0..1
  const score = 100 * (1 - ratio);
  return clamp(score, 0, 100);
}

/**
 * Score Recovery Factor: 0 => 0, 1 => ~30, 2 => ~60, 3 => ~80, 5+ => 100
 */
function scoreRecoveryFactor(rf: number): number {
  if (!isFinite(rf) || rf <= 0) return 0;
  if (rf >= 5) return 100;
  if (rf >= 3) return 80 + (rf - 3) * 10; // 3 -> 80, 5 -> 100
  if (rf >= 2) return 60 + (rf - 2) * 20; // 2 -> 60, 3 -> 80
  if (rf >= 1) return 30 + (rf - 1) * 30; // 1 -> 30, 2 -> 60
  return 10;
}

/**
 * Score Consistency: lower stdDev/totalProfit => better
 */
function scoreConsistency(consistencyRaw: number): number {
  if (!isFinite(consistencyRaw) || consistencyRaw <= 0) return 100;
  const score = 100 - consistencyRaw * 100;
  return clamp(score, 0, 100);
}

/**
 * Aggregate trades into dashboard statistics
 */
function aggregateTrades(trades: Trade[], days: number = 30): DashboardStats {
  // Calculate date range for daily PnL
  const dateRange = generateDateRange(days);
  const startDate = dateRange[0];
  const endDate = dateRange[dateRange.length - 1];

  // Filter trades within the date range (based on effective date)
  const relevantTrades = trades.filter((trade) => {
    const effectiveDate = getEffectiveDate(trade);
    if (!effectiveDate) return false;
    const dateKey = formatDateKey(effectiveDate);
    return dateKey >= startDate && dateKey <= endDate;
  });

  // Global KPIs (for all trades, not just last N days)
  const totalTrades = trades.length;
  const totalProfit = trades.reduce((sum, t) => sum + (t.pnlCurrency ?? 0), 0);
  
  const winCount = trades.filter((t) => (t.pnlCurrency ?? 0) > 0).length;
  const lossCount = trades.filter((t) => (t.pnlCurrency ?? 0) < 0).length;
  const totalWithResult = winCount + lossCount;
  const winRate = totalWithResult > 0 ? (winCount / totalWithResult) * 100 : 0;
  const avgProfitPerTrade = totalTrades > 0 ? totalProfit / totalTrades : 0;

  // Calculate average position size if available
  const tradesWithVolume = trades.filter((t) => t.positionSize && t.positionSize > 0);
  const avgPositionSize =
    tradesWithVolume.length > 0
      ? tradesWithVolume.reduce((sum, t) => sum + t.positionSize, 0) / tradesWithVolume.length
      : undefined;

  // Daily PnL aggregation (for last N days)
  const dailyPnlMap = new Map<string, DailyPnlPoint>();

  // Initialize all days in range with 0 profit
  dateRange.forEach((dateKey) => {
    const date = new Date(dateKey);
    dailyPnlMap.set(dateKey, {
      dateKey,
      date,
      profit: 0,
    });
  });

  // Aggregate trades into daily PnL
  relevantTrades.forEach((trade) => {
    const effectiveDate = getEffectiveDate(trade);
    if (!effectiveDate) return;

    const dateKey = formatDateKey(effectiveDate);
    const dayStats = dailyPnlMap.get(dateKey);
    if (dayStats) {
      dayStats.profit += trade.pnlCurrency ?? 0;
    }
  });

  // Convert to array and sort by date
  const dailyPnl = Array.from(dailyPnlMap.values()).sort(
    (a, b) => a.date.getTime() - b.date.getTime()
  );

  // Symbol stats aggregation (for all trades)
  const symbolMap = new Map<string, SymbolStats>();

  trades.forEach((trade) => {
    const symbol = trade.symbol;
    if (!symbol) return;

    let stats = symbolMap.get(symbol);
    if (!stats) {
      stats = {
        symbol,
        totalProfit: 0,
        tradesCount: 0,
        winCount: 0,
        lossCount: 0,
        winRate: 0,
      };
      symbolMap.set(symbol, stats);
    }

    const profit = trade.pnlCurrency ?? 0;
    stats.totalProfit += profit;
    stats.tradesCount += 1;

    if (profit > 0) {
      stats.winCount += 1;
    } else if (profit < 0) {
      stats.lossCount += 1;
    }
  });

  // Calculate win rates for symbols
  symbolMap.forEach((stats) => {
    const totalWithResult = stats.winCount + stats.lossCount;
    stats.winRate = totalWithResult > 0 ? stats.winCount / totalWithResult : 0;
  });

  // Convert to array, sort by totalProfit descending, take top 5
  const symbols = Array.from(symbolMap.values())
    .sort((a, b) => b.totalProfit - a.totalProfit)
    .slice(0, 5);

  // Calculate Compass Score metrics
  const pnlValues = trades.map((t) => t.pnlCurrency ?? 0);
  const wins = pnlValues.filter((v) => v > 0);
  const losses = pnlValues.filter((v) => v < 0);
  const grossProfit = wins.reduce((s, v) => s + v, 0);
  const grossLossAbs = Math.abs(losses.reduce((s, v) => s + v, 0));
  const avgWin = wins.length > 0 ? grossProfit / wins.length : 0;
  const avgLossAbs = losses.length > 0 ? grossLossAbs / losses.length : 0;

  // 1) Win Rate (already calculated as percentage 0-100)
  const winRatePct = winRate;

  // 2) Profit Factor
  const profitFactor = grossLossAbs > 0 ? grossProfit / grossLossAbs : 0;

  // 3) Avg Win/Loss ratio
  const avgWinLossRatio = avgLossAbs > 0 ? avgWin / avgLossAbs : 0;

  // 4) Max Drawdown (from cumulative daily PnL)
  // Build cumulative equity curve from ALL daily PnL points (not just last N days)
  // We need to aggregate all trades by date for the full history
  const allDailyPnlMap = new Map<string, number>();
  trades.forEach((trade) => {
    const effectiveDate = getEffectiveDate(trade);
    if (!effectiveDate) return;
    const dateKey = formatDateKey(effectiveDate);
    const current = allDailyPnlMap.get(dateKey) || 0;
    allDailyPnlMap.set(dateKey, current + (trade.pnlCurrency ?? 0));
  });

  const sortedDaily = Array.from(allDailyPnlMap.entries())
    .map(([dateKey, profit]) => ({
      date: new Date(dateKey),
      profit,
    }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());

  let equity = 0;
  let peak = 0;
  let maxDrawdown = 0; // negative number

  for (const d of sortedDaily) {
    equity += d.profit;
    if (equity > peak) peak = equity;
    const drawdown = equity - peak; // <= 0
    if (drawdown < maxDrawdown) maxDrawdown = drawdown;
  }

  const maxDrawdownAbs = Math.abs(maxDrawdown);

  // 5) Recovery Factor
  const recoveryFactor = maxDrawdownAbs > 0 ? totalProfit / maxDrawdownAbs : 0;

  // 6) Consistency (based on standard deviation of daily PnL)
  const nonZeroDays = sortedDaily.filter((d) => d.profit !== 0);
  let consistencyRaw = 0;

  if (nonZeroDays.length >= 2 && totalProfit > 0) {
    const mean = nonZeroDays.reduce((s, d) => s + d.profit, 0) / nonZeroDays.length;
    const variance =
      nonZeroDays.reduce((s, d) => s + Math.pow(d.profit - mean, 2), 0) /
      (nonZeroDays.length - 1);
    const stdDev = Math.sqrt(variance);
    // Higher stdDev relative to net profit => worse consistency
    consistencyRaw = stdDev / Math.abs(totalProfit);
  } else {
    consistencyRaw = 1; // worst
  }

  // Score each metric
  const winRateScore = scoreWinRate(winRatePct);
  const profitFactorScore = scoreProfitFactor(profitFactor);
  const avgWinLossScore = scoreAvgWinLoss(avgWinLossRatio);
  const maxDDScore = scoreMaxDrawdown(maxDrawdownAbs, totalProfit);
  const recoveryFactorScore = scoreRecoveryFactor(recoveryFactor);
  const consistencyScore = scoreConsistency(consistencyRaw);

  // Weights (sum to 1)
  const weights = {
    winRate: 0.2,
    profitFactor: 0.2,
    avgWinLoss: 0.2,
    maxDrawdown: 0.15,
    recoveryFactor: 0.15,
    consistency: 0.1,
  };

  // Calculate total weighted score
  const totalScore =
    winRateScore * weights.winRate +
    profitFactorScore * weights.profitFactor +
    avgWinLossScore * weights.avgWinLoss +
    maxDDScore * weights.maxDrawdown +
    recoveryFactorScore * weights.recoveryFactor +
    consistencyScore * weights.consistency;

  const compassScore: CompassScore = {
    totalScore,
    winRate: { value: winRatePct, score: winRateScore },
    profitFactor: { value: profitFactor, score: profitFactorScore },
    avgWinLoss: { value: avgWinLossRatio, score: avgWinLossScore },
    maxDrawdown: { value: maxDrawdownAbs, score: maxDDScore },
    recoveryFactor: { value: recoveryFactor, score: recoveryFactorScore },
    consistency: { value: consistencyRaw, score: consistencyScore },
  };

  // Calculate risk progress (daily and weekly PnL percentages)
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayKey = formatDateKey(today);
  
  // Get start of week (Monday) using date-fns
  const weekStart = startOfWeek(today, { weekStartsOn: 1 }); // 1 = Monday
  weekStart.setHours(0, 0, 0, 0);
  const startOfWeekKey = formatDateKey(weekStart);

  // Calculate cumulative PnL up to start of today (as base balance)
  let cumulativePnLBeforeToday = 0;
  for (const [dateKey, profit] of allDailyPnlMap.entries()) {
    if (dateKey < todayKey) {
      cumulativePnLBeforeToday += profit;
    }
  }
  
  // Calculate cumulative PnL up to start of week
  let cumulativePnLBeforeWeek = 0;
  for (const [dateKey, profit] of allDailyPnlMap.entries()) {
    if (dateKey < startOfWeekKey) {
      cumulativePnLBeforeWeek += profit;
    }
  }

  // Get today's PnL
  const todayPnL = allDailyPnlMap.get(todayKey) || 0;
  
  // Get this week's PnL (from start of week to today inclusive)
  let weekPnL = 0;
  for (const [dateKey, profit] of allDailyPnlMap.entries()) {
    if (dateKey >= startOfWeekKey && dateKey <= todayKey) {
      weekPnL += profit;
    }
  }

  // Calculate percentages
  // Use a minimum base balance to avoid division by zero or extreme percentages
  // If cumulative PnL is positive, use it as base; otherwise use a default base
  const DEFAULT_BASE_BALANCE = 10000; // $10,000 default account balance
  const dailyBaseBalance = cumulativePnLBeforeToday > 0 
    ? cumulativePnLBeforeToday 
    : DEFAULT_BASE_BALANCE;
  const weeklyBaseBalance = cumulativePnLBeforeWeek > 0 
    ? cumulativePnLBeforeWeek 
    : DEFAULT_BASE_BALANCE;
  
  const dailyPnlPercent = dailyBaseBalance > 0 ? (todayPnL / dailyBaseBalance) * 100 : 0;
  const weeklyPnlPercent = weeklyBaseBalance > 0 ? (weekPnL / weeklyBaseBalance) * 100 : 0;

  const riskProgress: RiskProgress = {
    dailyPnlPercent,
    weeklyPnlPercent,
    todayPnl: todayPnL,
    weekPnl: weekPnL,
  };

  return {
    kpis: {
      totalTrades,
      totalProfit,
      winCount,
      lossCount,
      winRate,
      avgProfitPerTrade,
      avgPositionSize,
    },
    dailyPnl,
    symbols,
    compassScore,
    riskProgress,
  };
}

/**
 * Hook to fetch and aggregate dashboard statistics
 * 
 * Fetches trades for the given user and account, then calculates:
 * - Global KPIs (total trades, profit, win rate, etc.)
 * - Daily PnL for the last N days (default 30)
 * - Top 5 symbols by profit
 * 
 * To adjust the date range for daily PnL, change the `days` parameter.
 * To filter by symbol, add a symbol filter to the query in getTradesForCalendar.
 */
export function useDashboardStats(
  params: UseDashboardStatsParams
): {
  data: DashboardStats | null;
  isLoading: boolean;
  error: Error | null;
} {
  const { userId, accountId, days = 30 } = params;

  // Calculate date range for querying trades
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  const startDate = new Date(today);
  startDate.setDate(startDate.getDate() - days);
  startDate.setHours(0, 0, 0, 0);

  const startDateStr = formatDateKey(startDate);
  const endDateStr = formatDateKey(today);

  // Fetch all trades for the account (we'll filter by date in aggregation)
  // Note: We fetch a wide range to ensure we get all trades for KPIs
  // The daily PnL will only use trades within the last N days
  const { data: trades, isLoading, error } = useQuery<Trade[]>({
    queryKey: ["dashboardStats", userId, accountId, days],
    queryFn: async () => {
      if (!userId || !accountId) {
        throw new Error("userId and accountId are required");
      }
      // Fetch trades for the account with a wide date range to get all trades for KPIs
      // We'll filter by date in the aggregation function for daily PnL
      // Using a date far in the past to get all trades
      const farPastDate = "2000-01-01";
      return await getTradesForCalendar(userId, accountId, farPastDate, endDateStr);
    },
    enabled: !!userId && !!accountId,
  });

  // Aggregate trades into dashboard stats
  const aggregatedData = trades ? aggregateTrades(trades, days) : null;

  return {
    data: aggregatedData,
    isLoading,
    error: error ? (error instanceof Error ? error : new Error(String(error))) : null,
  };
}

