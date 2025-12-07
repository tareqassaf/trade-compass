import type { UserRiskSettings } from "@/types/settings";

export type RiskStatusLevel = "safe" | "warning" | "limit" | "target";

export type RiskStatus = {
  status: RiskStatusLevel;
  label: string; // e.g. "Safe", "Warning", "Limit hit", "Target reached"
};

export function getDailyRiskStatus(
  dailyPnlPercent: number,
  settings: UserRiskSettings
): RiskStatus {
  const { maxDailyLossPercent, targetDailyProfitPercent } = settings;

  if (dailyPnlPercent >= targetDailyProfitPercent) {
    return { status: "target", label: "Target reached" };
  }

  if (dailyPnlPercent <= 0) {
    const lossAbs = Math.abs(dailyPnlPercent);

    if (lossAbs >= maxDailyLossPercent) {
      return { status: "limit", label: "Limit hit" };
    }

    if (lossAbs >= maxDailyLossPercent * 0.5) {
      return { status: "warning", label: "Warning" };
    }
  }

  return { status: "safe", label: "Safe" };
}

export function getWeeklyRiskStatus(
  weeklyPnlPercent: number,
  settings: UserRiskSettings
): RiskStatus {
  const { maxWeeklyLossPercent, targetWeeklyProfitPercent } = settings;

  if (weeklyPnlPercent >= targetWeeklyProfitPercent) {
    return { status: "target", label: "Target reached" };
  }

  if (weeklyPnlPercent <= 0) {
    const lossAbs = Math.abs(weeklyPnlPercent);

    if (lossAbs >= maxWeeklyLossPercent) {
      return { status: "limit", label: "Limit hit" };
    }

    if (lossAbs >= maxWeeklyLossPercent * 0.5) {
      return { status: "warning", label: "Warning" };
    }
  }

  return { status: "safe", label: "Safe" };
}

