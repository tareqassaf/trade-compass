import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Clock } from "lucide-react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Switch } from "@/components/ui/switch";

const sessionSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100, "Name must be less than 100 characters"),
  start_time_utc: z.string().optional(),
  end_time_utc: z.string().optional(),
  is_active: z.boolean().default(true),
});

type SessionFormData = z.infer<typeof sessionSchema>;

interface Session {
  id: string;
  name: string;
  start_time_utc: string | null;
  end_time_utc: string | null;
  is_active: boolean;
  created_at: string;
}

export default function Sessions() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingSession, setEditingSession] = useState<Session | null>(null);
  const [deletingSession, setDeletingSession] = useState<Session | null>(null);

  const form = useForm<SessionFormData>({
    resolver: zodResolver(sessionSchema),
    defaultValues: {
      name: "",
      start_time_utc: "",
      end_time_utc: "",
      is_active: true,
    },
  });

  const { data: sessions, isLoading } = useQuery({
    queryKey: ["sessions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sessions")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as Session[];
    },
  });

  const { data: sessionStats } = useQuery({
    queryKey: ["session-stats"],
    queryFn: async () => {
      const { data: trades, error } = await supabase
        .from("trades")
        .select("session_id, pnl_amount, result")
        .neq("result", "open");

      if (error) throw error;

      const stats = trades.reduce((acc, trade) => {
        if (!trade.session_id) return acc;
        
        if (!acc[trade.session_id]) {
          acc[trade.session_id] = {
            totalTrades: 0,
            wins: 0,
            losses: 0,
            totalPnl: 0,
          };
        }

        acc[trade.session_id].totalTrades++;
        if (trade.result === "win") acc[trade.session_id].wins++;
        if (trade.result === "loss") acc[trade.session_id].losses++;
        acc[trade.session_id].totalPnl += trade.pnl_amount || 0;

        return acc;
      }, {} as Record<string, { totalTrades: number; wins: number; losses: number; totalPnl: number }>);

      return stats;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: SessionFormData) => {
      const { error } = await supabase.from("sessions").insert({
        user_id: user!.id,
        name: data.name,
        start_time_utc: data.start_time_utc || null,
        end_time_utc: data.end_time_utc || null,
        is_active: data.is_active,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
      toast.success("Session created successfully");
      setIsCreateOpen(false);
      form.reset();
    },
    onError: (error) => {
      toast.error("Failed to create session: " + error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: SessionFormData }) => {
      const { error } = await supabase
        .from("sessions")
        .update({
          name: data.name,
          start_time_utc: data.start_time_utc || null,
          end_time_utc: data.end_time_utc || null,
          is_active: data.is_active,
        })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
      toast.success("Session updated successfully");
      setEditingSession(null);
      form.reset();
    },
    onError: (error) => {
      toast.error("Failed to update session: " + error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("sessions").delete().eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
      toast.success("Session deleted successfully");
      setDeletingSession(null);
    },
    onError: (error) => {
      toast.error("Failed to delete session: " + error.message);
    },
  });

  const onSubmit = (data: SessionFormData) => {
    if (editingSession) {
      updateMutation.mutate({ id: editingSession.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (session: Session) => {
    setEditingSession(session);
    form.reset({
      name: session.name,
      start_time_utc: session.start_time_utc || "",
      end_time_utc: session.end_time_utc || "",
      is_active: session.is_active,
    });
  };

  const handleCloseDialog = () => {
    setIsCreateOpen(false);
    setEditingSession(null);
    form.reset();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading sessions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Sessions</h1>
          <p className="text-muted-foreground mt-1">
            Manage your trading sessions and track performance by time of day
          </p>
        </div>
        <Dialog open={isCreateOpen || !!editingSession} onOpenChange={(open) => !open && handleCloseDialog()}>
          <DialogTrigger asChild>
            <Button onClick={() => setIsCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              New Session
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingSession ? "Edit Session" : "Create New Session"}</DialogTitle>
              <DialogDescription>
                Define a trading session with specific time windows (e.g., "London Open", "New York Session")
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Session Name</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., London Open, New York Session" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="start_time_utc"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Start Time (UTC)</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input 
                            type="time" 
                            className="pl-10"
                            {...field} 
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="end_time_utc"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>End Time (UTC)</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                          <Input 
                            type="time" 
                            className="pl-10"
                            {...field} 
                          />
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="is_active"
                  render={({ field }) => (
                    <FormItem className="flex items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">Active</FormLabel>
                        <div className="text-sm text-muted-foreground">
                          Show this session in trade forms
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
                    {editingSession ? "Update" : "Create"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Trading Sessions</CardTitle>
          <CardDescription>
            View and manage your trading sessions with performance statistics
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Time Window (UTC)</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Trades</TableHead>
                <TableHead className="text-right">Win Rate</TableHead>
                <TableHead className="text-right">Net P&L</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sessions?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    No sessions yet. Create your first session to get started.
                  </TableCell>
                </TableRow>
              ) : (
                sessions?.map((session) => {
                  const stats = sessionStats?.[session.id];
                  const winRate = stats?.totalTrades ? (stats.wins / stats.totalTrades) * 100 : 0;

                  return (
                    <TableRow key={session.id}>
                      <TableCell className="font-medium">{session.name}</TableCell>
                      <TableCell>
                        {session.start_time_utc && session.end_time_utc
                          ? `${session.start_time_utc} - ${session.end_time_utc}`
                          : "Not specified"}
                      </TableCell>
                      <TableCell>
                        <span
                          className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                            session.is_active
                              ? "bg-success/20 text-success"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {session.is_active ? "Active" : "Inactive"}
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
                            onClick={() => handleEdit(session)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => setDeletingSession(session)}
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

      <AlertDialog open={!!deletingSession} onOpenChange={() => setDeletingSession(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Session</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingSession?.name}"? This action cannot be undone.
              Trades linked to this session will not be deleted, but the session reference will be removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingSession && deleteMutation.mutate(deletingSession.id)}
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
