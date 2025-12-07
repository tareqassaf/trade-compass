import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { useUserGeneralSettings } from "@/features/settings/useUserGeneralSettings";
import { useToast } from "@/hooks/use-toast";
import type { UserGeneralSettings } from "@/types/trading";
import { RiskSettingsTab } from "@/components/settings/RiskSettingsTab";

const TIMEZONE_OPTIONS = [
  { value: "Europe/Berlin", label: "(UTC+1) Europe/Berlin" },
  { value: "Europe/London", label: "(UTC+0) Europe/London" },
  { value: "UTC", label: "UTC" },
  { value: "America/New_York", label: "(UTC-5) America/New_York" },
  { value: "America/Chicago", label: "(UTC-6) America/Chicago" },
  { value: "America/Los_Angeles", label: "(UTC-8) America/Los_Angeles" },
  { value: "Asia/Dubai", label: "(UTC+4) Asia/Dubai" },
  { value: "Asia/Riyadh", label: "(UTC+3) Asia/Riyadh" },
  { value: "Asia/Shanghai", label: "(UTC+8) Asia/Shanghai" },
  { value: "Asia/Tokyo", label: "(UTC+9) Asia/Tokyo" },
];

export default function Settings() {
  const { user } = useAuth();
  const userId = (user as any)?.uid || null;
  const { settings, isLoading, error, updateSettings, isUpdating } = useUserGeneralSettings(userId || "");
  const { toast } = useToast();

  // Form state
  const [baseCurrency, setBaseCurrency] = useState<UserGeneralSettings["baseCurrency"]>("EUR");
  const [defaultRisk, setDefaultRisk] = useState<number>(1);
  const [dashboardDays, setDashboardDays] = useState<number>(30);
  const [timezone, setTimezone] = useState<string>("Europe/Berlin");

  // Initialize form with settings or defaults
  useEffect(() => {
    if (settings) {
      setBaseCurrency(settings.baseCurrency ?? "EUR");
      setDefaultRisk(settings.defaultRiskPercent ?? 1);
      setDashboardDays(settings.defaultDashboardDays ?? 30);
      setTimezone(settings.timezone ?? "Europe/Berlin");
    }
  }, [settings]);

  const handleSave = async () => {
    try {
      await updateSettings({
        baseCurrency,
        defaultRiskPercent: defaultRisk,
        defaultDashboardDays: dashboardDays,
        timezone,
      });
      toast({
        title: "Settings saved",
        description: "Your trading preferences have been updated successfully.",
      });
    } catch (err) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to save settings",
        variant: "destructive",
      });
    }
  };

  if (!userId) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className="text-lg text-muted-foreground">Please sign in to view settings.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 bg-slate-950 min-h-screen p-6">
      <div>
        <h1 className="text-3xl font-bold text-white">Settings</h1>
        <p className="text-muted-foreground mt-1">Customize your Trade Compass preferences.</p>
      </div>

      {error && (
        <Card className="border-red-500/50 bg-red-500/10">
          <CardContent className="pt-6">
            <p className="text-red-400">Error loading settings: {error.message}</p>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="trading" className="space-y-6">
        <TabsList className="bg-slate-900">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="trading">Trading</TabsTrigger>
          <TabsTrigger value="accounts">Accounts</TabsTrigger>
          <TabsTrigger value="risk">Risk</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <Card className="border-border/50 shadow-lg bg-slate-900">
        <CardHeader>
              <CardTitle className="text-white">Profile</CardTitle>
              <CardDescription>Your account information</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              value={user?.email || ""}
              disabled
                  className="bg-slate-800"
                />
              </div>
              <p className="text-sm text-muted-foreground">
                Profile settings coming soon.
              </p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trading">
          <Card className="border-border/50 shadow-lg bg-slate-900">
            <CardHeader>
              <CardTitle className="text-white">Trading defaults</CardTitle>
              <CardDescription>Base currency, risk, and dashboard preferences.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {isLoading ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-10 w-full" />
          </div>
          <div className="space-y-2">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="h-10 w-full" />
          </div>
          <div className="space-y-2">
                    <Skeleton className="h-4 w-40" />
                    <Skeleton className="h-10 w-full" />
          </div>
          <div className="space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-10 w-full" />
                  </div>
                </div>
              ) : (
                <>
                  <div className="space-y-1">
                    <Label htmlFor="baseCurrency">Base currency</Label>
                    <Select
                      value={baseCurrency}
                      onValueChange={(value) => setBaseCurrency(value as UserGeneralSettings["baseCurrency"])}
                    >
                      <SelectTrigger id="baseCurrency" className="w-full bg-slate-800">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="USD">USD</SelectItem>
                        <SelectItem value="EUR">EUR</SelectItem>
                        <SelectItem value="GBP">GBP</SelectItem>
                        <SelectItem value="CHF">CHF</SelectItem>
                        <SelectItem value="JPY">JPY</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="defaultRisk">Default risk per trade (%)</Label>
                    <Input
                      id="defaultRisk"
                      type="number"
                      min={0}
                      step={0.1}
                      value={defaultRisk}
                      onChange={(e) => setDefaultRisk(Number(e.target.value))}
                      className="bg-slate-800"
                    />
                    <p className="text-xs text-muted-foreground">
                      Used as a guideline when calculating position size and R-multiples.
                    </p>
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="dashboardDays">Dashboard range (days)</Label>
            <Input
                      id="dashboardDays"
              type="number"
                      min={7}
                      max={365}
                      value={dashboardDays}
                      onChange={(e) => setDashboardDays(Number(e.target.value))}
                      className="bg-slate-800"
                    />
                    <p className="text-xs text-muted-foreground">
                      Number of days used for the main dashboard charts by default.
                    </p>
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="timezone">Timezone</Label>
                    <Select
                      value={timezone}
                      onValueChange={(value) => setTimezone(value)}
                    >
                      <SelectTrigger id="timezone" className="w-full bg-slate-800">
                        <SelectValue placeholder="Select a timezone" />
                      </SelectTrigger>
                      <SelectContent>
                        {TIMEZONE_OPTIONS.map((tz) => (
                          <SelectItem key={tz.value} value={tz.value}>
                            {tz.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <p className="text-xs text-muted-foreground">
                      Used for session/time analytics (e.g. London / NY sessions).
                    </p>
          </div>
                </>
              )}
            </CardContent>
            <CardFooter className="flex justify-end">
              <Button
                onClick={handleSave}
                disabled={isUpdating || isLoading}
                className="bg-gradient-primary hover:opacity-90"
              >
                {isUpdating ? "Saving..." : "Save changes"}
          </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="accounts">
          <Card className="border-border/50 shadow-lg bg-slate-900">
            <CardHeader>
              <CardTitle className="text-white">Accounts</CardTitle>
              <CardDescription>Manage your trading accounts</CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Account management coming soon.
              </p>
        </CardContent>
      </Card>
        </TabsContent>

        <TabsContent value="risk">
          <RiskSettingsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
