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
}

interface MatrixPlan {
  planName: string;
  contractId: string;
  county: string;
  premium: number;
  deductible: number;
  moop: number;
  pcpCopay: number;
  specialistCopay: number;
  erCopay: number;
  dental: number;
  vision: number;
  otc: number;
  transportation: number;
  starRating: number;
}

interface MatrixResponse {
  plans: MatrixPlan[];
  summary: {
    totalPlans: number;
    countiesSelected: number;
    avgPremium: number;
    avgDental: number;
  };
}

const BENEFIT_FIELDS: { key: keyof MatrixPlan; label: string; format: (v: number) => string; bestIs: "low" | "high" }[] = [
  { key: "premium", label: "Premium", format: (v) => `$${v}`, bestIs: "low" },
  { key: "deductible", label: "Deductible", format: (v) => `$${v}`, bestIs: "low" },
  { key: "moop", label: "MOOP", format: (v) => `$${v.toLocaleString()}`, bestIs: "low" },
  { key: "pcpCopay", label: "PCP Copay", format: (v) => `$${v}`, bestIs: "low" },
  { key: "specialistCopay", label: "Specialist Copay", format: (v) => `$${v}`, bestIs: "low" },
  { key: "erCopay", label: "ER Copay", format: (v) => `$${v}`, bestIs: "low" },
  { key: "dental", label: "Dental", format: (v) => `$${v.toLocaleString()}`, bestIs: "high" },
  { key: "vision", label: "Vision", format: (v) => `$${v}`, bestIs: "high" },
  { key: "otc", label: "OTC", format: (v) => `$${v}/mo`, bestIs: "high" },
  { key: "transportation", label: "Transportation", format: (v) => `$${v}`, bestIs: "high" },
  { key: "starRating", label: "Star Rating", format: (v) => `${v}`, bestIs: "high" },
];

type SortDirection = "asc" | "desc" | null;

export default function MatrixView() {
  const [selectedCarrier, setSelectedCarrier] = useState<string>("");
  const [selectedState, setSelectedState] = useState<string>("");
  const [selectedCounties, setSelectedCounties] = useState<string[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [sortCol, setSortCol] = useState<number | null>(null);
  const [sortDir, setSortDir] = useState<SortDirection>(null);

  const { data: carriers = [], isLoading: carriersLoading } = useQuery<CarrierOption[]>({
    queryKey: ["/api/carriers"],
  });

  const { data: matrixData, isLoading: matrixLoading } = useQuery<MatrixResponse>({
    queryKey: ["/api/matrix", selectedCarrier, selectedState, selectedCounties.join(",")],
    queryFn: async () => {
      const params = new URLSearchParams({
        carrier: selectedCarrier,
        state: selectedState,
        counties: selectedCounties.join(","),
      });
      const res = await fetch(`/api/matrix?${params}`);
      return res.json();
    },
    enabled: submitted && !!selectedCarrier && selectedCounties.length > 0,
  });

  const plans = matrixData?.plans ?? [];
  const summary = matrixData?.summary ?? { totalPlans: 0, countiesSelected: 0, avgPremium: 0, avgDental: 0 };

  // Derive available states from carriers data
  const states = useMemo(() => {
    const stateSet = new Set<string>();
    // Common US state abbreviations as fallback
    const defaultStates = [
      "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
      "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
      "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
      "VA","WA","WV","WI","WY","DC",
    ];
    defaultStates.forEach((s) => stateSet.add(s));
    return Array.from(stateSet).sort();
  }, []);

  // Placeholder counties - in production these come from the API based on state+carrier
  const availableCounties = useMemo(() => {
    if (!selectedState || !selectedCarrier) return [];
    // This would be fetched from API in production
    return ["County 1", "County 2", "County 3", "County 4", "County 5"];
  }, [selectedState, selectedCarrier]);

  const handleCountyToggle = (county: string) => {
    setSelectedCounties((prev) =>
      prev.includes(county) ? prev.filter((c) => c !== county) : [...prev, county]
    );
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
      const aVal = a.premium; // sort by plan index
      const bVal = b.premium;
      return sortDir === "asc" ? aVal - bVal : bVal - aVal;
    });
  }, [plans, sortCol, sortDir]);

  const getBestWorst = (field: typeof BENEFIT_FIELDS[0], planList: MatrixPlan[]) => {
    if (planList.length === 0) return { best: -1, worst: -1 };
    const values = planList.map((p) => p[field.key] as number);
    const best = field.bestIs === "low" ? Math.min(...values) : Math.max(...values);
    const worst = field.bestIs === "low" ? Math.max(...values) : Math.min(...values);
    return { best, worst };
  };

  const handleExportCsv = () => {
    const params = new URLSearchParams({
      scope: "matrix",
      carrier: selectedCarrier,
      state: selectedState,
      counties: selectedCounties.join(","),
    });
    window.open(`/api/export/csv?${params}`, "_blank");
  };

  const handleExportPdf = () => {
    const params = new URLSearchParams({
      scope: "matrix",
      format: "pdf",
      carrier: selectedCarrier,
      state: selectedState,
      counties: selectedCounties.join(","),
    });
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
          label="Counties Selected"
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
          label="Avg Dental"
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
              <Select value={selectedCarrier} onValueChange={(v) => { setSelectedCarrier(v); setSubmitted(false); }}>
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
              <Label className="text-sm font-medium">Counties</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-[200px] justify-start font-normal">
                    {selectedCounties.length > 0
                      ? `${selectedCounties.length} selected`
                      : "Select counties"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[200px] p-2" align="start">
                  {availableCounties.length === 0 ? (
                    <p className="text-sm text-muted-foreground p-2">Select carrier & state first</p>
                  ) : (
                    <div className="space-y-2 max-h-[200px] overflow-y-auto">
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
              disabled={!selectedCarrier || selectedCounties.length === 0}
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
          <CardContent className="p-6">
            <Skeleton className="h-[400px] w-full" />
          </CardContent>
        </Card>
      )}

      {submitted && !matrixLoading && plans.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Benefits Matrix</CardTitle>
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
                          key={idx}
                          className="cursor-pointer select-none min-w-[140px] text-center"
                          onClick={() => handleSort(idx)}
                        >
                          <div className="flex flex-col items-center gap-0.5">
                            <span className="text-xs font-medium truncate max-w-[130px]">
                              {plan.planName}
                            </span>
                            <span className="text-xs text-muted-foreground">{plan.county}</span>
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
                            const val = plan[field.key] as number;
                            const isBest = val === best && sortedPlans.length > 1;
                            const isWorst = val === worst && sortedPlans.length > 1 && best !== worst;
                            return (
                              <TableCell
                                key={idx}
                                className={cn(
                                  "text-center font-mono text-sm",
                                  isBest && "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300",
                                  isWorst && "bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-300"
                                )}
                              >
                                {field.format(val)}
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
          </CardContent>
        </Card>
      )}

      {submitted && !matrixLoading && plans.length === 0 && (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            No plans found for the selected filters. Try adjusting your carrier, state, or county selections.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
