import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  query,
  where,
  orderBy,
  limit,
  startAfter,
  getDocs,
  getCountFromServer,
  DocumentSnapshot,
  Timestamp,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import { tradesCollectionRef } from "@/lib/firestoreService";
import type { Trade } from "@/types/trading";

export type TradesFilter = {
  accountId?: string | null;
  symbols?: string[]; // if empty or undefined → all
  side?: "buy" | "sell" | "all";
  status?: "win" | "loss" | "be" | "all";
  tag?: string | null; // filter trades that contain this tag
  dateFrom?: Date | null; // filter by closeTime >= dateFrom
  dateTo?: Date | null; // filter by closeTime <= dateTo
};

export type UsePaginatedTradesOptions = {
  pageSize?: number; // default 50
};

/**
 * Convert Firestore document to Trade
 */
function docToTrade(doc: DocumentSnapshot): Trade {
  const data = doc.data();
  if (!data) {
    throw new Error("Document data is missing");
  }

  return {
    id: doc.id,
    userId: data.userId || "",
    accountId: data.accountId || "",
    symbol: data.symbol || "",
    side: data.side || "buy",
    entryPrice: data.entryPrice || 0,
    exitPrice: data.exitPrice || 0,
    positionSize: data.positionSize || 0,
    openTime: data.openTime || Timestamp.now(),
    closeTime: data.closeTime || Timestamp.now(),
    tradeDate: data.tradeDate || "",
    pnlPoints: data.pnlPoints || 0,
    pnlCurrency: data.pnlCurrency || 0,
    rMultiple: data.rMultiple ?? null,
    status: data.status || "loss",
    playbookId: data.playbookId ?? null,
    externalTicket: data.externalTicket,
    source: data.source,
    commission: data.commission,
    swap: data.swap,
    notes: data.notes,
    tags: data.tags,
    rating: data.rating ?? null,
    createdAt: data.createdAt || Timestamp.now(),
    updatedAt: data.updatedAt || Timestamp.now(),
  };
}

/**
 * Build Firestore query with filters
 */
function buildTradesQuery(
  userId: string,
  filters: TradesFilter,
  pageSize: number,
  lastDoc?: DocumentSnapshot
) {
  const tradesRef = tradesCollectionRef(userId);
  const constraints: any[] = [];

  // Apply filters
  if (filters.accountId) {
    constraints.push(where("accountId", "==", filters.accountId));
  }

  if (filters.symbols && filters.symbols.length > 0) {
    if (filters.symbols.length === 1) {
      constraints.push(where("symbol", "==", filters.symbols[0]));
    } else if (filters.symbols.length <= 10) {
      // Firestore 'in' query supports up to 10 items
      constraints.push(where("symbol", "in", filters.symbols));
    }
    // If more than 10 symbols, we'd need multiple queries or client-side filtering
    // For now, limit to 10
  }

  if (filters.side && filters.side !== "all") {
    constraints.push(where("side", "==", filters.side));
  }

  if (filters.status && filters.status !== "all") {
    constraints.push(where("status", "==", filters.status));
  }

  if (filters.tag) {
    constraints.push(where("tags", "array-contains", filters.tag));
  }

  if (filters.dateFrom) {
    constraints.push(where("closeTime", ">=", Timestamp.fromDate(filters.dateFrom)));
  }

  if (filters.dateTo) {
    const dateTo = new Date(filters.dateTo);
    dateTo.setHours(23, 59, 59, 999);
    constraints.push(where("closeTime", "<=", Timestamp.fromDate(dateTo)));
  }

  // Order by closeTime descending (most recent first)
  constraints.push(orderBy("closeTime", "desc"));

  // Pagination
  constraints.push(limit(pageSize));

  if (lastDoc) {
    constraints.push(startAfter(lastDoc));
  }

  return query(tradesRef, ...constraints);
}

/**
 * Hook for paginated and filtered trades
 */
export function usePaginatedTrades(
  userId: string | null,
  filters: TradesFilter,
  options?: UsePaginatedTradesOptions
) {
  const pageSize = options?.pageSize ?? 50;
  const [currentPage, setCurrentPage] = useState(0);
  const [pageCursors, setPageCursors] = useState<DocumentSnapshot[]>([]);
  const filtersRef = useRef(filters);
  const lastFiltersStringRef = useRef<string>("");

  // Update filters ref and reset page when filters change
  useEffect(() => {
    const filtersString = JSON.stringify(filters);
    if (filtersString !== lastFiltersStringRef.current) {
      lastFiltersStringRef.current = filtersString;
      filtersRef.current = filters;
      setCurrentPage(0);
      setPageCursors([]);
    }
  }, [filters]);

  // Build query key that includes filters and current page
  const queryKey = [
    "paginatedTrades",
    userId,
    JSON.stringify(filtersRef.current),
    currentPage,
    pageSize,
  ];

  // Fetch trades for current page
  const {
    data: pageData,
    isLoading,
    error,
    refetch,
  } = useQuery<{ trades: Trade[]; lastDoc: DocumentSnapshot | null; hasNextPage: boolean }>({
    queryKey,
    queryFn: async () => {
      if (!userId) {
        return { trades: [], lastDoc: null, hasNextPage: false };
      }

      const lastDoc = currentPage > 0 ? pageCursors[currentPage - 1] : undefined;
      // Fetch pageSize + 1 to check if there's a next page
      const q = buildTradesQuery(userId, filtersRef.current, pageSize + 1, lastDoc);

      const snapshot = await getDocs(q);
      const docs = snapshot.docs;

      // Check if there's a next page (we fetched pageSize + 1)
      const hasMore = docs.length > pageSize;
      const tradesDocs = hasMore ? docs.slice(0, pageSize) : docs;

      const trades = tradesDocs.map(docToTrade);
      const newLastDoc = tradesDocs.length > 0 ? tradesDocs[tradesDocs.length - 1] : null;

      // Update page cursors
      if (newLastDoc && currentPage === pageCursors.length) {
        setPageCursors((prev) => [...prev, newLastDoc]);
      }

      return {
        trades,
        lastDoc: newLastDoc,
        hasNextPage: hasMore,
      };
    },
    enabled: !!userId,
  });

  // Fetch total count (optional, can be expensive)
  const { data: totalCount } = useQuery<number>({
    queryKey: ["tradesCount", userId, JSON.stringify(filtersRef.current)],
    queryFn: async () => {
      if (!userId) return 0;

      const q = buildTradesQuery(userId, filtersRef.current, 1);
      const countSnapshot = await getCountFromServer(q);
      return countSnapshot.data().count;
    },
    enabled: !!userId,
  });

  const trades = pageData?.trades ?? [];
  const hasNextPage = pageData?.hasNextPage ?? false;

  const nextPage = useCallback(() => {
    if (hasNextPage) {
      setCurrentPage((prev) => prev + 1);
    }
  }, [hasNextPage]);

  const prevPage = useCallback(() => {
    if (currentPage > 0) {
      setCurrentPage((prev) => prev - 1);
    }
  }, [currentPage]);

  const refresh = useCallback(() => {
    refetch();
  }, [refetch]);

  return {
    trades,
    loading: isLoading,
    error: error ? (error instanceof Error ? error.message : String(error)) : null,
    hasNextPage: !!hasNextPage,
    hasPrevPage: currentPage > 0,
    currentPage,
    nextPage,
    prevPage,
    refresh,
    totalCount: totalCount ?? null,
  };
}

