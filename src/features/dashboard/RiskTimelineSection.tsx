import * as React from "react";
import { memo, useMemo } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { useRiskSettings } from "@/hooks/useRiskSettings";
import { useRiskTimeline } from "@/features/dashboard/useRiskTimeline";
import { useAuth } from "@/contexts/AuthContext";

interface RiskTimelineSectionProps {
  accountId: string;
}

// Memoized chart components
const DailyRiskChart = memo(function DailyRiskChart({ 
  data, 
  maxLoss, 
  target 
}: { 
  data: Array<{ date: string; pnlPercent: number }>; 
  maxLoss: number; 
  target: number;
}) {
  const tooltipContentStyle = useMemo(() => ({
    backgroundColor: "#1e293b",
    border: "1px solid #374151",
    borderRadius: "8px",
    color: "#fff",
  }), []);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis
          dataKey="date"
          stroke="#9ca3af"
          fontSize={12}
          angle={-45}
          textAnchor="end"
          height={60}
        />
        <YAxis
          stroke="#9ca3af"
          fontSize={12}
          tickFormatter={(v) => `${v.toFixed(1)}%`}
        />
        <Tooltip
          contentStyle={tooltipContentStyle}
          formatter={(value: number) => `${value.toFixed(2)}%`}
          labelStyle={{ color: "#9ca3af" }}
        />
        <ReferenceLine y={0} stroke="#9ca3af" strokeDasharray="3 3" />
        <ReferenceLine
          y={-maxLoss}
          stroke="#ef4444"
          strokeDasharray="3 3"
          label={{ value: "Max Loss", position: "right", fill: "#ef4444" }}
        />
        <ReferenceLine
          y={target}
          stroke="#22c55e"
          strokeDasharray="3 3"
          label={{ value: "Target", position: "right", fill: "#22c55e" }}
        />
        <Line
          type="monotone"
          dataKey="pnlPercent"
          stroke="#3b82f6"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
});

const WeeklyRiskChart = memo(function WeeklyRiskChart({ 
  data, 
  maxLoss, 
  target 
}: { 
  data: Array<{ weekLabel: string; pnlPercent: number }>; 
  maxLoss: number; 
  target: number;
}) {
  const tooltipContentStyle = useMemo(() => ({
    backgroundColor: "#1e293b",
    border: "1px solid #374151",
    borderRadius: "8px",
    color: "#fff",
  }), []);

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis
          dataKey="weekLabel"
          stroke="#9ca3af"
          fontSize={12}
          angle={-45}
          textAnchor="end"
          height={60}
        />
        <YAxis
          stroke="#9ca3af"
          fontSize={12}
          tickFormatter={(v) => `${v.toFixed(1)}%`}
        />
        <Tooltip
          contentStyle={tooltipContentStyle}
          formatter={(value: number) => `${value.toFixed(2)}%`}
          labelStyle={{ color: "#9ca3af" }}
        />
        <ReferenceLine y={0} stroke="#9ca3af" strokeDasharray="3 3" />
        <ReferenceLine
          y={-maxLoss}
          stroke="#ef4444"
          strokeDasharray="3 3"
          label={{ value: "Max Loss", position: "right", fill: "#ef4444" }}
        />
        <ReferenceLine
          y={target}
          stroke="#22c55e"
          strokeDasharray="3 3"
          label={{ value: "Target", position: "right", fill: "#22c55e" }}
        />
        <Line
          type="monotone"
          dataKey="pnlPercent"
          stroke="#3b82f6"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
});

export const RiskTimelineSection = memo(function RiskTimelineSection({ accountId }: RiskTimelineSectionProps) {
  const { user } = useAuth();
  const { data: riskSettings, loading: riskLoading } = useRiskSettings();
  const { data: timelineData, loading: timelineLoading, error } = useRiskTimeline({
    userId: user?.uid || "",
    accountId,
    days: 30,
    weeks: 12,
  });

  // Use default settings if not loaded yet
  const settings = riskSettings || {
    maxDailyLossPercent: 4,
    maxWeeklyLossPercent: 10,
    targetDailyProfitPercent: 3,
    targetWeeklyProfitPercent: 15,
    createdAt: null,
    updatedAt: null,
  };

  if (riskLoading || timelineLoading) {
    return (
      <section className="space-y-2 mt-6">
        <h2 className="text-lg font-semibold text-white">Risk Timeline</h2>
        <p className="text-sm text-muted-foreground">
          Daily and weekly PnL (%) compared to your configured risk limits and targets.
        </p>
        <div className="text-sm text-muted-foreground">
          Loading risk timeline…
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="space-y-2 mt-6">
        <h2 className="text-lg font-semibold text-white">Risk Timeline</h2>
        <p className="text-sm text-muted-foreground">
          Daily and weekly PnL (%) compared to your configured risk limits and targets.
        </p>
        <div className="text-sm text-red-500">
          Error loading risk timeline: {error}
        </div>
      </section>
    );
  }

  if (!timelineData || (timelineData.daily.length === 0 && timelineData.weekly.length === 0)) {
    return (
      <section className="space-y-2 mt-6">
        <h2 className="text-lg font-semibold text-white">Risk Timeline</h2>
        <p className="text-sm text-muted-foreground">
          Daily and weekly PnL (%) compared to your configured risk limits and targets.
        </p>
        <div className="text-sm text-muted-foreground">
          Not enough data to render risk timeline yet.
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-2 mt-6">
      <h2 className="text-lg font-semibold text-white">Risk Timeline</h2>
      <p className="text-sm text-muted-foreground">
        Daily and weekly PnL (%) compared to your configured risk limits and targets.
      </p>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Daily Risk Timeline card */}
        <Card className="border-border/50 shadow-lg bg-slate-900">
          <CardHeader>
            <CardTitle className="text-white">Daily Risk Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            {timelineData.daily.length > 0 ? (
              <>
                <div className="h-64">
                  <DailyRiskChart 
                    data={timelineData.daily}
                    maxLoss={settings.maxDailyLossPercent}
                    target={settings.targetDailyProfitPercent}
                  />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Showing the last 30 days of PnL % versus your max daily loss and daily profit target.
                </p>
              </>
            ) : (
              <div className="flex items-center justify-center h-64 text-muted-foreground">
                Not enough data for daily risk timeline yet.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Weekly Risk Timeline card */}
        <Card className="border-border/50 shadow-lg bg-slate-900">
          <CardHeader>
            <CardTitle className="text-white">Weekly Risk Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            {timelineData.weekly.length > 0 ? (
              <>
                <div className="h-64">
                  <WeeklyRiskChart 
                    data={timelineData.weekly}
                    maxLoss={settings.maxWeeklyLossPercent}
                    target={settings.targetWeeklyProfitPercent}
                  />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Showing the last 12 weeks of PnL % versus your weekly loss limit and weekly profit target.
                </p>
              </>
            ) : (
              <div className="flex items-center justify-center h-64 text-muted-foreground">
                Not enough data for weekly risk timeline yet.
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </section>
  );
});

