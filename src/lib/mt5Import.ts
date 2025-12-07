import * as XLSX from "xlsx";
import type { Trade, TradeStatus } from "@/types/trading";

/**
 * Represents a parsed MT5 position row from the trade history report
 */
export interface Mt5PositionRow {
  openTime: string; // raw string from report, e.g. "2025.11.27 13:15:34"
  ticket: string;
  symbol: string;
  type: string; // e.g. "buy", "sell"
  volume: number;
  entryPrice: number;
  sl?: number | null;
  tp?: number | null;
  closeTime: string;
  closePrice: number;
  commission: number;
  swap: number;
  profit: number;
}

/**
 * Parse MT5 date/time string to Date object
 * MT5 format: "YYYY.MM.DD HH:MM:SS"
 */
function parseMt5DateTime(dateTimeStr: string): Date {
  // Split date and time
  const [datePart, timePart] = dateTimeStr.trim().split(" ");
  
  if (!datePart || !timePart) {
    throw new Error(`Invalid MT5 date/time format: ${dateTimeStr}`);
  }

  // Replace dots with dashes in date part: "2025.11.27" -> "2025-11-27"
  const normalizedDate = datePart.replace(/\./g, "-");
  
  // Combine: "2025-11-27T13:15:34"
  const isoString = `${normalizedDate}T${timePart}`;
  
  // Parse as UTC (MT5 reports are typically in broker timezone, but we'll treat as UTC for simplicity)
  const date = new Date(isoString + "Z");
  
  if (isNaN(date.getTime())) {
    throw new Error(`Failed to parse date: ${dateTimeStr}`);
  }
  
  return date;
}

/**
 * Parse a File (XLSX or CSV) and return MT5 positions from the Positions section
 */
