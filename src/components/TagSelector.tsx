import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface Tag {
  id: string;
  label: string;
  color: string | null;
}

interface TagSelectorProps {
  selectedTagIds: string[];
  onTagsChange: (tagIds: string[]) => void;
  disabled?: boolean;
}

export function TagSelector({ selectedTagIds, onTagsChange, disabled }: TagSelectorProps) {
  const { data: tags } = useQuery({
    queryKey: ["tags"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tags")
        .select("id, label, color")
        .order("label");
      if (error) throw error;
      return data as Tag[];
    },
  });

  const selectedTags = tags?.filter(tag => selectedTagIds.includes(tag.id)) || [];

  const toggleTag = (tagId: string) => {
    if (selectedTagIds.includes(tagId)) {
      onTagsChange(selectedTagIds.filter(id => id !== tagId));
    } else {
      onTagsChange([...selectedTagIds, tagId]);
    }
  };

  const removeTag = (tagId: string) => {
    onTagsChange(selectedTagIds.filter(id => id !== tagId));
  };

  return (
    <div className="space-y-2">
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            className="w-full justify-between"
            disabled={disabled}
          >
            {selectedTags.length > 0
              ? `${selectedTags.length} tag${selectedTags.length > 1 ? "s" : ""} selected`
              : "Select tags..."}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0" align="start">
          <Command>
            <CommandInput placeholder="Search tags..." />
            <CommandList>
              <CommandEmpty>No tags found. Create tags in the Tags page.</CommandEmpty>
              <CommandGroup>
                {tags?.map((tag) => (
                  <CommandItem
                    key={tag.id}
                    value={tag.label}
                    onSelect={() => toggleTag(tag.id)}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        selectedTagIds.includes(tag.id) ? "opacity-100" : "opacity-0"
                      )}
                    />
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
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {selectedTags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedTags.map((tag) => (
            <Badge
              key={tag.id}
              style={{
                backgroundColor: `${tag.color}20`,
                color: tag.color || undefined,
                borderColor: tag.color || undefined,
              }}
              className="border flex items-center gap-1 pr-1"
            >
              {tag.label}
              <button
                type="button"
                onClick={() => removeTag(tag.id)}
                className="ml-1 hover:bg-foreground/10 rounded-full p-0.5"
                disabled={disabled}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}