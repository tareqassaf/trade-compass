import { memo } from "react";
import { AlertTriangle, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { useRiskSettings } from "@/hooks/useRiskSettings";
import { useDashboardStats } from "@/features/dashboard/useDashboardStats";
import { useAuth } from "@/contexts/AuthContext";
import { evaluateRiskGuard, type RiskGuardEvaluation } from "@/lib/riskGuard";

interface RiskGuardBannerProps {
  accountId: string;
}

interface TelemetryStripProps {
  evaluation: RiskGuardEvaluation;
}

function TelemetryStrip({ evaluation }: TelemetryStripProps) {
  const { todayReturnPercent, weekReturnPercent, dailyLossUsage, weeklyLossUsage, state } = evaluation;

  const isWarning = state === "daily-warning" || state === "weekly-warning";
  const isLocked = state === "daily-locked" || state === "weekly-locked";

  // Format helpers
  const formatPercent = (value?: number) =>
    typeof value === "number"
      ? `${value > 0 ? "+" : ""}${value.toFixed(1)}%`
      : "--";

  const formatUsage = (value?: number) =>
    typeof value === "number" ? `${Math.min(100, Math.round(value))}%` : "--";

  // Determine which usage to show based on state
  const showUsage = isLocked || isWarning;
  const usageValue = state?.startsWith("daily") ? dailyLossUsage : weeklyLossUsage;
  const usageLabel = state?.startsWith("daily") ? "DD" : "WD";

  return (
    <div
      className={cn(
        "mt-2 inline-flex items-center gap-3 rounded-full border px-3 py-1 shadow-[0_0_12px_rgba(34,211,238,0.3)]",
        isLocked
          ? "border-fuchsia-500/40 bg-slate-950/60 shadow-[0_0_12px_rgba(236,72,153,0.3)]"
          : isWarning
            ? "border-amber-500/40 bg-slate-950/60 shadow-[0_0_12px_rgba(245,158,11,0.3)]"
            : "border-cyan-500/40 bg-slate-950/60"
      )}
    >
      <span
        className={cn(
          "h-2 w-2 rounded-full motion-safe:animate-hud-flicker",
          isLocked
            ? "bg-fuchsia-400 shadow-[0_0_10px_rgba(236,72,153,0.8)]"
            : isWarning
              ? "bg-amber-400 shadow-[0_0_10px_rgba(245,158,11,0.8)]"
              : "bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)]"
        )}
      />
      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-cyan-200/80">
        Live Telemetry
      </span>
      <span className="font-mono text-[10px] text-slate-200/80">
        T:{formatPercent(todayReturnPercent)}
      </span>
      <span className="font-mono text-[10px] text-slate-200/60">
        W:{formatPercent(weekReturnPercent)}
      </span>
      {showUsage && usageValue !== undefined && (
        <span
          className={cn(
            "font-mono text-[10px]",
            isLocked ? "text-fuchsia-300/90" : "text-amber-300/90"
          )}
        >
          {usageLabel}:{formatUsage(usageValue)}
        </span>
      )}
    </div>
  );
}

export const RiskGuardBanner = memo(function RiskGuardBanner({ accountId }: RiskGuardBannerProps) {
  const { user } = useAuth();
  const userId = user?.uid || "";
  
  // Early return if no accountId
  if (!accountId || !userId) {
    return null;
  }

  const { data: riskSettings, loading: riskLoading } = useRiskSettings();
  const { data: dashboardStats, isLoading: statsLoading } = useDashboardStats({
    userId,
    accountId,
    days: 30,
  });

  // Early return if loading or no data
  if (riskLoading || statsLoading || !riskSettings || !dashboardStats?.riskProgress) {
    return null;
  }

  const evaluation = evaluateRiskGuard(dashboardStats.riskProgress, riskSettings);

  if (!evaluation || evaluation.state === "none" || !evaluation.message) {
    return null;
  }

  const { state, message } = evaluation;

  const isWarning = state === "daily-warning" || state === "weekly-warning";
  const isLocked = state === "daily-locked" || state === "weekly-locked";

  const Icon = isLocked ? ShieldAlert : AlertTriangle;

  // Get title based on state
  const getTitle = (): string => {
    switch (state) {
      case "daily-locked":
        return "Daily Loss Limit Reached";
      case "weekly-locked":
        return "Weekly Loss Limit Reached";
      case "daily-warning":
        return "Approaching Daily Risk Limit";
      case "weekly-warning":
        return "Approaching Weekly Risk Limit";
      default:
        return "Risk Guard Alert";
    }
  };

  return (
    <div className="mb-6">
      <div
        className={cn(
          "relative overflow-hidden rounded-2xl border bg-slate-950/80 backdrop-blur-xl px-4 py-3 md:px-6 md:py-4 transition-all duration-300",
          isWarning &&
            "border-cyan-400/40 shadow-[0_0_20px_rgba(34,211,238,0.25)]",
          isLocked &&
            "border-fuchsia-500/60 shadow-[0_0_30px_rgba(236,72,153,0.45)] animate-pulse-slow"
        )}
      >
        {/* CRT lines overlay */}
        <div
          className="pointer-events-none absolute inset-0 opacity-20 mix-blend-soft-light motion-safe:animate-crt-lines [background-image:linear-gradient(to_bottom,rgba(255,255,255,0.06)_1px,transparent_1px)] [background-size:100%_4px]"
        />

        {/* Sweeping scanline */}
        <div
          className="pointer-events-none absolute inset-x-0 h-6 bg-gradient-to-b from-transparent via-white/12 to-transparent motion-safe:animate-scanline-sweep"
        />

        {/* Top gradient accent bar */}
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-cyan-400 via-fuchsia-500 to-amber-400" />

        {/* Background gradient overlays for space effect */}
        <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-cyan-500/20 blur-3xl" />
        <div
          className={cn(
            "pointer-events-none absolute -left-24 bottom-0 h-48 w-48 rounded-full blur-3xl",
            isLocked ? "bg-fuchsia-500/30" : "bg-fuchsia-500/20"
          )}
        />

          <div className="relative flex items-start gap-3 md:gap-4">
          {/* Icon */}
          <div className="mt-0.5 flex-shrink-0">
            <Icon
              className={cn(
                "h-5 w-5 md:h-6 md:w-6 transition-colors motion-safe:animate-icon-drift",
                isLocked ? "text-fuchsia-300" : "text-cyan-300"
              )}
            />
          </div>

          {/* Content */}
          <div className="flex-1 space-y-1.5 min-w-0">
            {/* Label */}
            <div
              className={cn(
                "text-[10px] font-medium uppercase tracking-[0.2em]",
                isLocked ? "text-fuchsia-300/80" : "text-cyan-300/70"
              )}
            >
              RISK GUARD · PROTOCOL OMEGA-01
            </div>

            {/* Title */}
            <div className="text-sm md:text-base font-semibold text-slate-50">
              {getTitle()}
            </div>

            {/* Description */}
            <p className="text-xs md:text-sm text-slate-300/80 leading-relaxed">
              {message}
            </p>

            {/* Telemetry HUD strip */}
            <TelemetryStrip evaluation={evaluation} />
          </div>
        </div>
      </div>
    </div>
  );
});

