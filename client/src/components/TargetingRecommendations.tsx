import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { type TargetingRecommendation } from "@shared/schema";
import { Target, Download, Share2, ChevronRight, Zap } from "lucide-react";

interface TargetingRecommendationsProps {
  recommendations: TargetingRecommendation[];
  onExport?: (rec: TargetingRecommendation) => void;
  onShare?: (rec: TargetingRecommendation) => void;
  className?: string;
}

export function TargetingRecommendations({
  recommendations,
  onExport,
  onShare,
  className,
}: TargetingRecommendationsProps) {
  const getLocationTypeBadge = (type: TargetingRecommendation["locationType"]) => {
    switch (type) {
      case "state":
        return <Badge variant="secondary">State</Badge>;
      case "city":
        return <Badge variant="secondary">City</Badge>;
      case "zip":
        return <Badge variant="default">ZIP Code</Badge>;
    }
  };

  const getScoreColor = (score: number): string => {
    if (score >= 90) return "text-chart-1";
    if (score >= 80) return "text-chart-2";
    if (score >= 70) return "text-chart-3";
    return "text-muted-foreground";
  };

  return (
    <div className={cn("space-y-4", className)}>
      {recommendations.map((rec, idx) => (
        <Card
          key={rec.id}
          className={cn(
            "hover-elevate overflow-hidden",
            idx === 0 && "ring-2 ring-chart-1/30"
          )}
        >
          <CardContent className="p-0">
            <div className="flex flex-col lg:flex-row">
              <div className="flex-shrink-0 p-6 flex items-center justify-center bg-muted/30 lg:w-24">
                <div className="text-center">
                  <p className="text-xs text-muted-foreground mb-1">Rank</p>
                  <p className="text-3xl font-bold font-mono">#{idx + 1}</p>
                </div>
              </div>
              
              <div className="flex-1 p-6 space-y-4">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="font-semibold text-lg" data-testid={`rec-location-${rec.id}`}>
                        {rec.location}
                      </h3>
                      {getLocationTypeBadge(rec.locationType)}
                      {idx === 0 && (
                        <Badge variant="default" className="gap-1 bg-chart-1">
                          <Zap className="h-3 w-3" />
                          Top Pick
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Target className="h-4 w-4 text-chart-1" />
                      <span className="font-medium">Best Angle: {rec.bestAngle}</span>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <div className="text-right">
                      <p className="text-xs text-muted-foreground">Opportunity Score</p>
                      <p className={cn("text-2xl font-bold font-mono", getScoreColor(rec.score))}>
                        {rec.score}
                      </p>
                    </div>
                    <Progress
                      value={rec.score}
                      className="w-16 h-16 [&>div]:rounded-full"
                      style={{
                        background: `conic-gradient(hsl(var(--chart-1)) ${rec.score}%, hsl(var(--muted)) 0)`,
                        borderRadius: "50%",
                      }}
                    />
                  </div>
                </div>
                
                <p className="text-sm text-muted-foreground" data-testid={`rec-reasoning-${rec.id}`}>
                  {rec.reasoning}
                </p>
                
                <div className="flex items-center justify-between gap-4 pt-2 border-t flex-wrap">
                  <div className="flex items-center gap-6">
                    <div>
                      <p className="text-xs text-muted-foreground">Plans</p>
                      <p className="font-mono font-medium">{rec.metrics.planCount}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Avg Benefit</p>
                      <p className="font-mono font-medium">${rec.metrics.avgBenefit.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Coverage</p>
                      <p className="font-mono font-medium">{rec.metrics.coverage}%</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onShare?.(rec)}
                      data-testid={`button-share-${rec.id}`}
                    >
                      <Share2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => onExport?.(rec)}
                      data-testid={`button-export-${rec.id}`}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      data-testid={`button-details-${rec.id}`}
                    >
                      View Details
                      <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
