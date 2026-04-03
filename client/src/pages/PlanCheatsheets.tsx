import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Printer, Download, FileSpreadsheet, Star } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { useToast } from "@/hooks/use-toast";

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","DC","FL","GA","HI","ID","IL","IN",
  "IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH",
  "NJ","NM","NY","NC","ND","OH","OK","OR","PA","PR","RI","SC","SD","TN","TX",
  "UT","VT","VA","WA","WV","WI","WY",
];

interface CheatsheetPlan {
  name: string;
  contractId: string | null;
  planId: string | null;
  planType: string;
  premium: number;
  deductible: string;
  moop: string;
  pcpCopay: number | null;
  specialistCopay: number | null;
  dentalLimit: number | null;
  visionAllowance: number | null;
  otcAmount: number | null;
  starRating: number | null;
  drugDeductible: number | null;
  partbGiveback: number | null;
  snpType: string | null;
  hasTransportation: boolean;
  hasFitness: boolean;
}

interface CheatsheetData {
  carrier: string;
  state: string;
  county: string;
  generatedAt: string;
  planCount: number;
  plans: CheatsheetPlan[];
  marketContext: {
    avgPremium: number;
    avgMoop: number;
    avgDental: number;
    avgStarRating: number;
    totalPlansInCounty: number;
    totalCarriersInCounty: number;
  };
}

function fmt(val: number | null | undefined): string {
  if (val === null || val === undefined) return "-";
  return `$${val.toLocaleString()}`;
}

function StarDisplay({ rating }: { rating: number | null }) {
  if (!rating) return <span className="text-muted-foreground">-</span>;
  return (
    <span className="flex items-center gap-0.5">
      <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
      <span>{rating}</span>
    </span>
  );
}

