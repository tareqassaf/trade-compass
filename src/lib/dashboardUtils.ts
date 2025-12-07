import { format, startOfMonth, endOfMonth, eachDayOfInterval, parseISO, startOfWeek, endOfWeek } from "date-fns";
import type { DailyStat, CompassScore, KpiMetrics } from "@/types/trading";

/**
 * Calculate basic KPIs from daily stats
 */
export function calculateKpis(dailyStats: DailyStat[]): KpiMetrics {
  if (dailyStats.length === 0) {
    return {
      netPnl: 0,
      winRate: 0,
      profitFactor: null,
      avgR: null,
      totalTrades: 0,
      daysTraded: 0,
    };
  }

  const netPnl = dailyStats.reduce((sum, stat) => sum + stat.netPnlCurrency, 0);
  const totalTrades = dailyStats.reduce((sum, stat) => sum + stat.tradesCount, 0);
  const daysTraded = dailyStats.filter((stat) => stat.tradesCount > 0).length;

  const totalWins = dailyStats.reduce((sum, stat) => sum + stat.winsCount, 0);
  const totalLosses = dailyStats.reduce((sum, stat) => sum + stat.lossesCount, 0);
  const totalBe = dailyStats.reduce((sum, stat) => sum + stat.breakevenCount, 0);
  const totalTradesForWinRate = totalWins + totalLosses + totalBe;

  const winRate = totalTradesForWinRate > 0 ? (totalWins / totalTradesForWinRate) * 100 : 0;

  // Calculate profit factor
  const grossProfit = dailyStats
    .filter((stat) => stat.netPnlCurrency > 0)
    .reduce((sum, stat) => sum + stat.netPnlCurrency, 0);
  const grossLoss = Math.abs(
    dailyStats
      .filter((stat) => stat.netPnlCurrency < 0)
      .reduce((sum, stat) => sum + stat.netPnlCurrency, 0)
  );

  const profitFactor = grossLoss > 0 ? grossProfit / grossLoss : grossProfit > 0 ? null : null;

  // Calculate weighted average R
  let totalRWeighted = 0;
  let totalWeight = 0;
  dailyStats.forEach((stat) => {
    if (stat.avgR !== null && stat.tradesCount > 0) {
      totalRWeighted += stat.avgR * stat.tradesCount;
      totalWeight += stat.tradesCount;
    }
  });
  const avgR = totalWeight > 0 ? totalRWeighted / totalWeight : null;

  return {
    netPnl,
    winRate,
    profitFactor,
    avgR,
    totalTrades,
    daysTraded,
  };
}

/**
 * Compute Compass Score from daily stats
 */
