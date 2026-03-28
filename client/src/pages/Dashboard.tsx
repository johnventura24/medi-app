import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { motion } from "framer-motion";
import {
  Search,
  BarChart3,
  FileSpreadsheet,
  ArrowRight,
  Users,
  Calculator,
  Heart,
  Database,
  MapPin,
  Building,
  Globe,
  FileText,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
    transition: { staggerChildren: 0.1 },
  },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: "easeOut" } },
};

const workflows = [
  {
    title: "Find Plans for a Client",
    subtitle: "Enter a ZIP and find the perfect plan in seconds",
    icon: Search,
    href: "/find",
    cta: "Start",
    gradient: "from-blue-500/10 to-blue-600/5",
    iconColor: "text-blue-600 dark:text-blue-400",
    borderColor: "hover:border-blue-500/40",
  },
  {
    title: "Analyze a Market",
    subtitle: "Explore carrier territories, find gaps, and discover opportunities",
    icon: BarChart3,
    href: "/intelligence",
    cta: "Explore",
    gradient: "from-emerald-500/10 to-emerald-600/5",
    iconColor: "text-emerald-600 dark:text-emerald-400",
    borderColor: "hover:border-emerald-500/40",
  },
  {
    title: "Export Reports",
    subtitle: "Download benefit grids, CSVs, and compliance docs in your template format",
    icon: FileSpreadsheet,
    href: "/benefit-grid",
    cta: "Export",
    gradient: "from-violet-500/10 to-violet-600/5",
    iconColor: "text-violet-600 dark:text-violet-400",
    borderColor: "hover:border-violet-500/40",
  },
];

const quickActions = [
  { label: "New Client", href: "/clients/new", icon: Users },
  { label: "Money Calculator", href: "/calculator", icon: Calculator },
  { label: "Consumer Tool", href: "/for-you", icon: Heart },
  { label: "Data Sources", href: "/data-sources", icon: Database },
];

function formatNumber(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1)}K`;
  return n.toString();
}

export default function Dashboard() {
  const { user, isAuthenticated } = useAuth();

  const { data: summary } = useQuery<SummaryData>({
    queryKey: ["/api/summary"],
    staleTime: 5 * 60 * 1000,
  });

  const greeting = isAuthenticated && user
    ? `Welcome back, ${user.fullName.split(" ")[0]}`
    : "Welcome";

  return (
    <div className="max-w-6xl mx-auto px-6 py-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <h1 className="text-3xl font-bold tracking-tight">
          {greeting} <span className="inline-block">&#128075;</span>
        </h1>
        <p className="text-muted-foreground mt-1">
          What would you like to do today?
        </p>
      </motion.div>

      {/* Quick Stats */}
      {summary && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15, duration: 0.3 }}
          className="mt-6 flex flex-wrap gap-6 text-sm text-muted-foreground"
        >
          <div className="flex items-center gap-1.5">
            <FileText className="h-3.5 w-3.5" />
            <span className="font-semibold text-foreground">{formatNumber(summary.totalPlans)}</span> Plans
          </div>
          <div className="flex items-center gap-1.5">
            <Building className="h-3.5 w-3.5" />
            <span className="font-semibold text-foreground">{summary.totalCarriers}</span> Carriers
          </div>
          <div className="flex items-center gap-1.5">
            <Globe className="h-3.5 w-3.5" />
            <span className="font-semibold text-foreground">{summary.totalStates}</span> States
          </div>
          <div className="flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5" />
            <span className="font-semibold text-foreground">{formatNumber(summary.totalCities)}</span> Counties
          </div>
        </motion.div>
      )}

      {/* Workflow Cards */}
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="mt-8 grid gap-5 md:grid-cols-3"
      >
        {workflows.map((wf) => (
          <motion.div key={wf.href} variants={item}>
            <Link href={wf.href}>
              <Card
                className={`group relative cursor-pointer overflow-hidden border-2 border-transparent transition-all duration-200 ${wf.borderColor} hover:shadow-lg`}
              >
                <div className={`absolute inset-0 bg-gradient-to-br ${wf.gradient} opacity-60`} />
                <CardContent className="relative p-6 flex flex-col min-h-[220px]">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-xl bg-background shadow-sm border ${wf.iconColor}`}>
                    <wf.icon className="h-6 w-6" />
                  </div>
                  <h2 className="mt-4 text-lg font-semibold tracking-tight">
                    {wf.title}
                  </h2>
                  <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed flex-1">
                    {wf.subtitle}
                  </p>
                  <div className="mt-4 flex items-center gap-1 text-sm font-medium group-hover:gap-2 transition-all">
                    {wf.cta}
                    <ArrowRight className="h-4 w-4" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          </motion.div>
        ))}
      </motion.div>

      {/* Bottom Section */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.4 }}
        className="mt-10 grid gap-8 md:grid-cols-2"
      >
        {/* Quick Actions */}
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
            Quick Actions
          </h3>
          <div className="grid grid-cols-2 gap-3">
            {quickActions.map((action) => (
              <Link key={action.href} href={action.href}>
                <Button
                  variant="outline"
                  className="w-full justify-start gap-2 h-11"
                >
                  <action.icon className="h-4 w-4 text-muted-foreground" />
                  {action.label}
                </Button>
              </Link>
            ))}
          </div>
        </div>

        {/* Recent / Getting Started */}
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
            Getting Started
          </h3>
          <div className="space-y-3">
            <Link href="/find">
              <div className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent/50 transition-colors cursor-pointer">
                <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium">Search by ZIP code</p>
                  <p className="text-xs text-muted-foreground">Find and compare plans for any location</p>
                </div>
              </div>
            </Link>
            <Link href="/dashboard/states">
              <div className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent/50 transition-colors cursor-pointer">
                <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium">Explore the state heatmap</p>
                  <p className="text-xs text-muted-foreground">See plan density and coverage across the country</p>
                </div>
              </div>
            </Link>
            <Link href="/intelligence">
              <div className="flex items-center gap-3 p-3 rounded-lg border hover:bg-accent/50 transition-colors cursor-pointer">
                <BarChart3 className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium">Analyze market intelligence</p>
                  <p className="text-xs text-muted-foreground">Discover market gaps and carrier territories</p>
                </div>
              </div>
            </Link>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