export default function PlanCheatsheets() {
  const { toast } = useToast();
  const [state, setState] = useState<string>("");
  const [county, setCounty] = useState<string>("");
  const [carrier, setCarrier] = useState<string>("");

  // Fetch counties when state is selected
  const { data: counties } = useQuery<{ county: string; planCount: number }[]>({
    queryKey: ["/api/cheatsheets/counties", state],
    queryFn: async () => {
      if (!state) return [];
      const res = await fetch(`/api/cheatsheets/counties?state=${state}`);
      return res.json();
    },
    enabled: !!state,
  });

  // Fetch carriers when state + county are selected
  const { data: carriers } = useQuery<{ carrier: string; planCount: number }[]>({
    queryKey: ["/api/cheatsheets/carriers", state, county],
    queryFn: async () => {
      if (!state) return [];
      const params = new URLSearchParams({ state });
      if (county) params.set("county", county);
      const res = await fetch(`/api/cheatsheets/carriers?${params}`);
      return res.json();
    },
    enabled: !!state,
  });

  // Fetch cheatsheet data
  const { data: cheatsheet, isLoading } = useQuery<CheatsheetData>({
    queryKey: ["/api/cheatsheets", carrier, state, county],
    queryFn: async () => {
      const res = await fetch(
        `/api/cheatsheets?carrier=${encodeURIComponent(carrier)}&state=${state}&county=${encodeURIComponent(county)}`
      );
      return res.json();
    },
    enabled: !!carrier && !!state && !!county,
  });

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPDF = async () => {
    try {
      const res = await fetch(
        `/api/cheatsheets/pdf?carrier=${encodeURIComponent(carrier)}&state=${state}&county=${encodeURIComponent(county)}`
      );
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Cheatsheet_${carrier.replace(/\s+/g, "_")}_${state}_${county}_${new Date().toISOString().split("T")[0]}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "PDF Downloaded", description: "Cheatsheet PDF has been downloaded." });
    } catch {
      toast({ title: "Error", description: "Failed to download PDF", variant: "destructive" });
    }
  };

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Plan Cheatsheets"
        description="One-page carrier comparison grids for appointments. Select a carrier and county to generate a printable cheatsheet."
        badge="Print-Ready"
        helpText="Plan cheatsheets show all plans from a single carrier in a specific county, with key metrics in a compact grid. Print them or download as PDF to bring to client appointments."
        dataSource="Data: CMS CY2026 PBP files. Cheatsheet format shows all plans from one carrier in one county with key metrics (premium, MOOP, copays, dental, OTC) in a compact printable grid."
      />

      {/* Selectors */}
      <Card className="print:hidden">
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4">
            <div className="w-40">
              <label className="text-sm font-medium mb-1 block">State</label>
              <Select value={state} onValueChange={(v) => { setState(v); setCounty(""); setCarrier(""); }}>
                <SelectTrigger><SelectValue placeholder="State" /></SelectTrigger>
                <SelectContent>
                  {US_STATES.map((s) => (
                    <SelectItem key={s} value={s}>{s}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="w-56">
              <label className="text-sm font-medium mb-1 block">County</label>
              <Select value={county} onValueChange={(v) => { setCounty(v); setCarrier(""); }} disabled={!state}>
                <SelectTrigger><SelectValue placeholder="Select county" /></SelectTrigger>
                <SelectContent>
                  {(counties || []).map((c) => (
                    <SelectItem key={c.county} value={c.county}>
                      {c.county} ({c.planCount} plans)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="w-72">
              <label className="text-sm font-medium mb-1 block">Carrier</label>
              <Select value={carrier} onValueChange={setCarrier} disabled={!state}>
                <SelectTrigger><SelectValue placeholder="Select carrier" /></SelectTrigger>
                <SelectContent>
                  {(carriers || []).map((c) => (
                    <SelectItem key={c.carrier} value={c.carrier}>
                      {c.carrier} ({c.planCount} plans)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {cheatsheet && (
              <div className="flex items-end gap-2 ml-auto">
                <Button variant="outline" size="sm" onClick={handlePrint}>
                  <Printer className="h-4 w-4 mr-1" /> Print
                </Button>
                <Button variant="outline" size="sm" onClick={handleDownloadPDF}>
                  <Download className="h-4 w-4 mr-1" /> Download PDF
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Loading State */}
      {isLoading && (
        <Card>
          <CardContent className="pt-6 space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </CardContent>
        </Card>
      )}

      {/* Cheatsheet Grid */}
      {cheatsheet && cheatsheet.planCount > 0 && (
        <div className="cheatsheet-printable">
          <Card>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <FileSpreadsheet className="h-5 w-5" />
                    {cheatsheet.carrier}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {cheatsheet.county} County, {cheatsheet.state} — {cheatsheet.planCount} plans
                  </p>
                </div>
                <div className="text-right text-xs text-muted-foreground print:block">
                  <div>Market: {cheatsheet.marketContext.totalPlansInCounty} plans / {cheatsheet.marketContext.totalCarriersInCounty} carriers</div>
                  <div>Avg Premium: ${cheatsheet.marketContext.avgPremium} | Avg Dental: ${cheatsheet.marketContext.avgDental}</div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="text-xs">
                      <TableHead className="whitespace-nowrap font-bold">Plan Name</TableHead>
                      <TableHead className="whitespace-nowrap">Type</TableHead>
                      <TableHead className="whitespace-nowrap text-right">Premium</TableHead>
                      <TableHead className="whitespace-nowrap text-right">Deductible</TableHead>
                      <TableHead className="whitespace-nowrap text-right">MOOP</TableHead>
                      <TableHead className="whitespace-nowrap text-right">PCP</TableHead>
                      <TableHead className="whitespace-nowrap text-right">Specialist</TableHead>
                      <TableHead className="whitespace-nowrap text-right">Dental</TableHead>
                      <TableHead className="whitespace-nowrap text-right">Vision</TableHead>
                      <TableHead className="whitespace-nowrap text-right">OTC/Qtr</TableHead>
                      <TableHead className="whitespace-nowrap">Stars</TableHead>
                      <TableHead className="whitespace-nowrap text-right">Drug Ded.</TableHead>
                      <TableHead className="whitespace-nowrap text-right">Part B GB</TableHead>
                      <TableHead className="whitespace-nowrap">SNP</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {cheatsheet.plans.map((plan, idx) => (
                      <TableRow key={idx} className="text-xs">
                        <TableCell className="font-medium max-w-[200px] truncate" title={plan.name}>
                          {plan.name}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-[10px] px-1 py-0">
                            {plan.planType}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {plan.premium === 0 ? (
                            <span className="text-green-600 font-bold">$0</span>
                          ) : (
                            `$${plan.premium}`
                          )}
                        </TableCell>
                        <TableCell className="text-right">{plan.deductible}</TableCell>
                        <TableCell className="text-right">{plan.moop}</TableCell>
                        <TableCell className="text-right">{fmt(plan.pcpCopay)}</TableCell>
                        <TableCell className="text-right">{fmt(plan.specialistCopay)}</TableCell>
                        <TableCell className="text-right">{fmt(plan.dentalLimit)}</TableCell>
                        <TableCell className="text-right">{fmt(plan.visionAllowance)}</TableCell>
                        <TableCell className="text-right">{fmt(plan.otcAmount)}</TableCell>
                        <TableCell><StarDisplay rating={plan.starRating} /></TableCell>
                        <TableCell className="text-right">{fmt(plan.drugDeductible)}</TableCell>
                        <TableCell className="text-right">
                          {plan.partbGiveback && plan.partbGiveback > 0 ? (
                            <span className="text-green-600 font-medium">{fmt(plan.partbGiveback)}</span>
                          ) : "-"}
                        </TableCell>
                        <TableCell>{plan.snpType || "-"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Print-only footer */}
          <div className="hidden print:block mt-4 text-[8px] text-gray-400 text-center">
            We do not offer every plan available in your area. Please contact Medicare.gov, 1-800-MEDICARE, or your local SHIP to get information on all of your options.
          </div>
        </div>
      )}

      {/* Empty state */}
      {cheatsheet && cheatsheet.planCount === 0 && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No plans found for {carrier} in {county} County, {state}.
          </CardContent>
        </Card>
      )}

      {/* Print-friendly styles */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .cheatsheet-printable, .cheatsheet-printable * { visibility: visible; }
          .cheatsheet-printable { position: absolute; left: 0; top: 0; width: 100%; }
          .print\\:hidden { display: none !important; }
          .print\\:block { display: block !important; }
          @page { size: landscape; margin: 0.25in; }
          table { font-size: 7pt !important; }
          th, td { padding: 2px 4px !important; }
        }
      `}</style>
    </div>
  );
}
