import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { UserPlus, Users, MapPin, TrendingUp, Download, Search } from "lucide-react";
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

interface Turning65County {
  county: string;
  state: string;
  stateName: string;
  estimated65PlusRate: number;
  estimatedNewPerMonth: number;
  totalBeneficiaries: number;
  maPenetration: number;
  topPlans: Array<{ name: string; carrier: string; premium: number; dental: number }>;
  opportunityScore: number;
  agentTip: string;
}

export default function Turning65Pipeline() {
  const [stateFilter, setStateFilter] = useState<string>("all");
  const [, setLocation] = useLocation();

  const { data, isLoading, error } = useQuery<Turning65County[]>({
    queryKey: ["/api/pipeline/turning-65", stateFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (stateFilter !== "all") params.set("state", stateFilter);
      params.set("limit", "50");
      const res = await fetch(`/api/pipeline/turning-65?${params}`);
      if (!res.ok) throw new Error("Failed to fetch turning-65 data");
      return res.json();
    },
  });

  const stats = useMemo(() => {
    if (!data || data.length === 0) return null;
    const totalNew = data.reduce((sum, d) => sum + d.estimatedNewPerMonth, 0);
    const topState = data.reduce((acc, d) => {
      acc[d.state] = (acc[d.state] || 0) + d.estimatedNewPerMonth;
      return acc;
    }, {} as Record<string, number>);
    const topStateEntry = Object.entries(topState).sort((a, b) => b[1] - a[1])[0];
    const topCounty = data[0];
    return { totalNew, topState: topStateEntry, topCounty };
  }, [data]);

  const chartData = useMemo(() => {
    if (!data) return [];
    return data.slice(0, 15).map(d => ({
      name: `${d.county}, ${d.state}`,
      newPerMonth: d.estimatedNewPerMonth,
      score: d.opportunityScore,
    }));
  }, [data]);

  const insights: InsightItem[] = useMemo(() => {
    if (!data || data.length === 0) return [];
    const items: InsightItem[] = [];
    const top = data[0];
    if (top) {
      const ffsPct = 100 - top.maPenetration;
      items.push({
        icon: "target",
        text: `In ${top.county}, ${top.state}, ~${top.estimatedNewPerMonth} people turn 65 every month. Only ${top.maPenetration}% are on MA \u2014 that's ~${Math.round(top.estimatedNewPerMonth * ffsPct / 100)} potential new MA clients/month.`,
        priority: "high",
      });
    }
    const lowPen = data.filter(d => d.maPenetration < 30);
    if (lowPen.length > 0) {
      items.push({
        icon: "opportunity",
        text: `${lowPen.length} counties with <30% MA penetration \u2014 vast majority of new 65s are defaulting to Original Medicare. Educate and enroll.`,
        priority: "medium",
      });
    }
    const highVolume = data.filter(d => d.estimatedNewPerMonth > 50);
    if (highVolume.length > 0) {
      items.push({
        icon: "trend",
        text: `${highVolume.length} high-volume counties (50+ new eligibles/month). Consider seminar-based outreach and birthday mailer campaigns.`,
        priority: "medium",
      });
    }
    return items;
  }, [data]);

  function exportCSV() {
    if (!data) return;
    const headers = ["County", "State", "Est. New/Month", "65+ Rate (%)", "MA Penetration (%)", "Total Beneficiaries", "Score", "Top Plans", "Agent Tip"];
    const rows = data.map(d => [
      d.county, d.state, d.estimatedNewPerMonth, d.estimated65PlusRate,
      d.maPenetration, d.totalBeneficiaries, d.opportunityScore,
      d.topPlans.map(p => p.name).join("; "),
      `"${d.agentTip.replace(/"/g, '""')}"`,
    ]);
    const csv = [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "turning-65-pipeline.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="p-6 space-y-6 max-w-[1400px] mx-auto">
      <PageHeader
        title="Turning 65 Pipeline"
        description="New Medicare enrollees entering their Initial Enrollment Period by county. Target the highest-volume markets."
        helpText="People turning 65 enter a 7-month IEP (Initial Enrollment Period). This tool estimates monthly new-65s per county by crossing beneficiary data with population demographics. Focus on counties with high volume and low MA penetration for the best ROI."
        badge="IEP"
        dataSource="Data: Population estimates from US Census Bureau ACS data crossed with CMS enrollment and MA penetration rates by county. Monthly new-65 estimates derived from age cohort demographics."
        actions={
          <Button variant="outline" size="sm" onClick={exportCSV} disabled={!data?.length}>
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
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
            label="Est. New 65s / Month (Shown)"
            value={stats.totalNew.toLocaleString()}
            icon={<UserPlus className="h-5 w-5 text-blue-500" />}
          />
          <StatCard
            label="Top State"
            value={stats.topState ? `${stats.topState[0]} (${stats.topState[1].toLocaleString()}/mo)` : "N/A"}
            icon={<MapPin className="h-5 w-5 text-emerald-500" />}
          />
          <StatCard
            label="Top County"
            value={stats.topCounty ? `${stats.topCounty.county}, ${stats.topCounty.state}` : "N/A"}
            suffix={stats.topCounty ? ` (${stats.topCounty.estimatedNewPerMonth}/mo)` : ""}
            icon={<TrendingUp className="h-5 w-5 text-violet-500" />}
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

      {/* Bar Chart */}
      {chartData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Top 15 Counties by Estimated New Enrollees/Month</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={chartData} margin={{ top: 5, right: 30, left: 20, bottom: 80 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis
                  dataKey="name"
                  angle={-45}
                  textAnchor="end"
                  height={100}
                  tick={{ fontSize: 11 }}
                  className="fill-muted-foreground"
                />
                <YAxis className="fill-muted-foreground" />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }}
                  labelStyle={{ fontWeight: 600 }}
                />
                <Bar dataKey="newPerMonth" name="Est. New/Month" radius={[4, 4, 0, 0]}>
                  {chartData.map((entry, index) => (
                    <Cell
                      key={index}
                      fill={entry.score > 70 ? "#22c55e" : entry.score > 40 ? "#3b82f6" : "#94a3b8"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}

      {/* Insight Box */}
      {insights.length > 0 && (
        <InsightBox title="Pipeline Intelligence" insights={insights} />
      )}

      {/* Table */}
      {isLoading ? (
        <Skeleton className="h-96" />
      ) : error ? (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            Failed to load pipeline data. Ensure county_health_data and medicare_spending tables are populated.
          </CardContent>
        </Card>
      ) : data && data.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Counties Ranked by New Medicare Enrollees</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>County</TableHead>
                    <TableHead>State</TableHead>
                    <TableHead className="text-right">Est. New/Mo</TableHead>
                    <TableHead className="text-right">65+ Rate</TableHead>
                    <TableHead className="text-right">MA Pen.</TableHead>
                    <TableHead>Top Plans</TableHead>
                    <TableHead className="text-right">Score</TableHead>
                    <TableHead>Agent Tip</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.map((row, i) => (
                    <TableRow key={`${row.county}-${row.state}-${i}`}>
                      <TableCell className="font-medium">{row.county}</TableCell>
                      <TableCell>{row.state}</TableCell>
                      <TableCell className="text-right font-mono font-semibold">
                        {row.estimatedNewPerMonth.toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">{row.estimated65PlusRate}%</TableCell>
                      <TableCell className="text-right">
                        <Badge variant={row.maPenetration < 30 ? "destructive" : row.maPenetration < 50 ? "secondary" : "default"}>
                          {row.maPenetration}%
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[200px]">
                        <div className="space-y-1">
                          {row.topPlans.slice(0, 2).map((p, j) => (
                            <div key={j} className="text-xs">
                              <span className="font-medium">{p.carrier}</span>
                              <span className="text-muted-foreground"> ${p.premium}/mo</span>
                            </div>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant={row.opportunityScore > 70 ? "default" : "secondary"}>
                          {row.opportunityScore}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-[250px] text-xs text-muted-foreground">
                        {row.agentTip}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setLocation(`/find?state=${row.state}`)}
                        >
                          <Search className="h-3 w-3 mr-1" />
                          Plans
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
            No data available. Try a different state filter or check that county_health_data is loaded.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
