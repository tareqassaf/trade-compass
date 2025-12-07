import * as React from "react";
import { memo, useMemo, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { useRiskSettings } from "@/hooks/useRiskSettings";
import { useDashboardStats } from "@/features/dashboard/useDashboardStats";
import { useAuth } from "@/contexts/AuthContext";
import {
  getDailyRiskStatus,
  getWeeklyRiskStatus,
} from "@/features/dashboard/riskStatus";

interface RiskOverviewProps {
  accountId: string;
}

export const RiskOverview = memo(function RiskOverview({ accountId }: RiskOverviewProps) {
  // ✅ All hooks at the top, always called in the same order
  const { user } = useAuth();
  const { data: riskSettings, loading: riskLoading } = useRiskSettings();
  const { data: dashboardStats, isLoading: statsLoading } = useDashboardStats({
    userId: user?.uid || "",
    accountId,
    days: 30,
  });

  // Use safe defaults so hooks are always called
  const dailyPnlPercent = dashboardStats?.riskProgress?.dailyPnlPercent ?? 0;
  const weeklyPnlPercent = dashboardStats?.riskProgress?.weeklyPnlPercent ?? 0;
  const todayPnl = dashboardStats?.riskProgress?.todayPnl ?? 0;
  const weekPnl = dashboardStats?.riskProgress?.weekPnl ?? 0;

  // ✅ All hooks must be called before any conditional returns
  const dailyStatus = useMemo(() => {
    if (!riskSettings) {
      return { status: "safe" as const, label: "Safe" };
    }
    return getDailyRiskStatus(dailyPnlPercent, riskSettings);
  }, [dailyPnlPercent, riskSettings]);

  const weeklyStatus = useMemo(() => {
    if (!riskSettings) {
      return { status: "safe" as const, label: "Safe" };
    }
    return getWeeklyRiskStatus(weeklyPnlPercent, riskSettings);
  }, [weeklyPnlPercent, riskSettings]);

  // Calculate progress bars for daily loss/profit
  const dailyLossProgress = useMemo(() => {
    if (!riskSettings || dailyPnlPercent >= 0 || riskSettings.maxDailyLossPercent <= 0) {
      return 0;
    }
    const lossAbs = Math.abs(dailyPnlPercent);
    return Math.min((lossAbs / riskSettings.maxDailyLossPercent) * 100, 200);
  }, [dailyPnlPercent, riskSettings]);

  const dailyProfitProgress = useMemo(() => {
    if (!riskSettings || dailyPnlPercent <= 0 || riskSettings.targetDailyProfitPercent <= 0) {
      return 0;
    }
    return Math.min((dailyPnlPercent / riskSettings.targetDailyProfitPercent) * 100, 200);
  }, [dailyPnlPercent, riskSettings]);

  // Calculate progress bars for weekly loss/profit
  const weeklyLossProgress = useMemo(() => {
    if (!riskSettings || weeklyPnlPercent >= 0 || riskSettings.maxWeeklyLossPercent <= 0) {
      return 0;
    }
    const lossAbs = Math.abs(weeklyPnlPercent);
    return Math.min((lossAbs / riskSettings.maxWeeklyLossPercent) * 100, 200);
  }, [weeklyPnlPercent, riskSettings]);

  const weeklyProfitProgress = useMemo(() => {
    if (!riskSettings || weeklyPnlPercent <= 0 || riskSettings.targetWeeklyProfitPercent <= 0) {
      return 0;
    }
    return Math.min((weeklyPnlPercent / riskSettings.targetWeeklyProfitPercent) * 100, 200);
  }, [weeklyPnlPercent, riskSettings]);

  // Helper to map status to text color / badge style - memoized
  const statusClassName = useCallback((status: string) => {
    switch (status) {
      case "limit":
        return "text-red-500";
      case "warning":
        return "text-yellow-500";
      case "target":
        return "text-green-500";
      default:
        return "text-muted-foreground";
    }
  }, []);

  const formatPercent = useCallback((value: number): string => {
    const sign = value >= 0 ? "+" : "";
    return `${sign}${value.toFixed(2)}%`;
  }, []);

  const formatCurrency = useCallback((value: number): string => {
    const sign = value >= 0 ? "+" : "";
    return `${sign}${value.toFixed(2)}`;
  }, []);

  // Custom Progress component with color support
  const ColoredProgress = useCallback(({ 
    value, 
    isLoss 
  }: { 
    value: number; 
    isLoss: boolean;
  }) => {
    const progressValue = Math.min(value, 100);
    let colorClass = "";
    
    if (isLoss) {
      if (progressValue >= 100) colorClass = "bg-red-500";
      else if (progressValue >= 80) colorClass = "bg-red-400";
      else if (progressValue >= 50) colorClass = "bg-yellow-500";
      else colorClass = "bg-yellow-400";
    } else {
      if (progressValue >= 100) colorClass = "bg-green-500";
      else if (progressValue >= 80) colorClass = "bg-green-400";
      else colorClass = "bg-blue-400";
    }

    return (
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-slate-800">
        <div
          className={cn("h-full transition-all", colorClass)}
          style={{ width: `${progressValue}%` }}
        />
      </div>
    );
  }, []);

  // ✅ Early returns AFTER all hooks have been called
  if (riskLoading || statsLoading || !riskSettings || !dashboardStats?.riskProgress) {
    return (
      <div className="text-sm text-muted-foreground">
        Loading risk overview…
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <Card className="border-border/50 shadow-lg bg-slate-900">
        <CardHeader>
          <CardTitle className="text-white">Daily Risk Status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Today's P&L */}
          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-muted-foreground">PnL today</span>
              <div className="flex flex-col items-end">
                <span className={`text-lg font-semibold ${todayPnl >= 0 ? "text-green-500" : "text-red-500"}`}>
                  {formatCurrency(todayPnl)}
                </span>
                <span className={`text-xs ${dailyPnlPercent >= 0 ? "text-green-400" : "text-red-400"}`}>
                  {formatPercent(dailyPnlPercent)}
                </span>
              </div>
            </div>
          </div>

          {/* Daily Loss Progress */}
          {dailyPnlPercent < 0 && riskSettings.maxDailyLossPercent > 0 && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Loss vs. Max Daily Loss</span>
                <span className={dailyLossProgress >= 100 ? "text-red-500 font-semibold" : dailyLossProgress >= 50 ? "text-yellow-500" : "text-muted-foreground"}>
                  {dailyLossProgress.toFixed(1)}%
                </span>
              </div>
              <ColoredProgress 
                value={Math.min(dailyLossProgress, 100)} 
                isLoss={true}
              />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>0%</span>
                <span>{riskSettings.maxDailyLossPercent.toFixed(1)}% limit</span>
              </div>
            </div>
          )}

          {/* Daily Profit Progress */}
          {dailyPnlPercent > 0 && riskSettings.targetDailyProfitPercent > 0 && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Profit vs. Target</span>
                <span className={dailyProfitProgress >= 100 ? "text-green-500 font-semibold" : "text-muted-foreground"}>
                  {dailyProfitProgress.toFixed(1)}%
                </span>
              </div>
              <ColoredProgress 
                value={Math.min(dailyProfitProgress, 100)} 
                isLoss={false}
              />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>0%</span>
                <span>{riskSettings.targetDailyProfitPercent.toFixed(1)}% target</span>
              </div>
            </div>
          )}

          {/* Limits Summary */}
          <div className="pt-2 border-t border-slate-800 space-y-2">
            <div className="flex items-baseline justify-between text-sm">
              <span className="text-muted-foreground">Max daily loss</span>
              <span className="text-muted-foreground">
                {riskSettings.maxDailyLossPercent.toFixed(2)}%
              </span>
            </div>
            <div className="flex items-baseline justify-between text-sm">
              <span className="text-muted-foreground">Target daily profit</span>
              <span className="text-muted-foreground">
                {riskSettings.targetDailyProfitPercent.toFixed(2)}%
              </span>
            </div>
            <div className="flex items-center justify-between pt-1">
              <span className="text-sm text-muted-foreground">Status</span>
              <span className={`text-sm font-medium ${statusClassName(dailyStatus.status)}`}>
                {dailyStatus.label}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/50 shadow-lg bg-slate-900">
        <CardHeader>
          <CardTitle className="text-white">Weekly Risk Status</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* This Week's P&L */}
          <div className="space-y-2">
            <div className="flex items-baseline justify-between">
              <span className="text-sm text-muted-foreground">PnL this week</span>
              <div className="flex flex-col items-end">
                <span className={`text-lg font-semibold ${weekPnl >= 0 ? "text-green-500" : "text-red-500"}`}>
                  {formatCurrency(weekPnl)}
                </span>
                <span className={`text-xs ${weeklyPnlPercent >= 0 ? "text-green-400" : "text-red-400"}`}>
                  {formatPercent(weeklyPnlPercent)}
                </span>
              </div>
            </div>
          </div>

          {/* Weekly Loss Progress */}
          {weeklyPnlPercent < 0 && riskSettings.maxWeeklyLossPercent > 0 && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Loss vs. Max Weekly Loss</span>
                <span className={weeklyLossProgress >= 100 ? "text-red-500 font-semibold" : weeklyLossProgress >= 50 ? "text-yellow-500" : "text-muted-foreground"}>
                  {weeklyLossProgress.toFixed(1)}%
                </span>
              </div>
              <ColoredProgress 
                value={Math.min(weeklyLossProgress, 100)} 
                isLoss={true}
              />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>0%</span>
                <span>{riskSettings.maxWeeklyLossPercent.toFixed(1)}% limit</span>
              </div>
            </div>
          )}

          {/* Weekly Profit Progress */}
          {weeklyPnlPercent > 0 && riskSettings.targetWeeklyProfitPercent > 0 && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground">Profit vs. Target</span>
                <span className={weeklyProfitProgress >= 100 ? "text-green-500 font-semibold" : "text-muted-foreground"}>
                  {weeklyProfitProgress.toFixed(1)}%
                </span>
              </div>
              <ColoredProgress 
                value={Math.min(weeklyProfitProgress, 100)} 
                isLoss={false}
              />
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>0%</span>
                <span>{riskSettings.targetWeeklyProfitPercent.toFixed(1)}% target</span>
              </div>
            </div>
          )}

          {/* Limits Summary */}
          <div className="pt-2 border-t border-slate-800 space-y-2">
            <div className="flex items-baseline justify-between text-sm">
              <span className="text-muted-foreground">Max weekly loss</span>
              <span className="text-muted-foreground">
                {riskSettings.maxWeeklyLossPercent.toFixed(2)}%
              </span>
            </div>
            <div className="flex items-baseline justify-between text-sm">
              <span className="text-muted-foreground">Target weekly profit</span>
              <span className="text-muted-foreground">
                {riskSettings.targetWeeklyProfitPercent.toFixed(2)}%
              </span>
            </div>
            <div className="flex items-center justify-between pt-1">
              <span className="text-sm text-muted-foreground">Status</span>
              <span className={`text-sm font-medium ${statusClassName(weeklyStatus.status)}`}>
                {weeklyStatus.label}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
});
