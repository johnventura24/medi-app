import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatCard } from "@/components/StatCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  LayoutGrid,
  MapPin,
  DollarSign,
  Stethoscope,
  Download,
  FileText,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface CarrierOption {
  name: string;
  id: string;
  statesServed?: number;
  totalPlans?: number;
}

interface CityRow {
  id: string;
  city: string;
  state: string;
  stateAbbr: string;
  planCount: number;
  carrierCount: number;
  topCarrier: string;
  [key: string]: any;
}

// Matches the actual API response from /api/matrix
interface MatrixPlan {
  planId: string;
  planName: string;
  county: string;
  planType: string;
  premium: number;
  deductible: number;
  moop: number;
  pcpCopay: number;
  specialistCopay: number;
  emergencyCopay: number;
  urgentCareCopay: number;
  inpatientCopay: number;
  outpatientCopayMin: number;
  outpatientCopayMax: number;
  dentalCoverageLimit: number;
  visionAllowance: number;
  hearingCopay: number;
  hasOtc: boolean;
  hasTransportation: boolean;
  hasMealBenefit: boolean;
  hasTelehealth: boolean;
  hasFitnessBenefit: boolean;
  starRating: number | null;
}

interface MatrixApiResponse {
  carrier: string;
  counties: string[];
  plans: MatrixPlan[];
  benefitFields: string[];
}

const BENEFIT_FIELDS: { key: keyof MatrixPlan; label: string; format: (v: any) => string; bestIs: "low" | "high" }[] = [
  { key: "premium", label: "Premium", format: (v) => `$${v ?? 0}`, bestIs: "low" },
  { key: "deductible", label: "Deductible", format: (v) => `$${v ?? 0}`, bestIs: "low" },
  { key: "moop", label: "MOOP", format: (v) => `$${(v ?? 0).toLocaleString()}`, bestIs: "low" },
  { key: "pcpCopay", label: "PCP Copay", format: (v) => `$${v ?? 0}`, bestIs: "low" },
  { key: "specialistCopay", label: "Specialist Copay", format: (v) => `$${v ?? 0}`, bestIs: "low" },
  { key: "emergencyCopay", label: "Emergency Copay", format: (v) => `$${v ?? 0}`, bestIs: "low" },
  { key: "urgentCareCopay", label: "Urgent Care Copay", format: (v) => `$${v ?? 0}`, bestIs: "low" },
  { key: "inpatientCopay", label: "Inpatient Copay", format: (v) => `$${v ?? 0}`, bestIs: "low" },
  { key: "dentalCoverageLimit", label: "Dental Limit", format: (v) => `$${(v ?? 0).toLocaleString()}`, bestIs: "high" },
  { key: "visionAllowance", label: "Vision Allowance", format: (v) => `$${v ?? 0}`, bestIs: "high" },
  { key: "hearingCopay", label: "Hearing Copay", format: (v) => `$${v ?? 0}`, bestIs: "low" },
  { key: "hasOtc", label: "OTC", format: (v) => (v ? "Yes" : "No"), bestIs: "high" },
  { key: "hasTransportation", label: "Transportation", format: (v) => (v ? "Yes" : "No"), bestIs: "high" },
  { key: "hasMealBenefit", label: "Meal Benefit", format: (v) => (v ? "Yes" : "No"), bestIs: "high" },
  { key: "hasTelehealth", label: "Telehealth", format: (v) => (v ? "Yes" : "No"), bestIs: "high" },
  { key: "hasFitnessBenefit", label: "Fitness", format: (v) => (v ? "Yes" : "No"), bestIs: "high" },
  { key: "starRating", label: "Star Rating", format: (v) => (v != null ? `${v}` : "N/A"), bestIs: "high" },
];

type SortDirection = "asc" | "desc" | null;

