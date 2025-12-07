export type UserRiskSettings = {
  maxDailyLossPercent: number;        // e.g. 4
  maxWeeklyLossPercent: number;       // e.g. 10
  targetDailyProfitPercent: number;   // e.g. 3
  targetWeeklyProfitPercent: number;  // e.g. 15
  createdAt: Date | null;
  updatedAt: Date | null;
};

