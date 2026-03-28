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
import { Stethoscope, AlertTriangle, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNetworkStatus } from "@/hooks/useProviderSearch";

interface NetworkStatusGridProps {
  npi: string;
  planIds: number[];
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
                </TableRow>
              </TableHeader>
              <TableBody>
                {statuses.map((status) => (
                  <TableRow key={status.planId}>
                    <TableCell className="text-sm font-medium">
                      {status.planName}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {status.carrier}
                    </TableCell>
                    <TableCell className="text-center">
                      {status.inNetwork === true && (
                        <Badge
                          variant="secondary"
                          className="text-xs bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                        >
                          In-Network
                        </Badge>
                      )}
                      {status.inNetwork === false && (
                        <Badge
                          variant="secondary"
                          className="text-xs bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
                        >
                          Out-of-Network
                        </Badge>
                      )}
                      {status.inNetwork === null && (
                        <div className="flex items-center justify-center gap-1">
                          <Badge
                            variant="secondary"
                            className="text-xs bg-muted text-muted-foreground"
                          >
                            Unknown
                          </Badge>
                          {status.carrierWebsite && (
                            <a
                              href={status.carrierWebsite}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs text-primary hover:underline inline-flex items-center gap-0.5"
                            >
                              Verify
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          )}
                          {!status.carrierWebsite && (
                            <span className="text-[10px] text-muted-foreground">
                              Verify with carrier
                            </span>
                          )}
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
