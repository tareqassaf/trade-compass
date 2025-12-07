import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { TradingCalendarStats } from "./useTradingCalendar";

interface TradingCalendarProps {
  year: number;
  month: number; // 0-11
  stats: TradingCalendarStats | null;
  isLoading: boolean;
}

/**
 * Get the number of days in a month
 */
function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

/**
 * Get the day of week for the first day of the month (0 = Sunday, 1 = Monday, etc.)
 */
function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay();
}

/**
 * Get color class based on profit
 */
function getProfitColorClass(profit: number, hasTrades: boolean): string {
  if (!hasTrades) {
    return "bg-slate-800 border-slate-700";
  }

  if (profit > 0) {
    // Green variants - stronger for higher profit
    const absProfit = Math.abs(profit);
    if (absProfit >= 500) {
      return "bg-green-600 border-green-500";
    } else if (absProfit >= 200) {
      return "bg-green-500 border-green-400";
    } else if (absProfit >= 50) {
      return "bg-green-400 border-green-300";
    } else {
      return "bg-green-300 border-green-200";
    }
  } else if (profit < 0) {
    // Red variants - stronger for lower profit
    const absProfit = Math.abs(profit);
    if (absProfit >= 500) {
      return "bg-red-600 border-red-500";
    } else if (absProfit >= 200) {
      return "bg-red-500 border-red-400";
    } else if (absProfit >= 50) {
      return "bg-red-400 border-red-300";
    } else {
      return "bg-red-300 border-red-200";
    }
  } else {
    // Breakeven
    return "bg-yellow-300 border-yellow-200";
  }
}

interface CalendarCell {
  day: number | null; // null for empty cells
  dateKey: string | null;
  dayStats: {
    profit: number;
    tradesCount: number;
    winCount: number;
    lossCount: number;
  } | null;
}

export function TradingCalendar({ year, month, stats, isLoading }: TradingCalendarProps) {
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  
  // Convert Sunday (0) to be last, Monday (1) to be first
  const firstDayAdjusted = firstDay === 0 ? 6 : firstDay - 1;

  // Build calendar cells
  const cells: CalendarCell[] = [];
  
  // Add empty cells for days before the first day of the month
  for (let i = 0; i < firstDayAdjusted; i++) {
    cells.push({ day: null, dateKey: null, dayStats: null });
  }

  // Add cells for each day of the month
  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(year, month, day);
    const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    
    // Find stats for this day
    const dayStats = stats?.days.find((d) => d.dateKey === dateKey) || null;
    
    cells.push({
      day,
      dateKey,
      dayStats: dayStats
        ? {
            profit: dayStats.profit,
            tradesCount: dayStats.tradesCount,
            winCount: dayStats.winCount,
            lossCount: dayStats.lossCount,
          }
        : null,
    });
  }

  // Fill remaining cells to complete the grid (6 rows = 42 cells)
  const totalCells = 42;
  while (cells.length < totalCells) {
    cells.push({ day: null, dateKey: null, dayStats: null });
  }

  const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

  if (isLoading) {
    return (
      <Card className="border-border/50 shadow-lg bg-slate-800">
        <CardContent className="p-6">
          <div className="grid grid-cols-7 gap-2">
            {weekdays.map((day) => (
              <div key={day} className="text-center text-sm font-semibold text-muted-foreground py-2">
                {day}
              </div>
            ))}
            {Array.from({ length: 42 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50 shadow-lg bg-slate-800">
      <CardContent className="p-6">
        <div className="grid grid-cols-7 gap-2">
          {/* Weekday headers */}
          {weekdays.map((day) => (
            <div key={day} className="text-center text-sm font-semibold text-muted-foreground py-2">
              {day}
            </div>
          ))}

          {/* Calendar cells */}
          {cells.map((cell, index) => {
            if (cell.day === null) {
              return <div key={index} className="h-20" />;
            }

            const hasTrades = cell.dayStats !== null;
            const profit = cell.dayStats?.profit ?? 0;
            const tradesCount = cell.dayStats?.tradesCount ?? 0;
            const colorClass = getProfitColorClass(profit, hasTrades);

            return (
              <div
                key={cell.dateKey}
                className={`h-20 border rounded-lg p-2 flex flex-col justify-between ${colorClass} ${
                  hasTrades ? "cursor-pointer hover:opacity-80 transition-opacity" : ""
                }`}
              >
                <div className={`text-sm font-semibold ${hasTrades ? "text-white" : "text-slate-400"}`}>
                  {cell.day}
                </div>
                {hasTrades && (
                  <div className="text-xs space-y-0.5">
                    <div className="font-medium text-white drop-shadow-sm">
                      {profit >= 0 ? "+" : ""}
                      {profit.toFixed(2)}
                    </div>
                    <div className="text-white/80">
                      {tradesCount} trade{tradesCount !== 1 ? "s" : ""}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

