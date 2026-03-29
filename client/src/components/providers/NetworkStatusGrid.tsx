import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Stethoscope,
  AlertTriangle,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  XCircle,
  AlertCircle,
  HelpCircle,
  Shield,
} from "lucide-react";
import { useNetworkStatus, type NetworkStatus, type ConfidenceFactor } from "@/hooks/useProviderSearch";
import { cn } from "@/lib/utils";

interface NetworkStatusGridProps {
  npi: string;
  planIds: number[];
}

// ── Confidence Gauge (circular) ──

function ConfidenceGauge({ confidence, size = 56 }: { confidence: number; size?: number }) {
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = (confidence / 100) * circumference;
  const remaining = circumference - progress;

  const color =
    confidence >= 70
      ? "text-green-500"
      : confidence >= 40
        ? "text-yellow-500"
        : confidence > 0
          ? "text-red-500"
          : "text-muted-foreground";

  const strokeColor =
    confidence >= 70
      ? "stroke-green-500"
      : confidence >= 40
        ? "stroke-yellow-500"
        : confidence > 0
          ? "stroke-red-500"
          : "stroke-muted-foreground";

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth={4}
          className="text-muted/30"
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={4}
          strokeLinecap="round"
          className={strokeColor}
          strokeDasharray={`${progress} ${remaining}`}
        />
      </svg>
      <span className={cn("absolute text-xs font-bold", color)}>
        {confidence}%
      </span>
    </div>
  );
}

// ── Confidence Level Badge ──

function ConfidenceLevelBadge({ level }: { level: string }) {
  const config: Record<string, { label: string; className: string }> = {
    high: {
      label: "High Confidence",
      className: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
    },
    medium: {
      label: "Medium Confidence",
      className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
    },
    low: {
      label: "Low Confidence",
      className: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
    },
    unknown: {
      label: "Unknown",
      className: "bg-muted text-muted-foreground",
    },
  };

  const { label, className } = config[level] || config.unknown;

  return (
    <Badge variant="secondary" className={cn("text-xs", className)}>
      {label}
    </Badge>
  );
}

// ── Factor Icon ──

function FactorIcon({ impact }: { impact: string }) {
  if (impact === "positive") {
    return <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0 mt-0.5" />;
  }
  if (impact === "negative") {
    return <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0 mt-0.5" />;
  }
  return <AlertCircle className="h-3.5 w-3.5 text-yellow-500 shrink-0 mt-0.5" />;
}

// ── Factor List ──

function FactorList({ factors }: { factors: ConfidenceFactor[] }) {
  return (
    <ul className="space-y-1.5">
      {factors.map((f, i) => (
        <li key={i} className="flex items-start gap-2 text-xs">
          <FactorIcon impact={f.impact} />
          <span className="text-muted-foreground">{f.detail}</span>
        </li>
      ))}
    </ul>
  );
}

// ── Single Plan Confidence Card ──

function PlanConfidenceRow({ status }: { status: NetworkStatus }) {
  const [expanded, setExpanded] = useState(false);
  const verifyUrl = status.verificationUrl || status.carrierUrl || status.carrierWebsite;

  return (
    <div className="border rounded-lg p-3 space-y-2">
      <div className="flex items-center gap-3">
        {/* Confidence gauge */}
        <ConfidenceGauge confidence={status.confidence} />

        {/* Plan info */}
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate">{status.planName}</p>
          <p className="text-xs text-muted-foreground truncate">{status.carrier}</p>
          <div className="mt-1">
            <ConfidenceLevelBadge level={status.confidenceLevel} />
          </div>
        </div>

        {/* Verify button */}
        {verifyUrl && (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <a
                  href={verifyUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0"
                >
                  <Button variant="outline" size="sm" className="text-xs gap-1">
                    Verify
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                </a>
              </TooltipTrigger>
              <TooltipContent>
                Open carrier's provider directory to confirm network status
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>

      {/* Recommendation */}
      {status.recommendation && (
        <p className="text-xs text-muted-foreground italic pl-1">
          {status.recommendation}
        </p>
      )}

      {/* Expandable factors */}
      {status.factors && status.factors.length > 0 && (
        <Collapsible open={expanded} onOpenChange={setExpanded}>
          <CollapsibleTrigger asChild>
            <button className="flex items-center gap-1 text-xs text-primary hover:underline">
              {expanded ? (
                <>
                  Hide scoring details <ChevronUp className="h-3 w-3" />
                </>
              ) : (
                <>
                  Show scoring details <ChevronDown className="h-3 w-3" />
                </>
              )}
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-2 pl-1">
              <FactorList factors={status.factors} />
            </div>
          </CollapsibleContent>
        </Collapsible>
      )}
    </div>
  );
}

// ── Main Grid Component ──

export function NetworkStatusGrid({ npi, planIds }: NetworkStatusGridProps) {
  const { data, isLoading, error } = useNetworkStatus(npi, planIds);

  if (!npi || planIds.length === 0) {
    return null;
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Network Confidence
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="border rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-3">
                <Skeleton className="h-14 w-14 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                  <Skeleton className="h-5 w-24" />
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>{error.message}</AlertDescription>
      </Alert>
    );
  }

  const statuses = data?.statuses ?? [];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Shield className="h-4 w-4" />
          Network Confidence
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          Confidence scores estimate the likelihood a provider is in-network. Always verify with the carrier before enrolling.
        </p>
      </CardHeader>
      <CardContent>
        {statuses.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No network confidence data available
          </p>
        ) : (
          <div className="space-y-3">
            {statuses.map((status) => (
              <PlanConfidenceRow key={status.planId} status={status} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
