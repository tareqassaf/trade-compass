import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, getDay } from "date-fns";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

interface DailyStats {
  date: string;
  pnl: number;
  trades: number;
  wins: number;
  losses: number;
}

export default function TradeCalendar() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);

  const { data: dailyStats, isLoading } = useQuery({
    queryKey: ["daily-stats", user?.id, format(monthStart, "yyyy-MM")],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trades")
        .select("trading_day, pnl_amount, result")
        .eq("user_id", user!.id)
        .gte("trading_day", format(monthStart, "yyyy-MM-dd"))
        .lte("trading_day", format(monthEnd, "yyyy-MM-dd"));

      if (error) throw error;

      // Aggregate by day
      const statsMap = new Map<string, DailyStats>();
      
      data?.forEach((trade) => {
        const dateKey = trade.trading_day;
        const existing = statsMap.get(dateKey) || {
          date: dateKey,
          pnl: 0,
          trades: 0,
          wins: 0,
          losses: 0,
        };
        
        existing.pnl += trade.pnl_amount || 0;
        existing.trades += 1;
        if (trade.result === "win") existing.wins += 1;
        if (trade.result === "loss") existing.losses += 1;
        
        statsMap.set(dateKey, existing);
      });

      return statsMap;
    },
    enabled: !!user,
  });

  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startDayOfWeek = getDay(monthStart);
  
  // Calculate monthly totals
  const monthlyTotals = {
    pnl: 0,
    trades: 0,
    wins: 0,
    losses: 0,
    profitDays: 0,
    lossDays: 0,
  };

  dailyStats?.forEach((stats) => {
    monthlyTotals.pnl += stats.pnl;
    monthlyTotals.trades += stats.trades;
    monthlyTotals.wins += stats.wins;
    monthlyTotals.losses += stats.losses;
    if (stats.pnl > 0) monthlyTotals.profitDays += 1;
    if (stats.pnl < 0) monthlyTotals.lossDays += 1;
  });

  const handleDayClick = (date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    const stats = dailyStats?.get(dateStr);
    if (stats && stats.trades > 0) {
      navigate(`/trades?date=${dateStr}`);
    }
  };

  const getDayClass = (date: Date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    const stats = dailyStats?.get(dateStr);
    
    if (!stats || stats.trades === 0) return "";
    
    if (stats.pnl > 0) return "bg-emerald-500/20 hover:bg-emerald-500/30 border-emerald-500/50";
    if (stats.pnl < 0) return "bg-red-500/20 hover:bg-red-500/30 border-red-500/50";
    return "bg-muted hover:bg-muted/80 border-muted-foreground/30";
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Trade Calendar</h1>
        <p className="text-muted-foreground">
          View your daily trading performance at a glance
        </p>
      </div>

      {/* Monthly Summary */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Monthly P&L</CardDescription>
            <CardTitle className={cn(
              "text-2xl",
              monthlyTotals.pnl > 0 ? "text-emerald-500" : monthlyTotals.pnl < 0 ? "text-red-500" : ""
            )}>
              {monthlyTotals.pnl >= 0 ? "+" : ""}${monthlyTotals.pnl.toFixed(2)}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Trades</CardDescription>
            <CardTitle className="text-2xl">{monthlyTotals.trades}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Win Rate</CardDescription>
            <CardTitle className="text-2xl">
              {monthlyTotals.trades > 0 
                ? ((monthlyTotals.wins / monthlyTotals.trades) * 100).toFixed(1) 
                : 0}%
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Profit Days / Loss Days</CardDescription>
            <CardTitle className="text-2xl">
              <span className="text-emerald-500">{monthlyTotals.profitDays}</span>
              {" / "}
              <span className="text-red-500">{monthlyTotals.lossDays}</span>
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Calendar */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>{format(currentMonth, "MMMM yyyy")}</CardTitle>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                onClick={() => setCurrentMonth(new Date())}
              >
                Today
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center h-96">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <div className="grid grid-cols-7 gap-2">
              {/* Day headers */}
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                <div
                  key={day}
                  className="text-center text-sm font-medium text-muted-foreground py-2"
                >
                  {day}
                </div>
              ))}
              
              {/* Empty cells for days before month starts */}
              {Array.from({ length: startDayOfWeek }).map((_, i) => (
                <div key={`empty-${i}`} className="aspect-square" />
              ))}
              
              {/* Calendar days */}
              {days.map((day) => {
                const dateStr = format(day, "yyyy-MM-dd");
                const stats = dailyStats?.get(dateStr);
                const hasTrades = stats && stats.trades > 0;
                const isToday = isSameDay(day, new Date());
                
                return (
                  <button
                    key={dateStr}
                    onClick={() => handleDayClick(day)}
                    disabled={!hasTrades}
                    className={cn(
                      "aspect-square p-1 rounded-lg border border-transparent transition-all flex flex-col items-center justify-start",
                      getDayClass(day),
                      isToday && "ring-2 ring-primary ring-offset-2 ring-offset-background",
                      hasTrades && "cursor-pointer",
                      !hasTrades && "opacity-50 cursor-default"
                    )}
                  >
                    <span className={cn(
                      "text-sm font-medium",
                      !isSameMonth(day, currentMonth) && "text-muted-foreground"
                    )}>
                      {format(day, "d")}
                    </span>
                    
                    {hasTrades && (
                      <div className="flex flex-col items-center mt-1 w-full">
                        <div className={cn(
                          "text-xs font-semibold",
                          stats.pnl > 0 ? "text-emerald-500" : stats.pnl < 0 ? "text-red-500" : "text-muted-foreground"
                        )}>
                          {stats.pnl >= 0 ? "+" : ""}${stats.pnl.toFixed(0)}
                        </div>
                        <div className="flex items-center gap-0.5 mt-0.5">
                          {stats.pnl > 0 && <TrendingUp className="h-3 w-3 text-emerald-500" />}
                          {stats.pnl < 0 && <TrendingDown className="h-3 w-3 text-red-500" />}
                          {stats.pnl === 0 && <Minus className="h-3 w-3 text-muted-foreground" />}
                          <span className="text-[10px] text-muted-foreground">
                            {stats.trades}t
                          </span>
                        </div>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Legend */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-6 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-emerald-500/20 border border-emerald-500/50" />
              <span className="text-muted-foreground">Profitable Day</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-red-500/20 border border-red-500/50" />
              <span className="text-muted-foreground">Loss Day</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-muted border border-muted-foreground/30" />
              <span className="text-muted-foreground">Breakeven Day</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded ring-2 ring-primary ring-offset-2 ring-offset-background" />
              <span className="text-muted-foreground">Today</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
