/**
 * Mapping layer: Normalized MT5 rows → Trade
 * 
 * This module provides a pure mapping function that converts parsed MT5 position rows
 * into Trade objects ready for Firestore import.
 */

import { Timestamp } from "firebase/firestore";
import type { Mt5PositionRow } from "./mt5Import";
import type { Trade } from "@/types/trading";

/**
 * Parse MT5 date/time string to Date object
 * MT5 format: "YYYY.MM.DD HH:MM:SS"
 */
function parseMt5DateTime(dateTimeStr: string): Date {
  const [datePart, timePart] = dateTimeStr.trim().split(" ");
  
  if (!datePart || !timePart) {
    throw new Error(`Invalid MT5 date/time format: ${dateTimeStr}`);
  }

  const normalizedDate = datePart.replace(/\./g, "-");
  const isoString = `${normalizedDate}T${timePart}`;
  const date = new Date(isoString + "Z");
  
  if (isNaN(date.getTime())) {
    throw new Error(`Failed to parse date: ${dateTimeStr}`);
  }
  
  return date;
}

/**
 * Map a normalized MT5 position row to a Trade object
 * 
 * This is a pure mapping function with no Firestore logic.
 * It converts the parsed MT5 data structure to the internal Trade type.
 */
export function mapNormalizedMt5RowToTrade(
  row: Mt5PositionRow,
  context: {
    userId: string;
    accountId: string;
    now?: Date;
  }
): Trade {
  const now = context.now ?? new Date();
  const openDate = parseMt5DateTime(row.openTime);
  const closeDate = parseMt5DateTime(row.closeTime);

  // Convert MT5 type ("buy"/"sell") to Trade side
  const side = row.type === "buy" ? "buy" : "sell";
  const direction = side === "buy" ? 1 : -1;

  // Calculate PnL points
  const pnlPoints = (row.closePrice - row.entryPrice) * direction;

  // Derive status from profit
  let status: "win" | "loss" | "be" = "be";
  if (row.profit > 0) {
    status = "win";
  } else if (row.profit < 0) {
    status = "loss";
  }

  // Derive tradeDate from closeTime (YYYY-MM-DD)
  const tradeDate = closeDate.toISOString().slice(0, 10);

  // Convert dates to Timestamps
  const openTime = Timestamp.fromDate(openDate);
  const closeTime = Timestamp.fromDate(closeDate);
  const createdAt = Timestamp.fromDate(now);
  const updatedAt = Timestamp.fromDate(now);

  return {
    id: "", // Will be set by Firestore service
    userId: context.userId,
    accountId: context.accountId,
    symbol: row.symbol,
    side,
    entryPrice: row.entryPrice,
    exitPrice: row.closePrice,
    positionSize: row.volume,
    openTime,
    closeTime,
    tradeDate,
    pnlPoints,
    pnlCurrency: row.profit,
    rMultiple: null, // Can be calculated later if needed
    status,
    playbookId: null,
    externalTicket: row.ticket,
    source: "mt5_positions",
    commission: row.commission,
    swap: row.swap,
    createdAt,
    updatedAt,
  };
}

