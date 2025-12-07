import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  getDoc,
  QueryConstraint,
  Timestamp,
  doc,
  setDoc,
  updateDoc,
  serverTimestamp,
  writeBatch,
} from "firebase/firestore";
import { db } from "./firebase";
import type { Trade, DailyStat, UserGeneralSettings, UserRiskSettings } from "@/types/trading";
import type { UserRiskSettings as SettingsUserRiskSettings } from "@/types/settings";

/**
 * Path helpers for Firestore collections
 */
export const tradesCollectionRef = (userId: string) =>
  collection(db, "users", userId, "trades");

export const dailyStatsCollectionRef = (userId: string) =>
  collection(db, "users", userId, "dailyStats");

/**
 * Get daily stats for a user within a date range
 * 
 * NOTE: Date-range filtering is done client-side to avoid Firestore composite index requirements.
 */
export async function getDailyStatsForUserInRange(
  userId: string,
  startDate: string,
  endDate: string
): Promise<DailyStat[]> {
  if (!userId) {
    return [];
  }

  try {
    const statsRef = dailyStatsCollectionRef(userId);

    // Simple query without range filters or orderBy (avoids composite index requirements)
    const q = query(statsRef);
    const querySnapshot = await getDocs(q);

    const allStats: DailyStat[] = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      allStats.push({
        id: doc.id,
        userId: data.userId || userId,
        accountId: data.accountId || "",
        date: data.date || "",
        netPnlCurrency: data.netPnlCurrency || 0,
        tradesCount: data.tradesCount || 0,
        winsCount: data.winsCount || 0,
        lossesCount: data.lossesCount || 0,
        breakevenCount: data.breakevenCount || 0,
        avgR: data.avgR ?? null,
        profitFactor: data.profitFactor ?? null,
        createdAt: data.createdAt || Timestamp.now(),
        updatedAt: data.updatedAt || Timestamp.now(),
      });
    });

    // Client-side filtering by date range
    const filteredStats = allStats.filter((stat) => {
      return stat.date >= startDate && stat.date <= endDate;
    });

    // Sort by date ascending (client-side)
    filteredStats.sort((a, b) => a.date.localeCompare(b.date));

    return filteredStats;
  } catch (error) {
    console.error("Error fetching daily stats:", error);
    throw error;
  }
}

/**
 * Get all trades for a user, ordered by closeTime descending
 */
export async function getTradesByUser(userId: string): Promise<Trade[]> {
  if (!userId) return [];

  try {
    const tradesRef = tradesCollectionRef(userId);
    const q = query(tradesRef, orderBy("closeTime", "desc"));

    const querySnapshot = await getDocs(q);

    const trades: Trade[] = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      trades.push({
        id: doc.id,
        userId: data.userId || userId,
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
        notes: data.notes,
        tags: data.tags,
        rating: data.rating ?? null,
        createdAt: data.createdAt || Timestamp.now(),
        updatedAt: data.updatedAt || Timestamp.now(),
      });
    });

    return trades;
  } catch (error) {
    console.error("Error fetching trades:", error);
    throw error;
  }
}

/**
 * Get trades for a user within a date range (optional helper)
 * 
 * NOTE: Date-range filtering is done client-side to avoid Firestore composite index requirements.
 */
export async function getTradesForUserInRange(
  userId: string,
  startDate: string,
  endDate: string
): Promise<Trade[]> {
  if (!userId) {
    return [];
  }

  try {
    const tradesRef = tradesCollectionRef(userId);
    
    // Simple query without range filters or orderBy (avoids composite index requirements)
    const q = query(tradesRef);
    const querySnapshot = await getDocs(q);

    const allTrades: Trade[] = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      allTrades.push({
        id: doc.id,
        userId: data.userId || userId,
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
        notes: data.notes,
        tags: data.tags,
        rating: data.rating ?? null,
        createdAt: data.createdAt || Timestamp.now(),
        updatedAt: data.updatedAt || Timestamp.now(),
      });
    });

    // Client-side filtering by date range
    const filteredTrades = allTrades.filter((trade) => {
      if (trade.tradeDate) {
        const tradeDateStr = trade.tradeDate;
        return tradeDateStr >= startDate && tradeDateStr <= endDate;
      }
      // Fallback to closeTime or openTime if tradeDate is missing
      let effectiveDate: Date | null = null;
      if (trade.closeTime) {
        if (trade.closeTime instanceof Timestamp) {
          effectiveDate = trade.closeTime.toDate();
        } else if (trade.closeTime instanceof Date) {
          effectiveDate = trade.closeTime;
        } else if (typeof trade.closeTime === "string") {
          effectiveDate = new Date(trade.closeTime);
        }
      }
      if (!effectiveDate && trade.openTime) {
        if (trade.openTime instanceof Timestamp) {
          effectiveDate = trade.openTime.toDate();
        } else if (trade.openTime instanceof Date) {
          effectiveDate = trade.openTime;
        } else if (typeof trade.openTime === "string") {
          effectiveDate = new Date(trade.openTime);
        }
      }
      if (effectiveDate) {
        const dateStr = `${effectiveDate.getFullYear()}-${String(effectiveDate.getMonth() + 1).padStart(2, "0")}-${String(effectiveDate.getDate()).padStart(2, "0")}`;
        return dateStr >= startDate && dateStr <= endDate;
      }
      return false;
    });

    // Sort by tradeDate ascending (client-side)
    filteredTrades.sort((a, b) => {
      const dateA = a.tradeDate || "";
      const dateB = b.tradeDate || "";
      return dateA.localeCompare(dateB);
    });

    return filteredTrades;
  } catch (error) {
    console.error("Error fetching trades:", error);
    throw error;
  }
}

