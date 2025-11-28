import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, TrendingUp, TrendingDown } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function Trades() {
  const [search, setSearch] = useState("");
  const navigate = useNavigate();

  const { data: trades, isLoading } = useQuery({
    queryKey: ["trades", search],
    queryFn: async () => {
      let query = supabase
        .from("trades")
        .select(`
          *,
          instrument:instruments(symbol, name),
          strategy:strategies(name),
          session:sessions(name)
        `)
        .order("opened_at", { ascending: false });

      if (search) {
        query = query.or(`notes.ilike.%${search}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Trades</h1>
          <p className="text-muted-foreground mt-1">
            View and manage all your trades
          </p>
        </div>
        <Button onClick={() => navigate("/trades/new")} className="bg-gradient-primary hover:opacity-90">
          <Plus className="mr-2 h-4 w-4" />
          Add Trade
        </Button>
      </div>

      <Card className="border-border/50 shadow-card bg-gradient-card">
        <CardHeader>
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search trades..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : trades && trades.length > 0 ? (
            <div className="space-y-4">
              {trades.map((trade) => (
                <div
                  key={trade.id}
                  className="flex items-center justify-between p-4 rounded-lg border border-border/50 hover:border-border transition-colors bg-card/50"
                >
                  <div className="flex items-center gap-4">
                    <div className={`p-2 rounded-lg ${
                      trade.side === "long" ? "bg-success/20" : "bg-destructive/20"
                    }`}>
                      {trade.side === "long" ? (
                        <TrendingUp className="h-5 w-5 text-success" />
                      ) : (
                        <TrendingDown className="h-5 w-5 text-destructive" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{trade.instrument?.symbol}</span>
                        <Badge variant={trade.result === "win" ? "default" : trade.result === "loss" ? "destructive" : "secondary"}>
                          {trade.result}
                        </Badge>
                      </div>
                      <div className="text-sm text-muted-foreground flex items-center gap-2 mt-1">
                        <span>{new Date(trade.opened_at).toLocaleDateString()}</span>
                        {trade.strategy && (
                          <>
                            <span>•</span>
                            <span>{trade.strategy.name}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`text-lg font-bold ${
                      (trade.pnl_amount || 0) >= 0 ? "text-success" : "text-destructive"
                    }`}>
                      ${(trade.pnl_amount || 0).toFixed(2)}
                    </div>
                    {trade.r_multiple !== null && (
                      <div className="text-sm text-muted-foreground">
                        {trade.r_multiple.toFixed(2)}R
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <p className="text-muted-foreground mb-4">No trades found</p>
              <Button onClick={() => navigate("/trades/new")} className="bg-gradient-primary hover:opacity-90">
                <Plus className="mr-2 h-4 w-4" />
                Add Your First Trade
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
