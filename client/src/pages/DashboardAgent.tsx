import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
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
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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

// Mock data for agent dashboard
const mockPipeline = {
  intake: 12,
  plansReviewed: 8,
  enrolled: 5,
};

const mockRecentLeads = [
  { id: 1, name: "Margaret Smith", zip: "33101", source: "Consumer Flow", time: "30 min ago" },
  { id: 2, name: "Robert Johnson", zip: "77001", source: "Referral", time: "2 hrs ago" },
  { id: 3, name: "Dorothy Williams", zip: "85001", source: "Consumer Flow", time: "4 hrs ago" },
  { id: 4, name: "James Brown", zip: "60601", source: "Walk-in", time: "Yesterday" },
];

const mockSOAStatus = {
  total: 42,
  compliant: 38,
  expiringSoon: 3,
  expired: 1,
};

const mockRecentActivity = [
  { action: "Plan recommended", detail: "Humana Gold Plus for M. Smith", time: "1 hr ago", type: "plan" },
  { action: "SOA signed", detail: "R. Johnson - SOA completed", time: "3 hrs ago", type: "soa" },
  { action: "Client intake", detail: "D. Williams added", time: "4 hrs ago", type: "client" },
  { action: "Enrollment submitted", detail: "J. Brown - UHC AARP", time: "Yesterday", type: "enrollment" },
  { action: "Lead received", detail: "New lead from consumer flow", time: "Yesterday", type: "lead" },
];

export default function DashboardAgent() {
  const { user } = useAuth();

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
          Welcome back, {user?.fullName.split(" ")[0]}. Here is your client pipeline and tools.
        </p>
      </motion.div>

      {/* Pipeline Cards */}
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
                  <p className="text-sm text-muted-foreground">Clients Served</p>
                  <p className="text-3xl font-bold mt-1">42</p>
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">+3 this week</p>
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
                  <p className="text-3xl font-bold mt-1">156</p>
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
                  <p className="text-3xl font-bold mt-1">28</p>
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">67% conversion</p>
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
                  <p className="text-3xl font-bold mt-1">
                    {Math.round((mockSOAStatus.compliant / mockSOAStatus.total) * 100)}%
                  </p>
                  {mockSOAStatus.expiringSoon > 0 && (
                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                      {mockSOAStatus.expiringSoon} expiring soon
                    </p>
                  )}
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
                <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">{mockPipeline.intake}</p>
                <p className="text-sm text-muted-foreground mt-1">Intake</p>
              </div>
              <ArrowRight className="h-5 w-5 text-muted-foreground shrink-0" />
              <div className="flex-1 text-center p-4 rounded-lg bg-amber-500/5 border border-amber-200 dark:border-amber-800">
                <p className="text-3xl font-bold text-amber-600 dark:text-amber-400">{mockPipeline.plansReviewed}</p>
                <p className="text-sm text-muted-foreground mt-1">Plans Reviewed</p>
              </div>
              <ArrowRight className="h-5 w-5 text-muted-foreground shrink-0" />
              <div className="flex-1 text-center p-4 rounded-lg bg-emerald-500/5 border border-emerald-200 dark:border-emerald-800">
                <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">{mockPipeline.enrolled}</p>
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
            <div className="space-y-3">
              {mockRecentLeads.map((lead) => (
                <div
                  key={lead.id}
                  className="flex items-center gap-3 p-2.5 rounded-md border hover:bg-muted/30 transition-colors cursor-pointer"
                >
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-medium shrink-0">
                    {lead.name.split(" ").map((n) => n[0]).join("")}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{lead.name}</p>
                    <p className="text-xs text-muted-foreground">
                      ZIP: {lead.zip} -- {lead.source}
                    </p>
                  </div>
                  <span className="text-[10px] text-muted-foreground shrink-0">{lead.time}</span>
                </div>
              ))}
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
            <div className="space-y-3">
              {mockRecentActivity.map((activity, idx) => (
                <div key={idx} className="flex items-start gap-3">
                  <div className="mt-0.5">
                    {activity.type === "soa" ? (
                      <ClipboardCheck className="h-4 w-4 text-emerald-500" />
                    ) : activity.type === "enrollment" ? (
                      <CheckCircle className="h-4 w-4 text-blue-500" />
                    ) : activity.type === "lead" ? (
                      <Inbox className="h-4 w-4 text-amber-500" />
                    ) : activity.type === "plan" ? (
                      <FileText className="h-4 w-4 text-violet-500" />
                    ) : (
                      <Users className="h-4 w-4 text-muted-foreground" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{activity.action}</p>
                    <p className="text-xs text-muted-foreground truncate">{activity.detail}</p>
                  </div>
                  <span className="text-[10px] text-muted-foreground shrink-0 flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {activity.time}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* SOA Compliance Warning */}
      {(mockSOAStatus.expiringSoon > 0 || mockSOAStatus.expired > 0) && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.4 }}
          className="mt-6"
        >
          <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/30 dark:bg-amber-950/10">
            <CardContent className="p-4 flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-medium">SOA Compliance Attention Needed</p>
                <p className="text-xs text-muted-foreground">
                  {mockSOAStatus.expiringSoon} SOA{mockSOAStatus.expiringSoon !== 1 ? "s" : ""} expiring soon
                  {mockSOAStatus.expired > 0 && `, ${mockSOAStatus.expired} expired`}.
                  Review and renew to maintain compliance.
                </p>
              </div>
              <Link href="/soa">
                <Button size="sm" variant="outline" className="shrink-0">
                  Review SOAs
                </Button>
              </Link>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
