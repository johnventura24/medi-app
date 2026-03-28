import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  Legend,
} from "recharts";
import {
  Users,
  Search,
  Star,
  ChevronDown,
  ChevronUp,
  MapPin,
  Lightbulb,
  AlertCircle,
  Sparkles,
  DollarSign,
  Bus,
  UtensilsCrossed,
  Home,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/PageHeader";

// ── Pie Chart Colors ──

const ARCHETYPE_COLORS = [
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#f59e0b", // amber
  "#10b981", // emerald
  "#3b82f6", // blue
  "#f97316", // orange
];

// ── Plan Match Card ──

function MatchCard({ match, archId }: { match: any; archId: string }) {
  return (
    <div className="bg-muted/40 rounded-lg p-3 space-y-2">
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm line-clamp-1">{match.name}</p>
          <p className="text-xs text-muted-foreground">{match.carrier}</p>
        </div>
        <Badge variant="outline" className="shrink-0 ml-2 text-xs">
          Score: {match.matchScore}
        </Badge>
      </div>

      <div className="grid grid-cols-3 gap-2 text-xs">
        <div>
          <p className="text-muted-foreground">Premium</p>
          <p className="font-semibold">${match.premium}/mo</p>
        </div>
        <div>
          <p className="text-muted-foreground">Dental</p>
          <p className="font-semibold">${match.dental.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-muted-foreground">OTC/yr</p>
          <p className="font-semibold">${match.otcAnnual.toLocaleString()}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1">
        {match.starRating > 0 && (
          <Badge variant="secondary" className="text-xs gap-0.5">
            <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
            {match.starRating}
          </Badge>
        )}
        {match.hasTransportation && (
          <Badge variant="secondary" className="text-xs gap-0.5">
            <Bus className="h-3 w-3" /> Transport
          </Badge>
        )}
        {match.hasMeals && (
          <Badge variant="secondary" className="text-xs gap-0.5">
            <UtensilsCrossed className="h-3 w-3" /> Meals
          </Badge>
        )}
        {match.hasInHomeSupport && (
          <Badge variant="secondary" className="text-xs gap-0.5">
            <Home className="h-3 w-3" /> In-Home
          </Badge>
        )}
        {match.partbGiveback > 0 && (
          <Badge variant="secondary" className="text-xs gap-0.5 text-emerald-700 bg-emerald-100 dark:text-emerald-300 dark:bg-emerald-900/30">
            <DollarSign className="h-3 w-3" /> Giveback
          </Badge>
        )}
      </div>
    </div>
  );
}

// ── Archetype Card ──

function ArchetypeCard({ result, index, totalPlans }: {
  result: any;
  index: number;
  totalPlans: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const arch = result.archetype;
  const hasMatches = result.matchCount > 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, duration: 0.4 }}
    >
      <Card className={cn(
        "overflow-hidden transition-all hover:shadow-lg",
        hasMatches ? "border-2 border-transparent hover:border-violet-200 dark:hover:border-violet-800" : "opacity-60"
      )}>
        <CardContent className="p-5">
          {/* Header */}
          <div className="flex items-start gap-4 mb-4">
            <div className="text-4xl">{arch.emoji}</div>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-lg">{arch.name}</h3>
              <p className="text-sm text-muted-foreground">{arch.description}</p>
            </div>
          </div>

          {/* Stats */}
          <div className="flex items-center gap-4 mb-4">
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium">
                  <span className="text-2xl font-extrabold text-violet-600 dark:text-violet-400">
                    {result.matchCount}
                  </span>
                  <span className="text-muted-foreground ml-1">plans match</span>
                </span>
                <span className="text-sm text-muted-foreground">{result.pctOfPlans}%</span>
              </div>
              <Progress
                value={result.pctOfPlans}
                className="h-2 [&>div]:bg-violet-500"
              />
            </div>
          </div>

          {/* Top matches */}
          {hasMatches && (
            <>
              <div className="space-y-2">
                {result.topMatches
                  .slice(0, expanded ? undefined : 1)
                  .map((match: any) => (
                    <MatchCard key={match.id} match={match} archId={arch.id} />
                  ))}
              </div>

              {result.topMatches.length > 1 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full mt-2 text-xs"
                  onClick={() => setExpanded(!expanded)}
                >
                  {expanded ? (
                    <>
                      <ChevronUp className="h-3 w-3 mr-1" /> Show Less
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-3 w-3 mr-1" />
                      Show {result.topMatches.length - 1} More Match{result.topMatches.length > 2 ? "es" : ""}
                    </>
                  )}
                </Button>
              )}
            </>
          )}

          {!hasMatches && (
            <p className="text-sm text-muted-foreground italic text-center py-3">
              No matching plans in this area
            </p>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ── Custom Pie Label ──

function PieLabel({ cx, cy, midAngle, innerRadius, outerRadius, name, pct }: any) {
  if (pct < 5) return null;
  const RADIAN = Math.PI / 180;
  const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
  const x = cx + radius * Math.cos(-midAngle * RADIAN);
  const y = cy + radius * Math.sin(-midAngle * RADIAN);

  return (
    <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize="12" fontWeight="bold">
      {pct}%
    </text>
  );
}

// ── Main Page ──

export default function Archetypes() {
  const [input, setInput] = useState("");
  const [searchValue, setSearchValue] = useState("");

  const isZip = /^\d{5}$/.test(searchValue);

  const { data, isLoading, isError } = useQuery({
    queryKey: ["/api/archetypes", searchValue],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (isZip) {
        params.set("zip", searchValue);
      } else {
        // Treat as state abbreviation
        params.set("state", searchValue);
      }
      const res = await fetch(`/api/archetypes?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: searchValue.length >= 2,
  });

  const handleSearch = () => {
    if (input.trim().length >= 2) {
      setSearchValue(input.trim().toUpperCase());
    }
  };

  const profile = data?.countyProfile;
  const pieData = profile?.distribution
    ?.filter((d: any) => d.pct > 0)
    ?.map((d: any) => ({
      name: d.emoji + " " + d.name.replace("The ", ""),
      value: d.pct,
      pct: d.pct,
      count: d.count,
    })) || [];

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      <PageHeader
        title="Beneficiary Archetypes"
        description="Six common Medicare beneficiary profiles with ideal plan matches for each."
        helpText="Enter a ZIP to see which archetypes are most common in that area and the top 3 plans for each type."
      />
      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-3"
      >
        <div className="inline-flex items-center gap-2 bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 px-4 py-1.5 rounded-full text-sm font-medium">
          <Users className="h-4 w-4" />
          Beneficiary Archetypes
        </div>
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight">
          Who Lives Here?{" "}
          <span className="bg-gradient-to-r from-violet-600 to-pink-600 bg-clip-text text-transparent">
            Beneficiary Archetypes
          </span>
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Understand your market through 6 beneficiary profiles. Enter a ZIP code or state
          to see which archetypes dominate and find the best-fit plans.
        </p>
      </motion.div>

      {/* Search Input */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="flex justify-center"
      >
        <div className="flex gap-2 w-full max-w-md">
          <div className="relative flex-1">
            <MapPin className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="ZIP code (33139) or state (FL)"
              className="pl-10"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
          </div>
          <Button
            className="bg-violet-600 hover:bg-violet-700 text-white"
            onClick={handleSearch}
            disabled={input.trim().length < 2}
          >
            <Search className="h-4 w-4 mr-2" />
            Analyze
          </Button>
        </div>
      </motion.div>

      {/* Empty state */}
      {!searchValue && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-16"
        >
          <Users className="h-16 w-16 text-violet-300 dark:text-violet-700 mx-auto mb-4" />
          <p className="text-lg text-muted-foreground">Enter a ZIP or state to discover beneficiary archetypes</p>
          <div className="flex justify-center gap-3 mt-6 flex-wrap">
            {["33139", "10001", "90210", "60601", "FL", "TX", "CA"].map((ex) => (
              <Button
                key={ex}
                variant="outline"
                size="sm"
                onClick={() => {
                  setInput(ex);
                  setSearchValue(ex);
                }}
              >
                {ex}
              </Button>
            ))}
          </div>
        </motion.div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Card key={i}>
                <CardContent className="p-5 space-y-3">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="space-y-1 flex-1">
                      <Skeleton className="h-5 w-3/4" />
                      <Skeleton className="h-3 w-full" />
                    </div>
                  </div>
                  <Skeleton className="h-16" />
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Error */}
      {isError && (
        <Card className="max-w-lg mx-auto border-red-200 bg-red-50 dark:bg-red-950/20">
          <CardContent className="p-6 text-center">
            <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
            <p className="text-red-700 dark:text-red-300">
              Failed to load archetypes. Try a different ZIP or state.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {data && (
        <>
          {/* County header */}
          {profile && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center"
            >
              <div className="flex flex-wrap items-center justify-center gap-6">
                <div>
                  <p className="text-3xl font-extrabold">{profile.totalPlans}</p>
                  <p className="text-sm text-muted-foreground">Total Plans</p>
                </div>
                {profile.county && (
                  <div>
                    <p className="text-3xl font-extrabold">{profile.county}</p>
                    <p className="text-sm text-muted-foreground">{profile.state}</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}

          {/* Archetype Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {data.archetypes
              ?.sort((a: any, b: any) => b.matchCount - a.matchCount)
              .map((result: any, idx: number) => (
                <ArchetypeCard
                  key={result.archetype.id}
                  result={result}
                  index={idx}
                  totalPlans={profile?.totalPlans || 0}
                />
              ))}
          </div>

          {/* County Profile Section */}
          {profile && pieData.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.6 }}
            >
              <Card className="overflow-hidden">
                <div className="h-1.5 bg-gradient-to-r from-violet-500 via-pink-500 to-amber-500" />
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-violet-500" />
                    County Profile: {profile.county}, {profile.state}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    {/* Pie Chart */}
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={pieData}
                            cx="50%"
                            cy="50%"
                            outerRadius={120}
                            innerRadius={50}
                            paddingAngle={2}
                            dataKey="value"
                            label={PieLabel}
                            labelLine={false}
                          >
                            {pieData.map((_: any, index: number) => (
                              <Cell
                                key={index}
                                fill={ARCHETYPE_COLORS[index % ARCHETYPE_COLORS.length]}
                              />
                            ))}
                          </Pie>
                          <RechartsTooltip
                            formatter={(value: any, name: any) => [`${value}%`, name]}
                          />
                          <Legend />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>

                    {/* Distribution bars + recommendation */}
                    <div className="space-y-4">
                      <h4 className="font-semibold">Archetype Distribution</h4>
                      {profile.distribution
                        ?.filter((d: any) => d.pct > 0)
                        .map((d: any, i: number) => (
                          <div key={d.id} className="space-y-1">
                            <div className="flex items-center justify-between text-sm">
                              <span>
                                {d.emoji} {d.name.replace("The ", "")}
                              </span>
                              <span className="font-semibold">{d.pct}% ({d.count} plans)</span>
                            </div>
                            <div className="h-2 bg-muted rounded-full overflow-hidden">
                              <motion.div
                                className="h-full rounded-full"
                                style={{ backgroundColor: ARCHETYPE_COLORS[i % ARCHETYPE_COLORS.length] }}
                                initial={{ width: 0 }}
                                animate={{ width: `${d.pct}%` }}
                                transition={{ delay: 0.8 + i * 0.1, duration: 0.6 }}
                              />
                            </div>
                          </div>
                        ))}

                      {/* Marketing recommendation */}
                      {profile.recommendation && (
                        <div className="mt-6 p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
                          <div className="flex items-start gap-3">
                            <Lightbulb className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                            <div>
                              <p className="font-semibold text-sm text-amber-800 dark:text-amber-300 mb-1">
                                Marketing Recommendation
                              </p>
                              <p className="text-sm text-amber-700 dark:text-amber-400">
                                {profile.recommendation}
                              </p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </>
      )}
    </div>
  );
}
