import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";

export default function Settings() {
  const { user } = useAuth();

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user?.id)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Settings</h1>
        <p className="text-muted-foreground mt-1">
          Manage your account and preferences
        </p>
      </div>

      <Card className="border-border/50 shadow-card bg-gradient-card">
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>
            Your account information and trading preferences
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              defaultValue={profile?.name || ""}
              placeholder="Your name"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              value={user?.email || ""}
              disabled
              className="bg-muted"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="timezone">Timezone</Label>
            <Input
              id="timezone"
              defaultValue={profile?.timezone || "UTC"}
              placeholder="UTC"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="currency">Base Currency</Label>
            <Input
              id="currency"
              defaultValue={profile?.base_currency || "USD"}
              placeholder="USD"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="risk">Default Risk %</Label>
            <Input
              id="risk"
              type="number"
              step="0.1"
              defaultValue={profile?.default_risk_percent || 1.0}
              placeholder="1.0"
            />
          </div>
          <Button className="bg-gradient-primary hover:opacity-90">
            Save Changes
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
