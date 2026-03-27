import { useState, useEffect, useCallback } from "react";
import { useLocation } from "wouter";
import {
  CommandDialog,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
} from "@/components/ui/command";
import { Badge } from "@/components/ui/badge";
import { useSearch } from "@/hooks/useSearch";
import {
  Search,
  FileText,
  Building,
  MapPin,
  Loader2,
} from "lucide-react";

export function SearchCommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const { results, isLoading } = useSearch(query);
  const [, setLocation] = useLocation();

  // Listen for Cmd+K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleSelect = useCallback(
    (type: string, _item: unknown) => {
      setOpen(false);
      setQuery("");
      switch (type) {
        case "plan":
          setLocation("/plans");
          break;
        case "carrier":
          setLocation("/carriers");
          break;
        case "State":
          setLocation("/");
          break;
        case "City":
          setLocation("/cities");
          break;
        case "ZIP":
          setLocation("/zips");
          break;
      }
    },
    [setLocation]
  );

  const hasResults =
    results.plans.length > 0 ||
    results.carriers.length > 0 ||
    results.locations.length > 0;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="relative max-w-sm hidden sm:flex items-center gap-2 rounded-md border border-input bg-background px-3 py-2 text-sm text-muted-foreground shadow-sm hover:bg-accent hover:text-accent-foreground transition-colors w-64"
        data-testid="input-global-search"
      >
        <Search className="h-4 w-4 shrink-0" />
        <span className="flex-1 text-left">Search states, cities, ZIPs...</span>
        <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
          <span className="text-xs">⌘</span>K
        </kbd>
      </button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          placeholder="Search plans, carriers, locations..."
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          {isLoading && (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {!isLoading && query.length > 0 && !hasResults && (
            <CommandEmpty>No results found.</CommandEmpty>
          )}

          {!isLoading && query.length === 0 && (
            <CommandEmpty>Type to search plans, carriers, and locations...</CommandEmpty>
          )}

          {results.plans.length > 0 && (
            <CommandGroup heading="Plans">
              {results.plans.map((plan) => (
                <CommandItem
                  key={`plan-${plan.id}`}
                  value={`plan-${plan.planName}`}
                  onSelect={() => handleSelect("plan", plan)}
                >
                  <FileText className="h-4 w-4 mr-2 shrink-0 text-muted-foreground" />
                  <div className="flex flex-col flex-1 min-w-0">
                    <span className="truncate">{plan.planName}</span>
                    <span className="text-xs text-muted-foreground">
                      {plan.carrier} &middot; {plan.state}
                    </span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {results.plans.length > 0 && results.carriers.length > 0 && (
            <CommandSeparator />
          )}

          {results.carriers.length > 0 && (
            <CommandGroup heading="Carriers">
              {results.carriers.map((carrier) => (
                <CommandItem
                  key={`carrier-${carrier.id}`}
                  value={`carrier-${carrier.name}`}
                  onSelect={() => handleSelect("carrier", carrier)}
                >
                  <Building className="h-4 w-4 mr-2 shrink-0 text-muted-foreground" />
                  <span className="flex-1 truncate">{carrier.name}</span>
                  <span className="text-xs text-muted-foreground ml-2">
                    {carrier.planCount} plans
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}

          {(results.plans.length > 0 || results.carriers.length > 0) &&
            results.locations.length > 0 && <CommandSeparator />}

          {results.locations.length > 0 && (
            <CommandGroup heading="Locations">
              {results.locations.map((location) => (
                <CommandItem
                  key={`location-${location.type}-${location.id}`}
                  value={`location-${location.name}`}
                  onSelect={() => handleSelect(location.type, location)}
                >
                  <MapPin className="h-4 w-4 mr-2 shrink-0 text-muted-foreground" />
                  <span className="flex-1 truncate">{location.name}</span>
                  <Badge variant="secondary" className="ml-2 text-[10px]">
                    {location.type}
                  </Badge>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </CommandDialog>
    </>
  );
}
