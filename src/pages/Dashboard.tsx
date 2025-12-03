import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Target, DollarSign, Trophy, Activity, Scale, Gauge } from "lucide-react";
import { Bar, BarChart, CartesianGrid, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";

export default function Dashboard() {
  const { data: stats, isLoading } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const { data: trades, error } = await supabase
        .from("trades")
        .select("*")
        .neq("result", "open");

      if (error) throw error;

      const closedTrades = trades || [];
      const winningTrades = closedTrades.filter(t => t.result === "win");
      const losingTrades = closedTrades.filter(t => t.result === "loss");

      const totalPnl = closedTrades.reduce((sum, t) => sum + (t.pnl_amount || 0), 0);
      const winRate = closedTrades.length > 0 ? (winningTrades.length / closedTrades.length) * 100 : 0;
      
      const totalR = closedTrades.reduce((sum, t) => sum + (t.r_multiple || 0), 0);
      const avgR = closedTrades.length > 0 ? totalR / closedTrades.length : 0;

      const avgWin = winningTrades.length > 0 
        ? winningTrades.reduce((sum, t) => sum + (t.pnl_amount || 0), 0) / winningTrades.length 
        : 0;
      
      const avgLoss = losingTrades.length > 0
        ? losingTrades.reduce((sum, t) => sum + (t.pnl_amount || 0), 0) / losingTrades.length
        : 0;

      const expectancy = closedTrades.length > 0
        ? (winRate / 100) * avgWin + (1 - winRate / 100) * avgLoss
        : 0;

      // Profit Factor = Gross Profit / |Gross Loss|
      const grossProfit = winningTrades.reduce((sum, t) => sum + (t.pnl_amount || 0), 0);
      const grossLoss = Math.abs(losingTrades.reduce((sum, t) => sum + (t.pnl_amount || 0), 0));
      const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;

      // Sharpe Ratio = Mean Return / Std Dev of Returns (simplified, assuming 0 risk-free rate)
      const returns = closedTrades.map(t => t.pnl_amount || 0);
      const meanReturn = returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
      const variance = returns.length > 1 
        ? returns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) / (returns.length - 1)
        : 0;
      const stdDev = Math.sqrt(variance);
      const sharpeRatio = stdDev > 0 ? meanReturn / stdDev : 0;

      return {
        totalTrades: closedTrades.length,
        totalPnl,
        winRate,
        avgR,
        expectancy,
        avgWin,
        avgLoss,
        profitFactor,
        sharpeRatio,
      };
    },
  });

  const { data: equityCurve } = useQuery({
    queryKey: ["equity-curve"],
    queryFn: async () => {
      const { data: trades, error } = await supabase
        .from("trades")
        .select("trading_day, pnl_amount, closed_at")
        .not("exit_price", "is", null)
        .order("closed_at", { ascending: true });

      if (error) throw error;

      if (!trades || trades.length === 0) return [];

      // Group by trading day and calculate daily P&L
      const dailyPnl = trades.reduce((acc, trade) => {
        const day = trade.trading_day;
        if (!acc[day]) {
          acc[day] = { date: day, dailyPnl: 0, trades: 0 };
        }
        acc[day].dailyPnl += trade.pnl_amount || 0;
        acc[day].trades += 1;
        return acc;
      }, {} as Record<string, { date: string; dailyPnl: number; trades: number }>);

      // Convert to array and sort by date
      const sortedDays = Object.values(dailyPnl).sort((a, b) => 
        new Date(a.date).getTime() - new Date(b.date).getTime()
      );

      // Calculate cumulative P&L
      let cumulative = 0;
      return sortedDays.map(day => {
        cumulative += day.dailyPnl;
        return {
          date: new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          fullDate: day.date,
          cumulativePnl: cumulative,
          dailyPnl: day.dailyPnl,
          trades: day.trades,
          isWinningDay: day.dailyPnl > 0,
        };
      });
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const kpiCards = [
    {
      title: "Net P&L",
      value: `$${(stats?.totalPnl || 0).toFixed(2)}`,
      icon: DollarSign,
      gradient: (stats?.totalPnl || 0) >= 0 ? "bg-gradient-success" : "bg-gradient-danger",
      trend: (stats?.totalPnl || 0) >= 0 ? "up" : "down",
    },
    {
      title: "Win Rate",
      value: `${(stats?.winRate || 0).toFixed(1)}%`,
      icon: Trophy,
      gradient: "bg-gradient-primary",
    },
    {
      title: "Average R",
      value: (stats?.avgR || 0).toFixed(2),
      icon: Target,
      gradient: "bg-gradient-primary",
    },
    {
      title: "Expectancy",
      value: `$${(stats?.expectancy || 0).toFixed(2)}`,
      icon: Activity,
      gradient: (stats?.expectancy || 0) >= 0 ? "bg-gradient-success" : "bg-gradient-danger",
    },
    {
      title: "Total Trades",
      value: stats?.totalTrades || 0,
      icon: TrendingUp,
      gradient: "bg-gradient-primary",
    },
    {
      title: "Avg Win / Loss",
      value: `$${(stats?.avgWin || 0).toFixed(0)} / $${Math.abs(stats?.avgLoss || 0).toFixed(0)}`,
      icon: Activity,
      gradient: "bg-gradient-primary",
    },
    {
      title: "Profit Factor",
      value: stats?.profitFactor === Infinity ? "∞" : (stats?.profitFactor || 0).toFixed(2),
      icon: Scale,
      gradient: (stats?.profitFactor || 0) >= 1 ? "bg-gradient-success" : "bg-gradient-danger",
    },
    {
      title: "Sharpe Ratio",
      value: (stats?.sharpeRatio || 0).toFixed(2),
      icon: Gauge,
      gradient: (stats?.sharpeRatio || 0) >= 0 ? "bg-gradient-success" : "bg-gradient-danger",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          Welcome back! Here's your trading performance overview.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {kpiCards.map((card) => (
          <Card key={card.title} className="border-border/50 shadow-card bg-gradient-card">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {card.title}
              </CardTitle>
              <div className={`p-2 rounded-lg ${card.gradient}`}>
                <card.icon className="h-4 w-4 text-white" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{card.value}</div>
              {card.trend && (
                <div className={`flex items-center text-xs mt-1 ${
                  card.trend === "up" ? "text-success" : "text-destructive"
                }`}>
                  {card.trend === "up" ? (
                    <TrendingUp className="h-3 w-3 mr-1" />
                  ) : (
                    <TrendingDown className="h-3 w-3 mr-1" />
                  )}
                  {card.trend === "up" ? "Positive" : "Negative"}
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-border/50 shadow-card bg-gradient-card">
        <CardHeader>
          <CardTitle>Equity Curve</CardTitle>
          <CardDescription>
            Cumulative P&L over time with daily breakdown
          </CardDescription>
        </CardHeader>
        <CardContent>
          {equityCurve && equityCurve.length > 0 ? (
            <ResponsiveContainer width="100%" height={350}>
              <BarChart data={equityCurve}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis 
                  dataKey="date" 
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                />
                <YAxis 
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={12}
                  tickFormatter={(value) => `$${value.toFixed(0)}`}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const data = payload[0].payload;
                      const dayStatus = data.dailyPnl > 0 ? "Winning Day" : data.dailyPnl < 0 ? "Losing Day" : "Breakeven Day";
                      const statusColor = data.dailyPnl > 0 ? "bg-success/20 text-success" : data.dailyPnl < 0 ? "bg-destructive/20 text-destructive" : "bg-muted/50 text-muted-foreground";
                      return (
                        <div className="bg-card border border-border rounded-lg p-3 shadow-lg">
                          <p className="font-semibold text-sm mb-2">{data.fullDate}</p>
                          <div className="space-y-1 text-xs">
                            <div className="flex items-center justify-between gap-4">
                              <span className="text-muted-foreground">Daily P&L:</span>
                              <span className={`font-bold ${data.dailyPnl > 0 ? "text-success" : data.dailyPnl < 0 ? "text-destructive" : "text-muted-foreground"}`}>
                                ${data.dailyPnl.toFixed(2)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-4">
                              <span className="text-muted-foreground">Cumulative:</span>
                              <span className={`font-bold ${data.cumulativePnl >= 0 ? "text-success" : "text-destructive"}`}>
                                ${data.cumulativePnl.toFixed(2)}
                              </span>
                            </div>
                            <div className="flex items-center justify-between gap-4">
                              <span className="text-muted-foreground">Trades:</span>
                              <span className="font-semibold">{data.trades}</span>
                            </div>
                            <div className="mt-2 pt-2 border-t border-border">
                              <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-semibold ${statusColor}`}>
                                {dayStatus}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar dataKey="cumulativePnl" radius={[4, 4, 0, 0]}>
                  {equityCurve.map((entry, index) => {
                    let fillColor = "hsl(var(--muted))"; // Grey for breakeven
                    let opacity = 1;
                    
                    if (entry.dailyPnl > 0) {
                      fillColor = "hsl(var(--success))"; // Green for wins
                    } else if (entry.dailyPnl < 0) {
                      fillColor = "hsl(var(--destructive))"; // Red for losses
                    }
                    
                    if (entry.trades === 0) {
                      opacity = 0.2; // Transparent for no trades
                    }
                    
                    return (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={fillColor}
                        fillOpacity={opacity}
                      />
                    );
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex flex-col items-center justify-center h-[350px] text-center">
              <Activity className="h-12 w-12 text-muted-foreground/50 mb-4" />
              <p className="text-muted-foreground mb-2">No closed trades yet</p>
              <p className="text-sm text-muted-foreground/70">
                Start logging your trades to see your equity curve
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
