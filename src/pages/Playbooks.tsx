import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Edit, Archive, ArchiveRestore, X } from "lucide-react";
import { usePlaybooks } from "@/hooks/usePlaybooks";
import { usePlaybookAnalytics } from "@/hooks/usePlaybookAnalytics";
import type { Playbook, CreatePlaybookInput, UpdatePlaybookInput } from "@/types/playbook";
import { useToast } from "@/hooks/use-toast";

function formatCurrency(value: number): string {
  const sign = value >= 0 ? "" : "-";
  const abs = Math.abs(value);
  return `${sign}$${abs.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function CreatePlaybookDialog({
  onSuccess,
}: {
  onSuccess: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<CreatePlaybookInput>({
    name: "",
    description: "",
    notes: "",
    tags: [],
    timeframes: [],
    instruments: [],
  });
  const [tagInput, setTagInput] = useState("");
  const { addPlaybook } = usePlaybooks();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast({
        title: "Error",
        description: "Playbook name is required",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      await addPlaybook(form);
      toast({
        title: "Success",
        description: "Playbook created successfully",
      });
      setForm({
        name: "",
        description: "",
        notes: "",
        tags: [],
        timeframes: [],
        instruments: [],
      });
      setTagInput("");
      setOpen(false);
      onSuccess();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create playbook",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && tagInput.trim()) {
      e.preventDefault();
      const tag = tagInput.trim();
      if (!form.tags?.includes(tag)) {
        setForm((prev) => ({
          ...prev,
          tags: [...(prev.tags || []), tag],
        }));
      }
      setTagInput("");
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setForm((prev) => ({
      ...prev,
      tags: prev.tags?.filter((tag) => tag !== tagToRemove) || [],
    }));
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-gradient-primary hover:opacity-90">
          <Plus className="h-4 w-4 mr-2" />
          New Playbook
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Playbook</DialogTitle>
          <DialogDescription>
            Define a trading strategy or playbook to track performance.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="e.g. Breakout Strategy, Trend Following"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={form.description || ""}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                placeholder="Brief description of the strategy..."
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={form.notes || ""}
                onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                placeholder="Additional notes, rules, or guidelines..."
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="tags">Tags</Label>
              <Input
                id="tags"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleAddTag}
                placeholder="Type a tag and press Enter"
              />
              {form.tags && form.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {form.tags.map((tag) => (
                    <Badge key={tag} variant="outline" className="flex items-center gap-1">
                      {tag}
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(tag)}
                        className="ml-1 hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? "Creating..." : "Create Playbook"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditPlaybookDialog({
  playbook,
  onSuccess,
}: {
  playbook: Playbook;
  onSuccess: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<UpdatePlaybookInput>({
    name: playbook.name,
    description: playbook.description,
    notes: playbook.notes,
    tags: playbook.tags || [],
    timeframes: playbook.timeframes || [],
    instruments: playbook.instruments || [],
  });
  const [tagInput, setTagInput] = useState("");
  const { editPlaybook } = usePlaybooks();
  const { toast } = useToast();
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name?.trim()) {
      toast({
        title: "Error",
        description: "Playbook name is required",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      await editPlaybook(playbook.id, form);
      toast({
        title: "Success",
        description: "Playbook updated successfully",
      });
      setOpen(false);
      onSuccess();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update playbook",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddTag = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && tagInput.trim()) {
      e.preventDefault();
      const tag = tagInput.trim();
      if (!form.tags?.includes(tag)) {
        setForm((prev) => ({
          ...prev,
          tags: [...(prev.tags || []), tag],
        }));
      }
      setTagInput("");
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setForm((prev) => ({
      ...prev,
      tags: prev.tags?.filter((tag) => tag !== tagToRemove) || [],
    }));
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm">
          <Edit className="h-4 w-4" />
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Playbook</DialogTitle>
          <DialogDescription>Update playbook details.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Name *</Label>
              <Input
                id="edit-name"
                value={form.name || ""}
                onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea
                id="edit-description"
                value={form.description || ""}
                onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-notes">Notes</Label>
              <Textarea
                id="edit-notes"
                value={form.notes || ""}
                onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="edit-tags">Tags</Label>
              <Input
                id="edit-tags"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={handleAddTag}
                placeholder="Type a tag and press Enter"
              />
              {form.tags && form.tags.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {form.tags.map((tag) => (
                    <Badge key={tag} variant="outline" className="flex items-center gap-1">
                      {tag}
                      <button
                        type="button"
                        onClick={() => handleRemoveTag(tag)}
                        className="ml-1 hover:text-destructive"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSaving}>
              {isSaving ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function Playbooks() {
  const { playbooks, loading, error, setArchived, refresh } = usePlaybooks();
  const { data: statsByPlaybook, loading: statsLoading } = usePlaybookAnalytics(playbooks);
  const { toast } = useToast();

  const activePlaybooks = useMemo(
    () => playbooks.filter((pb) => !pb.isArchived),
    [playbooks]
  );

  const handleArchive = async (id: string, archived: boolean) => {
    try {
      await setArchived(id, archived);
      toast({
        title: "Success",
        description: archived ? "Playbook archived" : "Playbook unarchived",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update playbook",
        variant: "destructive",
      });
    }
  };

  if (loading || statsLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">Strategy Lab</h1>
            <p className="text-muted-foreground mt-1">
              Manage your playbooks and see performance per strategy.
            </p>
          </div>
        </div>
        <Card className="border-border/50 shadow-lg bg-slate-900">
          <CardContent className="pt-6">
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">Strategy Lab</h1>
            <p className="text-muted-foreground mt-1">
              Manage your playbooks and see performance per strategy.
            </p>
          </div>
        </div>
        <Card className="border-border/50 shadow-lg bg-slate-900">
          <CardContent className="pt-6">
            <p className="text-red-500">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Strategy Lab</h1>
          <p className="text-muted-foreground mt-1">
            Manage your playbooks and see performance per strategy.
          </p>
        </div>
        <CreatePlaybookDialog onSuccess={refresh} />
      </div>

      {activePlaybooks.length === 0 ? (
        <Card className="border-border/50 shadow-lg bg-slate-900">
          <CardContent className="pt-6">
            <div className="text-center py-12">
              <p className="text-muted-foreground mb-4">No playbooks yet</p>
              <CreatePlaybookDialog onSuccess={refresh} />
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-border/50 shadow-lg bg-slate-900">
          <CardHeader>
            <CardTitle className="text-white">Playbooks</CardTitle>
            <CardDescription>Performance metrics for each strategy</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Tags</TableHead>
                    <TableHead className="text-right">Trades</TableHead>
                    <TableHead className="text-right">Win Rate</TableHead>
                    <TableHead className="text-right">Net PnL</TableHead>
                    <TableHead className="text-right">Avg R</TableHead>
                    <TableHead className="text-right">Profit Factor</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activePlaybooks.map((playbook) => {
                    const stats = statsByPlaybook[playbook.id];
                    return (
                      <TableRow key={playbook.id}>
                        <TableCell className="font-medium">{playbook.name}</TableCell>
                        <TableCell>
                          {playbook.tags && playbook.tags.length > 0 ? (
                            <div className="flex flex-wrap gap-1">
                              {playbook.tags.slice(0, 3).map((tag) => (
                                <Badge key={tag} variant="outline" className="text-xs">
                                  {tag}
                                </Badge>
                              ))}
                              {playbook.tags.length > 3 && (
                                <Badge variant="outline" className="text-xs">
                                  +{playbook.tags.length - 3}
                                </Badge>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {stats?.tradesCount || 0}
                        </TableCell>
                        <TableCell className="text-right">
                          {stats?.winRate != null
                            ? `${stats.winRate.toFixed(1)}%`
                            : "—"}
                        </TableCell>
                        <TableCell
                          className={`text-right font-semibold ${
                            (stats?.netPnlBase || 0) >= 0 ? "text-green-400" : "text-red-400"
                          }`}
                        >
                          {stats?.netPnlBase != null ? formatCurrency(stats.netPnlBase) : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          {stats?.avgR != null ? stats.avgR.toFixed(2) : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          {stats?.profitFactor != null ? stats.profitFactor.toFixed(2) : "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <EditPlaybookDialog playbook={playbook} onSuccess={refresh} />
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleArchive(playbook.id, true)}
                            >
                              <Archive className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