export default function MatrixView() {
  const [selectedCarrier, setSelectedCarrier] = useState<string>("");
  const [selectedState, setSelectedState] = useState<string>("");
  const [selectedCounties, setSelectedCounties] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [sortCol, setSortCol] = useState<number | null>(null);
  const [sortDir, setSortDir] = useState<SortDirection>(null);

  // Fetch carriers from the API
  const { data: carriers = [], isLoading: carriersLoading } = useQuery<CarrierOption[]>({
    queryKey: ["/api/carriers"],
  });

  // Fetch counties (cities) for the selected state
  const { data: citiesData = [], isLoading: countiesLoading } = useQuery<CityRow[]>({
    queryKey: ["/api/cities", selectedState ? `?state=${selectedState}` : ""],
    queryFn: async () => {
      const res = await fetch(`/api/cities?state=${encodeURIComponent(selectedState)}`);
      if (!res.ok) throw new Error("Failed to fetch cities");
      return res.json();
    },
    enabled: !!selectedState,
  });

  // Extract unique county names from the cities response
  const availableCounties = useMemo(() => {
    if (!selectedState) return [];
    const countySet = new Set<string>();
    citiesData.forEach((row) => {
      if (row.city) countySet.add(row.city);
    });
    return Array.from(countySet).sort();
  }, [citiesData, selectedState]);

  // Fetch the matrix data - counties are optional now
  const { data: matrixData, isLoading: matrixLoading, isError: matrixError } = useQuery<MatrixApiResponse>({
    queryKey: ["/api/matrix", selectedCarrier, selectedState, selectedCounties.join(",")],
    queryFn: async () => {
      const params = new URLSearchParams({
        carrier: selectedCarrier,
        state: selectedState,
      });
      if (selectedCounties.length > 0) {
        params.set("counties", selectedCounties.join(","));
      }
      const res = await fetch(`/api/matrix?${params}`);
      if (!res.ok) throw new Error("Failed to fetch matrix data");
      return res.json();
    },
    enabled: submitted && !!selectedCarrier && !!selectedState,
  });

  const plans = matrixData?.plans ?? [];

  // Compute summary client-side from the plans array
  const summary = useMemo(() => {
    if (plans.length === 0) {
      return { totalPlans: 0, countiesSelected: 0, avgPremium: 0, avgDental: 0 };
    }
    const uniqueCounties = new Set(plans.map((p) => p.county));
    const avgPremium = plans.reduce((sum, p) => sum + (p.premium ?? 0), 0) / plans.length;
    const avgDental = plans.reduce((sum, p) => sum + (p.dentalCoverageLimit ?? 0), 0) / plans.length;
    return {
      totalPlans: plans.length,
      countiesSelected: uniqueCounties.size,
      avgPremium: Math.round(avgPremium * 100) / 100,
      avgDental: Math.round(avgDental),
    };
  }, [plans]);

  // Derive available states from carriers data (use statesServed names if available)
  const states = useMemo(() => {
    const defaultStates = [
      "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
      "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
      "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
      "VA","WA","WV","WI","WY","DC",
    ];
    return defaultStates.sort();
  }, []);

  const handleCountyToggle = (county: string) => {
    setSelectedCounties((prev) =>
      prev.includes(county) ? prev.filter((c) => c !== county) : [...prev, county]
    );
  };

  const handleSelectAllCounties = () => {
    if (selectedCounties.length === availableCounties.length) {
      setSelectedCounties([]);
    } else {
      setSelectedCounties([...availableCounties]);
    }
  };

  const handleGenerate = () => {
    setSubmitted(true);
  };

  const handleSort = (colIdx: number) => {
    if (sortCol === colIdx) {
      setSortDir(sortDir === "asc" ? "desc" : sortDir === "desc" ? null : "asc");
      if (sortDir === "desc") setSortCol(null);
    } else {
      setSortCol(colIdx);
      setSortDir("asc");
    }
  };

  const sortedPlans = useMemo(() => {
    if (sortCol === null || sortDir === null) return plans;
    return [...plans].sort((a, b) => {
      // Sort by a composite value score
      const aScore = (a.dentalCoverageLimit ?? 0) + (a.visionAllowance ?? 0) - (a.premium ?? 0) - (a.pcpCopay ?? 0);
      const bScore = (b.dentalCoverageLimit ?? 0) + (b.visionAllowance ?? 0) - (b.premium ?? 0) - (b.pcpCopay ?? 0);
      return sortDir === "asc" ? aScore - bScore : bScore - aScore;
    });
  }, [plans, sortCol, sortDir]);

  const getBestWorst = (field: typeof BENEFIT_FIELDS[0], planList: MatrixPlan[]) => {
    if (planList.length === 0) return { best: -Infinity, worst: Infinity };
    const values = planList.map((p) => {
      const raw = p[field.key];
      if (typeof raw === "boolean") return raw ? 1 : 0;
      return (raw as number) ?? 0;
    });
    const best = field.bestIs === "low" ? Math.min(...values) : Math.max(...values);
    const worst = field.bestIs === "low" ? Math.max(...values) : Math.min(...values);
    return { best, worst };
  };

  const getCellValue = (plan: MatrixPlan, key: keyof MatrixPlan): number => {
    const raw = plan[key];
    if (typeof raw === "boolean") return raw ? 1 : 0;
    return (raw as number) ?? 0;
  };

  const handleExportCsv = () => {
    const params = new URLSearchParams({
      scope: "matrix",
      carrier: selectedCarrier,
      state: selectedState,
    });
    if (selectedCounties.length > 0) {
      params.set("counties", selectedCounties.join(","));
    }
    window.open(`/api/export/csv?${params}`, "_blank");
  };

  const handleExportPdf = () => {
    const params = new URLSearchParams({
      scope: "matrix",
      format: "pdf",
      carrier: selectedCarrier,
      state: selectedState,
    });
    if (selectedCounties.length > 0) {
      params.set("counties", selectedCounties.join(","));
    }
    window.open(`/api/export/csv?${params}`, "_blank");
  };

  if (carriersLoading) {
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
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-[300px] w-full" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Carrier Benefits Matrix</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          label="Plans in Matrix"
          value={summary.totalPlans}
          icon={<LayoutGrid className="h-5 w-5 text-muted-foreground" />}
        />
        <StatCard
          label="Counties Covered"
          value={summary.countiesSelected}
          icon={<MapPin className="h-5 w-5 text-muted-foreground" />}
        />
        <StatCard
          label="Avg Premium"
          prefix="$"
          value={summary.avgPremium}
          icon={<DollarSign className="h-5 w-5 text-muted-foreground" />}
        />
        <StatCard
          label="Avg Dental Limit"
          prefix="$"
          value={summary.avgDental}
          icon={<Stethoscope className="h-5 w-5 text-muted-foreground" />}
        />
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-end gap-4">
            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Carrier</Label>
              <Select value={selectedCarrier} onValueChange={(v) => { setSelectedCarrier(v); setSelectedCounties([]); setSubmitted(false); }}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Select carrier" />
                </SelectTrigger>
                <SelectContent>
                  {carriers.map((c: any) => (
                    <SelectItem key={c.id ?? c.name} value={c.name}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium">State</Label>
              <Select value={selectedState} onValueChange={(v) => { setSelectedState(v); setSelectedCounties([]); setSubmitted(false); }}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Select state" />
                </SelectTrigger>
                <SelectContent>
                  {states.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm font-medium">Counties (optional)</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-[220px] justify-start font-normal">
                    {selectedCounties.length > 0
                      ? `${selectedCounties.length} of ${availableCounties.length} selected`
                      : availableCounties.length > 0
                        ? `All counties (${availableCounties.length})`
                        : "Select state first"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[220px] p-2" align="start">
                  {countiesLoading ? (
                    <div className="p-2 space-y-2">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-3/4" />
                    </div>
                  ) : availableCounties.length === 0 ? (
                    <p className="text-sm text-muted-foreground p-2">Select a state first to load counties</p>
                  ) : (
                    <div className="space-y-2 max-h-[250px] overflow-y-auto">
                      <div className="flex items-center space-x-2 border-b pb-2 mb-1">
                        <Checkbox
                          id="county-select-all"
                          checked={selectedCounties.length === availableCounties.length && availableCounties.length > 0}
                          onCheckedChange={handleSelectAllCounties}
                        />
                        <Label htmlFor="county-select-all" className="text-sm cursor-pointer font-medium">
                          Select All
                        </Label>
                      </div>
                      {availableCounties.map((county) => (
                        <div key={county} className="flex items-center space-x-2">
                          <Checkbox
                            id={`county-${county}`}
                            checked={selectedCounties.includes(county)}
                            onCheckedChange={() => handleCountyToggle(county)}
                          />
                          <Label htmlFor={`county-${county}`} className="text-sm cursor-pointer">
                            {county}
                          </Label>
                        </div>
                      ))}
                    </div>
                  )}
                </PopoverContent>
              </Popover>
            </div>

            <Button
              onClick={handleGenerate}
              disabled={!selectedCarrier || !selectedState}
            >
              Generate Matrix
            </Button>

            {plans.length > 0 && (
              <div className="flex gap-2 ml-auto">
                <Button variant="outline" size="sm" onClick={handleExportCsv}>
                  <Download className="h-4 w-4 mr-1" />
                  Export CSV
                </Button>
                <Button variant="outline" size="sm" onClick={handleExportPdf}>
                  <FileText className="h-4 w-4 mr-1" />
                  Export PDF
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {matrixLoading && (
        <Card>
          <CardContent className="p-6 space-y-3">
            <Skeleton className="h-6 w-48 mb-4" />
            <Skeleton className="h-[400px] w-full" />
          </CardContent>
        </Card>
      )}

      {matrixError && submitted && (
        <Card>
          <CardContent className="p-12 text-center text-destructive">
            Failed to load matrix data. Please check your selections and try again.
          </CardContent>
        </Card>
      )}

      {submitted && !matrixLoading && !matrixError && plans.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>
              Benefits Matrix — {matrixData?.carrier}
              {matrixData?.counties && matrixData.counties.length > 0 && (
                <span className="text-sm font-normal text-muted-foreground ml-2">
                  ({matrixData.counties.length} {matrixData.counties.length === 1 ? "county" : "counties"})
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border overflow-hidden">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50">
                      <TableHead className="font-semibold min-w-[160px] sticky left-0 bg-muted/50 z-10">
                        Benefit Field
                      </TableHead>
                      {sortedPlans.map((plan, idx) => (
                        <TableHead
                          key={plan.planId || idx}
                          className="cursor-pointer select-none min-w-[140px] text-center"
                          onClick={() => handleSort(idx)}
                        >
                          <div className="flex flex-col items-center gap-0.5">
                            <span className="text-xs font-medium truncate max-w-[130px]" title={plan.planName}>
                              {plan.planName}
                            </span>
                            <span className="text-xs text-muted-foreground">{plan.county}</span>
                            {plan.planType && (
                              <span className="text-[10px] text-muted-foreground">{plan.planType}</span>
                            )}
                            <div className="flex items-center gap-1">
                              {sortCol === idx ? (
                                sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                              ) : (
                                <ChevronsUpDown className="h-3 w-3" />
                              )}
                            </div>
                          </div>
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {BENEFIT_FIELDS.map((field) => {
                      const { best, worst } = getBestWorst(field, sortedPlans);
                      return (
                        <TableRow key={field.key}>
                          <TableCell className="font-medium sticky left-0 bg-background z-10">
                            {field.label}
                          </TableCell>
                          {sortedPlans.map((plan, idx) => {
                            const val = getCellValue(plan, field.key);
                            const isBest = val === best && sortedPlans.length > 1;
                            const isWorst = val === worst && sortedPlans.length > 1 && best !== worst;
                            return (
                              <TableCell
                                key={plan.planId || idx}
                                className={cn(
                                  "text-center font-mono text-sm",
                                  isBest && "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300",
                                  isWorst && "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
                                )}
                              >
                                {field.format(plan[field.key])}
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
            <p className="text-xs text-muted-foreground mt-3">
              Showing {plans.length} plans. Green = best value, Red = worst value for each benefit row.
            </p>
          </CardContent>
        </Card>
      )}

      {submitted && !matrixLoading && !matrixError && plans.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            No plans found for the selected filters. Try adjusting your carrier, state, or county selections.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
