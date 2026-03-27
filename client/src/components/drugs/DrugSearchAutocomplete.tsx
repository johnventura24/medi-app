import { useState, useRef } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
} from "@/components/ui/command";
import { Pill, Loader2 } from "lucide-react";
import { useDrugSearch, type DrugSearchResult } from "@/hooks/useDrugSearch";

interface DrugSearchAutocompleteProps {
  onSelect: (drug: DrugSearchResult) => void;
  placeholder?: string;
}

export function DrugSearchAutocomplete({
  onSelect,
  placeholder = "Search medications...",
}: DrugSearchAutocompleteProps) {
  const [open, setOpen] = useState(false);
  const { query, setQuery, results, isLoading } = useDrugSearch(400);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSelect = (drug: DrugSearchResult) => {
    onSelect(drug);
    setQuery("");
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <div
          className="flex items-center gap-2 border rounded-md px-3 py-2 text-sm cursor-text hover:border-ring transition-colors"
          onClick={() => {
            setOpen(true);
            setTimeout(() => inputRef.current?.focus(), 50);
          }}
        >
          <Pill className="h-4 w-4 text-muted-foreground shrink-0" />
          <span className="text-muted-foreground">{placeholder}</span>
        </div>
      </PopoverTrigger>
      <PopoverContent className="w-[350px] p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput
            ref={inputRef}
            placeholder={placeholder}
            value={query}
            onValueChange={setQuery}
          />
          <CommandList>
            {isLoading && (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                <span className="ml-2 text-sm text-muted-foreground">Searching...</span>
              </div>
            )}
            {!isLoading && query.length >= 2 && results.length === 0 && (
              <CommandEmpty>No medications found.</CommandEmpty>
            )}
            {!isLoading && results.length > 0 && (
              <CommandGroup>
                {results.map((drug) => (
                  <CommandItem
                    key={`${drug.rxcui}-${drug.strength}`}
                    value={drug.rxcui}
                    onSelect={() => handleSelect(drug)}
                    className="cursor-pointer"
                  >
                    <Pill className="h-4 w-4 text-muted-foreground mr-2 shrink-0" />
                    <div className="flex flex-col min-w-0">
                      <span className="text-sm font-medium truncate">{drug.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {drug.strength} &middot; {drug.dosageForm}
                      </span>
                    </div>
                  </CommandItem>
                ))}
              </CommandGroup>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
