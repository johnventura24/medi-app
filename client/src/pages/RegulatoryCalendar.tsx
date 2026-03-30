import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Calendar,
  Clock,
  AlertTriangle,
  Shield,
  FileText,
  Heart,
  Users,
  Star,
  ChevronRight,
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";

interface RegulatoryAlert {
  id: string;
  date: string;
  title: string;
  description: string;
  impact: "high" | "medium" | "low";
  category: "enrollment" | "compliance" | "filing" | "benefits" | "quality";
  daysUntil?: number;
}

interface CalendarMonth {
  month: string;
  alerts: (RegulatoryAlert & { daysUntil: number })[];
}

const CATEGORY_LABELS: Record<string, { label: string; icon: React.ComponentType<{ className?: string }>; color: string }> = {
  enrollment: { label: "Enrollment", icon: Users, color: "bg-blue-100 text-blue-700 border-blue-200" },
  compliance: { label: "Compliance", icon: Shield, color: "bg-purple-100 text-purple-700 border-purple-200" },
  filing: { label: "Filing", icon: FileText, color: "bg-amber-100 text-amber-700 border-amber-200" },
  benefits: { label: "Benefits", icon: Heart, color: "bg-green-100 text-green-700 border-green-200" },
  quality: { label: "Quality", icon: Star, color: "bg-pink-100 text-pink-700 border-pink-200" },
};

const IMPACT_COLORS: Record<string, string> = {
  high: "bg-red-100 text-red-700 border-red-200",
  medium: "bg-yellow-100 text-yellow-700 border-yellow-200",
  low: "bg-gray-100 text-gray-600 border-gray-200",
};

function DaysUntilBadge({ days }: { days: number }) {
  if (days < 0) {
    return <Badge variant="outline" className="text-muted-foreground text-[10px]">{Math.abs(days)}d ago</Badge>;
  }
  if (days === 0) {
    return <Badge className="bg-red-600 text-white text-[10px] animate-pulse">TODAY</Badge>;
  }
  if (days <= 7) {
    return <Badge className="bg-red-100 text-red-700 text-[10px]">{days}d</Badge>;
  }
  if (days <= 30) {
    return <Badge className="bg-yellow-100 text-yellow-700 text-[10px]">{days}d</Badge>;
  }
  return <Badge variant="outline" className="text-[10px]">{days}d</Badge>;
}

