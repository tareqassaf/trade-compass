import type { UserRiskSettings } from "@/types/settings";
import type { RiskProgress } from "@/features/dashboard/useDashboardStats";

export type RiskGuardStateType =
  | "none"
  | "daily-warning"
  | "daily-locked"
  | "weekly-warning"
  | "weekly-locked";

export interface RiskGuardEvaluation {
  state: RiskGuardStateType;
  message: string | null;
  todayReturnPercent?: number;
  weekReturnPercent?: number;
  dailyLossUsage?: number; // 0-100+ percentage of maxDailyLossPercent used
  weeklyLossUsage?: number; // 0-100+ percentage of maxWeeklyLossPercent used
}

/**
 * Evaluate risk guard state based on current performance and risk settings
 */
export function evaluateRiskGuard(
  riskProgress: RiskProgress | undefined,
  riskSettings: UserRiskSettings | null
): RiskGuardEvaluation | null {
  if (!riskProgress || !riskSettings) {
    return {
      state: "none",
      message: null,
    };
  }

  const { dailyPnlPercent, weeklyPnlPercent } = riskProgress;
  const {
    maxDailyLossPercent,
    maxWeeklyLossPercent,
    targetDailyProfitPercent,
    targetWeeklyProfitPercent,
  } = riskSettings;

  // Calculate loss usage percentages
  const dailyLossAbs = dailyPnlPercent < 0 ? Math.abs(dailyPnlPercent) : 0;
  const weeklyLossAbs = weeklyPnlPercent < 0 ? Math.abs(weeklyPnlPercent) : 0;

  const dailyLossUsage =
    maxDailyLossPercent > 0 ? (dailyLossAbs / maxDailyLossPercent) * 100 : 0;
  const weeklyLossUsage =
    maxWeeklyLossPercent > 0 ? (weeklyLossAbs / maxWeeklyLossPercent) * 100 : 0;

  // Check daily locked state (loss limit reached or exceeded)
  if (dailyLossAbs >= maxDailyLossPercent && maxDailyLossPercent > 0) {
    return {
      state: "daily-locked",
      message: `Daily loss limit reached – you should not open new trades today. Today: ${dailyPnlPercent.toFixed(2)}% (${dailyLossUsage.toFixed(0)}% of your daily loss cap).`,
      todayReturnPercent: dailyPnlPercent,
      dailyLossUsage,
    };
  }

  // Check weekly locked state (loss limit reached or exceeded)
  if (weeklyLossAbs >= maxWeeklyLossPercent && maxWeeklyLossPercent > 0) {
    return {
      state: "weekly-locked",
      message: `Weekly loss limit reached – you should not open new trades this week. This week: ${weeklyPnlPercent.toFixed(2)}% (${weeklyLossUsage.toFixed(0)}% of your weekly loss cap).`,
      weekReturnPercent: weeklyPnlPercent,
      weeklyLossUsage,
    };
  }

  // Check daily warning state (approaching loss limit - 50% threshold)
  if (dailyLossUsage >= 50 && dailyLossUsage < 100 && maxDailyLossPercent > 0) {
    return {
      state: "daily-warning",
      message: `You are close to your daily loss limit. Today: ${dailyPnlPercent.toFixed(2)}% (${dailyLossUsage.toFixed(0)}% of your daily loss cap).`,
      todayReturnPercent: dailyPnlPercent,
      dailyLossUsage,
    };
  }

  // Check weekly warning state (approaching loss limit - 50% threshold)
  if (weeklyLossUsage >= 50 && weeklyLossUsage < 100 && maxWeeklyLossPercent > 0) {
    return {
      state: "weekly-warning",
      message: `You are close to your weekly loss limit. This week: ${weeklyPnlPercent.toFixed(2)}% (${weeklyLossUsage.toFixed(0)}% of your weekly loss cap).`,
      weekReturnPercent: weeklyPnlPercent,
      weeklyLossUsage,
    };
  }

  // No risk guard state
  return {
    state: "none",
    message: null,
    todayReturnPercent: dailyPnlPercent,
    weekReturnPercent: weeklyPnlPercent,
    dailyLossUsage,
    weeklyLossUsage,
  };
}

