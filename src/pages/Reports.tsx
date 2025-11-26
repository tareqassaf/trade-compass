import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function Reports() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Reports</h1>
        <p className="text-muted-foreground mt-1">
          Advanced analytics and performance breakdown
        </p>
      </div>

      <Card className="border-border/50 shadow-card bg-gradient-card">
        <CardHeader>
          <CardTitle>Coming Soon</CardTitle>
          <CardDescription>
            Detailed performance reports by instrument, strategy, session, and more
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            This section will include advanced filtering, pivot tables, and detailed breakdowns of your trading performance.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
