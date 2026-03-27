import { useState, useMemo } from "react";
import { useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowLeft,
  Share2,
  X,
  Download,
  FileText,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

// ── Types ──

interface ComparePlan {
  id: number;
  name: string;
  carrier: string;
  planType: string;
  state: string;
  county: string;
  // Plan Info
  contractId?: string;
  planId?: string;
  segmentId?: string;
  snpType?: string;
  // Premiums & Costs
  premium: number;
  partbGiveback: number | null;
  deductible: number;
  moop: number;
  drugDeductible: number | null;
  // Medical Copays
  pcpCopay: number;
  specialistCopay: number;
  erCopay: number;
  urgentCareCopay?: number | null;
  inpatientCopay?: number | null;
  diagnosticCopay?: number | null;
  labCopay?: number | null;
  ambulanceCopay?: number | null;
  mentalHealthOutpatientCopay?: number | null;
  // Drug Coverage
  tier1CopayPreferred?: number | null;
  tier2CopayPreferred?: number | null;
  tier3CopayPreferred?: number | null;
  tier4CoinsurancePreferred?: number | null;
  tier5CoinsurancePreferred?: number | null;
  // Supplemental Benefits
  dental: number;
  vision: number;
  otcPerQuarter: number;
  flexCardAmount?: number | null;
  groceryAllowanceAmount?: number | null;
  transportationAmountPerYear?: number | null;
  mealBenefitAmount?: number | null;
  hearingAidAllowance?: number | null;
  transportation: boolean;
  mealBenefit: boolean;
  fitness: boolean;
  telehealth: boolean;
  inHomeSupport: boolean;
  // Quality
  starRating: number | null;
  lowPerforming?: boolean;
  highPerforming?: boolean;
  requiresPcpReferral?: boolean | null;
}

interface CompareResponse {
  plans: ComparePlan[];
}

// ── Field Definitions ──

interface FieldDef {
  key: string;
  label: string;
  group: string;
  format: (v: unknown) => string;
  bestIs?: "low" | "high";
  getValue: (plan: ComparePlan) => unknown;
}

const fieldGroups: { key: string; label: string }[] = [
  { key: "info", label: "Plan Info" },
  { key: "costs", label: "Premiums & Costs" },
  { key: "medical", label: "Medical Copays" },
  { key: "drug", label: "Drug Coverage" },
  { key: "supplemental", label: "Supplemental Benefits" },
  { key: "quality", label: "Quality" },
];

const fmtDollar = (v: unknown) => {
  if (v === null || v === undefined) return "N/A";
  return `$${Number(v).toLocaleString()}`;
};
const fmtDollarMo = (v: unknown) => {
  if (v === null || v === undefined) return "N/A";
  return `$${Number(v)}/mo`;
};
const fmtPct = (v: unknown) => {
  if (v === null || v === undefined) return "N/A";
  return `${Number(v)}%`;
};
const fmtBool = (v: unknown) => (v ? "Yes" : "No");
const fmtStr = (v: unknown) => (v !== null && v !== undefined ? String(v) : "N/A");
const fmtStar = (v: unknown) => {
  if (v === null || v === undefined) return "N/A";
  return `${Number(v)} Stars`;
};

const fields: FieldDef[] = [
  // Plan Info
  { key: "carrier", label: "Carrier", group: "info", format: fmtStr, getValue: (p) => p.carrier },
  { key: "planType", label: "Plan Type", group: "info", format: fmtStr, getValue: (p) => p.planType },
  { key: "county", label: "County", group: "info", format: fmtStr, getValue: (p) => `${p.county}, ${p.state}` },
  { key: "contractId", label: "Contract ID", group: "info", format: fmtStr, getValue: (p) => p.contractId },
  { key: "snpType", label: "SNP Type", group: "info", format: fmtStr, getValue: (p) => p.snpType },
  // Premiums & Costs
  { key: "premium", label: "Monthly Premium", group: "costs", format: fmtDollarMo, bestIs: "low", getValue: (p) => p.premium },
  { key: "partbGiveback", label: "Part B Giveback", group: "costs", format: fmtDollarMo, bestIs: "high", getValue: (p) => p.partbGiveback },
  { key: "deductible", label: "Annual Deductible", group: "costs", format: fmtDollar, bestIs: "low", getValue: (p) => p.deductible },
  { key: "moop", label: "Max Out-of-Pocket", group: "costs", format: fmtDollar, bestIs: "low", getValue: (p) => p.moop },
  { key: "drugDeductible", label: "Drug Deductible", group: "costs", format: fmtDollar, bestIs: "low", getValue: (p) => p.drugDeductible },
  // Medical Copays
  { key: "pcpCopay", label: "PCP Copay", group: "medical", format: fmtDollar, bestIs: "low", getValue: (p) => p.pcpCopay },
  { key: "specialistCopay", label: "Specialist Copay", group: "medical", format: fmtDollar, bestIs: "low", getValue: (p) => p.specialistCopay },
  { key: "erCopay", label: "ER Copay", group: "medical", format: fmtDollar, bestIs: "low", getValue: (p) => p.erCopay },
  { key: "urgentCareCopay", label: "Urgent Care Copay", group: "medical", format: fmtDollar, bestIs: "low", getValue: (p) => p.urgentCareCopay },
  { key: "inpatientCopay", label: "Inpatient Copay", group: "medical", format: fmtDollar, bestIs: "low", getValue: (p) => p.inpatientCopay },
  { key: "diagnosticCopay", label: "Diagnostic Copay", group: "medical", format: fmtDollar, bestIs: "low", getValue: (p) => p.diagnosticCopay },
  { key: "labCopay", label: "Lab Copay", group: "medical", format: fmtDollar, bestIs: "low", getValue: (p) => p.labCopay },
  { key: "ambulanceCopay", label: "Ambulance Copay", group: "medical", format: fmtDollar, bestIs: "low", getValue: (p) => p.ambulanceCopay },
  { key: "mentalHealthOutpatientCopay", label: "Mental Health Copay", group: "medical", format: fmtDollar, bestIs: "low", getValue: (p) => p.mentalHealthOutpatientCopay },
  // Drug Coverage
  { key: "tier1CopayPreferred", label: "Tier 1 (Preferred)", group: "drug", format: fmtDollar, bestIs: "low", getValue: (p) => p.tier1CopayPreferred },
  { key: "tier2CopayPreferred", label: "Tier 2 (Preferred)", group: "drug", format: fmtDollar, bestIs: "low", getValue: (p) => p.tier2CopayPreferred },
  { key: "tier3CopayPreferred", label: "Tier 3 (Preferred)", group: "drug", format: fmtDollar, bestIs: "low", getValue: (p) => p.tier3CopayPreferred },
  { key: "tier4CoinsurancePreferred", label: "Tier 4 (Preferred)", group: "drug", format: fmtPct, bestIs: "low", getValue: (p) => p.tier4CoinsurancePreferred },
  { key: "tier5CoinsurancePreferred", label: "Tier 5 (Preferred)", group: "drug", format: fmtPct, bestIs: "low", getValue: (p) => p.tier5CoinsurancePreferred },
  // Supplemental Benefits
  { key: "dental", label: "Dental Coverage", group: "supplemental", format: fmtDollar, bestIs: "high", getValue: (p) => p.dental },
  { key: "vision", label: "Vision Allowance", group: "supplemental", format: fmtDollar, bestIs: "high", getValue: (p) => p.vision },
  { key: "otcPerQuarter", label: "OTC Per Quarter", group: "supplemental", format: fmtDollar, bestIs: "high", getValue: (p) => p.otcPerQuarter },
  { key: "flexCardAmount", label: "Flex Card", group: "supplemental", format: fmtDollar, bestIs: "high", getValue: (p) => p.flexCardAmount },
  { key: "groceryAllowanceAmount", label: "Grocery Allowance", group: "supplemental", format: fmtDollar, bestIs: "high", getValue: (p) => p.groceryAllowanceAmount },
  { key: "transportationAmountPerYear", label: "Transportation/yr", group: "supplemental", format: fmtDollar, bestIs: "high", getValue: (p) => p.transportationAmountPerYear },
  { key: "mealBenefitAmount", label: "Meal Benefit", group: "supplemental", format: fmtDollar, bestIs: "high", getValue: (p) => p.mealBenefitAmount },
  { key: "hearingAidAllowance", label: "Hearing Aid", group: "supplemental", format: fmtDollar, bestIs: "high", getValue: (p) => p.hearingAidAllowance },
  { key: "transportation", label: "Has Transportation", group: "supplemental", format: fmtBool, getValue: (p) => p.transportation },
  { key: "mealBenefit", label: "Has Meal Benefit", group: "supplemental", format: fmtBool, getValue: (p) => p.mealBenefit },
  { key: "fitness", label: "Has Fitness", group: "supplemental", format: fmtBool, getValue: (p) => p.fitness },
  { key: "telehealth", label: "Has Telehealth", group: "supplemental", format: fmtBool, getValue: (p) => p.telehealth },
  { key: "inHomeSupport", label: "Has In-Home Support", group: "supplemental", format: fmtBool, getValue: (p) => p.inHomeSupport },
  // Quality
  { key: "starRating", label: "Star Rating", group: "quality", format: fmtStar, bestIs: "high", getValue: (p) => p.starRating },
  { key: "highPerforming", label: "High Performing", group: "quality", format: fmtBool, getValue: (p) => p.highPerforming },
  { key: "lowPerforming", label: "Low Performing", group: "quality", format: fmtBool, getValue: (p) => p.lowPerforming },
  { key: "requiresPcpReferral", label: "Requires PCP Referral", group: "quality", format: fmtBool, getValue: (p) => p.requiresPcpReferral },
];

// ── Component ──

export default function PlanCompare() {
  const [location] = useLocation();
  const { toast } = useToast();
  const [differencesOnly, setDifferencesOnly] = useState(false);
  const [removedIds, setRemovedIds] = useState<Set<number>>(new Set());

  // Parse IDs from URL
  const idsParam = useMemo(() => {
    const searchStr = typeof window !== "undefined" ? window.location.search : "";
    const params = new URLSearchParams(searchStr);
    return params.get("ids") ?? "";
  }, [location]);

  const requestedIds = useMemo(() => {
    return idsParam
      .split(",")
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !isNaN(n) && !removedIds.has(n));
  }, [idsParam, removedIds]);

  const {
    data: compareData,
    isLoading,
  } = useQuery<CompareResponse>({
    queryKey: ["/api/plans/compare", requestedIds.join(",")],
    queryFn: async () => {
      const res = await fetch(`/api/plans/compare?ids=${requestedIds.join(",")}`);
      if (!res.ok) throw new Error("Failed to load comparison");
      return res.json();
    },
    enabled: requestedIds.length > 0,
  });

  const plans = useMemo(() => {
    if (!compareData?.plans) return [];
    return compareData.plans.filter((p) => !removedIds.has(p.id));
  }, [compareData, removedIds]);

  const removePlan = (id: number) => {
    setRemovedIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };

  const handleShare = async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: "Link copied", description: "Comparison URL copied to clipboard." });
    } catch {
      toast({ title: "Share", description: url, variant: "destructive" });
    }
  };

  const handleExportCsv = () => {
    const ids = plans.map((p) => p.id).join(",");
    window.open(`/api/export/csv?scope=comparison&ids=${ids}`, "_blank");
  };

  const handleExportPdf = () => {
    const ids = plans.map((p) => p.id).join(",");
    window.open(`/api/export/csv?scope=comparison&format=pdf&ids=${ids}`, "_blank");
  };

  // Determine which rows differ
  const rowValues = useMemo(() => {
    const map: Record<string, unknown[]> = {};
    for (const field of fields) {
      map[field.key] = plans.map((p) => field.getValue(p));
    }
    return map;
  }, [plans]);

  const rowIsDifferent = (key: string) => {
    const vals = rowValues[key];
    if (!vals || vals.length <= 1) return false;
    const formatted = vals.map((v) => String(v));
    return new Set(formatted).size > 1;
  };

  const getBestWorstForField = (field: FieldDef) => {
    if (!field.bestIs || plans.length <= 1) return { best: undefined, worst: undefined };
    const numericVals = plans
      .map((p) => ({ id: p.id, val: field.getValue(p) }))
      .filter((x) => x.val !== null && x.val !== undefined && typeof x.val === "number");
    if (numericVals.length === 0) return { best: undefined, worst: undefined };
    const sorted = [...numericVals].sort((a, b) => (a.val as number) - (b.val as number));
    const best = field.bestIs === "low" ? sorted[0].id : sorted[sorted.length - 1].id;
    const worst = field.bestIs === "low" ? sorted[sorted.length - 1].id : sorted[0].id;
    return { best: best !== worst ? best : undefined, worst: best !== worst ? worst : undefined };
  };

  // ── Render ──

  if (requestedIds.length === 0) {
    return (
      <div className="p-6 space-y-6">
        <Card>
          <CardContent className="p-12 text-center">
            <h2 className="text-xl font-semibold mb-2">No Plans Selected</h2>
            <p className="text-muted-foreground mb-4">
              Go to the Plan Finder to select plans for comparison.
            </p>
            <Link href="/find">
              <Button>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Plan Finder
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-[500px] w-full" />
      </div>
    );
  }

  const renderComparisonTable = (groupKey: string) => {
    const groupFields = fields.filter((f) => f.group === groupKey);
    const visibleFields = differencesOnly
      ? groupFields.filter((f) => rowIsDifferent(f.key))
      : groupFields;

    if (visibleFields.length === 0) {
      return (
        <p className="text-sm text-muted-foreground py-4 text-center">
          {differencesOnly ? "All values are identical in this group." : "No data available."}
        </p>
      );
    }

    return (
      <div className="rounded-md border overflow-hidden">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-semibold min-w-[160px] sticky left-0 bg-muted/50 z-10">
                  Field
                </TableHead>
                {plans.map((plan) => (
                  <TableHead key={plan.id} className="min-w-[160px] text-center">
                    <div className="flex flex-col items-center gap-0.5">
                      <span className="text-xs font-medium truncate max-w-[150px]">
                        {plan.name}
                      </span>
                      <span className="text-xs text-muted-foreground">{plan.carrier}</span>
                      <button
                        onClick={() => removePlan(plan.id)}
                        className="text-xs text-muted-foreground hover:text-destructive mt-0.5"
                        title="Remove from comparison"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {visibleFields.map((field) => {
                const { best, worst } = getBestWorstForField(field);
                return (
                  <TableRow key={field.key}>
                    <TableCell className="font-medium text-sm sticky left-0 bg-background z-10">
                      {field.label}
                    </TableCell>
                    {plans.map((plan) => {
                      const raw = field.getValue(plan);
                      const formatted = field.format(raw);
                      const isBest = best === plan.id;
                      const isWorst = worst === plan.id;
                      const isBoolYes = typeof raw === "boolean" && raw;
                      const isBoolNo = typeof raw === "boolean" && !raw;

                      return (
                        <TableCell
                          key={plan.id}
                          className={cn(
                            "text-center text-sm font-mono",
                            isBest && "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300",
                            isWorst && "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
                          )}
                        >
                          {typeof raw === "boolean" ? (
                            <span className="inline-flex items-center gap-1">
                              {isBoolYes ? (
                                <CheckCircle className="h-4 w-4 text-green-600" />
                              ) : (
                                <XCircle className="h-4 w-4 text-muted-foreground/40" />
                              )}
                              {formatted}
                            </span>
                          ) : (
                            formatted
                          )}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Plan Comparison</h1>
          <p className="text-sm text-muted-foreground">
            Comparing {plans.length} plan{plans.length !== 1 ? "s" : ""} side by side
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-2 mr-4">
            <Switch
              checked={differencesOnly}
              onCheckedChange={setDifferencesOnly}
              id="diff-toggle"
            />
            <Label htmlFor="diff-toggle" className="text-sm cursor-pointer">
              Differences Only
            </Label>
          </div>
          <Button variant="outline" size="sm" onClick={handleShare}>
            <Share2 className="h-4 w-4 mr-1" />
            Share
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportCsv}>
            <Download className="h-4 w-4 mr-1" />
            CSV
          </Button>
          <Button variant="outline" size="sm" onClick={handleExportPdf}>
            <FileText className="h-4 w-4 mr-1" />
            PDF
          </Button>
        </div>
      </div>

      {/* Plan Summary Badges */}
      <div className="flex flex-wrap gap-2">
        {plans.map((plan) => (
          <Badge key={plan.id} variant="secondary" className="text-sm py-1 px-3">
            {plan.name}
            <button
              onClick={() => removePlan(plan.id)}
              className="ml-2 hover:text-destructive"
              title="Remove"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
      </div>

      {/* Comparison Tabs */}
      <Tabs defaultValue="info">
        <TabsList className="flex-wrap h-auto gap-1">
          {fieldGroups.map((group) => (
            <TabsTrigger key={group.key} value={group.key} className="text-xs">
              {group.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {fieldGroups.map((group) => (
          <TabsContent key={group.key} value={group.key}>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">{group.label}</CardTitle>
              </CardHeader>
              <CardContent>{renderComparisonTable(group.key)}</CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>

      {/* Back to Finder */}
      <div className="pt-4">
        <Link href="/find">
          <Button variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Plan Finder
          </Button>
        </Link>
      </div>
    </div>
  );
}
