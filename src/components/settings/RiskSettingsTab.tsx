import * as React from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useRiskSettings } from "@/hooks/useRiskSettings";

export function RiskSettingsTab() {
  const { data, loading, saving, error, save } = useRiskSettings();
  const [form, setForm] = React.useState({
    maxDailyLossPercent: 0,
    maxWeeklyLossPercent: 0,
    targetDailyProfitPercent: 0,
    targetWeeklyProfitPercent: 0,
  });

  React.useEffect(() => {
    if (!data) return;

    setForm({
      maxDailyLossPercent: data.maxDailyLossPercent,
      maxWeeklyLossPercent: data.maxWeeklyLossPercent,
      targetDailyProfitPercent: data.targetDailyProfitPercent,
      targetWeeklyProfitPercent: data.targetWeeklyProfitPercent,
    });
  }, [data]);

  const updateField =
    (field: keyof typeof form) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = Number(e.target.value);
      setForm((prev) => ({ ...prev, [field]: value }));
    };

  const handleSave = async () => {
    await save(form);
  };

  if (loading || !data) {
    return (
      <Card className="border-border/50 shadow-lg bg-slate-900">
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">Loading risk settings…</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50 shadow-lg bg-slate-900">
      <CardHeader>
        <CardTitle className="text-white">Risk rules</CardTitle>
        <CardDescription>
          Define your daily and weekly loss limits and profit targets. These will be used by the dashboard and alerts.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 max-w-md">
        {error && <p className="text-sm text-red-500">{error}</p>}

        <div className="space-y-2">
          <Label htmlFor="maxDailyLossPercent">Max daily loss %</Label>
          <Input
            id="maxDailyLossPercent"
            type="number"
            step="0.1"
            min={0}
            max={100}
            value={form.maxDailyLossPercent}
            onChange={updateField("maxDailyLossPercent")}
            className="bg-slate-800"
          />
          <p className="text-xs text-muted-foreground">
            e.g. 4% as the maximum allowed loss for a single day.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="maxWeeklyLossPercent">Max weekly loss %</Label>
          <Input
            id="maxWeeklyLossPercent"
            type="number"
            step="0.1"
            min={0}
            max={100}
            value={form.maxWeeklyLossPercent}
            onChange={updateField("maxWeeklyLossPercent")}
            className="bg-slate-800"
          />
          <p className="text-xs text-muted-foreground">
            e.g. 10% as the maximum allowed loss for a single week.
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="targetDailyProfitPercent">Target daily profit %</Label>
          <Input
            id="targetDailyProfitPercent"
            type="number"
            step="0.1"
            min={0}
            max={100}
            value={form.targetDailyProfitPercent}
            onChange={updateField("targetDailyProfitPercent")}
            className="bg-slate-800"
          />
          <p className="text-xs text-muted-foreground">
            Daily profit target (e.g. 2.5–3%).
          </p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="targetWeeklyProfitPercent">Target weekly profit %</Label>
          <Input
            id="targetWeeklyProfitPercent"
            type="number"
            step="0.1"
            min={0}
            max={100}
            value={form.targetWeeklyProfitPercent}
            onChange={updateField("targetWeeklyProfitPercent")}
            className="bg-slate-800"
          />
          <p className="text-xs text-muted-foreground">
            Weekly profit target consistent with your daily goals.
          </p>
        </div>
      </CardContent>
      <CardFooter className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} className="bg-gradient-primary hover:opacity-90">
          {saving ? "Saving…" : "Save risk settings"}
        </Button>
      </CardFooter>
    </Card>
  );
}

