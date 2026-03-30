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
  Clock,
  UserPlus,
  AlertTriangle,
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

// Mock data for admin dashboard — replace with real API calls
const mockAuditLog = [
  { id: 1, action: "User login", user: "agent@example.com", time: "2 min ago", level: "info" },
  { id: 2, action: "Plan data imported", user: "system", time: "15 min ago", level: "info" },
  { id: 3, action: "Role changed to admin", user: "admin@example.com", time: "1 hr ago", level: "warning" },
  { id: 4, action: "API key generated", user: "fmo@example.com", time: "2 hrs ago", level: "info" },
  { id: 5, action: "User registered", user: "newagent@example.com", time: "3 hrs ago", level: "info" },
  { id: 6, action: "Data validation completed", user: "system", time: "4 hrs ago", level: "info" },
  { id: 7, action: "Export generated", user: "compliance@example.com", time: "5 hrs ago", level: "info" },
  { id: 8, action: "Failed login attempt", user: "unknown@test.com", time: "6 hrs ago", level: "error" },
  { id: 9, action: "Carrier data updated", user: "system", time: "8 hrs ago", level: "info" },
  { id: 10, action: "User deactivated", user: "admin@example.com", time: "1 day ago", level: "warning" },
];

const mockRecentUsers = [
  { id: 1, name: "Sarah Johnson", email: "sarah@agency.com", role: "agent", joined: "Today" },
  { id: 2, name: "Mike Chen", email: "mike@fmo.com", role: "compliance", joined: "Yesterday" },
  { id: 3, name: "Lisa Wang", email: "lisa@broker.com", role: "agent", joined: "2 days ago" },
  { id: 4, name: "Tom Davis", email: "tom@viewer.com", role: "viewer", joined: "3 days ago" },
];

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
                  <p className="text-3xl font-bold mt-1">127</p>
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">+12 this week</p>
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
                  <p className="text-3xl font-bold mt-1">4,821</p>
                  <p className="text-xs text-muted-foreground mt-1">Avg 4.2K/day</p>
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
                  <p className="text-3xl font-bold mt-1">8</p>
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">All connected</p>
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
            <div className="space-y-2">
              {mockAuditLog.map((entry) => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between py-2 px-3 rounded-md hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {entry.level === "error" ? (
                      <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />
                    ) : entry.level === "warning" ? (
                      <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                    ) : (
                      <CheckCircle className="h-4 w-4 text-muted-foreground shrink-0" />
                    )}
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{entry.action}</p>
                      <p className="text-xs text-muted-foreground truncate">{entry.user}</p>
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0 ml-4 flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {entry.time}
                  </span>
                </div>
              ))}
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
            <div className="space-y-3">
              {mockRecentUsers.map((u) => (
                <div key={u.id} className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-medium shrink-0">
                    {u.name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{u.name}</p>
                    <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <Badge variant="secondary" className="text-[10px] capitalize">
                      {u.role}
                    </Badge>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{u.joined}</p>
                  </div>
                </div>
              ))}
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