/**
 * Get trades for a user within a date range filtered by accountId and optionally symbol
 * 
 * NOTE: Date-range filtering is done client-side to avoid Firestore composite index requirements.
 * The startDate/endDate parameters are kept for API compatibility but are ignored in the Firestore query.
 */
export async function getTradesForCalendar(
  userId: string,
  accountId: string,
  startDate: string,
  endDate: string,
  symbol?: string
): Promise<Trade[]> {
  if (!userId || !accountId) {
    return [];
  }

  try {
    const tradesRef = tradesCollectionRef(userId);
    
    // Simple Firestore query with only equality filter (no range filters, no orderBy)
    // This avoids composite index requirements
    const constraints: QueryConstraint[] = [
      where("accountId", "==", accountId),
    ];

    const q = query(tradesRef, ...constraints);
    const querySnapshot = await getDocs(q);

    // Map Firestore documents to Trade objects
    const allTrades: Trade[] = [];
    querySnapshot.forEach((doc) => {
      const data = doc.data();
      allTrades.push({
        id: doc.id,
        userId: data.userId || userId,
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
      });
    });

    // Client-side filtering by date range and symbol
    const filteredTrades = allTrades.filter((trade) => {
      // Filter by symbol if provided
      if (symbol && symbol !== "ALL" && trade.symbol !== symbol) {
        return false;
      }

      // Filter by date range using tradeDate string (YYYY-MM-DD format)
      if (trade.tradeDate) {
        const tradeDateStr = trade.tradeDate;
        if (tradeDateStr < startDate || tradeDateStr > endDate) {
          return false;
        }
      } else {
        // Fallback: if no tradeDate, try to extract from closeTime or openTime
        let effectiveDate: Date | null = null;
        if (trade.closeTime) {
          if (trade.closeTime instanceof Timestamp) {
            effectiveDate = trade.closeTime.toDate();
          } else if (trade.closeTime instanceof Date) {
            effectiveDate = trade.closeTime;
          } else if (typeof trade.closeTime === "string") {
            effectiveDate = new Date(trade.closeTime);
          }
        }
        if (!effectiveDate && trade.openTime) {
          if (trade.openTime instanceof Timestamp) {
            effectiveDate = trade.openTime.toDate();
          } else if (trade.openTime instanceof Date) {
            effectiveDate = trade.openTime;
          } else if (typeof trade.openTime === "string") {
            effectiveDate = new Date(trade.openTime);
          }
        }
        
        if (effectiveDate) {
          const dateStr = `${effectiveDate.getFullYear()}-${String(effectiveDate.getMonth() + 1).padStart(2, "0")}-${String(effectiveDate.getDate()).padStart(2, "0")}`;
          if (dateStr < startDate || dateStr > endDate) {
            return false;
          }
        } else {
          // If we can't determine the date, exclude it from date-filtered results
          return false;
        }
      }

      return true;
    });

    // Sort by tradeDate ascending (client-side)
    filteredTrades.sort((a, b) => {
      const dateA = a.tradeDate || "";
      const dateB = b.tradeDate || "";
      return dateA.localeCompare(dateB);
    });

    return filteredTrades;
  } catch (error) {
    console.error("Error fetching trades for calendar:", error);
    throw error;
  }
}


/**
 * Add an imported trade to Firestore
 */