export async function parseMt5PositionsFromFile(file: File): Promise<Mt5PositionRow[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        if (!data) {
          reject(new Error("Failed to read file"));
          return;
        }

        // Read workbook
        const workbook = XLSX.read(data, { type: "array" });
        
        // Get first sheet
        const firstSheetName = workbook.SheetNames[0];
        if (!firstSheetName) {
          reject(new Error("No sheets found in file"));
          return;
        }

        const sheet = workbook.Sheets[firstSheetName];
        
        // Convert to 2D array - use raw: true to preserve numbers, then convert
        const rows = XLSX.utils.sheet_to_json<any[]>(sheet, { 
          header: 1, 
          raw: true, // Keep raw values for numbers
          defval: null 
        });

        console.log("Total rows in sheet:", rows.length);
        console.log("First 15 rows for debugging:", rows.slice(0, 15));

        // Find the header row - look for "Positions" first, then find the header row
        let positionsStartIndex = -1;
        let headerRowIndex = -1;
        
        // First, find where "Positions" appears (case-insensitive)
        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          if (row && row.length > 0) {
            const firstCell = String(row[0] || "").trim().toLowerCase();
            if (firstCell.includes("position")) {
              positionsStartIndex = i;
              console.log(`Found "Positions" marker at row ${i + 1}`);
              break;
            }
          }
        }

        // If we found "Positions", look for header row after it
        // Otherwise, look for header row directly
        const searchStart = positionsStartIndex >= 0 ? positionsStartIndex + 1 : 0;
        const searchEnd = Math.min(searchStart + 20, rows.length); // Search up to 20 rows after Positions marker
        
        console.log(`Searching for header row from index ${searchStart} to ${searchEnd}`);
        
        for (let i = searchStart; i < searchEnd; i++) {
          const row = rows[i];
          if (!row || row.length < 3) continue;
          
          const cell0 = String(row[0] || "").trim().toLowerCase();
          const cell1 = String(row[1] || "").trim().toLowerCase();
          const cell2 = String(row[2] || "").trim().toLowerCase();
          
          // Look for header pattern: Time, Position/Ticket, Symbol (case-insensitive, flexible)
          const hasTimeHeader = cell0 === "time" || cell0.includes("time") || cell0 === "open" || cell0 === "open time";
          const hasPositionHeader = cell1 === "position" || cell1 === "ticket" || cell1 === "deal" || cell1.includes("position");
          const hasSymbolHeader = cell2 === "symbol" || cell2 === "instrument" || cell2 === "pair" || cell2.includes("symbol");
          
          if (hasTimeHeader && hasPositionHeader && hasSymbolHeader) {
            headerRowIndex = i;
            console.log(`Found header row at index ${i + 1}:`, row.slice(0, 5));
            break;
          }
        }

        if (headerRowIndex === -1) {
          // Debug: log rows around the Positions marker
          const debugStart = Math.max(0, positionsStartIndex >= 0 ? positionsStartIndex - 2 : 0);
          const debugEnd = Math.min(rows.length, debugStart + 15);
          console.log(`Rows ${debugStart + 1} to ${debugEnd} for debugging:`, rows.slice(debugStart, debugEnd));
          reject(new Error("Could not find Positions header row. Expected columns: Time, Position, Symbol, Type, Volume, Price, S/L, T/P, Time, Price, Commission, Swap, Profit. Please ensure the file is a valid MT5 Trade History Report."));
          return;
        }

        // Extract data rows (after header until "Orders" or empty row)
        const positions: Mt5PositionRow[] = [];
        
        for (let i = headerRowIndex + 1; i < rows.length; i++) {
          const row = rows[i];
          
          // Stop if we hit "Orders" section or empty row
          if (!row || row.length === 0 || !row[0]) {
            break;
          }
          
          const firstCell = String(row[0] || "").trim().toLowerCase();
          if (firstCell === "orders") {
            break;
          }

          // Parse row data - handle different column orders and formats
          // Convert all values to strings first, then parse
          const openTime = row[0] != null ? String(row[0]).trim() : "";
          const ticket = row[1] != null ? String(row[1]).trim() : "";
          const symbol = row[2] != null ? String(row[2]).trim() : "";
          const type = row[3] != null ? String(row[3]).trim().toLowerCase() : "";
          
          // Helper to safely parse numbers
          const safeParseFloat = (val: any): number => {
            if (val == null || val === "" || val === undefined) return 0;
            const parsed = parseFloat(String(val));
            return isNaN(parsed) ? 0 : parsed;
          };

          const safeParseFloatOrNull = (val: any): number | null => {
            if (val == null || val === "" || val === undefined) return null;
            const parsed = parseFloat(String(val));
            return isNaN(parsed) ? null : parsed;
          };
          
          // Try to parse numbers, handle empty strings and nulls
          const volume = safeParseFloat(row[4]);
          const entryPrice = safeParseFloat(row[5]);
          const sl = safeParseFloatOrNull(row[6]);
          const tp = safeParseFloatOrNull(row[7]);
          const closeTime = row[8] != null ? String(row[8]).trim() : "";
          const closePrice = safeParseFloat(row[9]);
          const commission = safeParseFloat(row[10]);
          const swap = safeParseFloat(row[11]);
          const profit = safeParseFloat(row[12]);

          // Validate required fields - be more lenient
          if (!openTime || !symbol || !closeTime) {
            continue; // Skip rows missing critical data
          }

          // Only process buy/sell types (handle variations)
          const normalizedType = type.replace(/[^a-z]/g, ""); // Remove non-letters
          if (normalizedType !== "buy" && normalizedType !== "sell") {
            continue;
          }

          // Validate numeric fields - allow 0 for prices in edge cases, but volume must be > 0
          if (volume <= 0 || isNaN(volume)) {
            console.warn(`Skipping row ${i + 1}: invalid volume`, volume);
            continue;
          }
          
          if (entryPrice <= 0 || isNaN(entryPrice) || closePrice <= 0 || isNaN(closePrice)) {
            console.warn(`Skipping row ${i + 1}: invalid prices`, { entryPrice, closePrice });
            continue;
          }

          // Validate dates
          try {
            parseMt5DateTime(openTime);
            parseMt5DateTime(closeTime);
          } catch (dateError) {
            console.warn(`Skipping row ${i + 1}: invalid date format`, { openTime, closeTime, error: dateError });
            continue;
          }

          positions.push({
            openTime,
            ticket,
            symbol,
            type,
            volume,
            entryPrice,
            sl,
            tp,
            closeTime,
            closePrice,
            commission,
            swap,
            profit,
          });
        }

        if (positions.length === 0) {
          // Debug: log more information
          console.log("Header row index:", headerRowIndex);
          console.log("Rows after header:", rows.slice(headerRowIndex + 1, headerRowIndex + 6));
          console.log("Total rows in sheet:", rows.length);
          reject(new Error(`No valid positions found in the Positions section. Found header at row ${headerRowIndex + 1}, but no valid data rows after it. Please check that the file contains closed positions.`));
          return;
        }

        console.log(`Successfully parsed ${positions.length} positions from MT5 report`);
        resolve(positions);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = () => {
      reject(new Error("Failed to read file"));
    };

    reader.readAsArrayBuffer(file);
  });
}

/**
 * Map MT5 position row to Trade input (without id, userId, timestamps)
 */
export function mapMt5PositionToTradeInput(
  position: Mt5PositionRow,
  accountId: string
): Omit<Trade, "id" | "userId" | "createdAt" | "updatedAt"> {
  const openDate = parseMt5DateTime(position.openTime);
  const closeDate = parseMt5DateTime(position.closeTime);

  const side = position.type === "buy" ? "buy" : "sell";
  const direction = side === "buy" ? 1 : -1;

  const pnlCurrency = position.profit;
  
  // Basic points calculation
  const pnlPoints = (position.closePrice - position.entryPrice) * direction;

  // Derive status from pnlCurrency
  let status: TradeStatus = "be";
  if (pnlCurrency > 0) {
    status = "win";
  } else if (pnlCurrency < 0) {
    status = "loss";
  }

  // Derive tradeDate from closeTime (YYYY-MM-DD)
  const tradeDate = closeDate.toISOString().slice(0, 10);

  return {
    accountId,
    symbol: position.symbol,
    side,
    entryPrice: position.entryPrice,
    exitPrice: position.closePrice,
    positionSize: position.volume,
    openTime: openDate.toISOString(),
    closeTime: closeDate.toISOString(),
    tradeDate,
    pnlPoints,
    pnlCurrency,
    rMultiple: null, // Can be calculated later if needed
    status,
    playbookId: null,
    externalTicket: position.ticket,
    commission: position.commission,
    swap: position.swap,
  };
}

