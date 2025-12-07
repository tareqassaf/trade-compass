import { useState, useMemo, useEffect, useCallback, memo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay } from "date-fns";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { DollarSign, Trophy, TrendingUp, Activity, AlertCircle, ChevronLeft, ChevronRight, Info } from "lucide-react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
} from "recharts";
import { useAuth } from "@/contexts/AuthContext";
import { getTradesByUser } from "@/lib/firestoreService";
import { useDashboardStats, type CompassScore } from "@/features/dashboard/useDashboardStats";
import { useUserGeneralSettings } from "@/features/settings/useUserGeneralSettings";
import { TagAnalyticsCard } from "@/components/TagAnalyticsCard";
import { TimeAnalyticsSection } from "@/features/analytics/TimeAnalyticsSection";
import { RiskOverview } from "@/features/dashboard/RiskOverview";
import { RiskTimelineSection } from "@/features/dashboard/RiskTimelineSection";
import { RiskGuardBanner } from "@/components/dashboard/RiskGuardBanner";
import type { Trade } from "@/types/trading";

interface CompassScoreCardProps {
  compassScore?: CompassScore;
  isLoading?: boolean;
}

const CompassScoreCard = memo(function CompassScoreCard({ compassScore, isLoading }: CompassScoreCardProps) {
  if (isLoading) {
    return (
      <Card className="border-border/50 shadow-lg bg-slate-900">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Compass Score</CardTitle>
          <Info className="h-3.5 w-3.5 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[260px]">
            <Skeleton className="h-full w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!compassScore) {
    return (
      <Card className="border-border/50 shadow-lg bg-slate-900">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">Compass Score</CardTitle>
          <Info className="h-3.5 w-3.5 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center h-[260px]">
            <div className="text-3xl font-semibold text-muted-foreground">0</div>
            <div className="text-xs text-muted-foreground mt-2">No trades yet</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const data = useMemo(() => [
    { metric: "Win %", score: compassScore.winRate.score },
    { metric: "PF", score: compassScore.profitFactor.score },
    { metric: "Avg W/L", score: compassScore.avgWinLoss.score },
    { metric: "Max DD", score: compassScore.maxDrawdown.score },
    { metric: "Recovery", score: compassScore.recoveryFactor.score },
    { metric: "Consistency", score: compassScore.consistency.score },
  ], [compassScore]);

  const scoreColor =
    compassScore.totalScore >= 80
      ? "text-emerald-500"
      : compassScore.totalScore >= 60
        ? "text-yellow-500"
        : compassScore.totalScore >= 40
          ? "text-orange-500"
          : "text-red-500";

  const barColor =
    compassScore.totalScore >= 80
      ? "bg-emerald-500"
      : compassScore.totalScore >= 60
        ? "bg-yellow-500"
        : compassScore.totalScore >= 40
          ? "bg-orange-500"
          : "bg-red-500";

  return (
    <Card className="border-border/50 shadow-lg bg-slate-900">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">Compass Score</CardTitle>
        <Info className="h-3.5 w-3.5 text-muted-foreground" />
      </CardHeader>
      <CardContent>
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className={`text-3xl font-semibold ${scoreColor}`}>
              {compassScore.totalScore.toFixed(0)}
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Overall trading score (0–100)
            </div>
          </div>
          <div className="w-32 h-32">
            <ResponsiveContainer width="100%" height="100%">
              <RadarChart data={data}>
                <PolarGrid stroke="#374151" />
                <PolarAngleAxis
                  dataKey="metric"
                  tick={{ fill: "#9ca3af", fontSize: 10 }}
                />
                <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} axisLine={false} />
                <Radar
                  name="Score"
                  dataKey="score"
                  stroke="#22c55e"
                  fill="#22c55e"
                  fillOpacity={0.6}
                />
              </RadarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Horizontal bar showing score */}
        <div className="mt-2 h-2 w-full rounded-full bg-slate-800 overflow-hidden">
          <div
            className={`h-full ${barColor} transition-all`}
            style={{ width: `${Math.min(compassScore.totalScore, 100)}%` }}
          />
        </div>
      </CardContent>
    </Card>
  );
});

export default function Dashboard() {
  const { user } = useAuth();
  const userId = (user as any)?.uid || null;
  const [accountId, setAccountId] = useState<string>("");
  const [calendarMonth, setCalendarMonth] = useState<Date>(new Date());

  // Get user settings for default dashboard days
  const { settings } = useUserGeneralSettings(userId || "");
  const effectiveDays =
    settings?.defaultDashboardDays && settings.defaultDashboardDays > 0
      ? settings.defaultDashboardDays
      : 30;

  const [daysRange, setDaysRange] = useState<number>(effectiveDays);

  // Update daysRange when settings change
  useEffect(() => {
    if (effectiveDays) {
      setDaysRange(effectiveDays);
    }
  }, [effectiveDays]);

  // Fetch all trades to get distinct accountIds
  const { data: allTrades } = useQuery<Trade[]>({
    queryKey: ["allTrades", userId],
    queryFn: async () => {
      if (!userId) return [];
      return await getTradesByUser(userId);
    },
    enabled: !!userId,
  });

  // Extract distinct accountIds
  const distinctAccountIds = useMemo(() => {
    if (!allTrades) return [];
    const accountIds = new Set<string>();
    allTrades.forEach((trade) => {
      if (trade.accountId) {
        accountIds.add(trade.accountId);
      }
    });
    return Array.from(accountIds).sort();
  }, [allTrades]);

  // Set default accountId if available and not set
  useEffect(() => {
    if (!accountId && distinctAccountIds.length > 0) {
      setAccountId(distinctAccountIds[0]);
    }
  }, [accountId, distinctAccountIds]);

  // Memoize account change handler
  const handleAccountChange = useCallback((value: string) => {
    setAccountId(value);
  }, []);

  // Fetch dashboard stats
  const { data: dashboardStats, isLoading, error } = useDashboardStats({
    userId: userId || "",
    accountId,
    days: daysRange,
  });

  // Calculate profit factor from daily PnL
  const profitFactor = useMemo(() => {
    if (!dashboardStats?.dailyPnl || dashboardStats.dailyPnl.length === 0) return 0;
    const grossProfit = dashboardStats.dailyPnl
      .filter((d) => d.profit > 0)
      .reduce((sum, d) => sum + d.profit, 0);
    const grossLoss = Math.abs(
      dashboardStats.dailyPnl
        .filter((d) => d.profit < 0)
        .reduce((sum, d) => sum + d.profit, 0)
    );
    return grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? 0 : 0;
  }, [dashboardStats]);

  // Calculate Day Win % from daily PnL
  const dayWinRate = useMemo(() => {
    if (!dashboardStats?.dailyPnl) return 0;
    const daysWithTrades = dashboardStats.dailyPnl.filter((d) => d.profit !== 0);
    const winningDays = daysWithTrades.filter((d) => d.profit > 0).length;
    const losingDays = daysWithTrades.filter((d) => d.profit < 0).length;
    const totalDaysWithResult = winningDays + losingDays;
    return totalDaysWithResult > 0 ? (winningDays / totalDaysWithResult) * 100 : 0;
  }, [dashboardStats]);

  // Filter trades by accountId for avg win/loss calculation
  const filteredTrades = useMemo(() => {
    if (!allTrades || !accountId) return [];
    return allTrades.filter((trade) => trade.accountId === accountId);
  }, [allTrades, accountId]);

  // Calculate Avg win/loss trade
  const avgWinLoss = useMemo(() => {
    if (!filteredTrades || filteredTrades.length === 0) return { avgWin: 0, avgLoss: 0, ratio: 0 };
    const wins = filteredTrades
      .filter((t) => (t.pnlCurrency ?? 0) > 0)
      .map((t) => t.pnlCurrency ?? 0);
    const losses = filteredTrades
      .filter((t) => (t.pnlCurrency ?? 0) < 0)
      .map((t) => t.pnlCurrency ?? 0);

    const avgWin = wins.length > 0 ? wins.reduce((s, v) => s + v, 0) / wins.length : 0;
    const avgLoss = losses.length > 0 ? Math.abs(losses.reduce((s, v) => s + v, 0) / losses.length) : 0;
    const ratio = avgLoss > 0 ? avgWin / avgLoss : 0;

    return { avgWin, avgLoss, ratio };
  }, [filteredTrades]);

  // Format currency helper - memoized to avoid recreating on each render
  const formatCurrency = useCallback((value: number | undefined): string => {
    if (value == null || isNaN(value)) return "$0.00";
    const sign = value >= 0 ? "" : "-";
    const abs = Math.abs(value);
    return `${sign}$${abs.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }, []);

  // Build cumulative PnL series
  const cumulativePnlSeries = useMemo(() => {
    if (!dashboardStats?.dailyPnl) return [];
    let cumulative = 0;
    return dashboardStats.dailyPnl.map((point) => {
      cumulative += point.profit;
      return {
        dateKey: format(point.date, "MMM dd"),
        value: cumulative,
      };
    });
  }, [dashboardStats]);

  // Build calendar data for current month
  const calendarData = useMemo(() => {
    if (!dashboardStats?.dailyPnl) return new Map();
    const map = new Map<string, number>();
    dashboardStats.dailyPnl.forEach((point) => {
      map.set(point.dateKey, point.profit);
    });
    return map;
  }, [dashboardStats]);

  // Calendar navigation - memoized callbacks
  const handlePreviousMonth = useCallback(() => {
    setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1));
  }, [calendarMonth]);

  const handleNextMonth = useCallback(() => {
    setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1));
  }, [calendarMonth]);

  // Get color for calendar day
  const getDayColor = (profit: number | undefined): string => {
    if (profit === undefined) return "bg-slate-800 border-slate-700";
    if (profit > 0) {
      const abs = Math.abs(profit);
      if (abs >= 500) return "bg-green-600 border-green-500";
      if (abs >= 200) return "bg-green-500 border-green-400";
      if (abs >= 50) return "bg-green-400 border-green-300";
      return "bg-green-300 border-green-200";
    } else if (profit < 0) {
      const abs = Math.abs(profit);
      if (abs >= 500) return "bg-red-600 border-red-500";
      if (abs >= 200) return "bg-red-500 border-red-400";
      if (abs >= 50) return "bg-red-400 border-red-300";
      return "bg-red-300 border-red-200";
    }
    return "bg-yellow-300 border-yellow-200";
  };

  if (!userId) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="text-center">
          <p className="text-lg text-muted-foreground">Please sign in to view your dashboard.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 bg-slate-950 min-h-screen p-6">
      {/* Risk Guard Banner */}
      {userId && accountId && (
        <RiskGuardBanner accountId={accountId} />
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Your trading performance overview</p>
        </div>
        <div className="flex gap-4">
          <div className="min-w-[200px]">
            <Select value={accountId} onValueChange={handleAccountChange} disabled={distinctAccountIds.length === 0}>
              <SelectTrigger>
                <SelectValue placeholder={distinctAccountIds.length === 0 ? "No accounts found" : "Select account"} />
              </SelectTrigger>
              {distinctAccountIds.length > 0 && (
                <SelectContent>
                  {distinctAccountIds.map((accId) => (
                    <SelectItem key={accId} value={accId}>
                      {accId}
                    </SelectItem>
                  ))}
                </SelectContent>
              )}
            </Select>
        </div>
        <div className="flex gap-2">
          <Button
              variant={daysRange === 30 ? "default" : "outline"}
            size="sm"
              onClick={() => setDaysRange(30)}
          >
              30D
          </Button>
          <Button
              variant={daysRange === 60 ? "default" : "outline"}
            size="sm"
              onClick={() => setDaysRange(60)}
          >
              60D
          </Button>
          <Button
              variant={daysRange === 90 ? "default" : "outline"}
            size="sm"
              onClick={() => setDaysRange(90)}
          >
              90D
          </Button>
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Failed to load dashboard data</AlertTitle>
          <AlertDescription>{error.message}</AlertDescription>
        </Alert>
      )}

      {/* No Account Selected */}
      {!accountId && distinctAccountIds.length > 0 && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Please select an account to view dashboard data.</AlertDescription>
        </Alert>
      )}

      {/* No Trades */}
      {!isLoading && dashboardStats && dashboardStats.kpis.totalTrades === 0 && accountId && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            No trades yet for this account. Import your MT5 history or add a trade to see stats.
          </AlertDescription>
        </Alert>
      )}

      {/* KPI Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
        {/* Card 1: Net P&L */}
        <Card className="border-border/50 shadow-lg bg-slate-900">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Net P&L</CardTitle>
            <Info className="h-3.5 w-3.5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <div
                className={`text-2xl font-semibold ${
                  dashboardStats && dashboardStats.kpis.totalProfit >= 0
                    ? "text-emerald-500"
                    : "text-red-500"
                }`}
              >
                {formatCurrency(dashboardStats?.kpis.totalProfit)}
            </div>
            )}
          </CardContent>
        </Card>

        {/* Card 2: Trade Win % */}
        <Card className="border-border/50 shadow-lg bg-slate-900">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Trade Win %</CardTitle>
            <Info className="h-3.5 w-3.5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <>
                <div className="text-2xl font-semibold text-white">
                  {dashboardStats ? dashboardStats.kpis.winRate.toFixed(2) : "0.00"}%
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Wins: {dashboardStats?.kpis.winCount || 0} / Losses: {dashboardStats?.kpis.lossCount || 0}
                </p>
                <div className="mt-2 w-full bg-slate-800 rounded-full h-1.5">
                  <div
                    className="bg-emerald-500 h-1.5 rounded-full transition-all"
                    style={{
                      width: `${dashboardStats?.kpis.winRate || 0}%`,
                    }}
                  />
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Card 3: Profit Factor */}
        <Card className="border-border/50 shadow-lg bg-slate-900">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Profit Factor</CardTitle>
            <Info className="h-3.5 w-3.5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <div className="flex items-center gap-3">
                <div className="text-2xl font-semibold text-white">
                  {profitFactor.toFixed(2)}
                </div>
                {/* Simple donut gauge using CSS */}
                <div className="relative w-12 h-12">
                  <svg className="w-12 h-12 transform -rotate-90" viewBox="0 0 36 36">
                    <circle
                      cx="18"
                      cy="18"
                      r="16"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      className="text-slate-700"
                    />
                    <circle
                      cx="18"
                      cy="18"
                      r="16"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeDasharray={`${Math.min((profitFactor / 3) * 100, 100)}, 100`}
                      className="text-emerald-500"
                      strokeLinecap="round"
                    />
                  </svg>
                </div>
            </div>
            )}
          </CardContent>
        </Card>

        {/* Card 4: Day Win % */}
        <Card className="border-border/50 shadow-lg bg-slate-900">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Day Win %</CardTitle>
            <Info className="h-3.5 w-3.5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <>
                <div className="text-2xl font-semibold text-white">
                  {dayWinRate.toFixed(2)}%
                </div>
                <div className="mt-2 w-full bg-slate-800 rounded-full h-1.5 flex overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 transition-all"
                    style={{
                      width: `${dayWinRate}%`,
                    }}
                  />
                  <div
                    className="h-full bg-red-500 transition-all"
                    style={{
                      width: `${100 - dayWinRate}%`,
                    }}
                  />
            </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Card 5: Avg win/loss trade */}
        <Card className="border-border/50 shadow-lg bg-slate-900">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Avg win/loss trade</CardTitle>
            <Info className="h-3.5 w-3.5 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-32" />
            ) : (
              <>
                <div className="text-2xl font-semibold text-white">
                  {avgWinLoss.ratio.toFixed(2)}
                </div>
                <div className="mt-2 h-2 w-full rounded-full bg-muted flex overflow-hidden">
                  <div
                    className="h-full bg-emerald-500 transition-all"
                    style={{
                      width: `${avgWinLoss.avgWin + avgWinLoss.avgLoss > 0 ? (avgWinLoss.avgWin / (avgWinLoss.avgWin + avgWinLoss.avgLoss)) * 100 : 50}%`,
                    }}
                  />
                  <div
                    className="h-full bg-rose-500 transition-all"
                    style={{
                      width: `${avgWinLoss.avgWin + avgWinLoss.avgLoss > 0 ? (avgWinLoss.avgLoss / (avgWinLoss.avgWin + avgWinLoss.avgLoss)) * 100 : 50}%`,
                    }}
                  />
                </div>
                <div className="mt-1 flex justify-between text-xs text-muted-foreground">
                  <span>{formatCurrency(avgWinLoss.avgWin)}</span>
                  <span>-{formatCurrency(avgWinLoss.avgLoss)}</span>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mt-6">
        {/* Left: Compass Score */}
        <CompassScoreCard compassScore={dashboardStats?.compassScore} isLoading={isLoading} />

        {/* Middle: Cumulative PnL / Equity Curve */}
        <Card className="border-border/50 shadow-lg bg-slate-900">
          <CardHeader>
            <CardTitle className="text-white">Equity Curve / Cumulative PnL</CardTitle>
            <CardDescription>Total profit and loss over time</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center h-[260px]">
                <Skeleton className="h-full w-full" />
              </div>
            ) : cumulativePnlSeries.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={cumulativePnlSeries}>
                  <defs>
                    <linearGradient id="pnlGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22c55e" stopOpacity={0.8} />
                      <stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="dateKey" stroke="#9ca3af" fontSize={12} />
                  <YAxis
                    stroke="#9ca3af"
                    fontSize={12}
                    tickFormatter={(value) => `$${(value / 1000).toFixed(0)}K`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1e293b",
                      border: "1px solid #374151",
                      borderRadius: "8px",
                      color: "#fff",
                    }}
                    formatter={(value: number) =>
                      `$${value.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}`
                    }
                  />
                  <Area
                    type="monotone"
                    dataKey="value"
                    stroke="#22c55e"
                    fill="url(#pnlGradient)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[260px] text-muted-foreground">
                No data available
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right: Net Daily PnL */}
        <Card className="border-border/50 shadow-lg bg-slate-900">
          <CardHeader>
            <CardTitle className="text-white">Net Daily PnL</CardTitle>
            <CardDescription>Daily profit and loss breakdown</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center h-[260px]">
                <Skeleton className="h-full w-full" />
              </div>
            ) : dashboardStats && dashboardStats.dailyPnl.length > 0 ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart
                  data={dashboardStats.dailyPnl.map((point) => ({
                    dateKey: format(point.date, "MMM dd"),
                    profit: point.profit,
                  }))}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="dateKey" stroke="#9ca3af" fontSize={12} />
                  <YAxis
                    stroke="#9ca3af"
                    fontSize={12}
                    tickFormatter={(value) => `$${(value / 1000).toFixed(0)}K`}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "#1e293b",
                      border: "1px solid #374151",
                      borderRadius: "8px",
                      color: "#fff",
                    }}
                    formatter={(value: number) =>
                      `$${value.toLocaleString(undefined, {
                        minimumFractionDigits: 2,
                        maximumFractionDigits: 2,
                      })}`
                    }
                  />
                  <Bar dataKey="profit" radius={[4, 4, 0, 0]}>
                    {dashboardStats.dailyPnl.map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={entry.profit >= 0 ? "#22c55e" : "#ef4444"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[260px] text-muted-foreground">
                No data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Calendar + Symbols Row */}
      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4 mt-6">
        {/* Left 2/3: Calendar */}
        <Card className="border-border/50 shadow-lg bg-slate-900 xl:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-white">PnL Calendar</CardTitle>
                <CardDescription>Daily profit and loss heatmap</CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" onClick={handlePreviousMonth}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-sm font-medium min-w-[120px] text-center">
                  {format(calendarMonth, "MMMM yyyy")}
                </span>
                <Button variant="outline" size="icon" onClick={handleNextMonth}>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="grid grid-cols-7 gap-2">
                {Array.from({ length: 42 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : (
            <div className="space-y-2">
                {/* Weekday headers */}
                <div className="grid grid-cols-7 gap-2 text-xs font-semibold text-muted-foreground mb-2">
                  {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => (
                    <div key={day} className="text-center py-1">
                    {day}
                  </div>
                ))}
              </div>

                {/* Calendar grid */}
                <div className="grid grid-cols-7 gap-2">
                {(() => {
                    const monthStart = startOfMonth(calendarMonth);
                    const monthEnd = endOfMonth(calendarMonth);
                    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
                    const firstDayOfWeek = getDay(monthStart) === 0 ? 6 : getDay(monthStart) - 1;

                    // Empty cells before first day
                  const emptyCells = Array(firstDayOfWeek).fill(null);
                    const allCells = [...emptyCells, ...days];

                    return allCells.map((day, idx) => {
                      if (!day) {
                        return <div key={`empty-${idx}`} className="h-16" />;
                      }

                      const dateKey = format(day, "yyyy-MM-dd");
                      const profit = calendarData.get(dateKey);
                      const colorClass = getDayColor(profit);

                  return (
                        <div
                          key={dateKey}
                          className={`h-16 border rounded-lg p-2 flex flex-col justify-between ${colorClass} ${
                            profit !== undefined ? "cursor-pointer hover:opacity-80 transition-opacity" : ""
                          }`}
                        >
                          <div className={`text-sm font-semibold ${profit !== undefined ? "text-white" : "text-slate-400"}`}>
                            {format(day, "d")}
                              </div>
                          {profit !== undefined && (
                            <div className="text-xs text-white drop-shadow-sm">
                              {profit >= 0 ? "+" : ""}
                              {profit.toFixed(0)}
                              </div>
                          )}
                        </div>
                  );
                    });
                })()}
              </div>
            </div>
            )}
          </CardContent>
        </Card>

        {/* Right 1/3: Top Symbols + Summary */}
        <Card className="border-border/50 shadow-lg bg-slate-900">
          <CardHeader>
            <CardTitle className="text-white">Top Symbols</CardTitle>
            <CardDescription>Top 5 by profit</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <div className="space-y-2">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : dashboardStats && dashboardStats.symbols.length > 0 ? (
              <>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-700">
                        <th className="px-2 py-2 text-left font-semibold text-muted-foreground">Symbol</th>
                        <th className="px-2 py-2 text-right font-semibold text-muted-foreground">PnL</th>
                        <th className="px-2 py-2 text-right font-semibold text-muted-foreground">Trades</th>
                        <th className="px-2 py-2 text-right font-semibold text-muted-foreground">Winrate</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dashboardStats.symbols.map((symbol) => (
                        <tr
                          key={symbol.symbol}
                          className="border-b border-slate-700/50 hover:bg-slate-800/50 transition-colors"
                        >
                          <td className="px-2 py-2 font-medium text-white">{symbol.symbol}</td>
                          <td
                            className={`px-2 py-2 text-right font-semibold ${
                              symbol.totalProfit >= 0 ? "text-green-400" : "text-red-400"
                            }`}
                      >
                            {symbol.totalProfit >= 0 ? "+" : ""}
                            {symbol.totalProfit.toFixed(2)}
                          </td>
                          <td className="px-2 py-2 text-right text-muted-foreground">{symbol.tradesCount}</td>
                          <td className="px-2 py-2 text-right text-muted-foreground">
                            {(symbol.winRate * 100).toFixed(1)}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                      </div>

                {/* Quick Summary Stats */}
                <div className="pt-4 border-t border-slate-700 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Total Trades:</span>
                    <span className="font-semibold text-white">{dashboardStats.kpis.totalTrades}</span>
                      </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Wins:</span>
                    <span className="font-semibold text-green-400">{dashboardStats.kpis.winCount}</span>
                    </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Losses:</span>
                    <span className="font-semibold text-red-400">{dashboardStats.kpis.lossCount}</span>
                  </div>
                </div>
              </>
              ) : (
              <div className="text-center text-muted-foreground py-8">No symbol data available</div>
              )}
          </CardContent>
        </Card>
      </div>

      {/* Tag Analytics Row */}
      {userId && accountId && (
        <div className="grid grid-cols-1 gap-4 mt-6">
          <TagAnalyticsCard userId={userId} accountId={accountId} />
        </div>
      )}

      {/* Time Analytics Row */}
      {userId && accountId && (
        <TimeAnalyticsSection userId={userId} accountId={accountId} />
      )}

      {/* Risk Overview Section */}
      {userId && accountId && (
        <section className="space-y-2 mt-6">
          <h2 className="text-lg font-semibold text-white">Risk Overview</h2>
          <p className="text-sm text-muted-foreground">
            Daily and weekly risk status based on your configured limits and targets.
          </p>
          <RiskOverview accountId={accountId} />
        </section>
      )}

      {/* Risk Timeline Section */}
      {userId && accountId && (
        <RiskTimelineSection accountId={accountId} />
      )}
    </div>
  );
}