export async function addImportedTrade(
  userId: string,
  trade: Omit<Trade, "id" | "userId" | "createdAt" | "updatedAt">
): Promise<string> {
  if (!userId) {
    throw new Error("User ID is required");
  }

  try {
    const colRef = tradesCollectionRef(userId);
    const docRef = doc(colRef); // auto-generated ID
    const now = serverTimestamp();

    const data: Trade = {
      id: docRef.id,
      userId,
      ...trade,
      createdAt: now as Timestamp,
      updatedAt: now as Timestamp,
    };

    await setDoc(docRef, data);
    return docRef.id;
  } catch (error) {
    console.error("Error adding imported trade:", error);
    throw error;
  }
}

/**
 * Result of bulk MT5 import operation
 */
export interface ImportMt5Result {
  imported: number;
  skippedDuplicates: number;
  failed: number;
  errors: { index: number; error: unknown }[];
}

/**
 * Bulk import MT5 trades with de-duplication
 * 
 * Uses deterministic document IDs based on accountId + externalTicket to ensure
 * idempotent imports. Re-importing the same MT5 file will not create duplicates.
 * 
 * @param trades - Array of Trade objects to import (must have externalTicket set)
 * @param options - User and account context
 * @returns Import result with counts of imported, skipped, and failed trades
 */
export async function importMt5Trades(
  trades: Trade[],
  options: { userId: string; accountId: string }
): Promise<ImportMt5Result> {
  if (!options.userId || !options.accountId) {
    throw new Error("userId and accountId are required");
  }

  const result: ImportMt5Result = {
    imported: 0,
    skippedDuplicates: 0,
    failed: 0,
    errors: [],
  };

  if (trades.length === 0) {
    return result;
  }

  const colRef = tradesCollectionRef(options.userId);
  const BATCH_SIZE = 500; // Firestore batch limit
  const batches: Trade[][] = [];

  // Split trades into batches
  for (let i = 0; i < trades.length; i += BATCH_SIZE) {
    batches.push(trades.slice(i, i + BATCH_SIZE));
  }

  // Process each batch
  for (const batchTrades of batches) {
    const batch = writeBatch(db);
    let batchImported = 0;

    for (let i = 0; i < batchTrades.length; i++) {
      const trade = batchTrades[i];
      const originalIndex = trades.indexOf(trade);

      try {
        const ticket = trade.externalTicket;
        if (!ticket) {
          // No ticket? Skip this one; it's probably invalid or incomplete
          result.skippedDuplicates++;
          continue;
        }

        // Create deterministic ID: mt5_{accountId}_{ticket}
        // This ensures idempotent imports - same ticket + account = same document
        const id = `mt5_${options.accountId}_${ticket}`;
        const docRef = doc(colRef, id);

        // Check if document already exists (for duplicate tracking)
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          // Document already exists - skip as duplicate
          result.skippedDuplicates++;
          continue;
        }

        // Prepare trade data with deterministic ID
        const tradeData: Trade = {
          ...trade,
          id,
          userId: options.userId,
          accountId: options.accountId,
          // Ensure source is set
          source: trade.source || "mt5_positions",
          // Use server timestamps for consistency
          createdAt: trade.createdAt || (serverTimestamp() as Timestamp),
          updatedAt: trade.updatedAt || (serverTimestamp() as Timestamp),
        };

        // Add to batch for writing
        batch.set(docRef, tradeData, { merge: false });
        batchImported++;
      } catch (error) {
        console.error(`[importMt5Trades] Error preparing trade ${originalIndex}`, error);
        result.errors.push({ index: originalIndex, error });
        result.failed++;
      }
    }

    // Commit the batch if there are any writes
    if (batchImported > 0) {
      try {
        await batch.commit();
        result.imported += batchImported;
      } catch (error) {
        console.error("[importMt5Trades] Batch commit failed", error);
        // If batch commit fails, mark all as failed
        result.failed += batchImported;
        result.errors.push({
          index: -1,
          error: new Error(`Batch commit failed: ${error instanceof Error ? error.message : String(error)}`),
        });
        result.imported -= batchImported;
      }
    }
  }

  return result;
}

/**
 * Update journal fields for a trade
 * Only updates the provided fields (notes, tags, rating, playbookId)
 */
