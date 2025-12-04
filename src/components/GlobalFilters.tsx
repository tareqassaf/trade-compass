import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useFilters } from "@/hooks/useFilters";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { format, parseISO } from "date-fns";
import { 
  CalendarIcon, 
  Filter, 
  X, 
  ChevronDown,
  TrendingUp,
  TrendingDown,
  Trophy,
  XCircle,
  MinusCircle
} from "lucide-react";
import { useState } from "react";

export function GlobalFilters() {
  const { filters, setFilters, clearFilters, hasActiveFilters } = useFilters();
  const [isOpen, setIsOpen] = useState(false);

  const { data: instruments } = useQuery({
    queryKey: ["instruments-filter"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("instruments")
        .select("id, symbol, name")
        .eq("is_active", true)
        .order("symbol");
      if (error) throw error;
      return data;
    },
  });

  const { data: strategies } = useQuery({
    queryKey: ["strategies-filter"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("strategies")
        .select("id, name")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: sessions } = useQuery({
    queryKey: ["sessions-filter"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("sessions")
        .select("id, name")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  const activeFilterCount = [
    filters.dateFrom || filters.dateTo,
    filters.instruments.length > 0,
    filters.strategies.length > 0,
    filters.sessions.length > 0,
    filters.side !== "all",
    filters.result !== "all",
    filters.minR !== null || filters.maxR !== null,
  ].filter(Boolean).length;

  const toggleArrayFilter = (key: "instruments" | "strategies" | "sessions", value: string) => {
    const current = filters[key];
    const updated = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    setFilters({ [key]: updated });
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" className="gap-2">
          <Filter className="h-4 w-4" />
          Filters
          {activeFilterCount > 0 && (
            <Badge variant="secondary" className="ml-1 h-5 w-5 rounded-full p-0 flex items-center justify-center text-xs">
              {activeFilterCount}
            </Badge>
          )}
          <ChevronDown className="h-4 w-4 ml-1" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[400px] p-0 bg-popover border-border z-50" align="start">
        <div className="p-4 border-b border-border flex items-center justify-between">
          <h4 className="font-semibold">Filters</h4>
          {hasActiveFilters && (
            <Button variant="ghost" size="sm" onClick={clearFilters} className="h-8 px-2 text-muted-foreground">
              <X className="h-4 w-4 mr-1" />
              Clear all
            </Button>
          )}
        </div>
        
        <ScrollArea className="h-[450px]">
          <div className="p-4 space-y-6">
            {/* Date Range */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Date Range</Label>
              <div className="flex gap-2">
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("flex-1 justify-start text-left font-normal", !filters.dateFrom && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {filters.dateFrom ? format(parseISO(filters.dateFrom), "MMM d, yyyy") : "From"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 bg-popover border-border z-[60]" align="start">
                    <Calendar
                      mode="single"
                      selected={filters.dateFrom ? parseISO(filters.dateFrom) : undefined}
                      onSelect={(date) => setFilters({ dateFrom: date ? format(date, "yyyy-MM-dd") : null })}
                      initialFocus
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("flex-1 justify-start text-left font-normal", !filters.dateTo && "text-muted-foreground")}>
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {filters.dateTo ? format(parseISO(filters.dateTo), "MMM d, yyyy") : "To"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0 bg-popover border-border z-[60]" align="start">
                    <Calendar
                      mode="single"
                      selected={filters.dateTo ? parseISO(filters.dateTo) : undefined}
                      onSelect={(date) => setFilters({ dateTo: date ? format(date, "yyyy-MM-dd") : null })}
                      initialFocus
                      className="p-3 pointer-events-auto"
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            <Separator />

            {/* Side Toggle */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Side</Label>
              <div className="flex gap-2">
                {[
                  { value: "all", label: "All" },
                  { value: "long", label: "Long", icon: TrendingUp },
                  { value: "short", label: "Short", icon: TrendingDown },
                ].map((option) => (
                  <Button
                    key={option.value}
                    variant={filters.side === option.value ? "default" : "outline"}
                    size="sm"
                    className="flex-1"
                    onClick={() => setFilters({ side: option.value as any })}
                  >
                    {option.icon && <option.icon className="h-3 w-3 mr-1" />}
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>

            <Separator />

            {/* Result Filter */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Result</Label>
              <div className="flex gap-2 flex-wrap">
                {[
                  { value: "all", label: "All" },
                  { value: "win", label: "Win", icon: Trophy, className: "text-success" },
                  { value: "loss", label: "Loss", icon: XCircle, className: "text-destructive" },
                  { value: "breakeven", label: "BE", icon: MinusCircle, className: "text-muted-foreground" },
                ].map((option) => (
                  <Button
                    key={option.value}
                    variant={filters.result === option.value ? "default" : "outline"}
                    size="sm"
                    onClick={() => setFilters({ result: option.value as any })}
                  >
                    {option.icon && <option.icon className={cn("h-3 w-3 mr-1", option.className)} />}
                    {option.label}
                  </Button>
                ))}
              </div>
            </div>

            <Separator />

            {/* R-Multiple Range */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">R-Multiple Range</Label>
              <div className="flex gap-2 items-center">
                <Input
                  type="number"
                  placeholder="Min R"
                  step="0.1"
                  value={filters.minR ?? ""}
                  onChange={(e) => setFilters({ minR: e.target.value ? parseFloat(e.target.value) : null })}
                  className="flex-1"
                />
                <span className="text-muted-foreground">to</span>
                <Input
                  type="number"
                  placeholder="Max R"
                  step="0.1"
                  value={filters.maxR ?? ""}
                  onChange={(e) => setFilters({ maxR: e.target.value ? parseFloat(e.target.value) : null })}
                  className="flex-1"
                />
              </div>
            </div>

            <Separator />

            {/* Instruments */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Instruments</Label>
              <div className="space-y-2 max-h-[150px] overflow-y-auto">
                {instruments?.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No instruments available</p>
                ) : (
                  instruments?.map((instrument) => (
                    <div key={instrument.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`instrument-${instrument.id}`}
                        checked={filters.instruments.includes(instrument.id)}
                        onCheckedChange={() => toggleArrayFilter("instruments", instrument.id)}
                      />
                      <label
                        htmlFor={`instrument-${instrument.id}`}
                        className="text-sm cursor-pointer"
                      >
                        {instrument.symbol}
                      </label>
                    </div>
                  ))
                )}
              </div>
            </div>

            <Separator />

            {/* Strategies */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Strategies</Label>
              <div className="space-y-2 max-h-[150px] overflow-y-auto">
                {strategies?.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No strategies available</p>
                ) : (
                  strategies?.map((strategy) => (
                    <div key={strategy.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`strategy-${strategy.id}`}
                        checked={filters.strategies.includes(strategy.id)}
                        onCheckedChange={() => toggleArrayFilter("strategies", strategy.id)}
                      />
                      <label
                        htmlFor={`strategy-${strategy.id}`}
                        className="text-sm cursor-pointer"
                      >
                        {strategy.name}
                      </label>
                    </div>
                  ))
                )}
              </div>
            </div>

            <Separator />

            {/* Sessions */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">Sessions</Label>
              <div className="space-y-2 max-h-[150px] overflow-y-auto">
                {sessions?.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No sessions available</p>
                ) : (
                  sessions?.map((session) => (
                    <div key={session.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={`session-${session.id}`}
                        checked={filters.sessions.includes(session.id)}
                        onCheckedChange={() => toggleArrayFilter("sessions", session.id)}
                      />
                      <label
                        htmlFor={`session-${session.id}`}
                        className="text-sm cursor-pointer"
                      >
                        {session.name}
                      </label>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