export function computeCompassScore(dailyStats: DailyStat[]): CompassScore {
  if (dailyStats.length === 0) {
    return {
      score: 0,
      level: "Weak",
      breakdown: {
        performance: 0,
        consistency: 0,
        risk: 0,
        discipline: 0,
      },
      strengths: [],
      weaknesses: ["No trading data available."],
    };
  }

  const kpis = calculateKpis(dailyStats);

  // Performance Score (based on profit factor and avg R)
  let performanceScore = 0;
  if (kpis.profitFactor !== null) {
    // Map profit factor to 0-100
    if (kpis.profitFactor <= 0.8) {
      performanceScore = 20;
    } else if (kpis.profitFactor <= 1.0) {
      performanceScore = 40;
    } else if (kpis.profitFactor <= 1.5) {
      performanceScore = 65;
    } else if (kpis.profitFactor <= 2.0) {
      performanceScore = 80;
    } else if (kpis.profitFactor >= 3.0) {
      performanceScore = 95;
    } else {
      // Linear interpolation between 2.0 and 3.0
      performanceScore = 80 + ((kpis.profitFactor - 2.0) / 1.0) * 15;
    }
  }

  // Add avgR component (weighted 40%)
  let avgRScore = 0;
  if (kpis.avgR !== null) {
    const clampedR = Math.max(-0.5, Math.min(3, kpis.avgR));
    // Map -0.5 to 0, 0 to 40, 1 to 60, 2 to 80, 3 to 95
    if (clampedR <= 0) {
      avgRScore = 40 + (clampedR / 0.5) * 40;
    } else if (clampedR <= 1) {
      avgRScore = 40 + (clampedR / 1) * 20;
    } else if (clampedR <= 2) {
      avgRScore = 60 + ((clampedR - 1) / 1) * 20;
    } else {
      avgRScore = 80 + ((clampedR - 2) / 1) * 15;
    }
  }

  // Combine performance scores (PF 60%, avgR 40%)
  performanceScore = performanceScore * 0.6 + avgRScore * 0.4;
  performanceScore = Math.max(0, Math.min(100, performanceScore));

  // Consistency Score
  const totalDaysInRange = dailyStats.length;
  const daysTradedRatio = totalDaysInRange > 0 ? kpis.daysTraded / totalDaysInRange : 0;
  let consistencyScore = daysTradedRatio * 100;

  // Penalize high volatility
  const pnlValues = dailyStats.map((stat) => stat.netPnlCurrency);
  const meanPnl = pnlValues.reduce((sum, val) => sum + val, 0) / pnlValues.length;
  const variance =
    pnlValues.reduce((sum, val) => sum + Math.pow(val - meanPnl, 2), 0) / pnlValues.length;
  const stdDev = Math.sqrt(variance);
  const coefficientOfVariation = meanPnl !== 0 ? stdDev / Math.abs(meanPnl) : 0;

  // Reduce consistency if volatility is very high
  if (coefficientOfVariation > 2) {
    consistencyScore *= 0.7;
  } else if (coefficientOfVariation > 1) {
    consistencyScore *= 0.85;
  }

  consistencyScore = Math.max(0, Math.min(100, consistencyScore));

  // Risk Score
  const winningDays = dailyStats.filter((stat) => stat.netPnlCurrency > 0);
  const losingDays = dailyStats.filter((stat) => stat.netPnlCurrency < 0);

  const avgWinningDay =
    winningDays.length > 0
      ? winningDays.reduce((sum, stat) => sum + stat.netPnlCurrency, 0) / winningDays.length
      : 0;
  const avgLosingDay =
    losingDays.length > 0
      ? Math.abs(losingDays.reduce((sum, stat) => sum + stat.netPnlCurrency, 0) / losingDays.length)
      : 0;

  let riskScore = 80;
  if (avgLosingDay > 0 && avgWinningDay > 0) {
    const ratio = avgLosingDay / avgWinningDay;
    if (ratio <= 1) {
      riskScore = 90;
    } else if (ratio <= 2) {
      riskScore = 70;
    } else if (ratio <= 3) {
      riskScore = 40;
    } else {
      riskScore = 20;
    }
  } else if (avgLosingDay > 0) {
    riskScore = 20;
  }

  // Discipline Score
  let disciplineScore = 50;
  if (kpis.winRate >= 45 && kpis.winRate <= 60 && (kpis.profitFactor ?? 0) > 1.3) {
    disciplineScore = 80;
  } else if (kpis.winRate >= 40 && kpis.winRate < 45 && (kpis.profitFactor ?? 0) > 1.2) {
    disciplineScore = 65;
  } else if (kpis.winRate < 40 || (kpis.profitFactor ?? 0) < 1.0) {
    disciplineScore = 30;
  }

  // Check for very large loss days
  const veryLargeLossDays = losingDays.filter(
    (stat) => Math.abs(stat.netPnlCurrency) > avgLosingDay * 2
  );
  if (veryLargeLossDays.length > losingDays.length * 0.3) {
    disciplineScore *= 0.7;
  }

  disciplineScore = Math.max(0, Math.min(100, disciplineScore));

  // Overall Score (weighted average)
  const overallScore =
    performanceScore * 0.35 + consistencyScore * 0.25 + riskScore * 0.25 + disciplineScore * 0.15;
  const finalScore = Math.max(0, Math.min(100, overallScore));

  // Map score to level
  let level: "Weak" | "Developing" | "Solid" | "Strong" | "Elite";
  if (finalScore < 40) {
    level = "Weak";
  } else if (finalScore < 60) {
    level = "Developing";
  } else if (finalScore < 75) {
    level = "Solid";
  } else if (finalScore < 90) {
    level = "Strong";
  } else {
    level = "Elite";
  }

  // Generate strengths and weaknesses
  const strengths: string[] = [];
  const weaknesses: string[] = [];

  if (kpis.winRate >= 50) {
    strengths.push("Good accuracy (solid win rate).");
  } else if (kpis.winRate < 40) {
    weaknesses.push("Low win rate with many losing days.");
  }

  if (kpis.profitFactor !== null && kpis.profitFactor > 1.5) {
    strengths.push("Strong profit factor.");
  } else if (kpis.profitFactor !== null && kpis.profitFactor <= 1.1) {
    weaknesses.push("Profit factor close to 1.0 (break-even).");
  }

  if (avgLosingDay > 0 && avgWinningDay > 0 && avgLosingDay <= avgWinningDay) {
    strengths.push("Losses are relatively small compared to wins.");
  } else if (avgLosingDay > avgWinningDay * 2) {
    weaknesses.push("Average losing day is much larger than average winning day.");
  }

  if (daysTradedRatio >= 0.7) {
    strengths.push("Consistent trading activity.");
  } else if (daysTradedRatio < 0.3) {
    weaknesses.push("Highly inconsistent trading activity (few days traded in the range).");
  }

  if (kpis.avgR !== null && kpis.avgR > 1.5) {
    strengths.push("Strong risk-reward ratio.");
  }

  if (strengths.length === 0) {
    strengths.push("Building trading foundation.");
  }
  if (weaknesses.length === 0) {
    weaknesses.push("Continue monitoring performance metrics.");
  }

  return {
    score: finalScore,
    level,
    breakdown: {
      performance: performanceScore,
      consistency: consistencyScore,
      risk: riskScore,
      discipline: disciplineScore,
    },
    strengths: strengths.slice(0, 3),
    weaknesses: weaknesses.slice(0, 3),
  };
}

