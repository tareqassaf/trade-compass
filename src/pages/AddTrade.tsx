import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, ArrowRight, Save } from "lucide-react";
import { calculateAllMetrics } from "@/lib/tradeCalculations";

type Step = "basic" | "risk" | "result";

export default function AddTrade() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [currentStep, setCurrentStep] = useState<Step>("basic");
  
  // Form state
  const [formData, setFormData] = useState({
    tradingDay: new Date().toISOString().split("T")[0],
    openedAt: new Date().toISOString().slice(0, 16),
    instrumentId: "",
    strategyId: "",
    sessionId: "",
    side: "long" as "long" | "short",
    orderType: "market" as "market" | "limit" | "stop",
    accountType: "demo" as "demo" | "live" | "prop",
    
    // Risk step
    sizeLots: "",
    riskPercent: "1",
    plannedEntryLow: "",
    plannedEntryHigh: "",
    entryPrice: "",
    stopLossPrice: "",
    tp1Price: "",
    tp2Price: "",
    tp3Price: "",
    
    // Result step
    closedAt: "",
    exitPrice: "",
    mfePoints: "",
    maePoints: "",
    rating: "",
    notes: "",
    executionErrors: "",
    preTradePlan: "",
    postTradeReview: "",
  });

  // Fetch instruments, strategies, sessions
  const { data: instruments } = useQuery({
    queryKey: ["instruments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("instruments")
        .select("*")
        .eq("is_active", true)
        .order("symbol");
      if (error) throw error;
      return data;
    },
  });

  const { data: strategies } = useQuery({
    queryKey: ["strategies"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("strategies")
        .select("*")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: sessions } = useQuery({
    queryKey: ["sessions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sessions")
        .select("*")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const createTradeMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");

      const selectedInstrument = instruments?.find(i => i.id === formData.instrumentId);
      
      const metrics = calculateAllMetrics({
        side: formData.side,
        entryPrice: parseFloat(formData.entryPrice),
        stopLossPrice: parseFloat(formData.stopLossPrice),
        exitPrice: formData.exitPrice ? parseFloat(formData.exitPrice) : undefined,
        tp1Price: formData.tp1Price ? parseFloat(formData.tp1Price) : undefined,
        tp2Price: formData.tp2Price ? parseFloat(formData.tp2Price) : undefined,
        tp3Price: formData.tp3Price ? parseFloat(formData.tp3Price) : undefined,
        sizeLots: parseFloat(formData.sizeLots),
        tickValue: selectedInstrument?.tick_value || 1,
        tickSize: selectedInstrument?.tick_size || 0.01,
      });

      const tradeData = {
        user_id: user.id,
        trading_day: formData.tradingDay,
        opened_at: formData.openedAt,
        closed_at: formData.closedAt || null,
        instrument_id: formData.instrumentId,
        strategy_id: formData.strategyId || null,
        session_id: formData.sessionId || null,
        side: formData.side,
        order_type: formData.orderType,
        account_type: formData.accountType,
        size_lots: parseFloat(formData.sizeLots),
        risk_percent: formData.riskPercent ? parseFloat(formData.riskPercent) : null,
        planned_entry_low: formData.plannedEntryLow ? parseFloat(formData.plannedEntryLow) : null,
        planned_entry_high: formData.plannedEntryHigh ? parseFloat(formData.plannedEntryHigh) : null,
        entry_price: parseFloat(formData.entryPrice),
        stop_loss_price: parseFloat(formData.stopLossPrice),
        tp1_price: formData.tp1Price ? parseFloat(formData.tp1Price) : null,
        tp2_price: formData.tp2Price ? parseFloat(formData.tp2Price) : null,
        tp3_price: formData.tp3Price ? parseFloat(formData.tp3Price) : null,
        exit_price: formData.exitPrice ? parseFloat(formData.exitPrice) : null,
        sl_points: metrics.slPoints,
        tp1_points: metrics.tp1Points,
        tp2_points: metrics.tp2Points,
        tp3_points: metrics.tp3Points,
        pnl_points: metrics.pnlPoints,
        pnl_amount: metrics.pnlAmount,
        r_multiple: metrics.rMultiple,
        mfe_points: formData.mfePoints ? parseFloat(formData.mfePoints) : null,
        mae_points: formData.maePoints ? parseFloat(formData.maePoints) : null,
        result: metrics.result,
        rating: formData.rating ? parseInt(formData.rating) : null,
        notes: formData.notes || null,
        execution_errors: formData.executionErrors || null,
        pre_trade_plan: formData.preTradePlan || null,
        post_trade_review: formData.postTradeReview || null,
      };

      const { data, error } = await supabase
        .from("trades")
        .insert(tradeData)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trades"] });
      toast({
        title: "Trade created",
        description: "Your trade has been successfully recorded.",
      });
      navigate("/trades");
    },
    onError: (error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleNext = () => {
    if (currentStep === "basic") setCurrentStep("risk");
    else if (currentStep === "risk") setCurrentStep("result");
  };

  const handleBack = () => {
    if (currentStep === "result") setCurrentStep("risk");
    else if (currentStep === "risk") setCurrentStep("basic");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createTradeMutation.mutate();
  };

  const updateField = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const canProceedFromBasic = formData.instrumentId && formData.tradingDay && formData.openedAt;
  const canProceedFromRisk = formData.sizeLots && formData.entryPrice && formData.stopLossPrice;

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/trades")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Add New Trade</h1>
          <p className="text-muted-foreground mt-1">
            Step {currentStep === "basic" ? "1" : currentStep === "risk" ? "2" : "3"} of 3
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <Card className="border-border/50 shadow-card bg-gradient-card">
          <CardHeader>
            <CardTitle>
              {currentStep === "basic" && "Basic Information"}
              {currentStep === "risk" && "Entry & Risk Management"}
              {currentStep === "result" && "Results & Review"}
            </CardTitle>
            <CardDescription>
              {currentStep === "basic" && "Select instrument, strategy, and trade timing"}
              {currentStep === "risk" && "Define your entry, stop loss, and targets"}
              {currentStep === "result" && "Record exit and trade outcome (optional for open trades)"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Step 1: Basic Info */}
            {currentStep === "basic" && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="tradingDay">Trading Day *</Label>
                    <Input
                      id="tradingDay"
                      type="date"
                      value={formData.tradingDay}
                      onChange={(e) => updateField("tradingDay", e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="openedAt">Opened At *</Label>
                    <Input
                      id="openedAt"
                      type="datetime-local"
                      value={formData.openedAt}
                      onChange={(e) => updateField("openedAt", e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="instrument">Instrument *</Label>
                  <Select value={formData.instrumentId} onValueChange={(v) => updateField("instrumentId", v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select instrument" />
                    </SelectTrigger>
                    <SelectContent>
                      {instruments?.map((inst) => (
                        <SelectItem key={inst.id} value={inst.id}>
                          {inst.symbol} {inst.name && `- ${inst.name}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="strategy">Strategy</Label>
                    <Select value={formData.strategyId} onValueChange={(v) => updateField("strategyId", v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select strategy" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">None</SelectItem>
                        {strategies?.map((strat) => (
                          <SelectItem key={strat.id} value={strat.id}>
                            {strat.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="session">Session</Label>
                    <Select value={formData.sessionId} onValueChange={(v) => updateField("sessionId", v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select session" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">None</SelectItem>
                        {sessions?.map((sess) => (
                          <SelectItem key={sess.id} value={sess.id}>
                            {sess.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="side">Side *</Label>
                    <Select value={formData.side} onValueChange={(v: any) => updateField("side", v)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="long">Long</SelectItem>
                        <SelectItem value="short">Short</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="orderType">Order Type *</Label>
                    <Select value={formData.orderType} onValueChange={(v: any) => updateField("orderType", v)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="market">Market</SelectItem>
                        <SelectItem value="limit">Limit</SelectItem>
                        <SelectItem value="stop">Stop</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="accountType">Account *</Label>
                    <Select value={formData.accountType} onValueChange={(v: any) => updateField("accountType", v)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="demo">Demo</SelectItem>
                        <SelectItem value="live">Live</SelectItem>
                        <SelectItem value="prop">Prop</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            )}

            {/* Step 2: Risk */}
            {currentStep === "risk" && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="sizeLots">Position Size (Lots) *</Label>
                    <Input
                      id="sizeLots"
                      type="number"
                      step="0.01"
                      value={formData.sizeLots}
                      onChange={(e) => updateField("sizeLots", e.target.value)}
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="riskPercent">Risk %</Label>
                    <Input
                      id="riskPercent"
                      type="number"
                      step="0.1"
                      value={formData.riskPercent}
                      onChange={(e) => updateField("riskPercent", e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="plannedEntryLow">Planned Entry Low</Label>
                    <Input
                      id="plannedEntryLow"
                      type="number"
                      step="0.00001"
                      value={formData.plannedEntryLow}
                      onChange={(e) => updateField("plannedEntryLow", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="plannedEntryHigh">Planned Entry High</Label>
                    <Input
                      id="plannedEntryHigh"
                      type="number"
                      step="0.00001"
                      value={formData.plannedEntryHigh}
                      onChange={(e) => updateField("plannedEntryHigh", e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="entryPrice">Entry Price *</Label>
                  <Input
                    id="entryPrice"
                    type="number"
                    step="0.00001"
                    value={formData.entryPrice}
                    onChange={(e) => updateField("entryPrice", e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="stopLossPrice">Stop Loss Price *</Label>
                  <Input
                    id="stopLossPrice"
                    type="number"
                    step="0.00001"
                    value={formData.stopLossPrice}
                    onChange={(e) => updateField("stopLossPrice", e.target.value)}
                    required
                  />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="tp1Price">TP1 Price</Label>
                    <Input
                      id="tp1Price"
                      type="number"
                      step="0.00001"
                      value={formData.tp1Price}
                      onChange={(e) => updateField("tp1Price", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tp2Price">TP2 Price</Label>
                    <Input
                      id="tp2Price"
                      type="number"
                      step="0.00001"
                      value={formData.tp2Price}
                      onChange={(e) => updateField("tp2Price", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="tp3Price">TP3 Price</Label>
                    <Input
                      id="tp3Price"
                      type="number"
                      step="0.00001"
                      value={formData.tp3Price}
                      onChange={(e) => updateField("tp3Price", e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="preTradePlan">Pre-Trade Plan</Label>
                  <Textarea
                    id="preTradePlan"
                    value={formData.preTradePlan}
                    onChange={(e) => updateField("preTradePlan", e.target.value)}
                    placeholder="Why is this setup valid? Key levels, confluence..."
                    rows={4}
                  />
                </div>
              </div>
            )}

            {/* Step 3: Result */}
            {currentStep === "result" && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="closedAt">Closed At</Label>
                    <Input
                      id="closedAt"
                      type="datetime-local"
                      value={formData.closedAt}
                      onChange={(e) => updateField("closedAt", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="exitPrice">Exit Price</Label>
                    <Input
                      id="exitPrice"
                      type="number"
                      step="0.00001"
                      value={formData.exitPrice}
                      onChange={(e) => updateField("exitPrice", e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="mfePoints">MFE (Max Favorable)</Label>
                    <Input
                      id="mfePoints"
                      type="number"
                      step="0.00001"
                      value={formData.mfePoints}
                      onChange={(e) => updateField("mfePoints", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="maePoints">MAE (Max Adverse)</Label>
                    <Input
                      id="maePoints"
                      type="number"
                      step="0.00001"
                      value={formData.maePoints}
                      onChange={(e) => updateField("maePoints", e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="rating">Rating (1-5)</Label>
                  <Select value={formData.rating} onValueChange={(v) => updateField("rating", v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Rate your execution" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">No rating</SelectItem>
                      <SelectItem value="1">1 - Poor</SelectItem>
                      <SelectItem value="2">2 - Below Average</SelectItem>
                      <SelectItem value="3">3 - Average</SelectItem>
                      <SelectItem value="4">4 - Good</SelectItem>
                      <SelectItem value="5">5 - Excellent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="executionErrors">Execution Errors</Label>
                  <Textarea
                    id="executionErrors"
                    value={formData.executionErrors}
                    onChange={(e) => updateField("executionErrors", e.target.value)}
                    placeholder="Late entry, didn't respect SL, moved SL..."
                    rows={3}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="postTradeReview">Post-Trade Review</Label>
                  <Textarea
                    id="postTradeReview"
                    value={formData.postTradeReview}
                    onChange={(e) => updateField("postTradeReview", e.target.value)}
                    placeholder="What happened? What went well? What could be improved?"
                    rows={4}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="notes">Additional Notes</Label>
                  <Textarea
                    id="notes"
                    value={formData.notes}
                    onChange={(e) => updateField("notes", e.target.value)}
                    placeholder="Any other observations..."
                    rows={3}
                  />
                </div>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex items-center justify-between pt-4 border-t border-border/50">
              <Button
                type="button"
                variant="outline"
                onClick={handleBack}
                disabled={currentStep === "basic"}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>

              {currentStep !== "result" ? (
                <Button
                  type="button"
                  onClick={handleNext}
                  disabled={
                    (currentStep === "basic" && !canProceedFromBasic) ||
                    (currentStep === "risk" && !canProceedFromRisk)
                  }
                  className="bg-gradient-primary hover:opacity-90"
                >
                  Next
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              ) : (
                <Button
                  type="submit"
                  disabled={createTradeMutation.isPending}
                  className="bg-gradient-primary hover:opacity-90"
                >
                  <Save className="mr-2 h-4 w-4" />
                  {createTradeMutation.isPending ? "Saving..." : "Save Trade"}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
