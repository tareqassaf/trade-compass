import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Target, DollarSign, Trophy, Activity } from "lucide-react";

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

      return {
        totalTrades: closedTrades.length,
        totalPnl,
        winRate,
        avgR,
        expectancy,
        avgWin,
        avgLoss,
      };
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
          <CardTitle>Getting Started</CardTitle>
          <CardDescription>
            Your trading journal is ready. Start by adding your first trade or importing your data.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col gap-2">
            <p className="text-sm text-muted-foreground">
              📊 <strong>Track every trade</strong> with detailed entry/exit data, risk metrics, and performance analysis
            </p>
            <p className="text-sm text-muted-foreground">
              📈 <strong>Analyze R-multiples</strong> to understand your edge and improve expectancy
            </p>
            <p className="text-sm text-muted-foreground">
              🎯 <strong>Build strategies</strong> and track which setups work best for you
            </p>
            <p className="text-sm text-muted-foreground">
              💡 <strong>Journal your thoughts</strong> to develop discipline and identify patterns
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
