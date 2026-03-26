import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import { type PlanData } from "@shared/schema";
import { Check, X, Star } from "lucide-react";

interface PlanComparisonProps {
  plans: PlanData[];
  className?: string;
}

const comparisonAttributes = [
  { key: "premium", label: "Monthly Premium", format: (v: number) => `$${v}`, lowerBetter: true },
  { key: "deductible", label: "Deductible", format: (v: number) => `$${v}`, lowerBetter: true },
  { key: "moop", label: "Max Out-of-Pocket", format: (v: number) => `$${v.toLocaleString()}`, lowerBetter: true },
  { key: "pcpCopay", label: "PCP Copay", format: (v: number) => `$${v}`, lowerBetter: true },
  { key: "specialistCopay", label: "Specialist Copay", format: (v: number) => `$${v}`, lowerBetter: true },
  { key: "hospitalCopay", label: "Hospital Copay", format: (v: number) => `$${v}`, lowerBetter: true },
  { key: "erCopay", label: "ER Copay", format: (v: number) => `$${v}`, lowerBetter: true },
  { key: "dentalAllowance", label: "Dental Allowance", format: (v: number) => `$${v.toLocaleString()}`, lowerBetter: false },
  { key: "otcAllowance", label: "OTC Allowance", format: (v: number) => `$${v}/mo`, lowerBetter: false },
  { key: "flexCard", label: "Flex Card", format: (v: number) => `$${v}/mo`, lowerBetter: false },
  { key: "groceryAllowance", label: "Grocery Allowance", format: (v: number) => `$${v}/mo`, lowerBetter: false },
  { key: "transportation", label: "Transportation", format: (v: number) => `$${v.toLocaleString()}/yr`, lowerBetter: false },
  { key: "vision", label: "Vision", format: (v: number) => `$${v}`, lowerBetter: false },
  { key: "hearing", label: "Hearing", format: (v: number) => `$${v.toLocaleString()}`, lowerBetter: false },
  { key: "insulin", label: "Insulin Copay", format: (v: number) => v === 0 ? "$0" : `$${v}`, lowerBetter: true },
];

export function PlanComparison({ plans, className }: PlanComparisonProps) {
  const [visibleAttributes, setVisibleAttributes] = useState<string[]>(
    comparisonAttributes.map((a) => a.key)
  );

  const getBestValue = (key: string, lowerBetter: boolean): number => {
    const values = plans.map((p) => p[key as keyof PlanData] as number);
    return lowerBetter ? Math.min(...values) : Math.max(...values);
  };

  const toggleAttribute = (key: string) => {
    setVisibleAttributes((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  };

  return (
    <div className={cn("space-y-6", className)}>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Show/Hide Attributes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {comparisonAttributes.map((attr) => (
              <label
                key={attr.key}
                className="flex items-center gap-2 text-sm cursor-pointer"
              >
                <Checkbox
                  checked={visibleAttributes.includes(attr.key)}
                  onCheckedChange={() => toggleAttribute(attr.key)}
                  data-testid={`checkbox-attr-${attr.key}`}
                />
                {attr.label}
              </label>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="overflow-x-auto">
        <div className="inline-flex gap-4 min-w-full">
          {plans.map((plan, idx) => (
            <Card
              key={plan.id}
              className={cn(
                "flex-shrink-0 w-72",
                idx === 0 && "ring-2 ring-chart-1"
              )}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <CardTitle className="text-base leading-tight" data-testid={`plan-name-${plan.id}`}>
                      {plan.planName}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      {plan.carrier}
                    </p>
                  </div>
                  {idx === 0 && (
                    <Badge variant="default" className="gap-1 bg-chart-1 flex-shrink-0">
                      <Star className="h-3 w-3" />
                      Best
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <Badge variant="secondary">{plan.planType}</Badge>
                  <Badge variant="outline">{plan.city}, {plan.state}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {comparisonAttributes
                  .filter((attr) => visibleAttributes.includes(attr.key))
                  .map((attr) => {
                    const value = plan[attr.key as keyof PlanData] as number;
                    const best = getBestValue(attr.key, attr.lowerBetter);
                    const isBest = value === best;
                    return (
                      <div
                        key={attr.key}
                        className={cn(
                          "flex items-center justify-between py-2 border-b last:border-0",
                          isBest && "bg-chart-1/5 -mx-3 px-3 rounded"
                        )}
                      >
                        <span className="text-sm text-muted-foreground">
                          {attr.label}
                        </span>
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              "font-mono text-sm font-medium",
                              isBest && "text-chart-1"
                            )}
                          >
                            {attr.format(value)}
                          </span>
                          {isBest && <Check className="h-4 w-4 text-chart-1" />}
                        </div>
                      </div>
                    );
                  })}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
