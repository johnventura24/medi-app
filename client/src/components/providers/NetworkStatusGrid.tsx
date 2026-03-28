import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Stethoscope, AlertTriangle, ExternalLink, CheckCircle2, XCircle, HelpCircle } from "lucide-react";
import { useNetworkStatus } from "@/hooks/useProviderSearch";

interface NetworkStatusGridProps {
  npi: string;
  planIds: number[];
}

function formatVerifiedDate(iso: string | null | undefined): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "";
  }
}

function sourceLabel(source: string): string {
  switch (source) {
    case "FHIR API":
      return "Verified via FHIR";
    case "Cache":
      return "Cached result";
    default:
      return "Not verified";
  }
}

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
            <Stethoscope className="h-4 w-4" />
            Network Status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
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
          <Stethoscope className="h-4 w-4" />
          Network Status
        </CardTitle>
      </CardHeader>
      <CardContent>
        {statuses.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            No network status data available
          </p>
        ) : (
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="text-xs">Plan Name</TableHead>
                  <TableHead className="text-xs">Carrier</TableHead>
                  <TableHead className="text-xs text-center">
                    Network Status
                  </TableHead>
                  <TableHead className="text-xs text-center">
                    Source
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {statuses.map((status) => {
                  const verifyUrl = status.carrierUrl || status.carrierWebsite;
                  const verified = formatVerifiedDate(status.verifiedAt);

                  return (
                    <TableRow key={status.planId}>
                      <TableCell className="text-sm font-medium">
                        {status.planName}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {status.carrier}
                      </TableCell>
                      <TableCell className="text-center">
                        {status.inNetwork === true && (
                          <div className="flex items-center justify-center gap-1">
                            <CheckCircle2 className="h-4 w-4 text-green-600" />
                            <Badge
                              variant="secondary"
                              className="text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                            >
                              In-Network
                            </Badge>
                          </div>
                        )}
                        {status.inNetwork === false && (
                          <div className="flex items-center justify-center gap-1">
                            <XCircle className="h-4 w-4 text-red-600" />
                            <Badge
                              variant="secondary"
                              className="text-xs bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                            >
                              Out-of-Network
                            </Badge>
                          </div>
                        )}
                        {status.inNetwork === null && (
                          <div className="flex items-center justify-center gap-1">
                            <HelpCircle className="h-4 w-4 text-muted-foreground" />
                            <Badge
                              variant="secondary"
                              className="text-xs bg-muted text-muted-foreground"
                            >
                              Unknown
                            </Badge>
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="flex flex-col items-center gap-0.5">
                          {status.source && status.source !== "Unknown" ? (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="text-[10px] text-muted-foreground cursor-help">
                                    {sourceLabel(status.source)}
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>
                                  {verified
                                    ? `Last verified: ${verified}`
                                    : "Verification date unavailable"}
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          ) : verifyUrl ? (
                            <a
                              href={verifyUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[10px] text-primary hover:underline inline-flex items-center gap-0.5"
                            >
                              Verify at carrier website
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          ) : (
                            <span className="text-[10px] text-muted-foreground">
                              Verify with carrier
                            </span>
                          )}
                          {/* Show verify link even for known statuses so users can double-check */}
                          {status.source && status.source !== "Unknown" && verifyUrl && (
                            <a
                              href={verifyUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-[10px] text-primary/70 hover:underline inline-flex items-center gap-0.5"
                            >
                              Verify
                              <ExternalLink className="h-2.5 w-2.5" />
                            </a>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