/**
 * Build cumulative PnL series for chart
 */
export function buildCumulativePnlSeries(
  dailyStats: DailyStat[]
): { date: string; cumulativePnl: number }[] {
  const sorted = [...dailyStats].sort((a, b) => a.date.localeCompare(b.date));
  let cumulative = 0;
  return sorted.map((stat) => {
    cumulative += stat.netPnlCurrency;
    return {
      date: format(parseISO(stat.date), "MMM dd"),
      cumulativePnl: cumulative,
    };
  });
}

/**
 * Build daily PnL series for chart
 */
export function buildDailyPnlSeries(dailyStats: DailyStat[]): { date: string; pnl: number }[] {
  const sorted = [...dailyStats].sort((a, b) => a.date.localeCompare(b.date));
  return sorted.map((stat) => ({
    date: format(parseISO(stat.date), "MMM dd"),
    pnl: stat.netPnlCurrency,
  }));
}

/**
 * Build calendar model for heatmap
 */
export function buildCalendarModel(
  dailyStats: DailyStat[],
  month: Date = new Date()
): Array<{
  date: Date;
  dateStr: string;
  pnl: number;
  tradesCount: number;
  category: "winDay" | "lossDay" | "flatDay" | "noTrade";
}> {
  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const statsMap = new Map<string, DailyStat>();
  dailyStats.forEach((stat) => {
    statsMap.set(stat.date, stat);
  });

  return days.map((day) => {
    const dateStr = format(day, "yyyy-MM-dd");
    const stat = statsMap.get(dateStr);

    if (!stat || stat.tradesCount === 0) {
      return {
        date: day,
        dateStr,
        pnl: 0,
        tradesCount: 0,
        category: "noTrade" as const,
      };
    }

    let category: "winDay" | "lossDay" | "flatDay";
    if (stat.netPnlCurrency > 0) {
      category = "winDay";
    } else if (stat.netPnlCurrency < 0) {
      category = "lossDay";
    } else {
      category = "flatDay";
    }

    return {
      date: day,
      dateStr,
      pnl: stat.netPnlCurrency,
      tradesCount: stat.tradesCount,
      category,
    };
  });
}

/**
 * Build weekly summary
 */
export function buildWeeklySummary(
  dailyStats: DailyStat[],
  month: Date = new Date()
): Array<{ weekLabel: string; netPnl: number; daysTraded: number }> {
  const monthStart = startOfMonth(month);
  const monthEnd = endOfMonth(month);

  const statsMap = new Map<string, DailyStat>();
  dailyStats.forEach((stat) => {
    statsMap.set(stat.date, stat);
  });

  const weeks: Array<{ weekLabel: string; netPnl: number; daysTraded: number }> = [];
  let currentWeekStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  let weekIndex = 1;

  while (currentWeekStart <= monthEnd) {
    const weekEnd = endOfWeek(currentWeekStart, { weekStartsOn: 0 });
    const weekDays = eachDayOfInterval({
      start: currentWeekStart > monthStart ? currentWeekStart : monthStart,
      end: weekEnd < monthEnd ? weekEnd : monthEnd,
    });

    let weekPnl = 0;
    let weekDaysTraded = 0;

    weekDays.forEach((day) => {
      const dateStr = format(day, "yyyy-MM-dd");
      const stat = statsMap.get(dateStr);
      if (stat && stat.tradesCount > 0) {
        weekPnl += stat.netPnlCurrency;
        weekDaysTraded += 1;
      }
    });

    weeks.push({
      weekLabel: `Week ${weekIndex}`,
      netPnl: weekPnl,
      daysTraded: weekDaysTraded,
    });

    currentWeekStart = new Date(weekEnd);
    currentWeekStart.setDate(currentWeekStart.getDate() + 1);
    weekIndex += 1;
  }

  return weeks;
}

