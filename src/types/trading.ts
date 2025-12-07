import { Timestamp } from "firebase/firestore";

export type TradeStatus = "win" | "loss" | "be";

export type Trade = {
  id: string;
  userId: string;
  accountId: string;
  symbol: string;
  side: "buy" | "sell";
  entryPrice: number;
  exitPrice: number;
  positionSize: number;
  openTime: string | Timestamp;
  closeTime: string | Timestamp;
  tradeDate: string; // "YYYY-MM-DD" in UTC
  pnlPoints: number;
  pnlCurrency: number;
  rMultiple?: number | null;
  status: TradeStatus;
  playbookId?: string | null;
  externalTicket?: string; // MT5 Position ID
  source?: string; // e.g. "manual", "mt5_positions"
  commission?: number;
  swap?: number;
  // Journal fields
  notes?: string;
  tags?: string[];
  rating?: number | null; // 1-5 rating
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type DailyStat = {
  id: string; // `${accountId}_${date}`
  userId: string;
  accountId: string;
  date: string; // "YYYY-MM-DD"
  netPnlCurrency: number;
  tradesCount: number;
  winsCount: number;
  lossesCount: number;
  breakevenCount: number;
  avgR: number | null;
  profitFactor: number | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
};

export type CompassScore = {
  score: number; // 0–100
  level: "Weak" | "Developing" | "Solid" | "Strong" | "Elite";
  breakdown: {
    performance: number; // 0–100
    consistency: number; // 0–100
    risk: number; // 0–100
    discipline: number; // 0–100
  };
  strengths: string[];
  weaknesses: string[];
};

export type KpiMetrics = {
  netPnl: number;
  winRate: number; // percentage 0–100
  profitFactor: number | null;
  avgR: number | null;
  totalTrades: number;
  daysTraded: number;
};

export interface TagStat {
  tag: string;
  tradesCount: number;
  winsCount: number;
  lossesCount: number;
  breakevenCount: number;
  winRate: number; // 0–1, not percentage
  netPnlCurrency: number; // sum of pnlCurrency
  avgRMultiple: number | null; // average of rMultiple where defined
  profitFactor: number | null; // grossProfit / grossLossAbs, or null if undefined
}

export type TradingSession = "Asia" | "London" | "NewYork" | "Other";

export interface WeekdayStat {
  weekday: number; // 0 = Sunday ... 6 = Saturday
  label: string; // "Sun", "Mon", ...
  tradesCount: number;
  winsCount: number;
  lossesCount: number;
  breakevenCount: number;
  netPnlCurrency: number;
  winRate: number; // 0–1
  avgRMultiple: number | null;
}

export interface SessionStat {
  session: TradingSession;
  tradesCount: number;
  winsCount: number;
  lossesCount: number;
  breakevenCount: number;
  netPnlCurrency: number;
  winRate: number; // 0–1
  avgRMultiple: number | null;
}

export interface DurationBucketStat {
  bucketKey: string; // e.g. "0-5m", "5-30m", "30m-2h", "2-6h", "6-24h", "24h+"
  minMinutes: number;
  maxMinutes: number | null; // null = no upper bound
  tradesCount: number;
  winsCount: number;
  lossesCount: number;
  breakevenCount: number;
  netPnlCurrency: number;
  winRate: number; // 0–1
  avgRMultiple: number | null;
}

export interface UserGeneralSettings {
  baseCurrency: "USD" | "EUR" | "GBP" | "CHF" | "JPY" | "Other";
  timezone: string; // e.g. "Europe/Berlin"
  defaultRiskPercent: number; // e.g. 0.5 = 0.5% per trade
  defaultDashboardDays: number; // e.g. 30
  language?: "en" | "ar"; // optional for now
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface UserRiskSettings {
  maxDailyLossPercent: number | null; // e.g. 4 = 4%
  maxWeeklyLossPercent: number | null; // e.g. 10 = 10%
  targetDailyProfitPercent: number | null; // e.g. 3 = 3%
  targetWeeklyProfitPercent: number | null; // e.g. 10 = 10%
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

