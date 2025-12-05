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
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Tag } from "lucide-react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";

const predefinedColors = [
  { name: "Red", value: "#ef4444" },
  { name: "Orange", value: "#f97316" },
  { name: "Amber", value: "#f59e0b" },
  { name: "Yellow", value: "#eab308" },
  { name: "Lime", value: "#84cc16" },
  { name: "Green", value: "#22c55e" },
  { name: "Emerald", value: "#10b981" },
  { name: "Teal", value: "#14b8a6" },
  { name: "Cyan", value: "#06b6d4" },
  { name: "Sky", value: "#0ea5e9" },
  { name: "Blue", value: "#3b82f6" },
  { name: "Indigo", value: "#6366f1" },
  { name: "Violet", value: "#8b5cf6" },
  { name: "Purple", value: "#a855f7" },
  { name: "Fuchsia", value: "#d946ef" },
  { name: "Pink", value: "#ec4899" },
  { name: "Rose", value: "#f43f5e" },
  { name: "Slate", value: "#64748b" },
];

const tagSchema = z.object({
  label: z.string().trim().min(1, "Label is required").max(50, "Label must be less than 50 characters"),
  color: z.string().min(1, "Color is required"),
});

type TagFormData = z.infer<typeof tagSchema>;

interface TagItem {
  id: string;
  label: string;
  color: string | null;
  created_at: string;
}

export default function Tags() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingTag, setEditingTag] = useState<TagItem | null>(null);
  const [deletingTag, setDeletingTag] = useState<TagItem | null>(null);

  const form = useForm<TagFormData>({
    resolver: zodResolver(tagSchema),
    defaultValues: {
      label: "",
      color: "#3b82f6",
    },
  });

  const { data: tags, isLoading } = useQuery({
    queryKey: ["tags"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tags")
        .select("*")
        .order("label", { ascending: true });

      if (error) throw error;
      return data as TagItem[];
    },
  });

  const { data: tagStats } = useQuery({
    queryKey: ["tag-stats"],
    queryFn: async () => {
      const { data: tradeTags, error } = await supabase
        .from("trade_tags")
        .select("tag_id, trade_id");

      if (error) throw error;

      const stats = tradeTags.reduce((acc, tt) => {
        acc[tt.tag_id] = (acc[tt.tag_id] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      return stats;
    },
  });

  const createMutation = useMutation({
    mutationFn: async (data: TagFormData) => {
      const { error } = await supabase.from("tags").insert({
        user_id: user!.id,
        label: data.label,
        color: data.color,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tags"] });
      toast.success("Tag created successfully");
      handleCloseDialog();
    },
    onError: (error) => {
      toast.error("Failed to create tag: " + error.message);
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: TagFormData }) => {
      const { error } = await supabase
        .from("tags")
        .update({
          label: data.label,
          color: data.color,
        })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tags"] });
      toast.success("Tag updated successfully");
      handleCloseDialog();
    },
    onError: (error) => {
      toast.error("Failed to update tag: " + error.message);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      // First delete trade_tags associations
      await supabase.from("trade_tags").delete().eq("tag_id", id);
      
      const { error } = await supabase.from("tags").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tags"] });
      queryClient.invalidateQueries({ queryKey: ["tag-stats"] });
      toast.success("Tag deleted successfully");
      setDeletingTag(null);
    },
    onError: (error) => {
      toast.error("Failed to delete tag: " + error.message);
    },
  });

  const onSubmit = (data: TagFormData) => {
    if (editingTag) {
      updateMutation.mutate({ id: editingTag.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (tag: TagItem) => {
    setEditingTag(tag);
    form.reset({
      label: tag.label,
      color: tag.color || "#3b82f6",
    });
  };

  const handleCloseDialog = () => {
    setIsCreateOpen(false);
    setEditingTag(null);
    form.reset({ label: "", color: "#3b82f6" });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading tags...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Tags</h1>
          <p className="text-muted-foreground mt-1">
            Manage custom tags to organize and categorize your trades
          </p>
        </div>
        <Dialog open={isCreateOpen || !!editingTag} onOpenChange={(open) => !open && handleCloseDialog()}>
          <DialogTrigger asChild>
            <Button onClick={() => setIsCreateOpen(true)}>
              <Plus className="h-4 w-4 mr-2" />
              New Tag
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editingTag ? "Edit Tag" : "Create New Tag"}</DialogTitle>
              <DialogDescription>
                Create a custom tag with a color to categorize your trades
              </DialogDescription>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="label"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Label</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g., FOMO, Revenge Trade, A+ Setup" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="color"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Color</FormLabel>
                      <FormControl>
                        <div className="grid grid-cols-6 gap-2">
                          {predefinedColors.map((color) => (
                            <button
                              key={color.value}
                              type="button"
                              onClick={() => field.onChange(color.value)}
                              className={`w-8 h-8 rounded-full border-2 transition-all ${
                                field.value === color.value
                                  ? "border-foreground scale-110"
                                  : "border-transparent hover:scale-105"
                              }`}
                              style={{ backgroundColor: color.value }}
                              title={color.name}
                            />
                          ))}
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="pt-2">
                  <p className="text-sm text-muted-foreground mb-2">Preview:</p>
                  <Badge
                    style={{
                      backgroundColor: `${form.watch("color")}20`,
                      color: form.watch("color"),
                      borderColor: form.watch("color"),
                    }}
                    className="border"
                  >
                    {form.watch("label") || "Tag Preview"}
                  </Badge>
                </div>

                <DialogFooter>
                  <Button type="button" variant="outline" onClick={handleCloseDialog}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                    {editingTag ? "Update" : "Create"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your Tags</CardTitle>
          <CardDescription>
            Tags help you categorize trades for better filtering and analysis
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tag</TableHead>
                <TableHead>Color</TableHead>
                <TableHead className="text-right">Trades</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tags?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center text-muted-foreground">
                    No tags yet. Create your first tag to start organizing trades.
                  </TableCell>
                </TableRow>
              ) : (
                tags?.map((tag) => (
                  <TableRow key={tag.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Tag className="h-4 w-4" style={{ color: tag.color || undefined }} />
                        <Badge
                          style={{
                            backgroundColor: `${tag.color}20`,
                            color: tag.color || undefined,
                            borderColor: tag.color || undefined,
                          }}
                          className="border"
                        >
                          {tag.label}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div
                          className="w-4 h-4 rounded-full border"
                          style={{ backgroundColor: tag.color || "#64748b" }}
                        />
                        <span className="text-sm text-muted-foreground font-mono">
                          {tag.color || "#64748b"}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {tagStats?.[tag.id] || 0}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleEdit(tag)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setDeletingTag(tag)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <AlertDialog open={!!deletingTag} onOpenChange={(open) => !open && setDeletingTag(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Tag</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deletingTag?.label}"? This will remove the tag from all trades. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingTag && deleteMutation.mutate(deletingTag.id)}
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