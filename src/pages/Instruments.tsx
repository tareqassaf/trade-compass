import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Coins } from "lucide-react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Database } from "@/integrations/supabase/types";

type AssetClass = Database["public"]["Enums"]["asset_class"];

const assetClasses: { value: AssetClass; label: string }[] = [
  { value: "forex", label: "Forex" },
  { value: "crypto", label: "Crypto" },
  { value: "index", label: "Index" },
  { value: "stock", label: "Stock" },
  { value: "commodity", label: "Commodity" },
];

const instrumentSchema = z.object({
  symbol: z.string().trim().min(1, "Symbol is required").max(20, "Symbol must be less than 20 characters"),
  name: z.string().max(100, "Name must be less than 100 characters").optional(),
  asset_class: z.enum(["forex", "crypto", "index", "stock", "commodity"]),
  tick_size: z.string().optional(),
  tick_value: z.string().optional(),
  is_active: z.boolean().default(true),
});

type InstrumentFormData = z.infer<typeof instrumentSchema>;

interface Instrument {
  id: string;
  symbol: string;
  name: string | null;
  asset_class: AssetClass;
  tick_size: number | null;
  tick_value: number | null;
  is_active: boolean | null;
  created_at: string;
}

export default function Instruments() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingInstrument, setEditingInstrument] = useState<Instrument | null>(null);
  const [deletingInstrument, setDeletingInstrument] = useState<Instrument | null>(null);

  const form = useForm<InstrumentFormData>({
    resolver: zodResolver(instrumentSchema),
    defaultValues: {
      symbol: "",
      name: "",
      asset_class: "forex",
      tick_size: "",
      tick_value: "",
      is_active: true,
    },
  });

  const { data: instruments, isLoading } = useQuery({
    queryKey: ["instruments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("instruments")
        .select("*")
        .order("symbol", { ascending: true });

      if (error) throw error;
      return data as Instrument[];
    },
  });

  const { data: instrumentStats } = useQuery({
    queryKey: ["instrument-stats"],
    queryFn: async () => {
      const { data: trades, error } = await supabase
        .from("trades")
        .select("instrument_id, pnl_amount, result, r_multiple")
        .neq("result", "open");

      if (error) throw error;

      const stats = trades.reduce((acc, trade) => {
        if (!trade.instrument_id) return acc;
        
        if (!acc[trade.instrument_id]) {
          acc[trade.instrument_id] = {
            totalTrades: 0,
            wins: 0,
            totalPnl: 0,
          };
        }

        acc[trade.instrument_id].totalTrades++;
        if (trade.result === "win") acc[trade.instrument_id].wins++;
        acc[trade.instrument_id].totalPnl += trade.pnl_amount || 0;

        return acc;
      }, {} as Record<string, { totalTrades: number; wins: number; totalPnl: number }>);

      return stats;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: InstrumentFormData) => {
      const { error } = await supabase.from("instruments").insert({
        user_id: user!.id,
        symbol: data.symbol.toUpperCase(),
        name: data.name || null,
        asset_class: data.asset_class,
        tick_size: data.tick_size ? parseFloat(data.tick_size) : null,
        tick_value: data.tick_value ? parseFloat(data.tick_value) : null,
        is_active: data.is_active,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["instruments"] });
      toast.success("Instrument created successfully");
      handleCloseDialog();
    },
    onError: (error) => {
      toast.error("Failed to create instrument: " + error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: InstrumentFormData }) => {
      const { error } = await supabase
        .from("instruments")
        .update({
          symbol: data.symbol.toUpperCase(),
          name: data.name || null,
          asset_class: data.asset_class,
          tick_size: data.tick_size ? parseFloat(data.tick_size) : null,
          tick_value: data.tick_value ? parseFloat(data.tick_value) : null,
          is_active: data.is_active,
        })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["instruments"] });
      toast.success("Instrument updated successfully");
      handleCloseDialog();
    },
    onError: (error) => {
      toast.error("Failed to update instrument: " + error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("instruments").delete().eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["instruments"] });
      toast.success("Instrument deleted successfully");
      setDeletingInstrument(null);
    },
    onError: (error) => {
      toast.error("Failed to delete instrument: " + error.message);
    },
  });

  const onSubmit = (data: InstrumentFormData) => {
    if (editingInstrument) {
      updateMutation.mutate({ id: editingInstrument.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (instrument: Instrument) => {
    setEditingInstrument(instrument);
    form.reset({
      symbol: instrument.symbol,
      name: instrument.name || "",
      asset_class: instrument.asset_class,
      tick_size: instrument.tick_size?.toString() || "",
      tick_value: instrument.tick_value?.toString() || "",
      is_active: instrument.is_active ?? true,
    });
  };

  const handleCloseDialog = () => {
    setIsCreateOpen(false);
    setEditingInstrument(null);
    form.reset();
  };

  const getAssetClassColor = (assetClass: AssetClass) => {
    const colors: Record<AssetClass, string> = {
      forex: "bg-blue-500/20 text-blue-400",
      crypto: "bg-orange-500/20 text-orange-400",
      index: "bg-purple-500/20 text-purple-400",
      stock: "bg-green-500/20 text-green-400",
      commodity: "bg-yellow-500/20 text-yellow-400",
    };
    return colors[assetClass];
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading instruments...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Instruments</h1>
          <p className="text-muted-foreground mt-1">
            Manage your trading instruments and their configurations
          </p>
        </div>
        <Dialog open={isCreateOpen || !!editingInstrument} onOpenChange={(open) => !open && handleCloseDialog()}>
          <DialogTrigger asChild>
            <Button onClick={() => setIsCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              New Instrument
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingInstrument ? "Edit Instrument" : "Add New Instrument"}</DialogTitle>
              <DialogDescription>
                Configure your trading instrument with tick size and value for accurate P&L calculations
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="symbol"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Symbol</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., XAUUSD, BTCUSD, NAS100" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name (Optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Gold, Bitcoin, Nasdaq 100" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="asset_class"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Asset Class</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select asset class" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {assetClasses.map((ac) => (
                            <SelectItem key={ac.value} value={ac.value}>
                              {ac.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="tick_size"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tick Size</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            step="any"
                            placeholder="e.g., 0.01"
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="tick_value"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Tick Value ($)</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            step="any"
                            placeholder="e.g., 1.00"
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="is_active"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Active</FormLabel>
                        <div className="text-sm text-muted-foreground">
                          Show this instrument in trade forms
                        </div>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={handleCloseDialog}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                    {editingInstrument ? "Update" : "Create"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Trading Instruments</CardTitle>
          <CardDescription>
            Your configured instruments with performance statistics
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Symbol</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Asset Class</TableHead>
                <TableHead>Tick Size</TableHead>
                <TableHead>Tick Value</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Trades</TableHead>
                <TableHead className="text-right">Win Rate</TableHead>
                <TableHead className="text-right">Net P&L</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {instruments?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={10} className="text-center text-muted-foreground">
                    No instruments yet. Add your first instrument to get started.
                  </TableCell>
                </TableRow>
              ) : (
                instruments?.map((instrument) => {
                  const stats = instrumentStats?.[instrument.id];
                  const winRate = stats?.totalTrades ? (stats.wins / stats.totalTrades) * 100 : 0;

                  return (
                    <TableRow key={instrument.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Coins className="h-4 w-4 text-primary" />
                          <span className="font-medium font-mono">{instrument.symbol}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {instrument.name || "-"}
                      </TableCell>
                      <TableCell>
                        <Badge className={getAssetClassColor(instrument.asset_class)}>
                          {assetClasses.find(ac => ac.value === instrument.asset_class)?.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono">
                        {instrument.tick_size ?? "-"}
                      </TableCell>
                      <TableCell className="font-mono">
                        {instrument.tick_value ? `$${instrument.tick_value}` : "-"}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            instrument.is_active
                              ? "bg-success/20 text-success"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {instrument.is_active ? "Active" : "Inactive"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">{stats?.totalTrades || 0}</TableCell>
                      <TableCell className="text-right">
                        {stats?.totalTrades ? `${winRate.toFixed(1)}%` : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        {stats?.totalPnl !== undefined ? (
                          <span className={stats.totalPnl >= 0 ? "text-success" : "text-destructive"}>
                            ${stats.totalPnl.toFixed(2)}
                          </span>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleEdit(instrument)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setDeletingInstrument(instrument)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AlertDialog open={!!deletingInstrument} onOpenChange={() => setDeletingInstrument(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Instrument</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingInstrument?.symbol}"? This action cannot be undone.
              Note: You cannot delete instruments that have trades associated with them.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingInstrument && deleteMutation.mutate(deletingInstrument.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
