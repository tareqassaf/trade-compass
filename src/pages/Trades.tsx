import { useState, useEffect, useMemo, useCallback, memo } from "react";
import { useNavigate } from "react-router-dom";
import { Timestamp } from "firebase/firestore";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Plus, TrendingUp, TrendingDown, Star, X, BookOpen, ChevronLeft, ChevronRight } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { getTradesByUser, updateTradeJournalFields } from "@/lib/firestoreService";
import { useToast } from "@/hooks/use-toast";
import { usePaginatedTrades, type TradesFilter } from "@/hooks/usePaginatedTrades";
import { TradesFilterBar } from "@/features/trades/TradesFilterBar";
import { useQuery } from "@tanstack/react-query";
import type { Trade, TradeStatus } from "@/types/trading";
import { usePlaybooks } from "@/hooks/usePlaybooks";

type SortKey = "closeTime" | "pnlCurrency" | "rMultiple";
type SortDirection = "asc" | "desc";

type TradesKpis = {
  netPnl: number;
  winRate: number; // 0–100
  profitFactor: number | null;
  avgR: number | null;
  totalTrades: number;
};

/**
 * Calculate KPIs from trades
 */
function calculateTradesKpis(trades: Trade[]): TradesKpis {
  if (trades.length === 0) {
    return {
      netPnl: 0,
      winRate: 0,
      profitFactor: null,
      avgR: null,
      totalTrades: 0,
    };
  }

  const netPnl = trades.reduce((sum, t) => sum + t.pnlCurrency, 0);
  const totalTrades = trades.length;

  const wins = trades.filter((t) => t.status === "win").length;
  const losses = trades.filter((t) => t.status === "loss").length;
  const breakevens = trades.filter((t) => t.status === "be").length;
  const totalWithResult = wins + losses + breakevens;
  const winRate = totalWithResult > 0 ? (wins / totalWithResult) * 100 : 0;

  // Calculate profit factor
  const grossProfit = trades
    .filter((t) => t.pnlCurrency > 0)
    .reduce((sum, t) => sum + t.pnlCurrency, 0);
  const grossLoss = Math.abs(
    trades.filter((t) => t.pnlCurrency < 0).reduce((sum, t) => sum + t.pnlCurrency, 0)
  );
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? null : null;

  // Calculate average R
  const tradesWithR = trades.filter((t) => t.rMultiple !== null && t.rMultiple !== undefined);
  const avgR =
    tradesWithR.length > 0
      ? tradesWithR.reduce((sum, t) => sum + (t.rMultiple || 0), 0) / tradesWithR.length
      : null;

  return {
    netPnl,
    winRate,
    profitFactor,
    avgR,
    totalTrades,
  };
}

/**
 * Filter trades based on criteria
 */
function filterTrades(
  trades: Trade[],
  filters: {
    symbol: string;
    side: "all" | "buy" | "sell";
    status: "all" | "win" | "loss" | "be";
  }
): Trade[] {
  let filtered = [...trades];

  if (filters.symbol !== "all") {
    filtered = filtered.filter((t) => t.symbol === filters.symbol);
  }

  if (filters.side !== "all") {
    filtered = filtered.filter((t) => t.side === filters.side);
  }

  if (filters.status !== "all") {
    filtered = filtered.filter((t) => t.status === filters.status);
  }

  return filtered;
}

/**
 * Sort trades
 */
function sortTrades(trades: Trade[], sortKey: SortKey, sortDirection: SortDirection): Trade[] {
  const sorted = [...trades];

  sorted.sort((a, b) => {
    let aValue: any;
    let bValue: any;

    switch (sortKey) {
      case "closeTime":
        const aTime = a.closeTime instanceof Timestamp ? a.closeTime.toMillis() : new Date(a.closeTime).getTime();
        const bTime = b.closeTime instanceof Timestamp ? b.closeTime.toMillis() : new Date(b.closeTime).getTime();
        aValue = aTime;
        bValue = bTime;
        break;
      case "pnlCurrency":
        aValue = a.pnlCurrency;
        bValue = b.pnlCurrency;
        break;
      case "rMultiple":
        aValue = a.rMultiple ?? 0;
        bValue = b.rMultiple ?? 0;
        break;
      default:
        return 0;
    }

    if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
    if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
    return 0;
  });

  return sorted;
}

