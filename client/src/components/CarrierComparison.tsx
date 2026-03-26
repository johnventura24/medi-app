import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { type CarrierData } from "@shared/schema";
import { Trophy, TrendingUp } from "lucide-react";

interface CarrierComparisonProps {
  carriers: CarrierData[];
  className?: string;
}

export function CarrierComparison({ carriers, className }: CarrierComparisonProps) {
  const sortedByMarketShare = [...carriers].sort((a, b) => b.marketShare - a.marketShare);
  const maxDental = Math.max(...carriers.map((c) => c.avgDentalAllowance));
  const maxOtc = Math.max(...carriers.map((c) => c.avgOtcAllowance));
  const maxFlex = Math.max(...carriers.map((c) => c.avgFlexCard));

  return (
    <div className={cn("grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6", className)}>
      {sortedByMarketShare.slice(0, 4).map((carrier, idx) => (
        <Card key={carrier.id} className="overflow-hidden">
          <CardHeader className="pb-2">
            <div className="flex items-start justify-between gap-2">
              <div>
                <CardTitle className="text-lg" data-testid={`carrier-name-${carrier.id}`}>
                  {carrier.name}
                </CardTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {carrier.statesServed} states
                </p>
              </div>
              {idx === 0 && (
                <Badge variant="default" className="gap-1">
                  <Trophy className="h-3 w-3" />
                  Leader
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Market Share</span>
              <div className="flex items-center gap-2">
                <TrendingUp className="h-3 w-3 text-chart-2" />
                <span className="font-mono font-medium">{carrier.marketShare}%</span>
              </div>
            </div>
            
            <div className="space-y-3">
              <div>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Avg Dental</span>
                  <span
                    className={cn(
                      "font-mono font-medium",
                      carrier.avgDentalAllowance === maxDental && "text-chart-1"
                    )}
                  >
                    ${carrier.avgDentalAllowance.toLocaleString()}
                    {carrier.avgDentalAllowance === maxDental && " (Best)"}
                  </span>
                </div>
                <Progress
                  value={(carrier.avgDentalAllowance / maxDental) * 100}
                  className="h-2"
                />
              </div>
              
              <div>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Avg OTC/mo</span>
                  <span
                    className={cn(
                      "font-mono font-medium",
                      carrier.avgOtcAllowance === maxOtc && "text-chart-2"
                    )}
                  >
                    ${carrier.avgOtcAllowance}
                    {carrier.avgOtcAllowance === maxOtc && " (Best)"}
                  </span>
                </div>
                <Progress
                  value={(carrier.avgOtcAllowance / maxOtc) * 100}
                  className="h-2"
                />
              </div>
              
              <div>
                <div className="flex items-center justify-between text-sm mb-1">
                  <span className="text-muted-foreground">Avg Flex Card</span>
                  <span
                    className={cn(
                      "font-mono font-medium",
                      carrier.avgFlexCard === maxFlex && "text-chart-3"
                    )}
                  >
                    ${carrier.avgFlexCard}
                    {carrier.avgFlexCard === maxFlex && " (Best)"}
                  </span>
                </div>
                <Progress
                  value={(carrier.avgFlexCard / maxFlex) * 100}
                  className="h-2"
                />
              </div>
            </div>

            <div className="pt-2 border-t">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Total Plans</span>
                <span className="font-mono font-medium">{carrier.totalPlans.toLocaleString()}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
