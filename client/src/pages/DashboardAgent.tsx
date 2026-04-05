import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import {
  Users,
  FileCheck,
  ClipboardCheck,
  ArrowRight,
  Stethoscope,
  Zap,
  UserPlus,
  Search,
  Clock,
  AlertTriangle,
  CheckCircle,
  Inbox,
  FileText,
  Target,
  Calendar,
  ShieldAlert,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";

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


interface ActionItem {
  priority: "urgent" | "high" | "medium" | "low";
  action: string;
  reason: string;
  deadline: string | null;
  planRecommendation?: {
    planId: number;
    name: string;
    carrier: string;
    whyBetter: string;
  };
  agentScript?: string;
}

interface NextBestAction {
  clientId: number;
  clientName: string;
  actions: ActionItem[];
}

export default function DashboardAgent() {
  const { user, token } = useAuth();
  const [, navigate] = useLocation();

  const { data: nextActions, isLoading: actionsLoading } = useQuery<NextBestAction[]>({
    queryKey: ["next-best-actions"],
    queryFn: async () => {
      const res = await fetch("/api/next-best-action", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!token,
    refetchInterval: 5 * 60 * 1000, // Refresh every 5 minutes
  });

  const totalActions = nextActions?.reduce((sum, c) => sum + c.actions.length, 0) ?? 0;
  const urgentActions = nextActions?.reduce(
    (sum, c) => sum + c.actions.filter((a) => a.priority === "urgent").length,
    0
  ) ?? 0;

  function getActionRoute(action: ActionItem, clientId: number): string {
    if (action.action.includes("SOA")) return "/soa";
    if (action.action.includes("SEP")) return "/sep/check";
    if (action.planRecommendation) return `/clients/${clientId}`;
    if (action.action.includes("Profile")) return `/clients/${clientId}`;
    return `/clients/${clientId}`;
  }

  const priorityConfig: Record<string, { color: string; bg: string; label: string }> = {
    urgent: { color: "text-red-600 dark:text-red-400", bg: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300", label: "Urgent" },
    high: { color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300", label: "High" },
    medium: { color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300", label: "Medium" },
    low: { color: "text-muted-foreground", bg: "bg-muted text-muted-foreground", label: "Low" },
  };

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
            My Dashboard
          </h1>
          <Badge className="text-xs bg-blue-600">Agent</Badge>
        </div>
        <p className="text-muted-foreground mt-1">
          Welcome back, {user?.fullName?.split(" ")[0] ?? "Agent"}. Here is your client pipeline and tools.
        </p>
      </motion.div>

      {/* Next Best Actions — THE KILLER FEATURE */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.4 }}
        className="mt-6"
      >
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div className="flex items-center gap-2">
              <Target className="h-5 w-5 text-primary" />
              <CardTitle className="text-base font-semibold">Next Best Actions</CardTitle>
              {totalActions > 0 && (
                <Badge variant="secondary" className="text-xs">{totalActions} action{totalActions !== 1 ? "s" : ""}</Badge>
              )}
              {urgentActions > 0 && (
                <Badge className="text-[10px] bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300">
                  {urgentActions} urgent
                </Badge>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {actionsLoading ? (
              <div className="space-y-3">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : nextActions && nextActions.length > 0 ? (
              <div className="space-y-2">
                {nextActions.slice(0, 6).flatMap((client) =>
                  client.actions.slice(0, 2).map((action, actionIdx) => {
                    const cfg = priorityConfig[action.priority] || priorityConfig.low;
                    return (
                      <div
                        key={`${client.clientId}-${actionIdx}`}
                        className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/30 transition-colors cursor-pointer group"
                        onClick={() => navigate(getActionRoute(action, client.clientId))}
                      >
                        <div className="shrink-0">
                          {action.priority === "urgent" ? (
                            <ShieldAlert className="h-5 w-5 text-red-500" />
                          ) : action.priority === "high" ? (
                            <AlertTriangle className="h-5 w-5 text-amber-500" />
                          ) : (
                            <Target className="h-5 w-5 text-blue-500" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{client.clientName}</span>
                            <Badge className={`text-[10px] ${cfg.bg}`}>{cfg.label}</Badge>
                          </div>
                          <p className="text-xs font-medium mt-0.5">{action.action}</p>
                          <p className="text-xs text-muted-foreground truncate">{action.reason}</p>
                        </div>
                        {action.deadline && (
                          <div className="text-right shrink-0">
                            <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {new Date(action.deadline).toLocaleDateString()}
                            </p>
                          </div>
                        )}
                        <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                      </div>
                    );
                  })
                )}
              </div>
            ) : (
              <div className="text-center py-6 text-muted-foreground">
                <Target className="h-8 w-8 mx-auto opacity-40" />
                <p className="text-sm mt-2">No actions needed right now. Great job!</p>
                <p className="text-xs mt-1">Actions will appear when your clients need attention.</p>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Pipeline Cards */}
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <motion.div variants={item}>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Clients Served</p>
                  <p className="text-3xl font-bold mt-1">0</p>
                  <p className="text-xs text-muted-foreground mt-1">Add clients to get started</p>
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
                  <p className="text-sm text-muted-foreground">Plans Recommended</p>
                  <p className="text-3xl font-bold mt-1">0</p>
                  <p className="text-xs text-muted-foreground mt-1">Across all clients</p>
                </div>
                <div className="h-12 w-12 rounded-xl bg-violet-500/10 flex items-center justify-center">
                  <FileText className="h-6 w-6 text-violet-600 dark:text-violet-400" />
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
                  <p className="text-sm text-muted-foreground">Enrollments</p>
                  <p className="text-3xl font-bold mt-1">0</p>
                  <p className="text-xs text-muted-foreground mt-1">Completed enrollments</p>
                </div>
                <div className="h-12 w-12 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                  <CheckCircle className="h-6 w-6 text-emerald-600 dark:text-emerald-400" />
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
                  <p className="text-sm text-muted-foreground">SOA Compliance</p>
                  <p className="text-3xl font-bold mt-1">&mdash;</p>
                  <p className="text-xs text-muted-foreground mt-1">Track in SOA dashboard</p>
                </div>
                <div className="h-12 w-12 rounded-xl bg-amber-500/10 flex items-center justify-center">
                  <ClipboardCheck className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </motion.div>

      {/* Client Pipeline */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25, duration: 0.4 }}
        className="mt-8"
      >
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Client Pipeline</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1 text-center p-4 rounded-lg bg-blue-500/5 border border-blue-200 dark:border-blue-800">
                <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">0</p>
                <p className="text-sm text-muted-foreground mt-1">Intake</p>
              </div>
              <ArrowRight className="h-5 w-5 text-muted-foreground shrink-0" />
              <div className="flex-1 text-center p-4 rounded-lg bg-amber-500/5 border border-amber-200 dark:border-amber-800">
                <p className="text-3xl font-bold text-amber-600 dark:text-amber-400">0</p>
                <p className="text-sm text-muted-foreground mt-1">Plans Reviewed</p>
              </div>
              <ArrowRight className="h-5 w-5 text-muted-foreground shrink-0" />
              <div className="flex-1 text-center p-4 rounded-lg bg-emerald-500/5 border border-emerald-200 dark:border-emerald-800">
                <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">0</p>
                <p className="text-sm text-muted-foreground mt-1">Enrolled</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Main Content Grid */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35, duration: 0.4 }}
        className="mt-6 grid gap-6 lg:grid-cols-3"
      >
        {/* Recent Leads */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base font-semibold">Recent Leads</CardTitle>
            <Link href="/leads">
              <Button variant="ghost" size="sm" className="gap-1 text-xs">
                All Leads <ArrowRight className="h-3 w-3" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-muted-foreground">
              <Inbox className="h-8 w-8 mx-auto opacity-40" />
              <p className="text-sm mt-3">New leads will appear here when consumers request help</p>
              <Link href="/leads">
                <Button variant="outline" size="sm" className="mt-3 gap-1">
                  View Leads <ArrowRight className="h-3 w-3" />
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Link href="/sep/check">
                <Button variant="outline" className="w-full justify-start gap-2 h-11 border-primary/30 hover:bg-primary/5">
                  <Calendar className="h-4 w-4 text-primary" />
                  SEP Eligibility Checker
                </Button>
              </Link>
              <Link href="/keep-my-doctor">
                <Button variant="outline" className="w-full justify-start gap-2 h-11 border-rose-200 dark:border-rose-800 hover:bg-rose-50 dark:hover:bg-rose-950/20">
                  <Stethoscope className="h-4 w-4 text-rose-500" />
                  Keep My Doctor
                </Button>
              </Link>
              <Link href="/smart-match">
                <Button variant="outline" className="w-full justify-start gap-2 h-11">
                  <Zap className="h-4 w-4 text-amber-500" />
                  Smart Match
                </Button>
              </Link>
              <Link href="/find">
                <Button variant="outline" className="w-full justify-start gap-2 h-11">
                  <Search className="h-4 w-4 text-blue-500" />
                  Find Plans
                </Button>
              </Link>
              <Link href="/clients/new">
                <Button variant="outline" className="w-full justify-start gap-2 h-11">
                  <UserPlus className="h-4 w-4 text-emerald-500" />
                  New Client
                </Button>
              </Link>
              <Link href="/soa">
                <Button variant="outline" className="w-full justify-start gap-2 h-11">
                  <FileCheck className="h-4 w-4 text-violet-500" />
                  SOA Dashboard
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity Timeline */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-base font-semibold">Recent Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-muted-foreground">
              <Clock className="h-8 w-8 mx-auto opacity-40" />
              <p className="text-sm mt-3">Your recent activity will appear here</p>
              <p className="text-xs mt-1">Actions like plan recommendations, SOA signings, and enrollments will be tracked.</p>
            </div>
          </CardContent>
        </Card>
      </motion.div>

    </div>
  );
}
