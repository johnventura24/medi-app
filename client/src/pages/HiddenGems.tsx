import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Gem,
  Star,
  TrendingUp,
  MapPin,
  Building,
  Bus,
  UtensilsCrossed,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Sparkles,
  AlertCircle,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/PageHeader";

// ── State Options ──

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS","KY","LA",
  "ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY","NC","ND","OH","OK",
  "OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV","WI","WY","DC","PR","GU","VI","AS","MP",
];

// ── Gem Score Visual ──

function GemScoreBadge({ score }: { score: number }) {
  const color = score >= 80
    ? "bg-gradient-to-r from-violet-500 to-fuchsia-500"
    : score >= 60
      ? "bg-gradient-to-r from-blue-500 to-cyan-500"
      : "bg-gradient-to-r from-slate-500 to-zinc-500";

  return (
    <div className={cn("flex items-center gap-1.5 px-3 py-1.5 rounded-full text-white font-bold text-sm", color)}>
      <Gem className="h-4 w-4" />
      {score}
    </div>
  );
}

// ── Rank Badge ──

function RankBadge({ rank, total, label }: { rank: number; total: number; label: string }) {
  if (rank <= 0 || rank > total) return null;
  const pct = total > 0 ? Math.round((rank / total) * 100) : 100;

  return (
    <Badge
      variant="secondary"
      className={cn(
        "text-xs",
        pct <= 5 ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300" :
        pct <= 15 ? "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300" :
        ""
      )}
    >
      #{rank} in {label}
    </Badge>
  );
}

// ── Gem Card ──

