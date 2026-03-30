import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { motion } from "framer-motion";
import {
  Users,
  TrendingUp,
  BarChart3,
  ArrowRight,
  MapPin,
  AlertTriangle,
  Download,
  Swords,
  ArrowRightLeft,
  Target,
  Building2,
  LineChart,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";

interface SummaryData {
  totalPlans: number;
  totalStates: number;
  totalCities: number;
  totalCarriers: number;
}

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } },
};

// Mock data for FMO dashboard
const mockAgentPerformance = [
  { name: "Sarah Johnson", enrollments: 42, clients: 68, compliance: 98 },
  { name: "Mike Chen", enrollments: 38, clients: 55, compliance: 100 },
  { name: "Lisa Wang", enrollments: 31, clients: 49, compliance: 95 },
  { name: "Tom Davis", enrollments: 27, clients: 41, compliance: 100 },
  { name: "Anna Lee", enrollments: 24, clients: 36, compliance: 97 },
];

const mockOpportunities = [
  { market: "Miami-Dade, FL", type: "Underserved", penetration: "34%", potential: "High" },
  { market: "Harris County, TX", type: "Growth", penetration: "28%", potential: "High" },
  { market: "Cook County, IL", type: "Competitive", penetration: "45%", potential: "Medium" },
  { market: "Maricopa, AZ", type: "Emerging", penetration: "22%", potential: "Very High" },
];

const mockAlerts = [
  { carrier: "Humana", action: "Exiting 3 counties in FL", severity: "high" },
  { carrier: "Aetna", action: "New DSNP plans in TX", severity: "medium" },
  { carrier: "UHC", action: "Premium reduction in AZ", severity: "low" },
  { carrier: "Centene", action: "Network expansion in IL", severity: "medium" },
];

export default function DashboardFMO() {
  const { user } = useAuth();

  const { data: summary } = useQuery<SummaryData>({
    queryKey: ["/api/summary"],
    staleTime: 5 * 60 * 1000,
  });

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex items-center gap-3">
          <h1 className="text-3xl font-bold tracking-tight">
            FMO Dashboard
          </h1>
          <Badge className="text-xs bg-emerald-600">FMO</Badge>
        </div>
        <p className="text-muted-foreground mt-1">
          Welcome back, {user?.fullName.split(" ")[0]}. Market intelligence and agent oversight.
        </p>
      </motion.div>

      {/* KPI Cards */}
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <motion.div variants={item}>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Agents</p>
                  <p className="text-3xl font-bold mt-1">48</p>
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">+5 this month</p>
                </div>
                <div className="h-12 w-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
                  <Users className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={item}>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Total Enrollments</p>
                  <p className="text-3xl font-bold mt-1">1,247</p>
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">+18% vs last AEP</p>
                </div>
                <div className="h-12 w-12 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                  <TrendingUp className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={item}>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Market Share</p>
                  <p className="text-3xl font-bold mt-1">12.4%</p>
                  <p className="text-xs text-muted-foreground mt-1">Across 6 states</p>
                </div>
                <div className="h-12 w-12 rounded-xl bg-violet-500/10 flex items-center justify-center">
                  <Target className="h-6 w-6 text-violet-600 dark:text-violet-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={item}>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Competitive Position</p>
                  <p className="text-3xl font-bold mt-1">#3</p>
                  <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">Up from #5</p>
                </div>
                <div className="h-12 w-12 rounded-xl bg-amber-500/10 flex items-center justify-center">
                  <BarChart3 className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>

      {/* Main Content */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.4 }}
        className="mt-8 grid gap-6 lg:grid-cols-3"
      >
        {/* Agent Performance Table */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base font-semibold">Agent Performance</CardTitle>
            <Badge variant="secondary" className="text-xs">{mockAgentPerformance.length} agents</Badge>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground">
                    <th className="text-left py-2 font-medium">Agent</th>
                    <th className="text-right py-2 font-medium">Enrollments</th>
                    <th className="text-right py-2 font-medium">Clients</th>
                    <th className="text-right py-2 font-medium">SOA %</th>
                  </tr>
                </thead>
                <tbody>
                  {mockAgentPerformance.map((agent) => (
                    <tr key={agent.name} className="border-b border-muted/50 hover:bg-muted/30 transition-colors">
                      <td className="py-2.5 font-medium">{agent.name}</td>
                      <td className="text-right py-2.5">{agent.enrollments}</td>
                      <td className="text-right py-2.5">{agent.clients}</td>
                      <td className="text-right py-2.5">
                        <Badge
                          variant={agent.compliance === 100 ? "default" : "secondary"}
                          className="text-xs"
                        >
                          {agent.compliance}%
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Competitive Alerts */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base font-semibold">Carrier Alerts</CardTitle>
            <Link href="/carrier-movements">
              <Button variant="ghost" size="sm" className="gap-1 text-xs">
                View All <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {mockAlerts.map((alert, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-3 p-2.5 rounded-md border hover:bg-muted/30 transition-colors"
                >
                  <AlertTriangle
                    className={`h-4 w-4 mt-0.5 shrink-0 ${
                      alert.severity === "high"
                        ? "text-red-500"
                        : alert.severity === "medium"
                        ? "text-amber-500"
                        : "text-blue-500"
                    }`}
                  />
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{alert.carrier}</p>
                    <p className="text-xs text-muted-foreground">{alert.action}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Opportunities + Quick Actions */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45, duration: 0.4 }}
        className="mt-6 grid gap-6 lg:grid-cols-3"
      >
        {/* Top Opportunities */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base font-semibold">Top Market Opportunities</CardTitle>
            <Link href="/intelligence">
              <Button variant="ghost" size="sm" className="gap-1 text-xs">
                Intelligence <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 sm:grid-cols-2">
              {mockOpportunities.map((opp, idx) => (
                <div
                  key={idx}
                  className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/30 transition-colors"
                >
                  <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{opp.market}</p>
                    <p className="text-xs text-muted-foreground">
                      MA Penetration: {opp.penetration}
                    </p>
                  </div>
                  <Badge
                    variant={opp.potential === "Very High" || opp.potential === "High" ? "default" : "secondary"}
                    className="text-xs shrink-0"
                  >
                    {opp.potential}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* FMO Quick Actions */}
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
            Quick Actions
          </h3>
          <div className="space-y-2">
            <Link href="/intelligence">
              <Button variant="outline" className="w-full justify-start gap-2 h-10">
                <TrendingUp className="h-4 w-4 text-emerald-500" />
                Market Intelligence
              </Button>
            </Link>
            <Link href="/battleground">
              <Button variant="outline" className="w-full justify-start gap-2 h-10">
                <Swords className="h-4 w-4 text-red-500" />
                Battleground Map
              </Button>
            </Link>
            <Link href="/carrier-movements">
              <Button variant="outline" className="w-full justify-start gap-2 h-10">
                <ArrowRightLeft className="h-4 w-4 text-blue-500" />
                Carrier Movements
              </Button>
            </Link>
            <Link href="/trends">
              <Button variant="outline" className="w-full justify-start gap-2 h-10">
                <LineChart className="h-4 w-4 text-violet-500" />
                Market Trends
              </Button>
            </Link>
            <Link href="/benefit-grid">
              <Button variant="outline" className="w-full justify-start gap-2 h-10">
                <Download className="h-4 w-4 text-amber-500" />
                Export Compliance Docs
              </Button>
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
