/**
 * Trade calculation utilities for R-multiple, PnL, and derived metrics
 */

interface TradeCalcInput {
  side: "long" | "short";
  entryPrice: number;
  stopLossPrice: number;
  exitPrice?: number;
  tp1Price?: number;
  tp2Price?: number;
  tp3Price?: number;
  sizeLots: number;
  tickValue?: number;
  tickSize?: number;
}

export function calculateSlPoints(
  side: "long" | "short",
  entryPrice: number,
  stopLossPrice: number
): number {
  if (side === "long") {
    return Math.abs(entryPrice - stopLossPrice);
  } else {
    return Math.abs(stopLossPrice - entryPrice);
  }
}

export function calculateTpPoints(
  side: "long" | "short",
  entryPrice: number,
  tpPrice: number
): number {
  if (side === "long") {
    return Math.max(0, tpPrice - entryPrice);
  } else {
    return Math.max(0, entryPrice - tpPrice);
  }
}

export function calculatePnlPoints(
  side: "long" | "short",
  entryPrice: number,
  exitPrice: number
): number {
  if (side === "long") {
    return exitPrice - entryPrice;
  } else {
    return entryPrice - exitPrice;
  }
}

export function calculateRiskAmount(
  slPoints: number,
  sizeLots: number,
  tickValue: number = 1,
  tickSize: number = 0.01
): number {
  const numberOfTicks = slPoints / tickSize;
  return numberOfTicks * tickValue * sizeLots;
}

export function calculatePnlAmount(
  pnlPoints: number,
  sizeLots: number,
  tickValue: number = 1,
  tickSize: number = 0.01
): number {
  const numberOfTicks = pnlPoints / tickSize;
  return numberOfTicks * tickValue * sizeLots;
}

export function calculateRMultiple(pnlAmount: number, riskAmount: number): number {
  if (riskAmount === 0) return 0;
  return pnlAmount / riskAmount;
}

export function calculatePnlPercent(pnlAmount: number, accountEquity: number): number {
  if (accountEquity === 0) return 0;
  return (pnlAmount / accountEquity) * 100;
}

export function calculateTradeResult(pnlPoints: number): "win" | "loss" | "breakeven" {
  if (pnlPoints > 0) return "win";
  if (pnlPoints < 0) return "loss";
  return "breakeven";
}

export function calculateAllMetrics(input: TradeCalcInput) {
  const slPoints = calculateSlPoints(input.side, input.entryPrice, input.stopLossPrice);
  
  const tp1Points = input.tp1Price
    ? calculateTpPoints(input.side, input.entryPrice, input.tp1Price)
    : null;
  const tp2Points = input.tp2Price
    ? calculateTpPoints(input.side, input.entryPrice, input.tp2Price)
    : null;
  const tp3Points = input.tp3Price
    ? calculateTpPoints(input.side, input.entryPrice, input.tp3Price)
    : null;

  const riskAmount = calculateRiskAmount(
    slPoints,
    input.sizeLots,
    input.tickValue,
    input.tickSize
  );

  let pnlPoints: number | null = null;
  let pnlAmount: number | null = null;
  let rMultiple: number | null = null;
  let result: "win" | "loss" | "breakeven" | "open" = "open";

  if (input.exitPrice) {
    pnlPoints = calculatePnlPoints(input.side, input.entryPrice, input.exitPrice);
    pnlAmount = calculatePnlAmount(
      pnlPoints,
      input.sizeLots,
      input.tickValue,
      input.tickSize
    );
    rMultiple = calculateRMultiple(pnlAmount, riskAmount);
    result = calculateTradeResult(pnlPoints);
  }

  return {
    slPoints,
    tp1Points,
    tp2Points,
    tp3Points,
    pnlPoints,
    pnlAmount,
    rMultiple,
    riskAmount,
    result,
  };
}
