import { memo, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
import { useTagAnalytics } from "@/features/analytics/useTagAnalytics";
import type { TagStat } from "@/types/trading";

interface TagAnalyticsCardProps {
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

// Memoized chart component
const TagAnalyticsChart = memo(function TagAnalyticsChart({ chartData }: { chartData: Array<{ tag: string; netPnlCurrency: number }> }) {
  const tooltipContentStyle = useMemo(() => ({
    backgroundColor: "#1e293b",
    border: "1px solid #374151",
    borderRadius: "8px",
    color: "#fff",
  }), []);

  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
        <XAxis
          dataKey="tag"
          hide
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
          {chartData.map((entry, index) => (
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

export const TagAnalyticsCard = memo(function TagAnalyticsCard({ userId, accountId }: TagAnalyticsCardProps) {
  const { data, isLoading, error } = useTagAnalytics({
    userId,
    accountId,
    days: 90,
  });

  if (error) {
    return (
      <Card className="border-border/50 shadow-lg bg-slate-900">
        <CardHeader>
          <CardTitle className="text-white">Tag Analytics</CardTitle>
          <CardDescription>Top setups by PnL</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertDescription>
              Failed to load tag analytics: {error.message}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className="border-border/50 shadow-lg bg-slate-900">
        <CardHeader>
          <CardTitle className="text-white">Tag Analytics</CardTitle>
          <CardDescription>Top setups by PnL</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
            <Skeleton className="h-[220px] w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data || data.length === 0) {
    return (
      <Card className="border-border/50 shadow-lg bg-slate-900">
        <CardHeader>
          <CardTitle className="text-white">Tag Analytics</CardTitle>
          <CardDescription>Top setups by PnL</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[300px] text-muted-foreground">
            <p className="text-center">
              No tags yet. Add tags to your trades in the journal to see analytics here.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const topTags = useMemo(() => data.slice(0, 10), [data]);
  const chartData = useMemo(() => topTags.map((tag) => ({
    tag: tag.tag,
    netPnlCurrency: tag.netPnlCurrency,
  })), [topTags]);

  return (
    <Card className="border-border/50 shadow-lg bg-slate-900">
      <CardHeader>
        <CardTitle className="text-white">Tag Analytics</CardTitle>
        <CardDescription>Top setups by PnL</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Table */}
          <div className="space-y-2">
            <div className="overflow-x-auto">
              <table className="w-full text-xs md:text-sm">
                <thead>
                  <tr className="border-b border-slate-700">
                    <th className="text-left py-2 px-2 font-semibold text-muted-foreground">Tag</th>
                    <th className="text-right py-2 px-2 font-semibold text-muted-foreground">PnL</th>
                    <th className="text-right py-2 px-2 font-semibold text-muted-foreground">Trades</th>
                    <th className="text-right py-2 px-2 font-semibold text-muted-foreground">Win%</th>
                    <th className="text-right py-2 px-2 font-semibold text-muted-foreground">PF</th>
                  </tr>
                </thead>
                <tbody>
                  {topTags.map((tag) => (
                    <tr
                      key={tag.tag}
                      className="border-t border-slate-700/50 hover:bg-slate-800/50 transition-colors"
                    >
                      <td className="py-2 px-2 font-medium text-white">{tag.tag}</td>
                      <td
                        className={`py-2 px-2 text-right font-semibold ${
                          tag.netPnlCurrency >= 0 ? "text-green-400" : "text-red-400"
                        }`}
                      >
                        {formatCurrency(tag.netPnlCurrency)}
                      </td>
                      <td className="py-2 px-2 text-right text-muted-foreground">
                        {tag.tradesCount}
                      </td>
                      <td className="py-2 px-2 text-right text-muted-foreground">
                        {(tag.winRate * 100).toFixed(1)}%
                      </td>
                      <td className="py-2 px-2 text-right text-muted-foreground">
                        {tag.profitFactor != null ? tag.profitFactor.toFixed(2) : "–"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right: Bar Chart */}
          <div className="space-y-2">
            <TagAnalyticsChart chartData={chartData} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

