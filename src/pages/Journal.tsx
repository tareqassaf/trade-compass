import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { format } from "date-fns";
import { Calendar as CalendarIcon, Save, Smile, Frown, Zap, AlertCircle, Target, Brain } from "lucide-react";
import { cn } from "@/lib/utils";

type MoodType = "confident" | "nervous" | "disciplined" | "impulsive" | "focused" | "stressed";

const moodConfig: Record<MoodType, { label: string; icon: any; color: string }> = {
  confident: { label: "Confident", icon: Smile, color: "text-success" },
  nervous: { label: "Nervous", icon: Frown, color: "text-warning" },
  disciplined: { label: "Disciplined", icon: Target, color: "text-primary" },
  impulsive: { label: "Impulsive", icon: Zap, color: "text-destructive" },
  focused: { label: "Focused", icon: Brain, color: "text-info" },
  stressed: { label: "Stressed", icon: AlertCircle, color: "text-destructive" },
};

export default function Journal() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [text, setText] = useState("");
  const [mood, setMood] = useState<MoodType | "">("");
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const tradingDay = format(selectedDate, "yyyy-MM-dd");

  // Fetch journal entry for selected date
  const { data: entry, isLoading } = useQuery({
    queryKey: ["journal-entry", tradingDay],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("journal_entries")
        .select("*")
        .eq("trading_day", tradingDay)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Fetch all journal dates for calendar highlighting
  const { data: journalDates } = useQuery({
    queryKey: ["journal-dates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("journal_entries")
        .select("trading_day");

      if (error) throw error;
      return data.map(d => new Date(d.trading_day));
    },
    enabled: !!user,
  });

  // Create or update mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");
      if (!text.trim()) throw new Error("Journal entry cannot be empty");

      if (entry) {
        // Update existing
        const { error } = await supabase
          .from("journal_entries")
          .update({
            text: text.trim(),
            mood: mood || null,
          })
          .eq("id", entry.id);

        if (error) throw error;
      } else {
        // Create new
        const { error } = await supabase
          .from("journal_entries")
          .insert({
            user_id: user.id,
            trading_day: tradingDay,
            text: text.trim(),
            mood: mood || null,
          });

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["journal-entry", tradingDay] });
      queryClient.invalidateQueries({ queryKey: ["journal-dates"] });
      setIsEditing(false);
      toast({
        title: "Journal saved",
        description: "Your trading journal entry has been saved.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!entry) throw new Error("No entry to delete");

      const { error } = await supabase
        .from("journal_entries")
        .delete()
        .eq("id", entry.id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["journal-entry", tradingDay] });
      queryClient.invalidateQueries({ queryKey: ["journal-dates"] });
      setText("");
      setMood("");
      setIsEditing(false);
      toast({
        title: "Entry deleted",
        description: "Your journal entry has been deleted.",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleEdit = () => {
    if (entry) {
      setText(entry.text);
      setMood(entry.mood || "");
      setIsEditing(true);
      setEditingId(entry.id);
    }
  };

  const handleNew = () => {
    setText("");
    setMood("");
    setIsEditing(true);
    setEditingId(null);
  };

  const handleCancel = () => {
    setIsEditing(false);
    setText("");
    setMood("");
    setEditingId(null);
  };

  const handleSave = () => {
    saveMutation.mutate();
  };

  const handleDelete = () => {
    if (confirm("Are you sure you want to delete this journal entry?")) {
      deleteMutation.mutate();
    }
  };

  const handleDateSelect = (date: Date | undefined) => {
    if (date) {
      setSelectedDate(date);
      setIsEditing(false);
      setText("");
      setMood("");
    }
  };

  return (
    <div className="space-y-6 max-w-7xl">
      <div>
        <h1 className="text-3xl font-bold">Trading Journal</h1>
        <p className="text-muted-foreground mt-1">
          Reflect on your trading day, track your mood, and build self-awareness
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Calendar Sidebar */}
        <Card className="border-border/50 shadow-card bg-gradient-card lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon className="h-5 w-5" />
              Calendar
            </CardTitle>
            <CardDescription>Select a date to view or create an entry</CardDescription>
          </CardHeader>
          <CardContent>
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={handleDateSelect}
              modifiers={{
                hasEntry: journalDates || [],
              }}
              modifiersStyles={{
                hasEntry: {
                  fontWeight: "bold",
                  textDecoration: "underline",
                  color: "hsl(var(--primary))",
                },
              }}
              className={cn("rounded-md border pointer-events-auto")}
            />
            <div className="mt-4 space-y-2 text-sm text-muted-foreground">
              <p>• <span className="font-bold text-primary">Underlined dates</span> have journal entries</p>
              <p>• Click any date to view or create an entry</p>
            </div>
          </CardContent>
        </Card>

        {/* Journal Entry */}
        <Card className="border-border/50 shadow-card bg-gradient-card lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>{format(selectedDate, "EEEE, MMMM d, yyyy")}</CardTitle>
                <CardDescription>
                  {entry ? "View or edit your journal entry" : "Create a new journal entry"}
                </CardDescription>
              </div>
              {!isEditing && !entry && (
                <Button onClick={handleNew} className="bg-gradient-primary hover:opacity-90">
                  New Entry
                </Button>
              )}
              {!isEditing && entry && (
                <div className="flex gap-2">
                  <Button onClick={handleEdit} variant="outline">
                    Edit
                  </Button>
                  <Button onClick={handleDelete} variant="destructive">
                    Delete
                  </Button>
                </div>
              )}
              {isEditing && (
                <div className="flex gap-2">
                  <Button onClick={handleSave} className="bg-gradient-primary hover:opacity-90">
                    <Save className="mr-2 h-4 w-4" />
                    Save
                  </Button>
                  <Button onClick={handleCancel} variant="outline">
                    Cancel
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {isLoading ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : isEditing ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="mood">How were you feeling today?</Label>
                  <Select value={mood} onValueChange={(v: MoodType) => setMood(v)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select your mood" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(moodConfig).map(([key, config]) => {
                        const Icon = config.icon;
                        return (
                          <SelectItem key={key} value={key}>
                            <div className="flex items-center gap-2">
                              <Icon className={cn("h-4 w-4", config.color)} />
                              <span>{config.label}</span>
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="text">Journal Entry</Label>
                  <Textarea
                    id="text"
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Reflect on your trading day... What went well? What could be improved? How did you follow your plan?"
                    rows={12}
                    className="resize-none"
                  />
                  <p className="text-xs text-muted-foreground">
                    {text.length} characters
                  </p>
                </div>

                <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                  <p className="font-semibold text-sm">Reflection Prompts:</p>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Did I follow my trading plan today?</li>
                    <li>• What was my best trade and why?</li>
                    <li>• What was my worst trade and what can I learn from it?</li>
                    <li>• How did emotions affect my decision-making?</li>
                    <li>• What will I do differently tomorrow?</li>
                  </ul>
                </div>
              </>
            ) : entry ? (
              <>
                {entry.mood && (
                  <div>
                    <Label className="text-muted-foreground">Mood</Label>
                    <div className="mt-2">
                      <Badge variant="secondary" className="gap-2">
                        {(() => {
                          const Icon = moodConfig[entry.mood as MoodType].icon;
                          return (
                            <>
                              <Icon className={cn("h-4 w-4", moodConfig[entry.mood as MoodType].color)} />
                              {moodConfig[entry.mood as MoodType].label}
                            </>
                          );
                        })()}
                      </Badge>
                    </div>
                  </div>
                )}

                <Separator />

                <div>
                  <Label className="text-muted-foreground">Entry</Label>
                  <div className="mt-3 whitespace-pre-wrap text-foreground leading-relaxed">
                    {entry.text}
                  </div>
                </div>

                <div className="text-xs text-muted-foreground">
                  Last updated: {format(new Date(entry.updated_at), "PPp")}
                </div>
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <CalendarIcon className="h-16 w-16 text-muted-foreground/50 mb-4" />
                <p className="text-lg font-semibold mb-2">No entry for this date</p>
                <p className="text-muted-foreground mb-4">
                  Start journaling to track your trading journey and build consistency
                </p>
                <Button onClick={handleNew} className="bg-gradient-primary hover:opacity-90">
                  Create Entry
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
