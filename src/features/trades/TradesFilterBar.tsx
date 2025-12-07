import * as React from "react";
import { memo, useMemo, useCallback } from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import type { TradesFilter } from "@/hooks/usePaginatedTrades";

export type TradesFilterBarProps = {
  filters: TradesFilter;
  onChange: (next: TradesFilter) => void;
  symbolsOptions: string[];
  accountsOptions: { id: string; name: string }[];
};

export const TradesFilterBar = memo(function TradesFilterBar({
  filters,
  onChange,
  symbolsOptions,
  accountsOptions,
}: TradesFilterBarProps) {
  const handleAccountChange = useCallback((value: string) => {
    onChange({
      ...filters,
      accountId: value === "all" ? null : value,
    });
  }, [filters, onChange]);

  const handleSymbolChange = useCallback((value: string) => {
    onChange({
      ...filters,
      symbols: value === "all" ? [] : [value],
    });
  }, [filters, onChange]);

  const handleSideChange = useCallback((value: string) => {
    onChange({
      ...filters,
      side: value === "all" ? "all" : (value as "buy" | "sell"),
    });
  }, [filters, onChange]);

  const handleStatusChange = useCallback((value: string) => {
    onChange({
      ...filters,
      status: value === "all" ? "all" : (value as "win" | "loss" | "be"),
    });
  }, [filters, onChange]);

  const handleTagChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({
      ...filters,
      tag: e.target.value || null,
    });
  }, [filters, onChange]);

  const handleDateFromChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({
      ...filters,
      dateFrom: e.target.value ? new Date(e.target.value) : null,
    });
  }, [filters, onChange]);

  const handleDateToChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    onChange({
      ...filters,
      dateTo: e.target.value ? new Date(e.target.value) : null,
    });
  }, [filters, onChange]);

  const handleReset = useCallback(() => {
    onChange({
      accountId: null,
      symbols: [],
      side: "all",
      status: "all",
      tag: null,
      dateFrom: null,
      dateTo: null,
    });
  }, [onChange]);

  const hasActiveFilters = useMemo(() =>
    filters.accountId ||
    (filters.symbols && filters.symbols.length > 0) ||
    filters.side !== "all" ||
    filters.status !== "all" ||
    filters.tag ||
    filters.dateFrom ||
    filters.dateTo,
    [filters]
  );

  return (
    <div className="space-y-3 p-4 bg-slate-900 rounded-lg border border-slate-800">
      <div className="flex items-center justify-between">
        <Label className="text-sm font-semibold text-white">Filters</Label>
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleReset}
            className="h-7 text-xs text-muted-foreground hover:text-foreground"
          >
            <X className="h-3 w-3 mr-1" />
            Reset
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-3">
        {/* Account Filter */}
        {accountsOptions.length > 0 && (
          <div className="space-y-1 min-w-[150px]">
            <Label htmlFor="account-filter" className="text-xs text-muted-foreground">
              Account
            </Label>
            <Select
              value={filters.accountId || "all"}
              onValueChange={handleAccountChange}
            >
              <SelectTrigger id="account-filter" className="h-9 bg-slate-800">
                <SelectValue placeholder="All accounts" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All accounts</SelectItem>
                {accountsOptions.map((account) => (
                  <SelectItem key={account.id} value={account.id}>
                    {account.name || account.id}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Symbol Filter */}
        <div className="space-y-1 min-w-[150px]">
          <Label htmlFor="symbol-filter" className="text-xs text-muted-foreground">
            Symbol
          </Label>
          <Select
            value={filters.symbols && filters.symbols.length > 0 ? filters.symbols[0] : "all"}
            onValueChange={handleSymbolChange}
          >
            <SelectTrigger id="symbol-filter" className="h-9 bg-slate-800">
              <SelectValue placeholder="All symbols" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All symbols</SelectItem>
              {symbolsOptions.map((symbol) => (
                <SelectItem key={symbol} value={symbol}>
                  {symbol}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Side Filter */}
        <div className="space-y-1 min-w-[120px]">
          <Label htmlFor="side-filter" className="text-xs text-muted-foreground">
            Side
          </Label>
          <Select
            value={filters.side || "all"}
            onValueChange={handleSideChange}
          >
            <SelectTrigger id="side-filter" className="h-9 bg-slate-800">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="buy">Buy</SelectItem>
              <SelectItem value="sell">Sell</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Status Filter */}
        <div className="space-y-1 min-w-[120px]">
          <Label htmlFor="status-filter" className="text-xs text-muted-foreground">
            Result
          </Label>
          <Select
            value={filters.status || "all"}
            onValueChange={handleStatusChange}
          >
            <SelectTrigger id="status-filter" className="h-9 bg-slate-800">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="win">Win</SelectItem>
              <SelectItem value="loss">Loss</SelectItem>
              <SelectItem value="be">Breakeven</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Tag Filter */}
        <div className="space-y-1 min-w-[150px]">
          <Label htmlFor="tag-filter" className="text-xs text-muted-foreground">
            Tag
          </Label>
          <Input
            id="tag-filter"
            type="text"
            placeholder="Filter by tag..."
            value={filters.tag || ""}
            onChange={handleTagChange}
            className="h-9 bg-slate-800"
          />
        </div>

        {/* Date From */}
        <div className="space-y-1 min-w-[150px]">
          <Label htmlFor="date-from-filter" className="text-xs text-muted-foreground">
            From Date
          </Label>
          <Input
            id="date-from-filter"
            type="date"
            value={
              filters.dateFrom
                ? filters.dateFrom.toISOString().split("T")[0]
                : ""
            }
            onChange={handleDateFromChange}
            className="h-9 bg-slate-800"
          />
        </div>

        {/* Date To */}
        <div className="space-y-1 min-w-[150px]">
          <Label htmlFor="date-to-filter" className="text-xs text-muted-foreground">
            To Date
          </Label>
          <Input
            id="date-to-filter"
            type="date"
            value={
              filters.dateTo
                ? filters.dateTo.toISOString().split("T")[0]
                : ""
            }
            onChange={handleDateToChange}
            className="h-9 bg-slate-800"
          />
        </div>
      </div>
    </div>
  );
});