/**
 * Format timestamp to readable date string
 */
function formatCloseTime(closeTime: string | Timestamp): string {
  let date: Date;
  if (closeTime instanceof Timestamp) {
    date = closeTime.toDate();
  } else {
    date = new Date(closeTime);
  }

  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function Trades() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const userId = (user as any)?.uid || null;

  // Filter state
  const [filters, setFilters] = useState<TradesFilter>({
    accountId: null,
    symbols: [],
    side: "all",
    status: "all",
    tag: null,
    dateFrom: null,
    dateTo: null,
  });

  // Memoized filter change handler
  const handleFiltersChange = useCallback((next: TradesFilter) => {
    setFilters(next);
  }, []);

  // Fetch all trades once to get unique symbols and accounts for filter options
  const { data: allTrades } = useQuery({
    queryKey: ["allTradesForFilters", userId],
    queryFn: async () => {
      if (!userId) return [];
      return await getTradesByUser(userId);
    },
    enabled: !!userId,
  });

  // Get unique symbols and accounts for filter options
  const uniqueSymbols = useMemo(() => {
    if (!allTrades) return [];
    const symbols = new Set<string>();
    allTrades.forEach((trade) => {
      if (trade.symbol) {
        symbols.add(trade.symbol);
      }
    });
    return Array.from(symbols).sort();
  }, [allTrades]);

  const accountsOptions = useMemo(() => {
    if (!allTrades) return [];
    const accounts = new Set<string>();
    allTrades.forEach((trade) => {
      if (trade.accountId) {
        accounts.add(trade.accountId);
      }
    });
    return Array.from(accounts).sort().map((id) => ({ id, name: id }));
  }, [allTrades]);

  // Use paginated trades hook
  const {
    trades,
    loading: isLoading,
    error,
    hasNextPage,
    hasPrevPage,
    currentPage,
    nextPage,
    prevPage,
    totalCount,
  } = usePaginatedTrades(userId, filters, { pageSize: 50 });

  // Journal drawer state
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);
  const [journalOpen, setJournalOpen] = useState(false);
  const [journalNotes, setJournalNotes] = useState("");
  const [journalTags, setJournalTags] = useState<string[]>([]);
  const [journalTagInput, setJournalTagInput] = useState("");
  const [journalRating, setJournalRating] = useState<number | null>(null);
  const [journalPlaybookId, setJournalPlaybookId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  // Fetch playbooks for the select
  const { playbooks } = usePlaybooks();

  // Calculate KPIs from current page (or all trades if available)
  const kpis = useMemo(() => calculateTradesKpis(trades), [trades]);

  // Open journal drawer for a trade - memoized
  const handleOpenJournal = useCallback((trade: Trade, e?: React.MouseEvent) => {
    e?.stopPropagation(); // Prevent row click navigation
    setSelectedTrade(trade);
    setJournalNotes(trade.notes || "");
    setJournalTags(trade.tags || []);
    setJournalTagInput("");
    setJournalRating(trade.rating ?? null);
    setJournalPlaybookId(trade.playbookId || null);
    setJournalOpen(true);
  }, []);

  // Close journal drawer - memoized
  const handleCloseJournal = useCallback(() => {
    setJournalOpen(false);
    setSelectedTrade(null);
    setJournalNotes("");
    setJournalTags([]);
    setJournalTagInput("");
    setJournalRating(null);
    setJournalPlaybookId(null);
  }, []);

  // Add tag
  const handleAddTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && journalTagInput.trim()) {
      e.preventDefault();
      const tag = journalTagInput.trim();
      if (!journalTags.includes(tag)) {
        setJournalTags([...journalTags, tag]);
      }
      setJournalTagInput("");
    }
  };

  // Remove tag
  const handleRemoveTag = (tagToRemove: string) => {
    setJournalTags(journalTags.filter((tag) => tag !== tagToRemove));
  };

  // Save journal
  const handleSaveJournal = async () => {
    if (!selectedTrade || !userId) return;

    setIsSaving(true);
    try {
      // Optimistic update
      const updatedTrade: Trade = {
        ...selectedTrade,
        notes: journalNotes,
        tags: journalTags,
        rating: journalRating,
      };

      // Note: Trade updates will be reflected on next page load/refresh
      // For now, we rely on Firestore updates

      // Save to Firestore
      await updateTradeJournalFields(userId, selectedTrade.id, {
        notes: journalNotes,
        tags: journalTags,
        rating: journalRating,
        playbookId: journalPlaybookId,
      });

      toast({
        title: "Journal saved",
        description: "Trade journal updated successfully",
      });

      handleCloseJournal();
    } catch (error) {
      console.error("Error saving journal:", error);
      // Note: Error occurred, but trade state will refresh on next page load
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save journal",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  if (!userId) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className="text-lg text-muted-foreground">Please sign in to view your trades.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Trade Log</h1>
          <p className="text-muted-foreground mt-1">View and manage all your trades</p>
        </div>
        <Button onClick={() => navigate("/trades/new")} className="bg-gradient-primary hover:opacity-90">
          <Plus className="mr-2 h-4 w-4" />
          Add Trade
        </Button>
      </div>

      {/* Error State */}
      {error && (
        <Card className="border-red-500/50 bg-red-500/10">
          <CardContent className="pt-6">
            <p className="text-red-400">Error: {error}</p>
          </CardContent>
        </Card>
      )}

      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card className="border-border/50 shadow-lg bg-slate-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Net PnL</CardTitle>
            <div className={`p-2 rounded-lg ${kpis.netPnl >= 0 ? "bg-green-500" : "bg-red-500"}`}>
              <TrendingUp className="h-4 w-4 text-white" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${kpis.netPnl.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
            <p className="text-xs text-muted-foreground mt-1">{kpis.totalTrades} trades</p>
          </CardContent>
        </Card>

        <Card className="border-border/50 shadow-lg bg-slate-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Win Rate</CardTitle>
            <div className="p-2 rounded-lg bg-blue-500">
              <TrendingUp className="h-4 w-4 text-white" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.winRate.toFixed(1)}%</div>
            <p className="text-xs text-muted-foreground mt-1">Win percentage</p>
          </CardContent>
        </Card>

        <Card className="border-border/50 shadow-lg bg-slate-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Profit Factor</CardTitle>
            <div className="p-2 rounded-lg bg-purple-500">
              <TrendingUp className="h-4 w-4 text-white" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {kpis.profitFactor !== null ? kpis.profitFactor.toFixed(2) : "N/A"}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Gross profit / Gross loss</p>
          </CardContent>
        </Card>

        <Card className="border-border/50 shadow-lg bg-slate-800">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg R</CardTitle>
            <div className="p-2 rounded-lg bg-blue-500">
              <TrendingUp className="h-4 w-4 text-white" />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{kpis.avgR !== null ? kpis.avgR.toFixed(2) : "N/A"}</div>
            <p className="text-xs text-muted-foreground mt-1">Average R-multiple</p>
          </CardContent>
        </Card>
      </div>

      {/* Filter Bar */}
      <TradesFilterBar
        filters={filters}
        onChange={handleFiltersChange}
        symbolsOptions={uniqueSymbols}
        accountsOptions={accountsOptions}
      />

      {/* Trades Table */}
      <Card className="border-border/50 shadow-lg bg-slate-800">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>
            Trades
            {totalCount !== null && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                ({totalCount})
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-red-500 mb-4">Error: {error}</p>
              <Button onClick={() => window.location.reload()} variant="outline">
                Retry
              </Button>
            </div>
          ) : trades.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground mb-4">No trades found</p>
              <Button onClick={() => navigate("/trades/new")} className="bg-gradient-primary hover:opacity-90">
                <Plus className="mr-2 h-4 w-4" />
                Add Your First Trade
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-700">
                      <th className="text-left p-3 text-sm font-semibold text-muted-foreground">Close Time</th>
                    <th className="text-left p-3 text-sm font-semibold text-muted-foreground">Symbol</th>
                    <th className="text-left p-3 text-sm font-semibold text-muted-foreground">Side</th>
                    <th className="text-left p-3 text-sm font-semibold text-muted-foreground">Status</th>
                    <th className="text-left p-3 text-sm font-semibold text-muted-foreground">Entry</th>
                    <th className="text-left p-3 text-sm font-semibold text-muted-foreground">Exit</th>
                    <th className="text-left p-3 text-sm font-semibold text-muted-foreground">Size</th>
                      <th className="text-left p-3 text-sm font-semibold text-muted-foreground">PnL</th>
                      <th className="text-left p-3 text-sm font-semibold text-muted-foreground">R Multiple</th>
                    <th className="text-left p-3 text-sm font-semibold text-muted-foreground">Account</th>
                    <th className="text-left p-3 text-sm font-semibold text-muted-foreground">Playbook</th>
                      <th className="text-left p-3 text-sm font-semibold text-muted-foreground">Journal</th>
                  </tr>
                </thead>
                <tbody>
                    {trades.map((trade, index) => (
                    <tr
                      key={trade.id}
                      className={`border-b border-slate-700/50 hover:bg-slate-700/30 transition-colors cursor-pointer ${
                        index % 2 === 0 ? "bg-slate-800/50" : "bg-slate-800/30"
                      }`}
                        onClick={() => handleOpenJournal(trade)}
                    >
                      <td className="p-3 text-sm">{formatCloseTime(trade.closeTime)}</td>
                      <td className="p-3 text-sm font-medium">{trade.symbol}</td>
                      <td className="p-3">
                        <Badge variant={trade.side === "buy" ? "default" : "secondary"}>
                          {trade.side === "buy" ? (
                            <div className="flex items-center gap-1">
                              <TrendingUp className="h-3 w-3" />
                              Buy
                            </div>
                          ) : (
                            <div className="flex items-center gap-1">
                              <TrendingDown className="h-3 w-3" />
                              Sell
                            </div>
                          )}
                        </Badge>
                      </td>
                      <td className="p-3">
                        <Badge
                          variant={
                            trade.status === "win"
                              ? "default"
                              : trade.status === "loss"
                                ? "destructive"
                                : "secondary"
                          }
                        >
                          {trade.status === "win" ? "Win" : trade.status === "loss" ? "Loss" : "BE"}
                        </Badge>
                      </td>
                      <td className="p-3 text-sm">{trade.entryPrice.toFixed(5)}</td>
                      <td className="p-3 text-sm">{trade.exitPrice.toFixed(5)}</td>
                      <td className="p-3 text-sm">{trade.positionSize.toFixed(2)}</td>
                      <td className={`p-3 text-sm font-semibold ${
                        trade.pnlCurrency > 0
                          ? "text-green-400"
                          : trade.pnlCurrency < 0
                            ? "text-red-400"
                            : "text-muted-foreground"
                      }`}>
                        ${trade.pnlCurrency.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        <div className="text-xs text-muted-foreground mt-0.5">
                          {trade.pnlPoints.toFixed(2)} pts
                        </div>
                      </td>
                      <td className="p-3 text-sm">
                        {trade.rMultiple !== null && trade.rMultiple !== undefined ? (
                          <span className="font-medium">{trade.rMultiple.toFixed(2)}R</span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="p-3 text-sm text-muted-foreground">{trade.accountId || "—"}</td>
                        <td className="p-3 text-sm text-muted-foreground">
                          {trade.playbookId ? (
                            <div className="flex items-center gap-1">
                              <BookOpen className="h-3 w-3" />
                              {trade.playbookId}
                            </div>
                          ) : (
                            "—"
                          )}
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            {/* Tags display */}
                            {trade.tags && trade.tags.length > 0 && (
                              <div className="flex items-center gap-1 flex-wrap">
                                {trade.tags.slice(0, 2).map((tag) => (
                                  <Badge key={tag} variant="outline" className="text-xs">
                                    {tag}
                                  </Badge>
                                ))}
                                {trade.tags.length > 2 && (
                                  <Badge variant="outline" className="text-xs">
                                    +{trade.tags.length - 2}
                                  </Badge>
                                )}
                              </div>
                            )}
                            {/* Rating display */}
                            {trade.rating && (
                              <div className="flex items-center gap-1 text-yellow-400">
                                <Star className="h-3 w-3 fill-current" />
                                <span className="text-xs">{trade.rating}</span>
                              </div>
                            )}
                            {/* Journal button */}
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0"
                              onClick={(e) => handleOpenJournal(trade, e)}
                            >
                              <BookOpen className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>

              {/* Pagination Controls */}
              <div className="flex items-center justify-between pt-4 border-t border-slate-700">
                <div className="text-xs text-muted-foreground">
                  Page {currentPage + 1}
                  {totalCount !== null && totalCount > 0 && (
                    <>
                      {" "}· {currentPage * 50 + 1}–{Math.min((currentPage + 1) * 50, totalCount)} of {totalCount}
                    </>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={prevPage}
                    disabled={!hasPrevPage || isLoading}
                    className="bg-slate-800"
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={nextPage}
                    disabled={!hasNextPage || isLoading}
                    className="bg-slate-800"
                  >
                    Next
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Journal Drawer */}
      <Drawer open={journalOpen} onOpenChange={setJournalOpen}>
        <DrawerContent className="max-h-[90vh]">
          {selectedTrade && (
            <>
              <DrawerHeader>
                <DrawerTitle>Trade Journal</DrawerTitle>
                <DrawerDescription>
                  {selectedTrade.symbol} • {selectedTrade.side === "buy" ? "Buy" : "Sell"} •{" "}
                  <span
                    className={
                      selectedTrade.pnlCurrency >= 0 ? "text-green-400" : "text-red-400"
                    }
                  >
                    {selectedTrade.pnlCurrency >= 0 ? "+" : ""}
                    ${selectedTrade.pnlCurrency.toFixed(2)}
                  </span>{" "}
                  • {formatCloseTime(selectedTrade.closeTime)}
                </DrawerDescription>
              </DrawerHeader>

              <div className="px-4 pb-4 space-y-6 overflow-y-auto">
                {/* Notes */}
                <div className="space-y-2">
                  <Label htmlFor="notes">Notes / Journal</Label>
                  <Textarea
                    id="notes"
                    value={journalNotes}
                    onChange={(e) => setJournalNotes(e.target.value)}
                    placeholder="Add your trade notes, observations, emotions, mistakes, or lessons learned..."
                    className="min-h-[120px]"
                  />
                </div>

                {/* Tags */}
                <div className="space-y-2">
                  <Label htmlFor="tags">Tags</Label>
                  <Input
                    id="tags"
                    value={journalTagInput}
                    onChange={(e) => setJournalTagInput(e.target.value)}
                    onKeyDown={handleAddTag}
                    placeholder="Type a tag and press Enter"
                  />
                  {journalTags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-2">
                      {journalTags.map((tag) => (
                        <Badge key={tag} variant="secondary" className="flex items-center gap-1">
                          {tag}
                          <button
                            type="button"
                            onClick={() => handleRemoveTag(tag)}
                            className="ml-1 hover:text-destructive"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>

                {/* Rating */}
                <div className="space-y-2">
                  <Label>Rating</Label>
                  <div className="flex items-center gap-2">
                    {[1, 2, 3, 4, 5].map((rating) => (
                      <button
                        key={rating}
                        type="button"
                        onClick={() => setJournalRating(journalRating === rating ? null : rating)}
                        className="focus:outline-none"
                      >
                        <Star
                          className={`h-6 w-6 transition-colors ${
                            journalRating && journalRating >= rating
                              ? "fill-yellow-400 text-yellow-400"
                              : "text-muted-foreground hover:text-yellow-400"
                          }`}
                        />
                      </button>
                    ))}
                    {journalRating && (
                      <span className="text-sm text-muted-foreground ml-2">
                        {journalRating} / 5
                      </span>
                    )}
                  </div>
                </div>

                {/* Playbook */}
                <div className="space-y-2">
                  <Label htmlFor="playbook">Playbook</Label>
                  <Select
                    value={journalPlaybookId || ""}
                    onValueChange={(value) => setJournalPlaybookId(value || null)}
                  >
                    <SelectTrigger id="playbook" className="bg-slate-800">
                      <SelectValue placeholder="Select a playbook" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">No playbook</SelectItem>
                      {playbooks
                        .filter((pb) => !pb.isArchived)
                        .map((playbook) => (
                          <SelectItem key={playbook.id} value={playbook.id}>
                            {playbook.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <DrawerFooter>
                <div className="flex gap-2">
                  <DrawerClose asChild>
                    <Button variant="outline" onClick={handleCloseJournal} disabled={isSaving}>
                      Cancel
                    </Button>
                  </DrawerClose>
                  <Button onClick={handleSaveJournal} disabled={isSaving}>
                    {isSaving ? "Saving..." : "Save"}
                  </Button>
                </div>
              </DrawerFooter>
            </>
          )}
        </DrawerContent>
      </Drawer>
    </div>
  );
}