export async function updateTradeJournalFields(
  userId: string,
  tradeId: string,
  data: {
    notes?: string;
    tags?: string[];
    rating?: number | null;
    playbookId?: string | null;
  }
): Promise<void> {
  if (!userId || !tradeId) {
    throw new Error("userId and tradeId are required");
  }

  try {
    const tradesRef = tradesCollectionRef(userId);
    const tradeDocRef = doc(tradesRef, tradeId);

    // Prepare update object with only provided fields
    const updateData: {
      notes?: string;
      tags?: string[];
      rating?: number | null;
      playbookId?: string | null;
      updatedAt: Timestamp;
    } = {
      updatedAt: serverTimestamp() as Timestamp,
    };

    if (data.notes !== undefined) {
      updateData.notes = data.notes;
    }
    if (data.tags !== undefined) {
      updateData.tags = data.tags;
    }
    if (data.rating !== undefined) {
      updateData.rating = data.rating;
    }
    if (data.playbookId !== undefined) {
      updateData.playbookId = data.playbookId;
    }

    await updateDoc(tradeDocRef, updateData);
  } catch (error) {
    console.error("Error updating trade journal fields:", error);
    throw error;
  }
}

/**
 * Get user general settings
 */
export async function getUserGeneralSettings(
  userId: string
): Promise<UserGeneralSettings | null> {
  if (!userId) {
    return null;
  }

  try {
    const settingsRef = doc(db, "users", userId, "settings", "general");
    const settingsSnap = await getDoc(settingsRef);

    if (!settingsSnap.exists()) {
      return null;
    }

    const data = settingsSnap.data();
    return {
      baseCurrency: data.baseCurrency || "EUR",
      timezone: data.timezone || "Europe/Berlin",
      defaultRiskPercent: data.defaultRiskPercent ?? 1,
      defaultDashboardDays: data.defaultDashboardDays ?? 30,
      language: data.language,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
    };
  } catch (error) {
    console.error("Error fetching user general settings:", error);
    throw error;
  }
}

/**
 * Update user general settings
 */
export async function updateUserGeneralSettings(
  userId: string,
  partial: Partial<UserGeneralSettings>
): Promise<void> {
  if (!userId) {
    throw new Error("userId is required");
  }

  try {
    const settingsRef = doc(db, "users", userId, "settings", "general");
    const settingsSnap = await getDoc(settingsRef);

    const updateData: Partial<UserGeneralSettings> = {
      ...partial,
      updatedAt: serverTimestamp() as Timestamp,
    };

    if (!settingsSnap.exists()) {
      // Create new document with defaults + partial override
      const defaults: UserGeneralSettings = {
        baseCurrency: "EUR",
        timezone: "Europe/Berlin",
        defaultRiskPercent: 1,
        defaultDashboardDays: 30,
        ...partial,
        createdAt: serverTimestamp() as Timestamp,
        updatedAt: serverTimestamp() as Timestamp,
      };
      await setDoc(settingsRef, defaults);
    } else {
      // Update existing document
      await setDoc(settingsRef, updateData, { merge: true });
    }
  } catch (error) {
    console.error("Error updating user general settings:", error);
    throw error;
  }
}

/**
 * Get user risk settings
 */
export async function getUserRiskSettings(
  userId: string
): Promise<SettingsUserRiskSettings | null> {
  const ref = doc(db, "users", userId, "settings", "risk");
  const snap = await getDoc(ref);

  if (!snap.exists()) return null;

  const data = snap.data();
  return {
    maxDailyLossPercent: data.maxDailyLossPercent ?? 0,
    maxWeeklyLossPercent: data.maxWeeklyLossPercent ?? 0,
    targetDailyProfitPercent: data.targetDailyProfitPercent ?? 0,
    targetWeeklyProfitPercent: data.targetWeeklyProfitPercent ?? 0,
    createdAt: data.createdAt?.toDate?.() ?? null,
    updatedAt: data.updatedAt?.toDate?.() ?? null,
  };
}

/**
 * Save user risk settings
 */
export async function saveUserRiskSettings(
  userId: string,
  payload: Omit<SettingsUserRiskSettings, "createdAt" | "updatedAt">
): Promise<void> {
  const ref = doc(db, "users", userId, "settings", "risk");
  const snap = await getDoc(ref);
  const existing = snap.data();

  await setDoc(
    ref,
    {
      maxDailyLossPercent: payload.maxDailyLossPercent,
      maxWeeklyLossPercent: payload.maxWeeklyLossPercent,
      targetDailyProfitPercent: payload.targetDailyProfitPercent,
      targetWeeklyProfitPercent: payload.targetWeeklyProfitPercent,
      createdAt: existing?.createdAt ?? serverTimestamp(),
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );
}
