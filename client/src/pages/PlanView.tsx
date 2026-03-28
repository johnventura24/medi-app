import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/StatCard";
import { PlanComparison } from "@/components/PlanComparison";
import { Skeleton } from "@/components/ui/skeleton";
import type { PlanData } from "@shared/schema";
import { FileText, DollarSign, Star, TrendingUp } from "lucide-react";
import { ExportButton } from "@/components/ExportButton";
import { PageHeader } from "@/components/PageHeader";

export default function PlanView() {
  const { data: planData = [], isLoading, isError } = useQuery<PlanData[]>({
    queryKey: ["/api/plans"],
  });

  const zeroPremiumPlans = planData.filter((p) => (p.premium ?? 0) === 0).length;
  const avgDental = planData.length > 0
    ? Math.round(planData.reduce((acc, p) => acc + (p.dentalAllowance ?? 0), 0) / planData.length)
    : 0;
  const bestPlan = planData.length > 0
    ? planData.reduce((max, p) => (p.dentalAllowance ?? 0) > (max.dentalAllowance ?? 0) ? p : max, planData[0])?.planName ?? "—"
    : "—";

  if (isError) {
    return (
      <div className="p-6">
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-lg font-medium">Failed to load plan data</p>
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
            <Skeleton className="h-6 w-48" />
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
      <PageHeader
        title="Plan Browser"
        description="Browse individual Medicare Advantage plans with full benefit details."
        helpText="Filter by state, carrier, or plan type. Click any plan for complete details."
      />
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Plans to Compare"
          value={planData.length}
          icon={<FileText className="h-5 w-5 text-muted-foreground" />}
        />
        <StatCard
          label="$0 Premium Plans"
          value={zeroPremiumPlans}
          icon={<DollarSign className="h-5 w-5 text-muted-foreground" />}
        />
        <StatCard
          label="Avg Dental Allowance"
          prefix="$"
          value={avgDental.toLocaleString()}
          icon={<Star className="h-5 w-5 text-muted-foreground" />}
        />
        <StatCard
          label="Best Value Plan"
          value={bestPlan.length > 15 ? bestPlan.substring(0, 15) + "..." : bestPlan}
          icon={<TrendingUp className="h-5 w-5 text-muted-foreground" />}
        />
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Side-by-Side Plan Comparison</CardTitle>
          <ExportButton scope="plans" />
        </CardHeader>
        <CardContent>
          <PlanComparison plans={planData} />
        </CardContent>
      </Card>
    </div>
  );
}
