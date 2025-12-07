import { useEffect, useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Playbook } from "@/types/playbook";
import type { Trade } from "@/types/trading";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { useAuth } from "@/contexts/AuthContext";

export type PlaybookStats = {
  playbookId: string;
  tradesCount: number;
  winCount: number;
  lossCount: number;
  breakevenCount: number;
  winRate: number; // 0-100
  netPnlBase: number;
  avgR: number | null;
  profitFactor: number | null;
};

export type PlaybookStatsMap = Record<string, PlaybookStats>;

/**
 * Fetch trades for a specific playbook
 */
async function getTradesForPlaybook(userId: string, playbookId: string): Promise<Trade[]> {
  const tradesRef = collection(db, "users", userId, "trades");
  const q = query(tradesRef, where("playbookId", "==", playbookId));
  const snapshot = await getDocs(q);

  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      userId: data.userId || userId,
      accountId: data.accountId || "",
      symbol: data.symbol || "",
      side: data.side || "buy",
      entryPrice: data.entryPrice || 0,
      exitPrice: data.exitPrice || 0,
      positionSize: data.positionSize || 0,
      openTime: data.openTime,
      closeTime: data.closeTime,
      tradeDate: data.tradeDate || "",
      pnlPoints: data.pnlPoints || 0,
      pnlCurrency: data.pnlCurrency || 0,
      rMultiple: data.rMultiple ?? null,
      status: data.status || "loss",
      playbookId: data.playbookId ?? null,
      notes: data.notes,
      tags: data.tags,
      rating: data.rating ?? null,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    } as Trade;
  });
}

/**
 * Aggregate stats from trades for a playbook
 */
function aggregatePlaybookStats(trades: Trade[]): PlaybookStats {
  if (trades.length === 0) {
    return {
      playbookId: "",
      tradesCount: 0,
      winCount: 0,
      lossCount: 0,
      breakevenCount: 0,
      winRate: 0,
      netPnlBase: 0,
      avgR: null,
      profitFactor: null,
    };
  }

  let winCount = 0;
  let lossCount = 0;
  let breakevenCount = 0;
  let netPnlBase = 0;
  const rMultiples: number[] = [];
  const profits: number[] = [];
  const losses: number[] = [];

  trades.forEach((trade) => {
    netPnlBase += trade.pnlCurrency || 0;

    if (trade.status === "win") {
      winCount++;
      if (trade.pnlCurrency > 0) {
        profits.push(trade.pnlCurrency);
      }
    } else if (trade.status === "loss") {
      lossCount++;
      if (trade.pnlCurrency < 0) {
        losses.push(Math.abs(trade.pnlCurrency));
      }
    } else {
      breakevenCount++;
    }

    if (trade.rMultiple != null && trade.rMultiple !== undefined) {
      rMultiples.push(trade.rMultiple);
    }
  });

  const totalTrades = winCount + lossCount + breakevenCount;
  const winRate = totalTrades > 0 ? (winCount / totalTrades) * 100 : 0;

  const avgR = rMultiples.length > 0 ? rMultiples.reduce((a, b) => a + b, 0) / rMultiples.length : null;

  const grossProfit = profits.reduce((a, b) => a + b, 0);
  const grossLoss = losses.reduce((a, b) => a + b, 0);
  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? null : null;

  return {
    playbookId: trades[0]?.playbookId || "",
    tradesCount: trades.length,
    winCount,
    lossCount,
    breakevenCount,
    winRate,
    netPnlBase,
    avgR,
    profitFactor,
  };
}

export function usePlaybookAnalytics(playbooks: Playbook[]): {
  data: PlaybookStatsMap;
  loading: boolean;
  error: string | null;
} {
  const { user } = useAuth();
  const userId = user?.uid || "";

  const [statsMap, setStatsMap] = useState<PlaybookStatsMap>({});
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch trades for all playbooks
  const playbookIds = useMemo(() => playbooks.map((pb) => pb.id), [playbooks]);

  const { data: allTradesData, isLoading } = useQuery<Record<string, Trade[]>>({
    queryKey: ["playbookAnalytics", userId, playbookIds],
    queryFn: async () => {
      if (!userId || playbookIds.length === 0) {
        return {};
      }

      const results: Record<string, Trade[]> = {};

      // Fetch trades for each playbook in parallel
      await Promise.all(
        playbookIds.map(async (playbookId) => {
          try {
            const trades = await getTradesForPlaybook(userId, playbookId);
            results[playbookId] = trades;
          } catch (err) {
            console.error(`Error fetching trades for playbook ${playbookId}:`, err);
            results[playbookId] = [];
          }
        })
      );

      return results;
    },
    enabled: !!userId && playbookIds.length > 0,
  });

  // Aggregate stats when trades data changes
  useEffect(() => {
    if (!allTradesData) {
      setStatsMap({});
      setLoading(isLoading);
      return;
    }

    setLoading(isLoading);

    const aggregated: PlaybookStatsMap = {};

    Object.entries(allTradesData).forEach(([playbookId, trades]) => {
      aggregated[playbookId] = aggregatePlaybookStats(trades);
    });

    setStatsMap(aggregated);
    setError(null);
  }, [allTradesData, isLoading]);

  return {
    data: statsMap,
    loading,
    error,
  };
}

