import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subWeeks, subMonths, parseISO, isWithinInterval } from "date-fns";
import { TrendingUp, TrendingDown, Minus, ArrowUp, ArrowDown } from "lucide-react";
import { useFilters } from "@/hooks/useFilters";

interface PeriodStats {
  label: string;
  startDate: Date;
  endDate: Date;
  trades: number;
  wins: number;
  losses: number;
  winRate: number;
  netPnl: number;
  avgR: number;
  expectancy: number;
}

const PerformanceSummary = () => {
  const { filters, applyFilters, hasActiveFilters } = useFilters();

  const { data: trades, isLoading } = useQuery({
    queryKey: ["trades-performance", filters],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trades")
        .select("*")
        .neq("result", "open");
      if (error) throw error;
      return applyFilters(data || []);
    },
  });

  const calculatePeriodStats = (
    startDate: Date,
    endDate: Date,
    label: string
  ): PeriodStats => {
    const periodTrades = trades?.filter((trade) => {
      const tradeDate = parseISO(trade.trading_day);
      return isWithinInterval(tradeDate, { start: startDate, end: endDate });
    }) || [];

    const wins = periodTrades.filter((t) => t.result === "win").length;
    const losses = periodTrades.filter((t) => t.result === "loss").length;
    const totalTrades = periodTrades.length;
    const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;
    const netPnl = periodTrades.reduce((sum, t) => sum + (t.pnl_amount || 0), 0);
    const avgR =
      totalTrades > 0
        ? periodTrades.reduce((sum, t) => sum + (t.r_multiple || 0), 0) / totalTrades
        : 0;
    const expectancy = totalTrades > 0 ? netPnl / totalTrades : 0;

    return {
      label,
      startDate,
      endDate,
      trades: totalTrades,
      wins,
      losses,
      winRate,
      netPnl,
      avgR,
      expectancy,
    };
  };

  const getWeeklyStats = () => {
    const weeks: PeriodStats[] = [];
    const now = new Date();

    for (let i = 0; i < 8; i++) {
      const weekStart = startOfWeek(subWeeks(now, i), { weekStartsOn: 1 });
      const weekEnd = endOfWeek(subWeeks(now, i), { weekStartsOn: 1 });
      const label = i === 0 ? "This Week" : i === 1 ? "Last Week" : format(weekStart, "MMM d");
      weeks.push(calculatePeriodStats(weekStart, weekEnd, label));
    }

    return weeks;
  };

  const getMonthlyStats = () => {
    const months: PeriodStats[] = [];
    const now = new Date();

    for (let i = 0; i < 6; i++) {
      const monthStart = startOfMonth(subMonths(now, i));
      const monthEnd = endOfMonth(subMonths(now, i));
      const label = i === 0 ? "This Month" : format(monthStart, "MMMM yyyy");
      months.push(calculatePeriodStats(monthStart, monthEnd, label));
    }

    return months;
  };

  const calculateChange = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : current < 0 ? -100 : 0;
    return ((current - previous) / Math.abs(previous)) * 100;
  };

  const ChangeIndicator = ({ value, suffix = "%" }: { value: number; suffix?: string }) => {
    if (value === 0) return <span className="text-muted-foreground flex items-center gap-1"><Minus className="h-3 w-3" /> 0{suffix}</span>;
    if (value > 0) return <span className="text-green-500 flex items-center gap-1"><ArrowUp className="h-3 w-3" /> +{value.toFixed(1)}{suffix}</span>;
    return <span className="text-red-500 flex items-center gap-1"><ArrowDown className="h-3 w-3" /> {value.toFixed(1)}{suffix}</span>;
  };

  const PeriodCard = ({ current, previous, showChange = true }: { current: PeriodStats; previous?: PeriodStats; showChange?: boolean }) => {
    const pnlChange = previous ? calculateChange(current.netPnl, previous.netPnl) : 0;
    const winRateChange = previous ? current.winRate - previous.winRate : 0;
    const tradesChange = previous ? calculateChange(current.trades, previous.trades) : 0;
    const avgRChange = previous ? current.avgR - previous.avgR : 0;

    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-lg flex items-center justify-between">
            {current.label}
            <span className="text-sm font-normal text-muted-foreground">
              {format(current.startDate, "MMM d")} - {format(current.endDate, "MMM d")}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Net P&L</p>
              <p className={`text-xl font-bold ${current.netPnl >= 0 ? "text-green-500" : "text-red-500"}`}>
                ${current.netPnl.toFixed(2)}
              </p>
              {showChange && previous && <ChangeIndicator value={pnlChange} />}
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Win Rate</p>
              <p className="text-xl font-bold">{current.winRate.toFixed(1)}%</p>
              {showChange && previous && <ChangeIndicator value={winRateChange} suffix=" pts" />}
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Trades</p>
              <p className="text-xl font-bold">{current.trades}</p>
              {showChange && previous && <ChangeIndicator value={tradesChange} />}
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Avg R</p>
              <p className={`text-xl font-bold ${current.avgR >= 0 ? "text-green-500" : "text-red-500"}`}>
                {current.avgR.toFixed(2)}R
              </p>
              {showChange && previous && <ChangeIndicator value={avgRChange} suffix="R" />}
            </div>
          </div>
          <div className="mt-4 pt-4 border-t grid grid-cols-3 gap-4 text-sm">
            <div>
              <span className="text-muted-foreground">Wins: </span>
              <span className="font-medium text-green-500">{current.wins}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Losses: </span>
              <span className="font-medium text-red-500">{current.losses}</span>
            </div>
            <div>
              <span className="text-muted-foreground">Expectancy: </span>
              <span className={`font-medium ${current.expectancy >= 0 ? "text-green-500" : "text-red-500"}`}>
                ${current.expectancy.toFixed(2)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  const weeklyStats = getWeeklyStats();
  const monthlyStats = getMonthlyStats();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        <div>
          <h1 className="text-3xl font-bold">Performance Summary</h1>
          <p className="text-muted-foreground">
            Track your trading performance over time with week-over-week and month-over-month comparisons.
          </p>
        </div>
        {hasActiveFilters && (
          <Badge variant="secondary" className="h-6">Filtered</Badge>
        )}
      </div>

      <Tabs defaultValue="weekly" className="space-y-4">
        <TabsList>
          <TabsTrigger value="weekly">Weekly</TabsTrigger>
          <TabsTrigger value="monthly">Monthly</TabsTrigger>
        </TabsList>

        <TabsContent value="weekly" className="space-y-4">
          <div className="grid gap-4">
            {weeklyStats.map((week, index) => (
              <PeriodCard
                key={index}
                current={week}
                previous={weeklyStats[index + 1]}
                showChange={index < weeklyStats.length - 1}
              />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="monthly" className="space-y-4">
          <div className="grid gap-4">
            {monthlyStats.map((month, index) => (
              <PeriodCard
                key={index}
                current={month}
                previous={monthlyStats[index + 1]}
                showChange={index < monthlyStats.length - 1}
              />
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PerformanceSummary;
