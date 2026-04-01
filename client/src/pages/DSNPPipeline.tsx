import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  ZAxis,
  Cell,
} from "recharts";
import { Heart, Download, Search, Users, MapPin, Shield, Utensils, Bus } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { InsightBox, type InsightItem } from "@/components/InsightBox";
import { StatCard } from "@/components/StatCard";
import { useLocation } from "wouter";

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","DC","FL","GA","HI","ID","IL","IN",
  "IA","KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH",
  "NJ","NM","NY","NC","ND","OH","OK","OR","PA","PR","RI","SC","SD","TN","TX",
  "UT","VT","VA","WA","WV","WI","WY",
];

interface DSNPOpportunity {
  county: string;
  state: string;
  stateName: string;
  estimatedDualEligible: number;
  dsnpPlansAvailable: number;
  topDSNPs: Array<{
    name: string;
    carrier: string;
    premium: number;
    dental: number;
    otc: number;
    hasMeals: boolean;
    hasTransport: boolean;
  }>;
  competitionLevel: "low" | "medium" | "high";
  monthlyOpportunity: string;
  opportunityScore: number;
}

export default function DSNPPipeline() {
  const [stateFilter, setStateFilter] = useState<string>("all");
  const [, setLocation] = useLocation();

  const { data, isLoading, error } = useQuery<DSNPOpportunity[]>({
    queryKey: ["/api/pipeline/dsnp", stateFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (stateFilter !== "all") params.set("state", stateFilter);
      params.set("limit", "50");
      const res = await fetch(`/api/pipeline/dsnp?${params}`);
      if (!res.ok) throw new Error("Failed to fetch D-SNP pipeline data");
      return res.json();
    },
  });

  const stats = useMemo(() => {
    if (!data || data.length === 0) return null;
    const totalDuals = data.reduce((sum, d) => sum + d.estimatedDualEligible, 0);
    const totalDSNPs = data.reduce((sum, d) => sum + d.dsnpPlansAvailable, 0);
    const underserved = data.filter(d => d.competitionLevel === "low" && d.estimatedDualEligible > 50).length;
    return { totalDuals, totalDSNPs, underserved };
  }, [data]);

  const scatterData = useMemo(() => {
    if (!data) return [];
    return data.map(d => ({
      x: d.estimatedDualEligible,
      y: d.dsnpPlansAvailable,
      z: d.opportunityScore,
      name: `${d.county}, ${d.state}`,
      county: d.county,
      state: d.state,
      competition: d.competitionLevel,
    }));
  }, [data]);

  const insights: InsightItem[] = useMemo(() => {
    if (!data || data.length === 0) return [];
    const items: InsightItem[] = [];

    // Best opportunity: high duals, few plans
    const bestOpp = data.filter(d => d.competitionLevel === "low" && d.estimatedDualEligible > 100)
      .sort((a, b) => b.opportunityScore - a.opportunityScore)[0];
    if (bestOpp) {
      items.push({
        icon: "target",
        text: `In ${bestOpp.county}, ${bestOpp.state}, ~${bestOpp.estimatedDualEligible.toLocaleString()} dual-eligibles but only ${bestOpp.dsnpPlansAvailable} D-SNP plans. Enroll any month \u2014 no waiting for AEP.`,
        priority: "high",
      });
    }

    const totalDuals = data.reduce((sum, d) => sum + d.estimatedDualEligible, 0);
    items.push({
      icon: "opportunity",
      text: `D-SNP enrollees have a monthly SEP \u2014 they can switch plans every single month. ${totalDuals.toLocaleString()} estimated dual-eligibles across ${data.length} counties shown.`,
      priority: "high",
    });

    const lowComp = data.filter(d => d.competitionLevel === "low");
    if (lowComp.length > 0) {
      items.push({
        icon: "trend",
        text: `${lowComp.length} counties have low D-SNP competition (fewer than 4 plans). These are underserved markets with ongoing enrollment opportunity.`,
        priority: "medium",
      });
    }

    return items;
  }, [data]);

  function exportCSV() {
    if (!data) return;
    const headers = ["County", "State", "Est. Dual-Eligible", "D-SNP Plans", "Competition", "Score", "Top D-SNPs", "Monthly Opportunity"];
    const rows = data.map(d => [
      d.county, d.state, d.estimatedDualEligible, d.dsnpPlansAvailable,
      d.competitionLevel, d.opportunityScore,
      d.topDSNPs.map(p => p.name).join("; "),
      `"${d.monthlyOpportunity.replace(/"/g, '""')}"`,
    ]);
    const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "dsnp-pipeline.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function getScatterColor(score: number): string {
    if (score >= 70) return "#22c55e";
    if (score >= 40) return "#3b82f6";
    return "#94a3b8";
  }

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    return (
      <div className="bg-card border rounded-lg p-3 shadow-lg text-sm">
        <p className="font-semibold">{d.name}</p>
        <p className="text-muted-foreground">Dual-Eligible: ~{d.x.toLocaleString()}</p>
        <p className="text-muted-foreground">D-SNP Plans: {d.y}</p>
        <p className="text-muted-foreground">Score: {d.z}</p>
        <p className="text-muted-foreground">Competition: {d.competition}</p>
      </div>
    );
  };

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <PageHeader
        title="D-SNP Monthly Pipeline"
        description="Dual-eligible beneficiaries can switch D-SNP plans every month. Find underserved markets."
        helpText="12M+ dual-eligible beneficiaries (Medicare + Medicaid) have a continuous SEP allowing monthly plan changes. This tool estimates dual-eligible populations by county using poverty and demographic data, then maps D-SNP plan availability to find underserved markets."
        badge="ALWAYS ACTIVE"
        actions={
          <div className="flex items-center gap-3">
            <Badge className="bg-green-500 text-white animate-pulse">
              Monthly SEP Active
            </Badge>
            <Button variant="outline" size="sm" onClick={exportCSV} disabled={!data?.length}>
              <Download className="h-4 w-4 mr-2" />
              Export CSV
            </Button>
          </div>
        }
      />

      {/* Stats */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-32" />)}
        </div>
      ) : stats ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <StatCard
            label="Est. Dual-Eligible (Shown)"
            value={stats.totalDuals.toLocaleString()}
            icon={<Users className="h-5 w-5 text-blue-500" />}
          />
          <StatCard
            label="D-SNP Plans Available"
            value={stats.totalDSNPs.toLocaleString()}
            icon={<Heart className="h-5 w-5 text-red-500" />}
          />
          <StatCard
            label="Underserved Counties"
            value={stats.underserved}
            icon={<MapPin className="h-5 w-5 text-emerald-500" />}
          />
        </div>
      ) : null}

      {/* Filter */}
      <div className="flex items-center gap-4">
        <Select value={stateFilter} onValueChange={setStateFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="All States" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All States</SelectItem>
            {US_STATES.map(st => (
              <SelectItem key={st} value={st}>{st}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Scatter Plot */}
      {scatterData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Opportunity Map: Dual-Eligible Population vs D-SNP Availability</CardTitle>
            <p className="text-xs text-muted-foreground">
              Bottom-right = best opportunity (many dual-eligibles, few plans). Color = opportunity score (green = high).
            </p>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={450}>
              <ScatterChart margin={{ top: 20, right: 30, bottom: 20, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  type="number"
                  dataKey="x"
                  name="Estimated Dual-Eligible"
                  label={{ value: "Estimated Dual-Eligible", position: "bottom", offset: 0 }}
                  className="fill-muted-foreground"
                  tick={{ fontSize: 11 }}
                />
                <YAxis
                  type="number"
                  dataKey="y"
                  name="D-SNP Plans"
                  label={{ value: "D-SNP Plans", angle: -90, position: "insideLeft" }}
                  className="fill-muted-foreground"
                  tick={{ fontSize: 11 }}
                />
                <ZAxis type="number" dataKey="z" range={[40, 400]} />
                <RechartsTooltip content={<CustomTooltip />} />
                <Scatter data={scatterData} shape="circle">
                  {scatterData.map((entry, index) => (
                    <Cell key={index} fill={getScatterColor(entry.z)} fillOpacity={0.7} />
                  ))}
                </Scatter>
              </ScatterChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Insight Box */}
      {insights.length > 0 && (
        <InsightBox title="D-SNP Pipeline Intelligence" insights={insights} />
      )}

      {/* Table */}
      {isLoading ? (
        <Skeleton className="h-96" />
      ) : error ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            Failed to load D-SNP pipeline data. Ensure county_health_data and plans tables are populated.
          </CardContent>
        </Card>
      ) : data && data.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">D-SNP Opportunities by County</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>County</TableHead>
                    <TableHead>State</TableHead>
                    <TableHead className="text-right">Est. Dual-Eligible</TableHead>
                    <TableHead className="text-right">D-SNP Plans</TableHead>
                    <TableHead>Competition</TableHead>
                    <TableHead className="text-right">Score</TableHead>
                    <TableHead>Top D-SNPs</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((row, i) => (
                    <TableRow key={`${row.county}-${row.state}-${i}`}>
                      <TableCell className="font-medium">{row.county}</TableCell>
                      <TableCell>{row.state}</TableCell>
                      <TableCell className="text-right font-mono font-semibold">
                        {row.estimatedDualEligible.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {row.dsnpPlansAvailable}
                      </TableCell>
                      <TableCell>
                        <Badge variant={
                          row.competitionLevel === "low" ? "default" :
                          row.competitionLevel === "medium" ? "secondary" : "outline"
                        }>
                          {row.competitionLevel}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant={row.opportunityScore > 70 ? "default" : "secondary"}>
                          {row.opportunityScore}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[280px]">
                        <div className="space-y-1">
                          {row.topDSNPs.slice(0, 2).map((p, j) => (
                            <div key={j} className="text-xs flex items-center gap-1">
                              <span className="font-medium truncate max-w-[120px]">{p.carrier}</span>
                              <span className="text-muted-foreground">${p.premium}/mo</span>
                              {p.hasMeals && <Utensils className="h-3 w-3 text-orange-500" />}
                              {p.hasTransport && <Bus className="h-3 w-3 text-blue-500" />}
                            </div>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setLocation(`/find?state=${row.state}`)}
                        >
                          <Search className="h-3 w-3 mr-1" />
                          D-SNP Plans
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            No D-SNP data available. Try a different state filter or check that D-SNP plans are loaded.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
