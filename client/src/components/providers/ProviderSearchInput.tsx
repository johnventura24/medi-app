import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Stethoscope, Loader2, MapPin, Phone, Info } from "lucide-react";
import { useProviderSearch, type ProviderResult } from "@/hooks/useProviderSearch";
import { cn } from "@/lib/utils";

interface ProviderSearchInputProps {
  onSelect: (provider: ProviderResult) => void;
}

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS",
  "KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY",
  "NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY"
];

export function ProviderSearchInput({ onSelect }: ProviderSearchInputProps) {
  const {
    query,
    setQuery,
    stateFilter,
    setStateFilter,
    results,
    isLoading,
  } = useProviderSearch(400);
  const [selectedProvider, setSelectedProvider] = useState<ProviderResult | null>(null);
  const [showDropdown, setShowDropdown] = useState(false);

  const handleSelect = (provider: ProviderResult) => {
    setSelectedProvider(provider);
    setShowDropdown(false);
    setQuery("");
    onSelect(provider);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Stethoscope className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setShowDropdown(true);
              setSelectedProvider(null);
            }}
            onFocus={() => setShowDropdown(true)}
            placeholder="Search by doctor name..."
            className="pl-10"
          />
          {isLoading && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
          )}

          {/* Dropdown */}
          {showDropdown && query.length >= 2 && (
            <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-md max-h-[300px] overflow-y-auto">
              {isLoading && (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  <span className="ml-2 text-sm text-muted-foreground">Searching...</span>
                </div>
              )}
              {!isLoading && results.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No providers found
                </p>
              )}
              {!isLoading &&
                results.map((provider) => (
                  <div
                    key={provider.npi}
                    className="flex items-start gap-3 px-3 py-2 cursor-pointer hover:bg-accent transition-colors"
                    onClick={() => handleSelect(provider)}
                  >
                    <Stethoscope className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        Dr. {provider.name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {provider.specialty}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {provider.city}, {provider.state}
                      </p>
                    </div>
                  </div>
                ))}
            </div>
          )}
        </div>
        <Select value={stateFilter || "all"} onValueChange={(v) => setStateFilter(v === "all" ? "" : v)}>
          <SelectTrigger className="w-24">
            <SelectValue placeholder="State" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            {US_STATES.map((s) => (
              <SelectItem key={s} value={s}>
                {s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Selected Provider Card */}
      {selectedProvider && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Stethoscope className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0 flex-1 space-y-1">
                <p className="text-sm font-semibold">
                  Dr. {selectedProvider.name}
                </p>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {selectedProvider.specialty && (
                    <Badge variant="outline" className="text-xs">
                      {selectedProvider.specialty}
                    </Badge>
                  )}
                </div>
                {/* Specialty Note */}
                {selectedProvider.specialtyNote && (
                  <div className="flex items-start gap-1.5 mt-1.5 p-2 rounded bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                    <Info className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-800 dark:text-amber-300">
                      {selectedProvider.specialtyNote}
                    </p>
                  </div>
                )}
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3" />
                  {selectedProvider.address}, {selectedProvider.city},{" "}
                  {selectedProvider.state}
                </div>
                {selectedProvider.phone && (
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Phone className="h-3 w-3" />
                    {selectedProvider.phone}
                  </div>
                )}
                <p className="text-[10px] text-muted-foreground font-mono">
                  NPI: {selectedProvider.npi}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
