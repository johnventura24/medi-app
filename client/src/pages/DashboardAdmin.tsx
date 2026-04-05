import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { motion } from "framer-motion";
import {
  Users,
  Activity,
  Database,
  FileText,
  Shield,
  Key,
  Server,
  ArrowRight,
  CheckCircle,
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

function formatNumber(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}K`;
  return n.toString();
}

const adminQuickLinks = [
  { label: "Audit Logs", href: "/admin/audit", icon: Shield, color: "text-amber-600 dark:text-amber-400" },
  { label: "User Management", href: "/admin/users", icon: Users, color: "text-blue-600 dark:text-blue-400" },
  { label: "API Keys", href: "/admin/api-keys", icon: Key, color: "text-violet-600 dark:text-violet-400" },
  { label: "System Health", href: "/admin/health", icon: Server, color: "text-emerald-600 dark:text-emerald-400" },
  { label: "Data Sources", href: "/data-sources", icon: Database, color: "text-cyan-600 dark:text-cyan-400" },
  { label: "Data Validation", href: "/validation", icon: CheckCircle, color: "text-green-600 dark:text-green-400" },
];

export default function DashboardAdmin() {
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
            Admin Dashboard
          </h1>
          <Badge variant="destructive" className="text-xs">Admin</Badge>
        </div>
        <p className="text-muted-foreground mt-1">
          Welcome back, {user?.fullName.split(" ")[0]}. Platform overview and management tools.
        </p>
      </motion.div>

      {/* System Health Cards */}
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
                  <p className="text-sm text-muted-foreground">Active Users</p>
                  <p className="text-3xl font-bold mt-1">&mdash;</p>
                  <p className="text-xs text-muted-foreground mt-1">Syncs from user data</p>
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
                  <p className="text-sm text-muted-foreground">API Requests Today</p>
                  <p className="text-3xl font-bold mt-1">&mdash;</p>
                  <p className="text-xs text-muted-foreground mt-1">View in system health</p>
                </div>
                <div className="h-12 w-12 rounded-xl bg-violet-500/10 flex items-center justify-center">
                  <Activity className="h-6 w-6 text-violet-600 dark:text-violet-400" />
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
                  <p className="text-sm text-muted-foreground">Data Sources</p>
                  <p className="text-3xl font-bold mt-1">&mdash;</p>
                  <p className="text-xs text-muted-foreground mt-1">Manage connections</p>
                </div>
                <div className="h-12 w-12 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                  <Database className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
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
                  <p className="text-sm text-muted-foreground">Plans in Database</p>
                  <p className="text-3xl font-bold mt-1">
                    {summary ? formatNumber(summary.totalPlans) : "--"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {summary ? `${summary.totalCarriers} carriers` : "Loading..."}
                  </p>
                </div>
                <div className="h-12 w-12 rounded-xl bg-amber-500/10 flex items-center justify-center">
                  <FileText className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>

      {/* Main Content Grid */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.4 }}
        className="mt-8 grid gap-6 lg:grid-cols-3"
      >
        {/* Audit Log Preview */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base font-semibold">Recent Audit Log</CardTitle>
            <Link href="/admin/audit">
              <Button variant="ghost" size="sm" className="gap-1 text-xs">
                View All <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-muted-foreground">
              <Shield className="h-8 w-8 mx-auto opacity-40" />
              <p className="text-sm mt-3">View audit logs for system activity</p>
              <Link href="/admin/audit">
                <Button variant="outline" size="sm" className="mt-3 gap-1">
                  Open Audit Logs <ArrowRight className="h-3 w-3" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Recent Registrations */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base font-semibold">Recent Users</CardTitle>
            <Link href="/admin/users">
              <Button variant="ghost" size="sm" className="gap-1 text-xs">
                Manage <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-muted-foreground">
              <Users className="h-8 w-8 mx-auto opacity-40" />
              <p className="text-sm mt-3">Manage users in the admin panel</p>
              <Link href="/admin/users">
                <Button variant="outline" size="sm" className="mt-3 gap-1">
                  User Management <ArrowRight className="h-3 w-3" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Admin Quick Links */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.45, duration: 0.4 }}
        className="mt-8"
      >
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
          Admin Tools
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {adminQuickLinks.map((link) => (
            <Link key={link.href} href={link.href}>
              <Button
                variant="outline"
                className="w-full h-auto py-4 flex flex-col items-center gap-2"
              >
                <link.icon className={`h-5 w-5 ${link.color}`} />
                <span className="text-xs font-medium">{link.label}</span>
              </Button>
            </Link>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
