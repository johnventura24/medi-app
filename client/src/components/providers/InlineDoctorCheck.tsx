import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Stethoscope,
  Loader2,
  ExternalLink,
  Search,
  Shield,
} from "lucide-react";
import {
  useProviderSearch,
  useNetworkStatus,
  type ProviderResult,
} from "@/hooks/useProviderSearch";
import { cn } from "@/lib/utils";

interface InlineDoctorCheckProps {
  planId: number;
}

function ConfidenceBadge({
  confidence,
  level,
}: {
  confidence: number;
  level: string;
}) {
  const config: Record<string, { className: string }> = {
    high: {
      className:
        "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    },
    medium: {
      className:
        "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    },
    low: {
      className:
        "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    },
    unknown: {
      className: "bg-muted text-muted-foreground",
    },
  };

  const { className } = config[level] || config.unknown;

  return (
    <Badge variant="secondary" className={cn("text-[10px]", className)}>
      {confidence}% confidence
    </Badge>
  );
}

function InlineResult({
  provider,
  planId,
}: {
  provider: ProviderResult;
  planId: number;
}) {
  const { data, isLoading } = useNetworkStatus(provider.npi, [planId]);
  const status = data?.statuses?.[0];

  return (
    <div className="flex items-center gap-2 px-2 py-1.5 rounded border bg-card">
      <Shield className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
      <div className="flex-1 min-w-0">
        <span className="text-xs font-medium truncate block">
          Dr. {provider.name}
        </span>
        <span className="text-[10px] text-muted-foreground truncate block">
          {provider.specialty}
        </span>
      </div>
      {isLoading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground shrink-0" />
      ) : status ? (
        <div className="flex items-center gap-1.5 shrink-0">
          <ConfidenceBadge
            confidence={status.confidence}
            level={status.confidenceLevel}
          />
          {status.verificationUrl && (
            <a
              href={status.verificationUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
        </div>
      ) : null}
    </div>
  );
}

/**
 * Compact inline provider search for embedding in plan cards.
 * Shows a search field, results with confidence scores for a single plan.
 */
export function InlineDoctorCheck({ planId }: InlineDoctorCheckProps) {
  const {
    query,
    setQuery,
    results,
    isLoading,
  } = useProviderSearch(500);
  const [selectedProviders, setSelectedProviders] = useState<ProviderResult[]>(
    []
  );
  const [showDropdown, setShowDropdown] = useState(false);

  const handleSelect = (provider: ProviderResult) => {
    if (!selectedProviders.find((p) => p.npi === provider.npi)) {
      setSelectedProviders((prev) => [...prev, provider]);
    }
    setShowDropdown(false);
    setQuery("");
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        <Stethoscope className="h-3.5 w-3.5" />
        Check if your doctor is in-network
      </div>
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <Input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setShowDropdown(true);
          }}
          onFocus={() => {
            if (query.length >= 2) setShowDropdown(true);
          }}
          placeholder="Doctor name..."
          className="pl-8 h-8 text-xs"
        />
        {isLoading && (
          <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin text-muted-foreground" />
        )}

        {showDropdown && query.length >= 2 && (
          <div className="absolute z-50 w-full mt-1 bg-popover border rounded-md shadow-md max-h-[200px] overflow-y-auto">
            {isLoading && (
              <div className="flex items-center justify-center py-3">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                <span className="ml-2 text-xs text-muted-foreground">
                  Searching...
                </span>
              </div>
            )}
            {!isLoading && results.length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-3">
                No providers found
              </p>
            )}
            {!isLoading &&
              results.map((provider) => (
                <div
                  key={provider.npi}
                  className="flex items-start gap-2 px-2.5 py-1.5 cursor-pointer hover:bg-accent transition-colors"
                  onClick={() => handleSelect(provider)}
                >
                  <Stethoscope className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-xs font-medium truncate">
                      Dr. {provider.name}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {provider.specialty} -- {provider.city}, {provider.state}
                    </p>
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Selected provider results with confidence */}
      {selectedProviders.length > 0 && (
        <div className="space-y-1.5">
          {selectedProviders.map((provider) => (
            <InlineResult
              key={provider.npi}
              provider={provider}
              planId={planId}
            />
          ))}
        </div>
      )}
    </div>
  );
}
