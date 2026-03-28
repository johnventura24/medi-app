import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/StatCard";
import { ZipRankingTable } from "@/components/ZipRankingTable";
import { Skeleton } from "@/components/ui/skeleton";
import { ZipScoresBarChart } from "@/components/charts/ZipScoresBarChart";
import { DesirabilityHistogram } from "@/components/charts/DesirabilityHistogram";
import type { ZipData } from "@shared/schema";
import { MapPin, Target, Star, TrendingUp } from "lucide-react";
import { ExportButton } from "@/components/ExportButton";
import { PageHeader } from "@/components/PageHeader";

export default function ZipRankings() {
  const { data: zipData = [], isLoading, isError } = useQuery<ZipData[]>({
    queryKey: ["/api/zips"],
  });

  const avgScore = zipData.length > 0
    ? Math.round(zipData.reduce((acc, z) => acc + (z.desirabilityScore ?? 0), 0) / zipData.length)
    : 0;
  const topZips = zipData.filter((z) => (z.desirabilityScore ?? 0) >= 90).length;
  const bestZip = zipData.length > 0
    ? zipData.reduce((max, z) => (z.desirabilityScore ?? 0) > (max.desirabilityScore ?? 0) ? z : max, zipData[0])?.zip ?? "—"
    : "—";

  const zipScoreData = useMemo(
    () => zipData.map((z) => ({ zip: z.zip ?? "", city: z.city ?? "", state: z.state ?? "", score: z.desirabilityScore ?? 0 })),
    [zipData]
  );

  const desirabilityScores = useMemo(
    () => zipData.map((z) => z.desirabilityScore ?? 0),
    [zipData]
  );

  if (isError) {
    return (
      <div className="p-6">
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-lg font-medium">Failed to load ZIP data</p>
          <p className="text-sm mt-1">Please check your connection and try refreshing the page.</p>
        </div>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-8 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-6 w-64" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[300px] w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="ZIP Code Rankings"
        description="ZIP codes ranked by plan density and benefit richness. Higher scores mean more plan options with better benefits."
        helpText="The desirability score factors in plan count, dental coverage, and supplemental benefit availability."
      />
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="ZIP Codes Analyzed"
          value={zipData.length}
          icon={<MapPin className="h-5 w-5 text-muted-foreground" />}
        />
        <StatCard
          label="Avg Desirability Score"
          value={avgScore}
          suffix="/100"
          icon={<Target className="h-5 w-5 text-muted-foreground" />}
        />
        <StatCard
          label="Top-Rated ZIPs (90+)"
          value={topZips}
          icon={<Star className="h-5 w-5 text-muted-foreground" />}
        />
        <StatCard
          label="Best ZIP Code"
          value={bestZip}
          icon={<TrendingUp className="h-5 w-5 text-muted-foreground" />}
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {zipScoreData.length > 0 && (
          <ZipScoresBarChart
            data={zipScoreData}
            count={15}
            title="Top 15 ZIP Codes by Desirability Score"
          />
        )}
        {desirabilityScores.length > 0 && (
          <DesirabilityHistogram
            scores={desirabilityScores}
            title="Desirability Score Distribution"
          />
        )}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>ZIP Code Rankings by Opportunity Score</CardTitle>
          <ExportButton scope="zips" />
        </CardHeader>
        <CardContent>
          <ZipRankingTable
            data={zipData}
            onZipClick={(zip) => console.log("View ZIP:", zip)}
          />
        </CardContent>
      </Card>
    </div>
  );
}
