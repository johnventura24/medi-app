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
                  <p className="text-3xl font-bold mt-1">0</p>
                  <p className="text-xs text-muted-foreground mt-1">Onboard agents to begin</p>
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
                  <p className="text-3xl font-bold mt-1">0</p>
                  <p className="text-xs text-muted-foreground mt-1">Across all agents</p>
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
                  <p className="text-3xl font-bold mt-1">&mdash;</p>
                  <p className="text-xs text-muted-foreground mt-1">View in intelligence</p>
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
                  <p className="text-3xl font-bold mt-1">&mdash;</p>
                  <p className="text-xs text-muted-foreground mt-1">Analyzed from market data</p>
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
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-8 w-8 mx-auto opacity-40" />
              <p className="text-sm mt-3">Agent performance data will appear when agents are active</p>
              <p className="text-xs mt-1">Enrollment counts, client totals, and compliance rates will be tracked here.</p>
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
            <div className="text-center py-8 text-muted-foreground">
              <AlertTriangle className="h-8 w-8 mx-auto opacity-40" />
              <p className="text-sm mt-3">No carrier alerts at this time</p>
              <p className="text-xs mt-1">Carrier changes and market movements will appear here.</p>
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
            <div className="text-center py-8 text-muted-foreground">
              <MapPin className="h-8 w-8 mx-auto opacity-40" />
              <p className="text-sm mt-3">Market opportunities will be identified from intelligence data</p>
              <Link href="/intelligence">
                <Button variant="outline" size="sm" className="mt-3 gap-1">
                  Open Market Intelligence <ArrowRight className="h-3 w-3" />
                </Button>
              </Link>
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