function GemCard({ gem, index }: { gem: any; index: number }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.4 }}
    >
      <Card className="overflow-hidden hover:shadow-xl transition-all border-2 border-transparent hover:border-violet-200 dark:hover:border-violet-800">
        {/* Header gradient */}
        <div className="h-1.5 bg-gradient-to-r from-violet-500 via-fuchsia-500 to-pink-500" />

        <CardContent className="p-5">
          {/* Top row: gem score + market share */}
          <div className="flex items-start justify-between mb-3">
            <GemScoreBadge score={gem.gemScore} />
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Carrier Market Share</p>
              <p className="text-sm font-mono font-semibold text-muted-foreground">
                {gem.carrierMarketShare}%
              </p>
            </div>
          </div>

          {/* Plan name + carrier */}
          <h3 className="font-bold text-base mb-0.5 line-clamp-2">{gem.plan.name}</h3>
          <div className="flex items-center gap-2 mb-3">
            <Building className="h-3 w-3 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">{gem.plan.carrier}</span>
          </div>

          {/* Why it's a gem */}
          <div className="space-y-1.5 mb-4">
            {gem.whyItsAGem.slice(0, expanded ? undefined : 3).map((reason: string, i: number) => (
              <div key={i} className="flex items-start gap-2">
                <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />
                <span className="text-sm text-emerald-700 dark:text-emerald-300">{reason}</span>
              </div>
            ))}
          </div>

          {/* Key metrics grid */}
          <div className="grid grid-cols-4 gap-2 text-center mb-3">
            <div className="bg-muted/50 rounded-lg p-2">
              <p className="text-xs text-muted-foreground">Premium</p>
              <p className="font-bold text-sm">${gem.plan.premium}</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-2">
              <p className="text-xs text-muted-foreground">Dental</p>
              <p className="font-bold text-sm">${gem.plan.dental.toLocaleString()}</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-2">
              <p className="text-xs text-muted-foreground">OTC/yr</p>
              <p className="font-bold text-sm">${gem.plan.otcAnnual.toLocaleString()}</p>
            </div>
            <div className="bg-muted/50 rounded-lg p-2">
              <p className="text-xs text-muted-foreground">Stars</p>
              <p className="font-bold text-sm flex items-center justify-center gap-0.5">
                {gem.plan.starRating > 0 ? (
                  <>
                    <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                    {gem.plan.starRating}
                  </>
                ) : (
                  <span className="text-muted-foreground">N/A</span>
                )}
              </p>
            </div>
          </div>

          {/* Rank badges */}
          <div className="flex flex-wrap gap-1.5 mb-3">
            <RankBadge rank={gem.benefitRank.overall} total={gem.benefitRank.totalInCounty} label="overall" />
            <RankBadge rank={gem.benefitRank.dental} total={gem.benefitRank.totalInCounty} label="dental" />
            <RankBadge rank={gem.benefitRank.otc} total={gem.benefitRank.totalInCounty} label="OTC" />
            <RankBadge rank={gem.benefitRank.premium} total={gem.benefitRank.totalInCounty} label="value" />
          </div>

          {/* County info + extra features */}
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {gem.plan.county}, {gem.plan.state}
            </span>
            {gem.plan.hasTransportation && (
              <span className="flex items-center gap-1">
                <Bus className="h-3 w-3 text-blue-500" /> Transport
              </span>
            )}
            {gem.plan.hasMeals && (
              <span className="flex items-center gap-1">
                <UtensilsCrossed className="h-3 w-3 text-orange-500" /> Meals
              </span>
            )}
          </div>

          {gem.whyItsAGem.length > 3 && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full mt-2 text-xs"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? <ChevronUp className="h-3 w-3 mr-1" /> : <ChevronDown className="h-3 w-3 mr-1" />}
              {expanded ? "Show Less" : `+${gem.whyItsAGem.length - 3} more reasons`}
            </Button>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ── Main Page ──

export default function HiddenGems() {
  const [selectedState, setSelectedState] = useState<string>("");

  const { data, isLoading, isError } = useQuery({
    queryKey: ["/api/gems", selectedState],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (selectedState) params.set("state", selectedState);
      params.set("limit", "20");
      const res = await fetch(`/api/gems?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    enabled: !!selectedState,
  });

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      <PageHeader
        title="Hidden Gems"
        description="Plans in the top 10% of benefits from carriers with less than 10% market share. The plans nobody's talking about."
        helpText="These are objectively great plans from smaller carriers that most agents overlook. Gem score = benefit quality x inverse market share."
      />
      {/* Hero */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center space-y-3"
      >
        <div className="inline-flex items-center gap-2 bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 px-4 py-1.5 rounded-full text-sm font-medium">
          <Gem className="h-4 w-4" />
          Hidden Gems
        </div>
        <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight">
          Hidden Gems{" "}
          <span className="bg-gradient-to-r from-violet-600 to-fuchsia-600 bg-clip-text text-transparent">
            Nobody's Talking About
          </span>
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          Plans in the top 10% of benefits from carriers with less than 10% market share.
          The best-kept secrets in Medicare Advantage.
        </p>
      </motion.div>

      {/* State Filter */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="flex flex-col items-center gap-4"
      >
        <div className="flex items-center gap-3">
          <Label className="text-sm font-medium">Select a State:</Label>
          <Select value={selectedState} onValueChange={setSelectedState}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Choose state..." />
            </SelectTrigger>
            <SelectContent>
              {US_STATES.map((s) => (
                <SelectItem key={s} value={s}>{s}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </motion.div>

      {/* Empty state */}
      {!selectedState && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-16"
        >
          <Gem className="h-16 w-16 text-violet-300 dark:text-violet-700 mx-auto mb-4" />
          <p className="text-lg text-muted-foreground">Select a state to discover hidden gem plans</p>
        </motion.div>
      )}

      {/* Loading */}
      {isLoading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <div className="h-1.5 bg-gradient-to-r from-violet-200 to-fuchsia-200 animate-pulse" />
              <CardContent className="p-5 space-y-3">
                <Skeleton className="h-8 w-24" />
                <Skeleton className="h-5 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-20" />
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Error */}
      {isError && (
        <Card className="max-w-lg mx-auto border-red-200 bg-red-50 dark:bg-red-950/20">
          <CardContent className="p-6 text-center">
            <AlertCircle className="h-8 w-8 text-red-500 mx-auto mb-2" />
            <p className="text-red-700 dark:text-red-300">Failed to load hidden gems. Please try again.</p>
          </CardContent>
        </Card>
      )}

      {/* Results */}
      {data && (
        <>
          {/* Summary stats */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-wrap justify-center gap-6"
          >
            <div className="text-center">
              <p className="text-3xl font-extrabold text-violet-600 dark:text-violet-400">{data.totalGems}</p>
              <p className="text-sm text-muted-foreground">Hidden Gems Found</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-extrabold">{data.countiesSearched}</p>
              <p className="text-sm text-muted-foreground">Counties Searched</p>
            </div>
            <div className="text-center">
              <p className="text-3xl font-extrabold">{data.stateName}</p>
              <p className="text-sm text-muted-foreground">State</p>
            </div>
          </motion.div>

          {data.gems.length === 0 ? (
            <div className="text-center py-12">
              <Sparkles className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-lg text-muted-foreground">
                No hidden gems found in this state. All top plans are from major carriers.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              {data.gems.map((gem: any, idx: number) => (
                <GemCard key={gem.plan.id} gem={gem} index={idx} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

// Quick Label import
function Label({ children, className }: { children: React.ReactNode; className?: string }) {
  return <label className={cn("text-sm font-medium", className)}>{children}</label>;
}
