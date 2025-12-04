import { useSearchParams } from "react-router-dom";
import { useCallback, useMemo } from "react";
import { startOfMonth, endOfMonth, parseISO, format } from "date-fns";

export interface FilterState {
  dateFrom: string | null;
  dateTo: string | null;
  instruments: string[];
  strategies: string[];
  sessions: string[];
  side: "all" | "long" | "short";
  result: "all" | "win" | "loss" | "breakeven";
  minR: number | null;
  maxR: number | null;
}

const defaultFilters: FilterState = {
  dateFrom: null,
  dateTo: null,
  instruments: [],
  strategies: [],
  sessions: [],
  side: "all",
  result: "all",
  minR: null,
  maxR: null,
};

export function useFilters() {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = useMemo<FilterState>(() => {
    return {
      dateFrom: searchParams.get("dateFrom"),
      dateTo: searchParams.get("dateTo"),
      instruments: searchParams.get("instruments")?.split(",").filter(Boolean) || [],
      strategies: searchParams.get("strategies")?.split(",").filter(Boolean) || [],
      sessions: searchParams.get("sessions")?.split(",").filter(Boolean) || [],
      side: (searchParams.get("side") as FilterState["side"]) || "all",
      result: (searchParams.get("result") as FilterState["result"]) || "all",
      minR: searchParams.get("minR") ? parseFloat(searchParams.get("minR")!) : null,
      maxR: searchParams.get("maxR") ? parseFloat(searchParams.get("maxR")!) : null,
    };
  }, [searchParams]);

  const setFilters = useCallback((newFilters: Partial<FilterState>) => {
    setSearchParams((prev) => {
      const updated = new URLSearchParams(prev);

      Object.entries(newFilters).forEach(([key, value]) => {
        if (value === null || value === "all" || (Array.isArray(value) && value.length === 0)) {
          updated.delete(key);
        } else if (Array.isArray(value)) {
          updated.set(key, value.join(","));
        } else {
          updated.set(key, String(value));
        }
      });

      return updated;
    });
  }, [setSearchParams]);

  const clearFilters = useCallback(() => {
    setSearchParams(new URLSearchParams());
  }, [setSearchParams]);

  const hasActiveFilters = useMemo(() => {
    return (
      filters.dateFrom !== null ||
      filters.dateTo !== null ||
      filters.instruments.length > 0 ||
      filters.strategies.length > 0 ||
      filters.sessions.length > 0 ||
      filters.side !== "all" ||
      filters.result !== "all" ||
      filters.minR !== null ||
      filters.maxR !== null
    );
  }, [filters]);

  // Filter function to apply to trades
  const applyFilters = useCallback(<T extends {
    trading_day?: string;
    instrument_id?: string;
    strategy_id?: string | null;
    session_id?: string | null;
    side?: string;
    result?: string;
    r_multiple?: number | null;
  }>(trades: T[]): T[] => {
    return trades.filter((trade) => {
      // Date range filter
      if (filters.dateFrom && trade.trading_day) {
        if (trade.trading_day < filters.dateFrom) return false;
      }
      if (filters.dateTo && trade.trading_day) {
        if (trade.trading_day > filters.dateTo) return false;
      }

      // Instruments filter
      if (filters.instruments.length > 0 && trade.instrument_id) {
        if (!filters.instruments.includes(trade.instrument_id)) return false;
      }

      // Strategies filter
      if (filters.strategies.length > 0) {
        if (!trade.strategy_id || !filters.strategies.includes(trade.strategy_id)) return false;
      }

      // Sessions filter
      if (filters.sessions.length > 0) {
        if (!trade.session_id || !filters.sessions.includes(trade.session_id)) return false;
      }

      // Side filter
      if (filters.side !== "all" && trade.side) {
        if (trade.side !== filters.side) return false;
      }

      // Result filter
      if (filters.result !== "all" && trade.result) {
        if (trade.result !== filters.result) return false;
      }

      // R-multiple filter
      if (filters.minR !== null && trade.r_multiple !== null && trade.r_multiple !== undefined) {
        if (trade.r_multiple < filters.minR) return false;
      }
      if (filters.maxR !== null && trade.r_multiple !== null && trade.r_multiple !== undefined) {
        if (trade.r_multiple > filters.maxR) return false;
      }

      return true;
    });
  }, [filters]);

  return {
    filters,
    setFilters,
    clearFilters,
    hasActiveFilters,
    applyFilters,
  };
}
