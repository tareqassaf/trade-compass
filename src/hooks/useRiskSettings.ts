import { useEffect, useState } from "react";
import type { UserRiskSettings } from "@/types/settings";
import { getUserRiskSettings, saveUserRiskSettings } from "@/lib/firestoreService";
import { useAuth } from "@/contexts/AuthContext";

const DEFAULT_RISK_SETTINGS: UserRiskSettings = {
  maxDailyLossPercent: 4,
  maxWeeklyLossPercent: 10,
  targetDailyProfitPercent: 3,
  targetWeeklyProfitPercent: 15,
  createdAt: null,
  updatedAt: null,
};

export function useRiskSettings() {
  const { user } = useAuth();
  const userId = user?.uid;

  const [data, setData] = useState<UserRiskSettings | null>(null);
  const [loading, setLoading] = useState<boolean>(!!userId);
  const [saving, setSaving] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;
    setLoading(true);

    getUserRiskSettings(userId)
      .then((res) => {
        if (cancelled) return;
        setData(res ?? DEFAULT_RISK_SETTINGS);
      })
      .catch((err) => {
        console.error(err);
        if (!cancelled) setError("Failed to load risk settings");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  const save = async (partial: Partial<UserRiskSettings>) => {
    if (!userId || !data) return;
    setSaving(true);
    setError(null);

    const merged: UserRiskSettings = { ...data, ...partial };

    try {
      await saveUserRiskSettings(userId, {
        maxDailyLossPercent: merged.maxDailyLossPercent,
        maxWeeklyLossPercent: merged.maxWeeklyLossPercent,
        targetDailyProfitPercent: merged.targetDailyProfitPercent,
        targetWeeklyProfitPercent: merged.targetWeeklyProfitPercent,
      });

      setData(merged);
    } catch (err) {
      console.error(err);
      setError("Failed to save risk settings");
    } finally {
      setSaving(false);
    }
  };

  return { data, loading, saving, error, save };
}

