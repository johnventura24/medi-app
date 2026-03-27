import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/StatCard";
import { TargetingRecommendations } from "@/components/TargetingRecommendations";
import { Skeleton } from "@/components/ui/skeleton";
import type { TargetingRecommendation } from "@shared/schema";
import { Target, Zap, TrendingUp, MapPin } from "lucide-react";

export default function Recommendations() {
  const { data: recommendations = [], isLoading, isError } = useQuery<TargetingRecommendation[]>({
    queryKey: ["/api/recommendations"],
  });

  const avgScore = recommendations.length > 0
    ? Math.round(recommendations.reduce((acc, r) => acc + (r.score ?? 0), 0) / recommendations.length)
    : 0;
  const topPicks = recommendations.filter((r) => (r.score ?? 0) >= 90).length;
  const bestLocation = recommendations.length > 0
    ? recommendations.reduce((max, r) => (r.score ?? 0) > (max.score ?? 0) ? r : max, recommendations[0])?.location ?? "—"
    : "—";

  if (isError) {
    return (
      <div className="p-6">
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-lg font-medium">Failed to load recommendations</p>
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
            <Skeleton className="h-[400px] w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Targeting Opportunities"
          value={recommendations.length}
          icon={<Target className="h-5 w-5 text-muted-foreground" />}
        />
        <StatCard
          label="Avg Opportunity Score"
          value={avgScore}
          suffix="/100"
          icon={<TrendingUp className="h-5 w-5 text-muted-foreground" />}
        />
        <StatCard
          label="Top Picks (90+)"
          value={topPicks}
          icon={<Zap className="h-5 w-5 text-muted-foreground" />}
        />
        <StatCard
          label="Best Location"
          value={bestLocation.length > 12 ? bestLocation.substring(0, 12) + "..." : bestLocation}
          icon={<MapPin className="h-5 w-5 text-muted-foreground" />}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-chart-1" />
            AI-Driven Targeting Recommendations
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recommendations.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Target className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p className="text-lg font-medium">No recommendations available</p>
              <p className="text-sm mt-1">Try adjusting your filters or check back later.</p>
            </div>
          ) : (
            <TargetingRecommendations
              recommendations={recommendations}
              onExport={(rec) => console.log("Export:", rec.location)}
              onShare={(rec) => console.log("Share:", rec.location)}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
