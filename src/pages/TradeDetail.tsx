import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Edit2, Save, X, TrendingUp, TrendingDown } from "lucide-react";
import { calculateAllMetrics } from "@/lib/tradeCalculations";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from "recharts";

export default function TradeDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<any>({});

  const { data: trade, isLoading } = useQuery({
    queryKey: ["trade", id],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from("trades")
          .select(`
            *,
            instrument:instruments(symbol, name, tick_value, tick_size),
            strategy:strategies(name, description),
            session:sessions(name)
          `)
          .eq("id", id)
          .single();
        if (error) {
          console.warn("Supabase query error (migrating to Firebase):", error);
          return null;
        }
        return data;
      } catch (error) {
        console.warn("Error fetching trade (migrating to Firebase):", error);
        return null;
      }
    },
    enabled: !!id,
  });

  const { data: averages } = useQuery({
    queryKey: ["trade-averages", (user as any)?.uid || (user as any)?.id],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from("trades")
          .select("r_multiple, pnl_amount, result")
          .eq("user_id", (user as any)?.uid || (user as any)?.id)
          .not("exit_price", "is", null);
        
        if (error) {
          console.warn("Supabase query error (migrating to Firebase):", error);
          return { avgR: 0, avgWin: 0, avgLoss: 0, winRate: 0, totalTrades: 0 };
        }
        
        const winningTrades = (data || []).filter(t => t.result === "win");
        const losingTrades = (data || []).filter(t => t.result === "loss");
        const avgR = (data || []).reduce((sum, t) => sum + (t.r_multiple || 0), 0) / ((data || []).length || 1);
        const avgWin = winningTrades.length > 0 ? winningTrades.reduce((sum, t) => sum + (t.pnl_amount || 0), 0) / winningTrades.length : 0;
        const avgLoss = losingTrades.length > 0 ? losingTrades.reduce((sum, t) => sum + (t.pnl_amount || 0), 0) / losingTrades.length : 0;
        const winRate = ((data || []).length > 0 ? (winningTrades.length / (data || []).length) * 100 : 0);
        
        return { avgR, avgWin, avgLoss, winRate, totalTrades: (data || []).length };
      } catch (error) {
        console.warn("Error fetching trade averages (migrating to Firebase):", error);
        return { avgR: 0, avgWin: 0, avgLoss: 0, winRate: 0, totalTrades: 0 };
      }
    },
    enabled: !!user,
  });

  const updateTradeMutation = useMutation({
    mutationFn: async (data: any) => {
      const metrics = calculateAllMetrics({
        side: data.side,
        entryPrice: parseFloat(data.entry_price),
        stopLossPrice: parseFloat(data.stop_loss_price),
        exitPrice: data.exit_price ? parseFloat(data.exit_price) : undefined,
        tp1Price: data.tp1_price ? parseFloat(data.tp1_price) : undefined,
        tp2Price: data.tp2_price ? parseFloat(data.tp2_price) : undefined,
        tp3Price: data.tp3_price ? parseFloat(data.tp3_price) : undefined,
        sizeLots: parseFloat(data.size_lots),
        tickValue: trade?.instrument?.tick_value || 1,
        tickSize: trade?.instrument?.tick_size || 0.01,
      });

      try {
        const { error } = await supabase
          .from("trades")
          .update({
          ...data,
          sl_points: metrics.slPoints,
          tp1_points: metrics.tp1Points,
          tp2_points: metrics.tp2Points,
          tp3_points: metrics.tp3Points,
          pnl_points: metrics.pnlPoints,
          pnl_amount: metrics.pnlAmount,
          r_multiple: metrics.rMultiple,
          result: metrics.result,
        })
        .eq("id", id);

        if (error) {
          console.warn("Supabase update error (migrating to Firebase):", error);
          throw new Error("Failed to update trade. Please migrate to Firebase.");
        }
      } catch (error: any) {
        console.warn("Error updating trade (migrating to Firebase):", error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trade", id] });
      queryClient.invalidateQueries({ queryKey: ["trades"] });
      setIsEditing(false);
      toast({ title: "Trade updated", description: "Changes saved successfully." });
    },
    onError: (error: any) => {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    },
  });

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!trade) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Trade not found</p>
        <Button onClick={() => navigate("/trades")} className="mt-4">
          Back to Trades
        </Button>
      </div>
    );
  }

  const handleEdit = () => {
    setEditData({ ...trade });
    setIsEditing(true);
  };

  const handleSave = () => {
    updateTradeMutation.mutate(editData);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditData({});
  };

  const updateEditField = (field: string, value: any) => {
    setEditData((prev: any) => ({ ...prev, [field]: value }));
  };

  // Prepare visualization data
  const visualData = [
    {
      name: "Levels",
      "Stop Loss": Number(trade.stop_loss_price),
      "Entry": Number(trade.entry_price),
      "TP1": trade.tp1_price ? Number(trade.tp1_price) : undefined,
      "TP2": trade.tp2_price ? Number(trade.tp2_price) : undefined,
      "TP3": trade.tp3_price ? Number(trade.tp3_price) : undefined,
      "Exit": trade.exit_price ? Number(trade.exit_price) : undefined,
    },
  ];

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/trades")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold">{trade.instrument?.symbol}</h1>
              <Badge variant={trade.result === "win" ? "default" : trade.result === "loss" ? "destructive" : "secondary"}>
                {trade.result}
              </Badge>
              <div className={`p-2 rounded-lg ${trade.side === "long" ? "bg-success/20" : "bg-destructive/20"}`}>
                {trade.side === "long" ? (
                  <TrendingUp className="h-5 w-5 text-success" />
                ) : (
                  <TrendingDown className="h-5 w-5 text-destructive" />
                )}
              </div>
            </div>
            <p className="text-muted-foreground mt-1">
              {new Date(trade.opened_at).toLocaleString()}
            </p>
          </div>
        </div>
        {!isEditing ? (
          <Button onClick={handleEdit} className="bg-gradient-primary hover:opacity-90">
            <Edit2 className="mr-2 h-4 w-4" />
            Edit
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button onClick={handleSave} className="bg-gradient-primary hover:opacity-90">
              <Save className="mr-2 h-4 w-4" />
              Save
            </Button>
            <Button onClick={handleCancel} variant="outline">
              <X className="mr-2 h-4 w-4" />
              Cancel
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Info */}
        <div className="lg:col-span-2 space-y-6">
          {/* Performance Metrics */}
          <Card className="border-border/50 shadow-card bg-gradient-card">
            <CardHeader>
              <CardTitle>Performance Metrics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">P&L Amount</p>
                  <p className={`text-2xl font-bold ${(trade.pnl_amount || 0) >= 0 ? "text-success" : "text-destructive"}`}>
                    ${(trade.pnl_amount || 0).toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">R-Multiple</p>
                  <p className={`text-2xl font-bold ${(trade.r_multiple || 0) >= 0 ? "text-success" : "text-destructive"}`}>
                    {trade.r_multiple ? `${trade.r_multiple.toFixed(2)}R` : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">P&L Points</p>
                  <p className="text-2xl font-bold">
                    {trade.pnl_points ? trade.pnl_points.toFixed(2) : "—"}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">P&L %</p>
                  <p className="text-2xl font-bold">
                    {trade.pnl_percent ? `${trade.pnl_percent.toFixed(2)}%` : "—"}
                  </p>
                </div>
              </div>

              {averages && trade.exit_price && (
                <>
                  <Separator className="my-4" />
                  <div className="space-y-2">
                    <p className="text-sm font-semibold">Comparison to Your Averages</p>
                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <p className="text-muted-foreground">Your Avg R: {averages.avgR.toFixed(2)}R</p>
                        <p className={trade.r_multiple && trade.r_multiple > averages.avgR ? "text-success" : "text-muted-foreground"}>
                          {trade.r_multiple && trade.r_multiple > averages.avgR ? "Above average ✓" : "Below average"}
                        </p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Your Win Rate: {averages.winRate.toFixed(1)}%</p>
                        <p className="text-muted-foreground">Total Trades: {averages.totalTrades}</p>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Price Levels Visualization */}
          <Card className="border-border/50 shadow-card bg-gradient-card">
            <CardHeader>
              <CardTitle>Price Levels</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={visualData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis type="number" stroke="hsl(var(--muted-foreground))" />
                  <YAxis dataKey="name" type="category" stroke="hsl(var(--muted-foreground))" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      border: "1px solid hsl(var(--border))",
                      borderRadius: "8px",
                    }}
                  />
                  <Legend />
                  <ReferenceLine x={Number(trade.entry_price)} stroke="hsl(var(--primary))" strokeWidth={2} />
                  <Bar dataKey="Stop Loss" fill="hsl(var(--destructive))" />
                  <Bar dataKey="Entry" fill="hsl(var(--primary))" />
                  <Bar dataKey="TP1" fill="hsl(var(--success))" />
                  <Bar dataKey="TP2" fill="hsl(var(--success))" />
                  <Bar dataKey="TP3" fill="hsl(var(--success))" />
                  {trade.exit_price && <Bar dataKey="Exit" fill="hsl(var(--accent))" />}
                </BarChart>
              </ResponsiveContainer>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4 text-sm">
                <div>
                  <p className="text-muted-foreground">Entry Price</p>
                  <p className="font-semibold">{trade.entry_price}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">Stop Loss</p>
                  <p className="font-semibold text-destructive">{trade.stop_loss_price}</p>
                </div>
                {trade.exit_price && (
                  <div>
                    <p className="text-muted-foreground">Exit Price</p>
                    <p className="font-semibold">{trade.exit_price}</p>
                  </div>
                )}
                {trade.tp1_price && (
                  <div>
                    <p className="text-muted-foreground">TP1</p>
                    <p className="font-semibold text-success">{trade.tp1_price}</p>
                  </div>
                )}
                {trade.tp2_price && (
                  <div>
                    <p className="text-muted-foreground">TP2</p>
                    <p className="font-semibold text-success">{trade.tp2_price}</p>
                  </div>
                )}
                {trade.tp3_price && (
                  <div>
                    <p className="text-muted-foreground">TP3</p>
                    <p className="font-semibold text-success">{trade.tp3_price}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Trade Notes */}
          {(trade.notes || trade.pre_trade_plan || trade.post_trade_review || isEditing) && (
            <Card className="border-border/50 shadow-card bg-gradient-card">
              <CardHeader>
                <CardTitle>Notes & Review</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {isEditing ? (
                  <>
                    <div className="space-y-2">
                      <Label>Pre-Trade Plan</Label>
                      <Textarea
                        value={editData.pre_trade_plan || ""}
                        onChange={(e) => updateEditField("pre_trade_plan", e.target.value)}
                        rows={3}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Notes</Label>
                      <Textarea
                        value={editData.notes || ""}
                        onChange={(e) => updateEditField("notes", e.target.value)}
                        rows={3}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Post-Trade Review</Label>
                      <Textarea
                        value={editData.post_trade_review || ""}
                        onChange={(e) => updateEditField("post_trade_review", e.target.value)}
                        rows={3}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Execution Errors</Label>
                      <Textarea
                        value={editData.execution_errors || ""}
                        onChange={(e) => updateEditField("execution_errors", e.target.value)}
                        rows={2}
                      />
                    </div>
                  </>
                ) : (
                  <>
                    {trade.pre_trade_plan && (
                      <div>
                        <p className="text-sm font-semibold text-muted-foreground mb-2">Pre-Trade Plan</p>
                        <p className="whitespace-pre-wrap">{trade.pre_trade_plan}</p>
                      </div>
                    )}
                    {trade.notes && (
                      <div>
                        <p className="text-sm font-semibold text-muted-foreground mb-2">Notes</p>
                        <p className="whitespace-pre-wrap">{trade.notes}</p>
                      </div>
                    )}
                    {trade.post_trade_review && (
                      <div>
                        <p className="text-sm font-semibold text-muted-foreground mb-2">Post-Trade Review</p>
                        <p className="whitespace-pre-wrap">{trade.post_trade_review}</p>
                      </div>
                    )}
                    {trade.execution_errors && (
                      <div>
                        <p className="text-sm font-semibold text-muted-foreground mb-2">Execution Errors</p>
                        <p className="whitespace-pre-wrap text-destructive">{trade.execution_errors}</p>
                      </div>
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Trade Details */}
          <Card className="border-border/50 shadow-card bg-gradient-card">
            <CardHeader>
              <CardTitle>Trade Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {isEditing ? (
                <>
                  <div className="space-y-2">
                    <Label>Position Size (Lots)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={editData.size_lots}
                      onChange={(e) => updateEditField("size_lots", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Exit Price</Label>
                    <Input
                      type="number"
                      step="0.00001"
                      value={editData.exit_price || ""}
                      onChange={(e) => updateEditField("exit_price", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Rating (1-5)</Label>
                    <Input
                      type="number"
                      min="1"
                      max="5"
                      value={editData.rating || ""}
                      onChange={(e) => updateEditField("rating", e.target.value)}
                    />
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <p className="text-sm text-muted-foreground">Strategy</p>
                    <p className="font-semibold">{trade.strategy?.name || "—"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Session</p>
                    <p className="font-semibold">{trade.session?.name || "—"}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Account Type</p>
                    <p className="font-semibold capitalize">{trade.account_type}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Order Type</p>
                    <p className="font-semibold capitalize">{trade.order_type}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Position Size</p>
                    <p className="font-semibold">{trade.size_lots} lots</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Risk %</p>
                    <p className="font-semibold">{trade.risk_percent ? `${trade.risk_percent}%` : "—"}</p>
                  </div>
                  {trade.rating && (
                    <div>
                      <p className="text-sm text-muted-foreground">Rating</p>
                      <p className="font-semibold">{trade.rating}/5 ⭐</p>
                    </div>
                  )}
                  {trade.mae_points && (
                    <div>
                      <p className="text-sm text-muted-foreground">MAE (Points)</p>
                      <p className="font-semibold">{trade.mae_points}</p>
                    </div>
                  )}
                  {trade.mfe_points && (
                    <div>
                      <p className="text-sm text-muted-foreground">MFE (Points)</p>
                      <p className="font-semibold">{trade.mfe_points}</p>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Risk Metrics */}
          <Card className="border-border/50 shadow-card bg-gradient-card">
            <CardHeader>
              <CardTitle>Risk Metrics</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-sm text-muted-foreground">SL Points</p>
                <p className="font-semibold">{trade.sl_points?.toFixed(2) || "—"}</p>
              </div>
              {trade.tp1_points && (
                <div>
                  <p className="text-sm text-muted-foreground">TP1 Points</p>
                  <p className="font-semibold">{trade.tp1_points.toFixed(2)}</p>
                </div>
              )}
              {trade.tp2_points && (
                <div>
                  <p className="text-sm text-muted-foreground">TP2 Points</p>
                  <p className="font-semibold">{trade.tp2_points.toFixed(2)}</p>
                </div>
              )}
              {trade.tp3_points && (
                <div>
                  <p className="text-sm text-muted-foreground">TP3 Points</p>
                  <p className="font-semibold">{trade.tp3_points.toFixed(2)}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
