import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Loader2,
  Pill,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  DollarSign,
  Info,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { cn } from "@/lib/utils";
import { useDrugCosts, type DrugCostMedication } from "@/hooks/useDrugCosts";
import { CoveragePhaseBreakdown } from "@/components/drugs/CoveragePhaseBreakdown";
import { FormularyStatusBadge } from "@/components/drugs/FormularyStatusBadge";

interface DrugCostEstimatorProps {
  clientId: number;
  planIds: number[];
  medications: DrugCostMedication[];
}

export function DrugCostEstimator({
  clientId,
  planIds,
  medications,
}: DrugCostEstimatorProps) {
  const { estimate, data, isEstimating, error } = useDrugCosts(clientId);
  const [expandedPlan, setExpandedPlan] = useState<number | null>(null);

  const handleEstimate = () => {
    if (medications.length === 0 || planIds.length === 0) return;
    estimate({ planIds, medications });
  };

  const chartData =
    data?.estimates.map((est) => ({
      name: est.planName.length > 20 ? est.planName.slice(0, 20) + "..." : est.planName,
      annualCost: est.annualCost,
      planId: est.planId,
    })) ?? [];

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <DollarSign className="h-4 w-4" />
            Drug Cost Estimator
          </CardTitle>
          <Button
            size="sm"
            onClick={handleEstimate}
            disabled={isEstimating || medications.length === 0 || planIds.length === 0}
          >
            {isEstimating ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Pill className="h-4 w-4 mr-2" />
            )}
            {isEstimating ? "Estimating..." : "Estimate Drug Costs"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {medications.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            Add medications above to estimate costs across plans.
          </p>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>{error.message}</AlertDescription>
          </Alert>
        )}

        {isEstimating && (
          <div className="space-y-3">
            <Skeleton className="h-48 w-full" />
            <Skeleton className="h-32 w-full" />
          </div>
        )}

        {data && !isEstimating && (
          <>
            {/* IRA Cap Note */}
            <Alert className="bg-blue-50 border-blue-200 dark:bg-blue-950 dark:border-blue-800">
              <Info className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-xs text-blue-800 dark:text-blue-200">
                Part D out-of-pocket is capped at $2,000/year (Inflation Reduction Act)
              </AlertDescription>
            </Alert>

            {/* Bar Chart */}
            {chartData.length > 0 && (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis
                      dataKey="name"
                      tick={{ fontSize: 11 }}
                      angle={-20}
                      textAnchor="end"
                      height={60}
                    />
                    <YAxis
                      tick={{ fontSize: 11 }}
                      tickFormatter={(v) => `$${v.toLocaleString()}`}
                    />
                    <Tooltip
                      formatter={(value: number) => [
                        `$${value.toLocaleString()}`,
                        "Annual Drug Cost",
                      ]}
                    />
                    <Bar
                      dataKey="annualCost"
                      name="Annual Drug Cost"
                      fill="hsl(var(--primary))"
                      radius={[4, 4, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Per-plan breakdown */}
            {data.estimates.map((est) => (
              <Collapsible
                key={est.planId}
                open={expandedPlan === est.planId}
                onOpenChange={(open) =>
                  setExpandedPlan(open ? est.planId : null)
                }
              >
                <CollapsibleTrigger asChild>
                  <div className="flex items-center justify-between p-3 border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                    <div className="flex items-center gap-3 min-w-0">
                      <div>
                        <p className="text-sm font-medium truncate">
                          {est.planName}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {est.carrier}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-lg font-bold font-mono">
                        ${est.annualCost.toLocaleString()}
                      </span>
                      <span className="text-xs text-muted-foreground">/year</span>
                      {expandedPlan === est.planId ? (
                        <ChevronUp className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="mt-2 space-y-4 p-3 border border-t-0 rounded-b-lg">
                    {/* Drug breakdown table */}
                    <div className="rounded-md border overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-muted/50">
                            <TableHead className="text-xs">Drug</TableHead>
                            <TableHead className="text-xs text-center">Status</TableHead>
                            <TableHead className="text-xs text-right">Annual Cost</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {est.drugs.map((drug) => (
                            <TableRow key={drug.rxcui}>
                              <TableCell className="text-sm">{drug.name}</TableCell>
                              <TableCell className="text-center">
                                <FormularyStatusBadge
                                  covered={drug.covered}
                                  tier={drug.tier}
                                  tierLabel={drug.tierLabel}
                                  priorAuth={drug.priorAuth}
                                  stepTherapy={drug.stepTherapy}
                                  quantityLimit={drug.quantityLimit}
                                />
                              </TableCell>
                              <TableCell className="text-right font-mono text-sm">
                                ${drug.annualCost.toLocaleString()}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>

                    {/* Coverage phase breakdown */}
                    <CoveragePhaseBreakdown phases={est.phases} />
                  </div>
                </CollapsibleContent>
              </Collapsible>
            ))}
          </>
        )}
      </CardContent>
    </Card>
  );
}
