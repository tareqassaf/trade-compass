import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";

interface PerformanceMetrics {
  name: string;
  trades: number;
  wins: number;
  losses: number;
  winRate: number;
  avgR: number;
  netPnL: number;
  expectancy: number;
  profitFactor: number;
  sharpeRatio: number;
}

export default function Reports() {
  const { data: trades, isLoading } = useQuery({
    queryKey: ["trades-reports"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trades")
        .select(`
          *,
          instruments (symbol, name),
          strategies (name),
          sessions (name)
        `)
        .order("trading_day", { ascending: true });

      if (error) throw error;
      return data;
    },
  });

  const calculateMetrics = (group: Array<any & { groupKey: string }>): PerformanceMetrics[] => {
    const grouped = group.reduce((acc, trade) => {
      const key = trade.groupKey;
      if (!acc[key]) {
        acc[key] = [];
      }
      acc[key].push(trade);
      return acc;
    }, {} as Record<string, any[]>);

    return Object.entries(grouped).map(([name, items]: [string, any[]]) => {
      const closedTrades = items.filter(t => t.result !== "open");
      const winningTrades = closedTrades.filter(t => t.result === "win");
      const losingTrades = closedTrades.filter(t => t.result === "loss");
      const wins = winningTrades.length;
      const losses = losingTrades.length;
      const totalTrades = closedTrades.length;
      const winRate = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;
      
      const totalR = closedTrades.reduce((sum, t) => sum + (t.r_multiple || 0), 0);
      const avgR = totalTrades > 0 ? totalR / totalTrades : 0;
      
      const netPnL = closedTrades.reduce((sum, t) => sum + (t.pnl_amount || 0), 0);
      const expectancy = totalTrades > 0 ? netPnL / totalTrades : 0;

      // Profit Factor
      const grossProfit = winningTrades.reduce((sum, t) => sum + (t.pnl_amount || 0), 0);
      const grossLoss = Math.abs(losingTrades.reduce((sum, t) => sum + (t.pnl_amount || 0), 0));
      const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? Infinity : 0;

      // Sharpe Ratio
      const returns = closedTrades.map(t => t.pnl_amount || 0);
      const meanReturn = returns.length > 0 ? returns.reduce((a, b) => a + b, 0) / returns.length : 0;
      const variance = returns.length > 1 
        ? returns.reduce((sum, r) => sum + Math.pow(r - meanReturn, 2), 0) / (returns.length - 1)
        : 0;
      const stdDev = Math.sqrt(variance);
      const sharpeRatio = stdDev > 0 ? meanReturn / stdDev : 0;

      return {
        name,
        trades: totalTrades,
        wins,
        losses,
        winRate,
        avgR,
        netPnL,
        expectancy,
        profitFactor,
        sharpeRatio,
      };
    }).sort((a, b) => b.netPnL - a.netPnL);
  };

  const byInstrument = trades?.map(t => ({
    ...t,
    groupKey: t.instruments?.symbol || "Unknown"
  })) || [];

  const byStrategy = trades?.map(t => ({
    ...t,
    groupKey: t.strategies?.name || "No Strategy"
  })) || [];

  const bySession = trades?.map(t => ({
    ...t,
    groupKey: t.sessions?.name || "No Session"
  })) || [];

  const byDayOfWeek = trades?.map(t => {
    const date = new Date(t.trading_day);
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    return {
      ...t,
      groupKey: days[date.getDay()]
    };
  }) || [];

  const instrumentMetrics = calculateMetrics(byInstrument);
  const strategyMetrics = calculateMetrics(byStrategy);
  const sessionMetrics = calculateMetrics(bySession);
  const dayOfWeekMetrics = calculateMetrics(byDayOfWeek);

  const renderTable = (metrics: PerformanceMetrics[]) => (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Name</TableHead>
          <TableHead className="text-right">Trades</TableHead>
          <TableHead className="text-right">Win Rate</TableHead>
          <TableHead className="text-right">Avg R</TableHead>
          <TableHead className="text-right">Net P&L</TableHead>
          <TableHead className="text-right">Profit Factor</TableHead>
          <TableHead className="text-right">Sharpe</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {metrics.length === 0 ? (
          <TableRow>
            <TableCell colSpan={7} className="text-center text-muted-foreground">
              No data available
            </TableCell>
          </TableRow>
        ) : (
          metrics.map((metric) => (
            <TableRow key={metric.name}>
              <TableCell className="font-medium">{metric.name}</TableCell>
              <TableCell className="text-right">{metric.trades}</TableCell>
              <TableCell className="text-right">
                {metric.winRate.toFixed(1)}%
              </TableCell>
              <TableCell className="text-right">
                <span className={metric.avgR >= 0 ? "text-success" : "text-destructive"}>
                  {metric.avgR.toFixed(2)}R
                </span>
              </TableCell>
              <TableCell className="text-right">
                <span className={metric.netPnL >= 0 ? "text-success" : "text-destructive"}>
                  ${metric.netPnL.toFixed(2)}
                </span>
              </TableCell>
              <TableCell className="text-right">
                <span className={metric.profitFactor >= 1 ? "text-success" : "text-destructive"}>
                  {metric.profitFactor === Infinity ? "∞" : metric.profitFactor.toFixed(2)}
                </span>
              </TableCell>
              <TableCell className="text-right">
                <span className={metric.sharpeRatio >= 0 ? "text-success" : "text-destructive"}>
                  {metric.sharpeRatio.toFixed(2)}
                </span>
              </TableCell>
            </TableRow>
          ))
        )}
      </TableBody>
    </Table>
  );

  const renderChart = (metrics: PerformanceMetrics[]) => (
    <ChartContainer
      config={{
        netPnL: {
          label: "Net P&L",
          color: "hsl(var(--chart-1))",
        },
      }}
      className="h-[300px] w-full mt-6"
    >
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={metrics}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis 
            dataKey="name" 
            className="text-xs"
            tick={{ fill: "hsl(var(--muted-foreground))" }}
          />
          <YAxis 
            className="text-xs"
            tick={{ fill: "hsl(var(--muted-foreground))" }}
          />
          <ChartTooltip content={<ChartTooltipContent />} />
          <Bar dataKey="netPnL" radius={[4, 4, 0, 0]}>
            {metrics.map((entry, index) => (
              <Cell 
                key={`cell-${index}`}
                fill={entry.netPnL >= 0 ? "hsl(var(--success))" : "hsl(var(--destructive))"}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartContainer>
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading reports...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Reports</h1>
        <p className="text-muted-foreground mt-1">
          Advanced analytics and performance breakdown
        </p>
      </div>

      <Tabs defaultValue="instrument" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="instrument">By Instrument</TabsTrigger>
          <TabsTrigger value="strategy">By Strategy</TabsTrigger>
          <TabsTrigger value="session">By Session</TabsTrigger>
          <TabsTrigger value="dayofweek">By Day of Week</TabsTrigger>
        </TabsList>

        <TabsContent value="instrument" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Performance by Instrument</CardTitle>
            </CardHeader>
            <CardContent>
              {renderTable(instrumentMetrics)}
              {renderChart(instrumentMetrics)}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="strategy" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Performance by Strategy</CardTitle>
            </CardHeader>
            <CardContent>
              {renderTable(strategyMetrics)}
              {renderChart(strategyMetrics)}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="session" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Performance by Session</CardTitle>
            </CardHeader>
            <CardContent>
              {renderTable(sessionMetrics)}
              {renderChart(sessionMetrics)}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="dayofweek" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Performance by Day of Week</CardTitle>
            </CardHeader>
            <CardContent>
              {renderTable(dayOfWeekMetrics)}
              {renderChart(dayOfWeekMetrics)}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
