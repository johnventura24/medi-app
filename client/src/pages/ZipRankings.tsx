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
import { InsightBox, type InsightItem } from "@/components/InsightBox";

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

  const zipInsights = useMemo((): InsightItem[] => {
    if (zipData.length === 0) return [];
    const items: InsightItem[] = [];

    // Best ZIP
    const best = zipData.reduce((max, z) => (z.desirabilityScore ?? 0) > (max.desirabilityScore ?? 0) ? z : max, zipData[0]);
    items.push({
      icon: "target",
      text: `Top ZIP ${best.zip} (${best.city}, ${best.state}) has a desirability score of ${best.desirabilityScore} — best area for beneficiaries`,
      priority: "high",
    });

    // Underserved ZIPs
    const underserved = zipData.filter((z) => (z.desirabilityScore ?? 0) < 50);
    if (underserved.length > 0) {
      items.push({
        icon: "alert",
        text: `${underserved.length} ZIPs score below 50 — underserved areas worth targeting for market entry`,
        priority: underserved.length > zipData.length * 0.3 ? "high" : "medium",
      });
    }

    // Average score context
    const nationalBenchmark = 65;
    items.push({
      icon: "trend",
      text: `Average score across all ${zipData.length} ZIPs: ${avgScore}/100 — ${avgScore >= nationalBenchmark ? "above" : "below"} the ${nationalBenchmark} national benchmark`,
      priority: avgScore < nationalBenchmark ? "medium" : "low",
    });

    // Top ZIPs cluster
    const top10 = [...zipData].sort((a, b) => (b.desirabilityScore ?? 0) - (a.desirabilityScore ?? 0)).slice(0, 10);
    const topStates = Array.from(new Set(top10.map((z) => z.state)));
    if (topStates.length <= 3) {
      items.push({
        icon: "opportunity",
        text: `Top 10 ZIPs cluster in ${topStates.join(", ")} — focus agent recruitment in these states`,
        priority: "medium",
      });
    }

    return items.slice(0, 5);
  }, [zipData, avgScore]);

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
        helpText="The desirability score factors in plan count, dental coverage, and supplemental benefit availability. A score of 90+ means excellent plan choice with rich benefits. Below 50 means limited options."
        dataSource="Data: CMS CY2026 PBP files cross-referenced with ZIP-to-county mappings. Desirability score is calculated from plan count, dental %, OTC %, and supplemental benefit diversity."
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

      {zipInsights.length > 0 && (
        <InsightBox title="ZIP Code Insights" insights={zipInsights} />
      )}

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
