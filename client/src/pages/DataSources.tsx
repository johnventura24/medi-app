import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/PageHeader";
import {
  Database,
  Globe,
  FileSpreadsheet,
  CheckCircle,
  AlertCircle,
  XCircle,
  Loader2,
  Server,
  Hash,
  Calendar,
  ExternalLink,
} from "lucide-react";

interface DataSource {
  name: string;
  type: "file_import" | "api";
  description: string;
  status: "connected" | "partial" | "not_configured";
  records: number | null;
  lastUpdated?: string;
  coverage?: string;
  provides: string[];
  endpoint: string | null;
}

interface DataSourcesResponse {
  sources: DataSource[];
}

function formatNumber(n: number | null): string {
  if (n === null || n === undefined) return "N/A";
  return n.toLocaleString();
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "connected":
      return (
        <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400 hover:bg-emerald-100 gap-1">
          <CheckCircle className="h-3 w-3" />
          Connected
        </Badge>
      );
    case "partial":
      return (
        <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 hover:bg-amber-100 gap-1">
          <AlertCircle className="h-3 w-3" />
          Partial
        </Badge>
      );
    case "not_configured":
      return (
        <Badge className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 hover:bg-red-100 gap-1">
          <XCircle className="h-3 w-3" />
          Not Configured
        </Badge>
      );
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
}

function TypeBadge({ type }: { type: string }) {
  switch (type) {
    case "file_import":
      return (
        <Badge variant="outline" className="gap-1 text-xs">
          <FileSpreadsheet className="h-3 w-3" />
          File Import
        </Badge>
      );
    case "api":
      return (
        <Badge variant="outline" className="gap-1 text-xs">
          <Globe className="h-3 w-3" />
          API
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="gap-1 text-xs">
          <Database className="h-3 w-3" />
          Database
        </Badge>
      );
  }
}

function SourceCard({ source }: { source: DataSource }) {
  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <StatusBadge status={source.status} />
              <TypeBadge type={source.type} />
            </div>
            <CardTitle className="text-lg leading-tight mt-2">{source.name}</CardTitle>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">{source.description}</p>
      </CardHeader>
      <CardContent className="flex-1 space-y-4">
        {/* Stats row */}
        <div className="flex items-center gap-4 text-sm">
          {source.records !== null && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Hash className="h-3.5 w-3.5" />
              <span className="font-medium text-foreground">{formatNumber(source.records)}</span>
              <span>records</span>
            </div>
          )}
          {source.lastUpdated && (
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" />
              <span>{source.lastUpdated}</span>
            </div>
          )}
        </div>

        {source.coverage && (
          <p className="text-xs text-muted-foreground bg-muted/50 rounded px-2 py-1">
            {source.coverage}
          </p>
        )}

        {/* Provides */}
        <div className="space-y-1.5">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Provides</p>
          <div className="flex flex-wrap gap-1">
            {source.provides.map((item) => (
              <Badge
                key={item}
                variant="secondary"
                className="text-xs font-normal"
              >
                {item}
              </Badge>
            ))}
          </div>
        </div>

        {/* Endpoint */}
        {source.endpoint && (
          <div className="flex items-center gap-1.5 pt-1 border-t">
            <ExternalLink className="h-3 w-3 text-muted-foreground shrink-0" />
            <code className="text-xs text-muted-foreground font-mono truncate">
              {source.endpoint}
            </code>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function DataSources() {
  const { data, isLoading, error } = useQuery<DataSourcesResponse>({
    queryKey: ["/api/data-sources"],
    queryFn: async () => {
      const res = await fetch("/api/data-sources");
      if (!res.ok) throw new Error("Failed to fetch data sources");
      return res.json();
    },
  });

  const sources = data?.sources ?? [];
  const fileImports = sources.filter((s) => s.type === "file_import");
  const apis = sources.filter((s) => s.type === "api");

  const totalSources = sources.length;
  const connectedCount = sources.filter((s) => s.status === "connected").length;
  const partialCount = sources.filter((s) => s.status === "partial").length;
  const totalRecords = sources.reduce((sum, s) => sum + (s.records ?? 0), 0);

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Data Sources"
        description="Every data source powering the platform and its current status."
      />

      {isLoading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {error && (
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive">Failed to load data sources. Please try again.</p>
          </CardContent>
        </Card>
      )}

      {!isLoading && !error && (
        <>
          {/* Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <Server className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{totalSources}</p>
                    <p className="text-xs text-muted-foreground">Total Sources</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                    <CheckCircle className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{connectedCount}</p>
                    <p className="text-xs text-muted-foreground">
                      Connected{partialCount > 0 ? ` (+${partialCount} partial)` : ""}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/30">
                    <Database className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{totalRecords.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">Total Records</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-100 dark:bg-purple-900/30">
                    <Calendar className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">CY2026</p>
                    <p className="text-xs text-muted-foreground">Last Updated</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Data Imports Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-lg font-semibold">Data Imports</h2>
              <Badge variant="secondary" className="text-xs">{fileImports.length}</Badge>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {fileImports.map((source) => (
                <SourceCard key={source.name} source={source} />
              ))}
            </div>
          </div>

          {/* Live APIs Section */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-muted-foreground" />
              <h2 className="text-lg font-semibold">Live APIs</h2>
              <Badge variant="secondary" className="text-xs">{apis.length}</Badge>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {apis.map((source) => (
                <SourceCard key={source.name} source={source} />
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
