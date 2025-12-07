import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useTradingCalendar } from "@/features/calendar/useTradingCalendar";
import { TradingCalendar } from "@/features/calendar/TradingCalendar";
import { getTradesByUser } from "@/lib/firestoreService";
import { useQuery } from "@tanstack/react-query";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

export default function TradingCalendarPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const userId = (user as any)?.uid || null;

  // Get current date
  const now = new Date();
  const [currentYear, setCurrentYear] = useState(now.getFullYear());
  const [currentMonth, setCurrentMonth] = useState(now.getMonth());
  const [accountId, setAccountId] = useState<string>("");
  const [symbolFilter, setSymbolFilter] = useState<string>("ALL");

  // Fetch all trades to get distinct symbols and accountIds
  const { data: allTrades } = useQuery({
    queryKey: ["allTrades", userId],
    queryFn: async () => {
      if (!userId) return [];
      return await getTradesByUser(userId);
    },
    enabled: !!userId,
  });

  // Extract distinct symbols and accountIds
  const distinctSymbols = useMemo(() => {
    if (!allTrades) return [];
    const symbols = new Set<string>();
    allTrades.forEach((trade) => {
      if (trade.symbol) {
        symbols.add(trade.symbol);
      }
    });
    return Array.from(symbols).sort();
  }, [allTrades]);

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
  useMemo(() => {
    if (!accountId && distinctAccountIds.length > 0) {
      setAccountId(distinctAccountIds[0]);
    }
  }, [accountId, distinctAccountIds]);

  // Fetch calendar data
  const { data: calendarStats, isLoading, error } = useTradingCalendar({
    userId: userId || "",
    accountId,
    month: currentMonth,
    year: currentYear,
    symbol: symbolFilter,
  });

  // Navigation handlers
  const handlePreviousMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  const handleToday = () => {
    setCurrentYear(now.getFullYear());
    setCurrentMonth(now.getMonth());
  };

  // Calculate winrate
  const winRate =
    calendarStats && calendarStats.totalWins + calendarStats.totalLosses > 0
      ? (calendarStats.totalWins / (calendarStats.totalWins + calendarStats.totalLosses)) * 100
      : 0;

  if (!userId) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className="text-lg text-muted-foreground">Please sign in to view the trading calendar.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Trading Calendar</h1>
          <p className="text-muted-foreground mt-1">View your daily PnL and trading activity</p>
        </div>
      </div>

      {/* Filters */}
      <Card className="border-border/50 shadow-lg bg-slate-800">
        <CardHeader>
          <CardTitle>Filters</CardTitle>
          <CardDescription>Select account and symbol to filter the calendar</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium mb-2 block">Account ID</label>
              <Select value={accountId} onValueChange={setAccountId} disabled={distinctAccountIds.length === 0}>
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

            <div className="flex-1 min-w-[200px]">
              <label className="text-sm font-medium mb-2 block">Symbol</label>
              <Select value={symbolFilter} onValueChange={setSymbolFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL">All symbols</SelectItem>
                  {distinctSymbols.map((symbol) => (
                    <SelectItem key={symbol} value={symbol}>
                      {symbol}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Month Navigation */}
      <Card className="border-border/50 shadow-lg bg-slate-800">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <Button variant="outline" size="icon" onClick={handlePreviousMonth}>
              <ChevronLeft className="h-4 w-4" />
            </Button>

            <div className="flex items-center gap-4">
              <h2 className="text-xl font-semibold">
                {MONTH_NAMES[currentMonth]} {currentYear}
              </h2>
              <Button variant="outline" size="sm" onClick={handleToday}>
                Today
              </Button>
            </div>

            <Button variant="outline" size="icon" onClick={handleNextMonth}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Summary Stats */}
      {calendarStats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card className="border-border/50 shadow-lg bg-slate-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Trades</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{calendarStats.totalTrades}</div>
            </CardContent>
          </Card>

          <Card className="border-border/50 shadow-lg bg-slate-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total PnL</CardTitle>
            </CardHeader>
            <CardContent>
              <div
                className={`text-2xl font-bold ${
                  calendarStats.totalProfit >= 0 ? "text-green-400" : "text-red-400"
                }`}
              >
                {calendarStats.totalProfit >= 0 ? "+" : ""}
                {calendarStats.totalProfit.toFixed(2)}
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50 shadow-lg bg-slate-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Win Rate</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{winRate.toFixed(1)}%</div>
            </CardContent>
          </Card>

          <Card className="border-border/50 shadow-lg bg-slate-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Best Day</CardTitle>
            </CardHeader>
            <CardContent>
              {calendarStats.bestDay ? (
                <div>
                  <div className="text-lg font-bold text-green-400">
                    +{calendarStats.bestDay.profit.toFixed(2)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(calendarStats.bestDay.date).toLocaleDateString()}
                  </div>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">—</div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/50 shadow-lg bg-slate-800">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Worst Day</CardTitle>
            </CardHeader>
            <CardContent>
              {calendarStats.worstDay ? (
                <div>
                  <div className="text-lg font-bold text-red-400">
                    {calendarStats.worstDay.profit.toFixed(2)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {new Date(calendarStats.worstDay.date).toLocaleDateString()}
                  </div>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">—</div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Failed to load calendar data: {error.message}
          </AlertDescription>
        </Alert>
      )}

      {/* Calendar */}
      {!accountId ? (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>Please select an account to view the calendar.</AlertDescription>
        </Alert>
      ) : (
        <TradingCalendar
          year={currentYear}
          month={currentMonth}
          stats={calendarStats}
          isLoading={isLoading}
        />
      )}
    </div>
  );
}