function AlertCard({ alert }: { alert: RegulatoryAlert & { daysUntil: number } }) {
  const categoryMeta = CATEGORY_LABELS[alert.category] || CATEGORY_LABELS.compliance;
  const CategoryIcon = categoryMeta.icon;
  const isPast = alert.daysUntil < 0;

  return (
    <Card className={`transition-all ${isPast ? "opacity-50" : "hover:shadow-md"}`}>
      <CardContent className="py-4 px-5">
        <div className="flex items-start gap-3">
          <div className={`p-2 rounded-lg shrink-0 ${categoryMeta.color}`}>
            <CategoryIcon className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0 space-y-1">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-sm font-semibold leading-tight">{alert.title}</h3>
              <DaysUntilBadge days={alert.daysUntil} />
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">{alert.description}</p>
            <div className="flex items-center gap-2 pt-1">
              <Badge variant="outline" className={`text-[10px] ${IMPACT_COLORS[alert.impact]}`}>
                {alert.impact} impact
              </Badge>
              <Badge variant="outline" className={`text-[10px] ${categoryMeta.color}`}>
                {categoryMeta.label}
              </Badge>
              <span className="text-[10px] text-muted-foreground">
                {new Date(alert.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function RegulatoryCalendar() {
  const [category, setCategory] = useState<string>("all");
  const [view, setView] = useState<"timeline" | "calendar">("timeline");

  // Upcoming alerts
  const { data: upcomingAlerts } = useQuery<RegulatoryAlert[]>({
    queryKey: ["/api/regulatory/alerts?upcoming=true&days=180"],
  });

  // Full calendar
  const { data: calendarData, isLoading } = useQuery<CalendarMonth[]>({
    queryKey: ["/api/regulatory/calendar"],
  });

  // All alerts for timeline
  const { data: allAlerts } = useQuery<RegulatoryAlert[]>({
    queryKey: ["/api/regulatory/alerts"],
  });

  const filteredCalendar = useMemo(() => {
    if (!calendarData) return [];
    if (category === "all") return calendarData;
    return calendarData
      .map((m) => ({
        ...m,
        alerts: m.alerts.filter((a) => a.category === category),
      }))
      .filter((m) => m.alerts.length > 0);
  }, [calendarData, category]);

  const filteredAlerts = useMemo(() => {
    if (!allAlerts) return [];
    const today = new Date();
    const enriched = allAlerts.map((a) => ({
      ...a,
      daysUntil: Math.ceil((new Date(a.date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24)),
    }));
    if (category === "all") return enriched;
    return enriched.filter((a) => a.category === category);
  }, [allAlerts, category]);

  // Stats
  const upcomingCount = upcomingAlerts?.length || 0;
  const highImpactCount = upcomingAlerts?.filter((a) => a.impact === "high").length || 0;
  const nextAlert = upcomingAlerts?.[0];

  return (
    <div className="p-6 space-y-6">
      <PageHeader
        title="Regulatory Calendar"
        description="Track CMS regulatory changes, enrollment periods, compliance deadlines, and filing dates that affect Medicare plans."
        badge="Compliance"
        helpText="Stay ahead of key CMS dates. High-impact events are highlighted in red. Use the category filter to focus on enrollment periods, compliance deadlines, filing requirements, or benefit changes."
      />

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100">
                <Calendar className="h-5 w-5 text-blue-700" />
              </div>
              <div>
                <div className="text-2xl font-bold">{upcomingCount}</div>
                <div className="text-xs text-muted-foreground">Upcoming (180 days)</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-100">
                <AlertTriangle className="h-5 w-5 text-red-700" />
              </div>
              <div>
                <div className="text-2xl font-bold">{highImpactCount}</div>
                <div className="text-xs text-muted-foreground">High Impact Upcoming</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100">
                <Clock className="h-5 w-5 text-green-700" />
              </div>
              <div>
                <div className="text-2xl font-bold">
                  {nextAlert
                    ? `${Math.ceil((new Date(nextAlert.date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))} days`
                    : "N/A"}
                </div>
                <div className="text-xs text-muted-foreground truncate">
                  {nextAlert ? `Until: ${nextAlert.title}` : "No upcoming events"}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            <SelectItem value="enrollment">Enrollment</SelectItem>
            <SelectItem value="compliance">Compliance</SelectItem>
            <SelectItem value="filing">Filing</SelectItem>
            <SelectItem value="benefits">Benefits</SelectItem>
            <SelectItem value="quality">Quality</SelectItem>
          </SelectContent>
        </Select>

        <Tabs value={view} onValueChange={(v) => setView(v as "timeline" | "calendar")} className="ml-auto">
          <TabsList>
            <TabsTrigger value="timeline">Timeline</TabsTrigger>
            <TabsTrigger value="calendar">By Month</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      )}

      {/* Timeline View */}
      {view === "timeline" && filteredAlerts.length > 0 && (
        <div className="space-y-3">
          {filteredAlerts.map((alert) => (
            <AlertCard key={alert.id} alert={alert} />
          ))}
        </div>
      )}

      {/* Calendar View */}
      {view === "calendar" && filteredCalendar.length > 0 && (
        <div className="space-y-6">
          {filteredCalendar.map((month) => (
            <div key={month.month}>
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                {month.month}
                <Badge variant="secondary" className="text-xs ml-1">
                  {month.alerts.length} event{month.alerts.length !== 1 ? "s" : ""}
                </Badge>
              </h2>
              <div className="space-y-2 ml-6 border-l-2 border-muted pl-4">
                {month.alerts.map((alert) => (
                  <AlertCard key={alert.id} alert={alert} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && filteredAlerts.length === 0 && view === "timeline" && (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No regulatory alerts match the current filter.
          </CardContent>
        </Card>
      )}
    </div>
  );
}
