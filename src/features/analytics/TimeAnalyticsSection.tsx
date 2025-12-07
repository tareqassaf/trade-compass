import { memo, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { useTimeAnalytics } from "./useTimeAnalytics";
import type { WeekdayStat, SessionStat, DurationBucketStat } from "@/types/trading";

interface TimeAnalyticsSectionProps {
  userId: string;
  accountId: string;
}

/**
 * Format currency value
 */
function formatCurrency(value: number): string {
  const sign = value >= 0 ? "" : "-";
  const abs = Math.abs(value);
  return `${sign}$${abs.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

// Memoized chart components
const WeekdayChart = memo(function WeekdayChart({ data }: { data: WeekdayStat[] }) {
  const tooltipContentStyle = useMemo(() => ({
    backgroundColor: "#1e293b",
    border: "1px solid #374151",
    borderRadius: "8px",
    color: "#fff",
  }), []);

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis
          dataKey="label"
          stroke="#9ca3af"
          fontSize={10}
        />
        <YAxis
          stroke="#9ca3af"
          fontSize={10}
          tickFormatter={(value) => `$${(value / 1000).toFixed(0)}K`}
        />
        <Tooltip
          contentStyle={tooltipContentStyle}
          formatter={(value: number) => formatCurrency(value)}
          labelStyle={{ color: "#9ca3af" }}
        />
        <Bar dataKey="netPnlCurrency" radius={[4, 4, 0, 0]}>
          {data.map((entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={entry.netPnlCurrency >= 0 ? "#22c55e" : "#ef4444"}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
});

const SessionChart = memo(function SessionChart({ data }: { data: SessionStat[] }) {
  const tooltipContentStyle = useMemo(() => ({
    backgroundColor: "#1e293b",
    border: "1px solid #374151",
    borderRadius: "8px",
    color: "#fff",
  }), []);

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis
          dataKey="session"
          stroke="#9ca3af"
          fontSize={10}
        />
        <YAxis
          stroke="#9ca3af"
          fontSize={10}
          tickFormatter={(value) => `$${(value / 1000).toFixed(0)}K`}
        />
        <Tooltip
          contentStyle={tooltipContentStyle}
          formatter={(value: number) => formatCurrency(value)}
          labelStyle={{ color: "#9ca3af" }}
        />
        <Bar dataKey="netPnlCurrency" radius={[4, 4, 0, 0]}>
          {data.map((entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={entry.netPnlCurrency >= 0 ? "#22c55e" : "#ef4444"}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
});

const DurationChart = memo(function DurationChart({ data }: { data: DurationBucketStat[] }) {
  const tooltipContentStyle = useMemo(() => ({
    backgroundColor: "#1e293b",
    border: "1px solid #374151",
    borderRadius: "8px",
    color: "#fff",
  }), []);

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis
          dataKey="bucketKey"
          stroke="#9ca3af"
          fontSize={10}
          angle={-45}
          textAnchor="end"
          height={60}
        />
        <YAxis
          stroke="#9ca3af"
          fontSize={10}
          tickFormatter={(value) => `$${(value / 1000).toFixed(0)}K`}
        />
        <Tooltip
          contentStyle={tooltipContentStyle}
          formatter={(value: number) => formatCurrency(value)}
          labelStyle={{ color: "#9ca3af" }}
        />
        <Bar dataKey="netPnlCurrency" radius={[4, 4, 0, 0]}>
          {data.map((entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={entry.netPnlCurrency >= 0 ? "#22c55e" : "#ef4444"}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
});

export const TimeAnalyticsSection = memo(function TimeAnalyticsSection({
  userId,
  accountId,
}: TimeAnalyticsSectionProps) {
  const { data, isLoading, error } = useTimeAnalytics({
    userId,
    accountId,
    days: 90,
  });

  if (error) {
    return (
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mt-6">
        <Card className="border-border/50 shadow-lg bg-slate-900 xl:col-span-3">
          <CardContent className="pt-6">
            <p className="text-red-400">Failed to load time analytics: {error.message}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const hasData =
    data &&
    (data.weekdayStats.length > 0 ||
      data.sessionStats.length > 0 ||
      data.durationStats.length > 0);

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mt-6">
      {/* Weekday Performance Card */}
      <Card className="border-border/50 shadow-lg bg-slate-900">
        <CardHeader>
          <CardTitle className="text-white">PnL by Weekday</CardTitle>
          <CardDescription>Performance by day of week</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-[200px] w-full" />
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            </div>
          ) : !hasData || !data.weekdayStats.length ? (
            <div className="flex items-center justify-center h-[300px] text-muted-foreground">
              <p className="text-center">No trades in this period</p>
            </div>
          ) : (
            <div className="space-y-4">
              <WeekdayChart data={data.weekdayStats} />

              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-700">
                      <th className="text-left py-1 px-2 font-semibold text-muted-foreground">
                        Day
                      </th>
                      <th className="text-right py-1 px-2 font-semibold text-muted-foreground">
                        Trades
                      </th>
                      <th className="text-right py-1 px-2 font-semibold text-muted-foreground">
                        Win%
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.weekdayStats.map((stat) => (
                      <tr
                        key={stat.weekday}
                        className="border-t border-slate-700/50 hover:bg-slate-800/50 transition-colors"
                      >
                        <td className="py-1 px-2 font-medium text-white">{stat.label}</td>
                        <td className="py-1 px-2 text-right text-muted-foreground">
                          {stat.tradesCount}
                        </td>
                        <td className="py-1 px-2 text-right text-muted-foreground">
                          {(stat.winRate * 100).toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Session Performance Card */}
      <Card className="border-border/50 shadow-lg bg-slate-900">
        <CardHeader>
          <CardTitle className="text-white">Session Performance</CardTitle>
          <CardDescription>Performance by trading session</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-[200px] w-full" />
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            </div>
          ) : !hasData || !data.sessionStats.length ? (
            <div className="flex items-center justify-center h-[300px] text-muted-foreground">
              <p className="text-center">No trades in this period</p>
            </div>
          ) : (
            <div className="space-y-4">
              <SessionChart data={data.sessionStats} />

              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-700">
                      <th className="text-left py-1 px-2 font-semibold text-muted-foreground">
                        Session
                      </th>
                      <th className="text-right py-1 px-2 font-semibold text-muted-foreground">
                        Trades
                      </th>
                      <th className="text-right py-1 px-2 font-semibold text-muted-foreground">
                        Win%
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.sessionStats.map((stat) => (
                      <tr
                        key={stat.session}
                        className="border-t border-slate-700/50 hover:bg-slate-800/50 transition-colors"
                      >
                        <td className="py-1 px-2 font-medium text-white">{stat.session}</td>
                        <td className="py-1 px-2 text-right text-muted-foreground">
                          {stat.tradesCount}
                        </td>
                        <td className="py-1 px-2 text-right text-muted-foreground">
                          {(stat.winRate * 100).toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Duration Buckets Card */}
      <Card className="border-border/50 shadow-lg bg-slate-900">
        <CardHeader>
          <CardTitle className="text-white">PnL by Trade Duration</CardTitle>
          <CardDescription>Performance by holding time</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-[200px] w-full" />
              <div className="space-y-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            </div>
          ) : !hasData || !data.durationStats.length ? (
            <div className="flex items-center justify-center h-[300px] text-muted-foreground">
              <p className="text-center">No trades in this period</p>
            </div>
          ) : (
            <div className="space-y-4">
              <DurationChart data={data.durationStats} />

              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-slate-700">
                      <th className="text-left py-1 px-2 font-semibold text-muted-foreground">
                        Duration
                      </th>
                      <th className="text-right py-1 px-2 font-semibold text-muted-foreground">
                        Trades
                      </th>
                      <th className="text-right py-1 px-2 font-semibold text-muted-foreground">
                        Avg R
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.durationStats.map((stat) => (
                      <tr
                        key={stat.bucketKey}
                        className="border-t border-slate-700/50 hover:bg-slate-800/50 transition-colors"
                      >
                        <td className="py-1 px-2 font-medium text-white">{stat.bucketKey}</td>
                        <td className="py-1 px-2 text-right text-muted-foreground">
                          {stat.tradesCount}
                        </td>
                        <td className="py-1 px-2 text-right text-muted-foreground">
                          {stat.avgRMultiple != null
                            ? stat.avgRMultiple.toFixed(2)
                            : "–"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
});

