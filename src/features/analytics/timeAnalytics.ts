import { Timestamp } from "firebase/firestore";
import type {
  Trade,
  TradingSession,
  WeekdayStat,
  SessionStat,
  DurationBucketStat,
} from "@/types/trading";

export interface TimeAnalyticsResult {
  weekdayStats: WeekdayStat[];
  sessionStats: SessionStat[];
  durationStats: DurationBucketStat[];
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
 * Get effective open time for a trade
 */
export function getEffectiveOpenTime(trade: Trade): Date | null {
  // Prefer openTime
  const openTime = normalizeTimestamp(trade.openTime);
  if (openTime) return openTime;

  // Fallback to closeTime
  const closeTime = normalizeTimestamp(trade.closeTime);
  if (closeTime) return closeTime;

  // Fallback to tradeDate string
  if (trade.tradeDate) {
    const date = new Date(trade.tradeDate);
    return isNaN(date.getTime()) ? null : date;
  }

  return null;
}

/**
 * Get effective close time for a trade
 */
export function getEffectiveCloseTime(trade: Trade): Date | null {
  // Prefer closeTime
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
 * Classify trading session based on hour (assuming UTC or Europe/Berlin timezone)
 * Asia: 0-7
 * London: 7-14
 * NewYork: 14-22
 * Other: everything else
 */
export function classifySession(date: Date): TradingSession {
  const hour = date.getHours();

  if (hour >= 0 && hour < 7) {
    return "Asia";
  } else if (hour >= 7 && hour < 14) {
    return "London";
  } else if (hour >= 14 && hour < 22) {
    return "NewYork";
  } else {
    return "Other";
  }
}

/**
 * Classify duration bucket based on holding time in minutes
 */
export function classifyDurationBucket(
  minutes: number
): DurationBucketStat["bucketKey"] {
  if (minutes < 5) {
    return "0-5m";
  } else if (minutes < 30) {
    return "5-30m";
  } else if (minutes < 120) {
    return "30m-120m";
  } else if (minutes < 360) {
    return "2-6h";
  } else if (minutes < 1440) {
    return "6-24h";
  } else {
    return "24h+";
  }
}

/**
 * Get weekday label from weekday number (0 = Sunday, 6 = Saturday)
 */
function getWeekdayLabel(weekday: number): string {
  const labels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  return labels[weekday] || "Unknown";
}

/**
 * Aggregate time analytics from trades
 */
export function aggregateTimeAnalytics(
  trades: Trade[]
): TimeAnalyticsResult {
  // Filter out trades without valid open/close times
  const validTrades = trades.filter((trade) => {
    const openTime = getEffectiveOpenTime(trade);
    const closeTime = getEffectiveCloseTime(trade);
    return openTime !== null && closeTime !== null;
  });

  // Initialize maps for aggregation
  const weekdayMap = new Map<
    number,
    {
      tradesCount: number;
      winsCount: number;
      lossesCount: number;
      breakevenCount: number;
      netPnlCurrency: number;
      sumR: number;
      countR: number;
    }
  >();

  const sessionMap = new Map<
    TradingSession,
    {
      tradesCount: number;
      winsCount: number;
      lossesCount: number;
      breakevenCount: number;
      netPnlCurrency: number;
      sumR: number;
      countR: number;
    }
  >();

  const durationBucketMap = new Map<
    string,
    {
      tradesCount: number;
      winsCount: number;
      lossesCount: number;
      breakevenCount: number;
      netPnlCurrency: number;
      sumR: number;
      countR: number;
    }
  >();

  // Process each trade
  validTrades.forEach((trade) => {
    const openTime = getEffectiveOpenTime(trade)!;
    const closeTime = getEffectiveCloseTime(trade)!;

    // Calculate holding time in minutes
    const holdingMinutes = (closeTime.getTime() - openTime.getTime()) / 60000;

    // Classify trade attributes
    const weekday = openTime.getDay(); // 0 = Sunday, 6 = Saturday
    const session = classifySession(openTime);
    const bucketKey = classifyDurationBucket(holdingMinutes);

    // Determine win/loss/breakeven
    const pnl = trade.pnlCurrency ?? 0;
    const isWin = pnl > 0;
    const isLoss = pnl < 0;
    const isBE = pnl === 0;

    // Update weekday stats
    let weekdayStats = weekdayMap.get(weekday);
    if (!weekdayStats) {
      weekdayStats = {
        tradesCount: 0,
        winsCount: 0,
        lossesCount: 0,
        breakevenCount: 0,
        netPnlCurrency: 0,
        sumR: 0,
        countR: 0,
      };
      weekdayMap.set(weekday, weekdayStats);
    }
    weekdayStats.tradesCount++;
    if (isWin) weekdayStats.winsCount++;
    if (isLoss) weekdayStats.lossesCount++;
    if (isBE) weekdayStats.breakevenCount++;
    weekdayStats.netPnlCurrency += pnl;
    if (trade.rMultiple != null && trade.rMultiple !== undefined) {
      weekdayStats.sumR += trade.rMultiple;
      weekdayStats.countR++;
    }

    // Update session stats
    let sessionStats = sessionMap.get(session);
    if (!sessionStats) {
      sessionStats = {
        tradesCount: 0,
        winsCount: 0,
        lossesCount: 0,
        breakevenCount: 0,
        netPnlCurrency: 0,
        sumR: 0,
        countR: 0,
      };
      sessionMap.set(session, sessionStats);
    }
    sessionStats.tradesCount++;
    if (isWin) sessionStats.winsCount++;
    if (isLoss) sessionStats.lossesCount++;
    if (isBE) sessionStats.breakevenCount++;
    sessionStats.netPnlCurrency += pnl;
    if (trade.rMultiple != null && trade.rMultiple !== undefined) {
      sessionStats.sumR += trade.rMultiple;
      sessionStats.countR++;
    }

    // Update duration bucket stats
    let durationStats = durationBucketMap.get(bucketKey);
    if (!durationStats) {
      durationStats = {
        tradesCount: 0,
        winsCount: 0,
        lossesCount: 0,
        breakevenCount: 0,
        netPnlCurrency: 0,
        sumR: 0,
        countR: 0,
      };
      durationBucketMap.set(bucketKey, durationStats);
    }
    durationStats.tradesCount++;
    if (isWin) durationStats.winsCount++;
    if (isLoss) durationStats.lossesCount++;
    if (isBE) durationStats.breakevenCount++;
    durationStats.netPnlCurrency += pnl;
    if (trade.rMultiple != null && trade.rMultiple !== undefined) {
      durationStats.sumR += trade.rMultiple;
      durationStats.countR++;
    }
  });

  // Convert maps to arrays and compute final stats
  const weekdayStats: WeekdayStat[] = Array.from(weekdayMap.entries())
    .map(([weekday, stats]) => {
      const tradesWithResult = stats.winsCount + stats.lossesCount;
      const winRate = tradesWithResult > 0 ? stats.winsCount / tradesWithResult : 0;
      const avgRMultiple = stats.countR > 0 ? stats.sumR / stats.countR : null;

      return {
        weekday,
        label: getWeekdayLabel(weekday),
        tradesCount: stats.tradesCount,
        winsCount: stats.winsCount,
        lossesCount: stats.lossesCount,
        breakevenCount: stats.breakevenCount,
        netPnlCurrency: stats.netPnlCurrency,
        winRate,
        avgRMultiple,
      };
    })
    .sort((a, b) => a.weekday - b.weekday); // Sort by weekday (Sun=0 to Sat=6)

  const sessionStats: SessionStat[] = Array.from(sessionMap.entries())
    .map(([session, stats]) => {
      const tradesWithResult = stats.winsCount + stats.lossesCount;
      const winRate = tradesWithResult > 0 ? stats.winsCount / tradesWithResult : 0;
      const avgRMultiple = stats.countR > 0 ? stats.sumR / stats.countR : null;

      return {
        session,
        tradesCount: stats.tradesCount,
        winsCount: stats.winsCount,
        lossesCount: stats.lossesCount,
        breakevenCount: stats.breakevenCount,
        netPnlCurrency: stats.netPnlCurrency,
        winRate,
        avgRMultiple,
      };
    })
    .sort((a, b) => {
      // Sort by session order: Asia, London, NewYork, Other
      const order: TradingSession[] = ["Asia", "London", "NewYork", "Other"];
      return order.indexOf(a.session) - order.indexOf(b.session);
    });

  // Define duration bucket order and metadata
  const durationBucketOrder: DurationBucketStat["bucketKey"][] = [
    "0-5m",
    "5-30m",
    "30m-120m",
    "2-6h",
    "6-24h",
    "24h+",
  ];

  const durationBucketMetadata: Record<
    DurationBucketStat["bucketKey"],
    { minMinutes: number; maxMinutes: number | null }
  > = {
    "0-5m": { minMinutes: 0, maxMinutes: 5 },
    "5-30m": { minMinutes: 5, maxMinutes: 30 },
    "30m-120m": { minMinutes: 30, maxMinutes: 120 },
    "2-6h": { minMinutes: 120, maxMinutes: 360 },
    "6-24h": { minMinutes: 360, maxMinutes: 1440 },
    "24h+": { minMinutes: 1440, maxMinutes: null },
  };

  const durationStats: DurationBucketStat[] = Array.from(durationBucketMap.entries())
    .map(([bucketKey, stats]) => {
      const tradesWithResult = stats.winsCount + stats.lossesCount;
      const winRate = tradesWithResult > 0 ? stats.winsCount / tradesWithResult : 0;
      const avgRMultiple = stats.countR > 0 ? stats.sumR / stats.countR : null;
      const metadata = durationBucketMetadata[bucketKey];

      return {
        bucketKey,
        minMinutes: metadata.minMinutes,
        maxMinutes: metadata.maxMinutes,
        tradesCount: stats.tradesCount,
        winsCount: stats.winsCount,
        lossesCount: stats.lossesCount,
        breakevenCount: stats.breakevenCount,
        netPnlCurrency: stats.netPnlCurrency,
        winRate,
        avgRMultiple,
      };
    })
    .sort((a, b) => {
      // Sort by bucket order
      return (
        durationBucketOrder.indexOf(a.bucketKey) -
        durationBucketOrder.indexOf(b.bucketKey)
      );
    });

  return {
    weekdayStats,
    sessionStats,
    durationStats,
  };
}

