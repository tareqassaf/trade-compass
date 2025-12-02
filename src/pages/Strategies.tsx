import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, X, Target } from "lucide-react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";

const strategySchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100, "Name must be less than 100 characters"),
  description: z.string().max(1000, "Description must be less than 1000 characters").optional(),
  typical_rr_min: z.string().optional(),
  typical_rr_max: z.string().optional(),
  is_active: z.boolean().default(true),
});

type StrategyFormData = z.infer<typeof strategySchema>;

interface Strategy {
  id: string;
  name: string;
  description: string | null;
  checklist: string[] | null;
  example_screenshots: string[] | null;
  typical_rr_min: number | null;
  typical_rr_max: number | null;
  is_active: boolean | null;
  created_at: string;
}

export default function Strategies() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingStrategy, setEditingStrategy] = useState<Strategy | null>(null);
  const [deletingStrategy, setDeletingStrategy] = useState<Strategy | null>(null);
  const [checklistItems, setChecklistItems] = useState<string[]>([]);
  const [newChecklistItem, setNewChecklistItem] = useState("");

  const form = useForm<StrategyFormData>({
    resolver: zodResolver(strategySchema),
    defaultValues: {
      name: "",
      description: "",
      typical_rr_min: "",
      typical_rr_max: "",
      is_active: true,
    },
  });

  const { data: strategies, isLoading } = useQuery({
    queryKey: ["strategies"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("strategies")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Strategy[];
    },
  });

  const { data: strategyStats } = useQuery({
    queryKey: ["strategy-stats"],
    queryFn: async () => {
      const { data: trades, error } = await supabase
        .from("trades")
        .select("strategy_id, pnl_amount, result, r_multiple")
        .neq("result", "open");

      if (error) throw error;

      const stats = trades.reduce((acc, trade) => {
        if (!trade.strategy_id) return acc;
        
        if (!acc[trade.strategy_id]) {
          acc[trade.strategy_id] = {
            totalTrades: 0,
            wins: 0,
            losses: 0,
            totalPnl: 0,
            totalR: 0,
            rCount: 0,
          };
        }

        acc[trade.strategy_id].totalTrades++;
        if (trade.result === "win") acc[trade.strategy_id].wins++;
        if (trade.result === "loss") acc[trade.strategy_id].losses++;
        acc[trade.strategy_id].totalPnl += trade.pnl_amount || 0;
        if (trade.r_multiple !== null) {
          acc[trade.strategy_id].totalR += trade.r_multiple;
          acc[trade.strategy_id].rCount++;
        }

        return acc;
      }, {} as Record<string, { totalTrades: number; wins: number; losses: number; totalPnl: number; totalR: number; rCount: number }>);

      return stats;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: StrategyFormData) => {
      const { error } = await supabase.from("strategies").insert({
        user_id: user!.id,
        name: data.name,
        description: data.description || null,
        checklist: checklistItems.length > 0 ? checklistItems : null,
        typical_rr_min: data.typical_rr_min ? parseFloat(data.typical_rr_min) : null,
        typical_rr_max: data.typical_rr_max ? parseFloat(data.typical_rr_max) : null,
        is_active: data.is_active,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["strategies"] });
      toast.success("Strategy created successfully");
      handleCloseDialog();
    },
    onError: (error) => {
      toast.error("Failed to create strategy: " + error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: StrategyFormData }) => {
      const { error } = await supabase
        .from("strategies")
        .update({
          name: data.name,
          description: data.description || null,
          checklist: checklistItems.length > 0 ? checklistItems : null,
          typical_rr_min: data.typical_rr_min ? parseFloat(data.typical_rr_min) : null,
          typical_rr_max: data.typical_rr_max ? parseFloat(data.typical_rr_max) : null,
          is_active: data.is_active,
        })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["strategies"] });
      toast.success("Strategy updated successfully");
      handleCloseDialog();
    },
    onError: (error) => {
      toast.error("Failed to update strategy: " + error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("strategies").delete().eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["strategies"] });
      toast.success("Strategy deleted successfully");
      setDeletingStrategy(null);
    },
    onError: (error) => {
      toast.error("Failed to delete strategy: " + error.message);
    },
  });

  const onSubmit = (data: StrategyFormData) => {
    if (editingStrategy) {
      updateMutation.mutate({ id: editingStrategy.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (strategy: Strategy) => {
    setEditingStrategy(strategy);
    setChecklistItems(strategy.checklist || []);
    form.reset({
      name: strategy.name,
      description: strategy.description || "",
      typical_rr_min: strategy.typical_rr_min?.toString() || "",
      typical_rr_max: strategy.typical_rr_max?.toString() || "",
      is_active: strategy.is_active ?? true,
    });
  };

  const handleCloseDialog = () => {
    setIsCreateOpen(false);
    setEditingStrategy(null);
    setChecklistItems([]);
    setNewChecklistItem("");
    form.reset();
  };

  const addChecklistItem = () => {
    if (newChecklistItem.trim()) {
      setChecklistItems([...checklistItems, newChecklistItem.trim()]);
      setNewChecklistItem("");
    }
  };

  const removeChecklistItem = (index: number) => {
    setChecklistItems(checklistItems.filter((_, i) => i !== index));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading strategies...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Strategies</h1>
          <p className="text-muted-foreground mt-1">
            Manage your trading strategies and track their performance
          </p>
        </div>
        <Dialog open={isCreateOpen || !!editingStrategy} onOpenChange={(open) => !open && handleCloseDialog()}>
          <DialogTrigger asChild>
            <Button onClick={() => setIsCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              New Strategy
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingStrategy ? "Edit Strategy" : "Create New Strategy"}</DialogTitle>
              <DialogDescription>
                Define your trading strategy with entry rules and checklist
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Strategy Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., Break & Retest, Supply/Demand Zone" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Description</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Describe your strategy, when to use it, and key characteristics..."
                          className="min-h-[100px]"
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="typical_rr_min"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Typical R:R Min</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            step="0.1"
                            placeholder="e.g., 1.5"
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="typical_rr_max"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Typical R:R Max</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            step="0.1"
                            placeholder="e.g., 3.0"
                            {...field} 
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="space-y-3">
                  <FormLabel>Entry Checklist</FormLabel>
                  <div className="flex gap-2">
                    <Input
                      value={newChecklistItem}
                      onChange={(e) => setNewChecklistItem(e.target.value)}
                      placeholder="Add a checklist item..."
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.preventDefault();
                          addChecklistItem();
                        }
                      }}
                    />
                    <Button type="button" variant="outline" onClick={addChecklistItem}>
                      Add
                    </Button>
                  </div>
                  {checklistItems.length > 0 && (
                    <div className="space-y-2 mt-2">
                      {checklistItems.map((item, index) => (
                        <div key={index} className="flex items-center gap-2 bg-muted/50 rounded-lg px-3 py-2">
                          <span className="text-sm flex-1">{item}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeChecklistItem(index)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <FormField
                  control={form.control}
                  name="is_active"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Active</FormLabel>
                        <div className="text-sm text-muted-foreground">
                          Show this strategy in trade forms
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
                    {editingStrategy ? "Update" : "Create"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Trading Strategies</CardTitle>
          <CardDescription>
            Your playbook of strategies with performance statistics
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>R:R Range</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Trades</TableHead>
                <TableHead className="text-right">Win Rate</TableHead>
                <TableHead className="text-right">Avg R</TableHead>
                <TableHead className="text-right">Net P&L</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {strategies?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center text-muted-foreground">
                    No strategies yet. Create your first strategy to get started.
                  </TableCell>
                </TableRow>
              ) : (
                strategies?.map((strategy) => {
                  const stats = strategyStats?.[strategy.id];
                  const winRate = stats?.totalTrades ? (stats.wins / stats.totalTrades) * 100 : 0;
                  const avgR = stats?.rCount ? stats.totalR / stats.rCount : 0;

                  return (
                    <TableRow key={strategy.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Target className="h-4 w-4 text-primary" />
                          <span className="font-medium">{strategy.name}</span>
                        </div>
                        {strategy.checklist && strategy.checklist.length > 0 && (
                          <Badge variant="secondary" className="mt-1 text-xs">
                            {strategy.checklist.length} checklist items
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[200px]">
                        <span className="text-sm text-muted-foreground line-clamp-2">
                          {strategy.description || "No description"}
                        </span>
                      </TableCell>
                      <TableCell>
                        {strategy.typical_rr_min || strategy.typical_rr_max
                          ? `${strategy.typical_rr_min || "-"} : ${strategy.typical_rr_max || "-"}`
                          : "-"}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            strategy.is_active
                              ? "bg-success/20 text-success"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {strategy.is_active ? "Active" : "Inactive"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">{stats?.totalTrades || 0}</TableCell>
                      <TableCell className="text-right">
                        {stats?.totalTrades ? `${winRate.toFixed(1)}%` : "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        {stats?.rCount ? (
                          <span className={avgR >= 0 ? "text-success" : "text-destructive"}>
                            {avgR.toFixed(2)}R
                          </span>
                        ) : (
                          "-"
                        )}
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
                            onClick={() => handleEdit(strategy)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setDeletingStrategy(strategy)}
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

      <AlertDialog open={!!deletingStrategy} onOpenChange={() => setDeletingStrategy(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Strategy</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingStrategy?.name}"? This action cannot be undone.
              Trades linked to this strategy will not be deleted, but the strategy reference will be removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingStrategy && deleteMutation.mutate(deletingStrategy.id)}
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
