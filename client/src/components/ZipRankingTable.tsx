import { DataTable, type Column, Badge } from "./DataTable";
import { cn } from "@/lib/utils";
import { type ZipData } from "@shared/schema";
import { Star, Check, X } from "lucide-react";

interface ZipRankingTableProps {
  data: ZipData[];
  onZipClick?: (zip: ZipData) => void;
  className?: string;
}

export function ZipRankingTable({ data, onZipClick, className }: ZipRankingTableProps) {
  const getScoreBadge = (score: number) => {
    if (score >= 90) {
      return (
        <Badge variant="default" className="gap-1 bg-chart-1">
          <Star className="h-3 w-3" />
          {score}
        </Badge>
      );
    }
    if (score >= 80) {
      return <Badge variant="default">{score}</Badge>;
    }
    if (score >= 70) {
      return <Badge variant="secondary">{score}</Badge>;
    }
    return <Badge variant="outline">{score}</Badge>;
  };

  const columns: Column<ZipData>[] = [
    {
      key: "zip",
      header: "ZIP Code",
      sortable: true,
      render: (value) => (
        <span className="font-mono font-medium">{value as string}</span>
      ),
    },
    {
      key: "city",
      header: "City",
      sortable: true,
    },
    {
      key: "state",
      header: "State",
      sortable: true,
    },
    {
      key: "planCount",
      header: "Plans",
      sortable: true,
      render: (value) => (
        <span className="font-mono">{value as number}</span>
      ),
    },
    {
      key: "desirabilityScore",
      header: "Score",
      sortable: true,
      render: (value) => getScoreBadge(value as number),
    },
    {
      key: "topBenefit",
      header: "Top Benefit",
      sortable: true,
      render: (value) => (
        <Badge variant="secondary">{value as string}</Badge>
      ),
    },
    {
      key: "hasFlexCard",
      header: "Flex Card",
      sortable: true,
      render: (value) =>
        value ? (
          <Check className="h-4 w-4 text-chart-2" />
        ) : (
          <X className="h-4 w-4 text-muted-foreground" />
        ),
    },
    {
      key: "hasOtc",
      header: "OTC",
      sortable: true,
      render: (value) =>
        value ? (
          <Check className="h-4 w-4 text-chart-2" />
        ) : (
          <X className="h-4 w-4 text-muted-foreground" />
        ),
    },
    {
      key: "maxDental",
      header: "Max Dental",
      sortable: true,
      render: (value) => (
        <span className="font-mono text-chart-1">
          ${(value as number).toLocaleString()}
        </span>
      ),
    },
    {
      key: "maxOtc",
      header: "Max OTC",
      sortable: true,
      render: (value) => (
        <span className="font-mono">${value as number}/mo</span>
      ),
    },
  ];

  return (
    <div className={cn("", className)}>
      <DataTable
        data={data as unknown as Record<string, unknown>[]}
        columns={columns as unknown as Column<Record<string, unknown>>[]}
        searchPlaceholder="Search ZIP codes..."
        pageSize={10}
        onRowClick={(row) => onZipClick?.(row as unknown as ZipData)}
      />
    </div>
  );
}
