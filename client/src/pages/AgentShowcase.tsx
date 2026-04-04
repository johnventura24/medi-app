import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { motion, useInView } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  Diamond,
  ArrowRight,
  Menu,
  X,
  Stethoscope,
  Search,
  GitCompare,
  Calculator,
  Brain,
  Shield,
  Gem,
  CalendarCheck,
  Globe,
  MapPin,
  Hash,
  BarChart3,
  Map,
  TrendingUp,
  Swords,
  Clock,
  Award,
  AlertTriangle,
  Repeat,
  FileSpreadsheet,
  Table2,
  FileText,
  BookOpen,
  Scale,
  Users,
  Megaphone,
  HeartPulse,
  CheckCircle,
  type LucideIcon,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Animated counter                                                   */
/* ------------------------------------------------------------------ */
function AnimatedCounter({ end, duration = 2000 }: { end: number; duration?: number }) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true });

  useEffect(() => {
    if (!inView) return;
    let start = 0;
    const increment = end / (duration / 16);
    const timer = setInterval(() => {
      start += increment;
      if (start >= end) {
        setCount(end);
        clearInterval(timer);
      } else {
        setCount(Math.floor(start));
      }
    }, 16);
    return () => clearInterval(timer);
  }, [inView, end, duration]);

  return <span ref={ref}>{count.toLocaleString()}</span>;
}

/* ------------------------------------------------------------------ */
/*  Fade-in wrapper                                                    */
/* ------------------------------------------------------------------ */
function FadeIn({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.6, delay, ease: "easeOut" }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

/* ------------------------------------------------------------------ */
/*  Nav                                                                */
/* ------------------------------------------------------------------ */
function ShowcaseNav() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
              <Diamond className="h-4.5 w-4.5 text-primary-foreground" />
            </div>
            <span className="font-semibold text-lg">Prism</span>
          </Link>

          <div className="hidden md:flex items-center gap-6">
            <Link href="/for-you" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Find My Plan
            </Link>
            <Link href="/pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Pricing
            </Link>
            <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Login
            </Link>
            <Link href="/register">
              <Button size="sm">Get Started</Button>
            </Link>
          </div>

          <button className="md:hidden p-2" onClick={() => setMobileOpen(!mobileOpen)}>
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {mobileOpen && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="md:hidden border-t bg-background"
        >
          <div className="flex flex-col gap-1 p-4">
            <Link href="/for-you" className="py-2 text-sm text-muted-foreground hover:text-foreground">Find My Plan</Link>
            <Link href="/pricing" className="py-2 text-sm text-muted-foreground hover:text-foreground">Pricing</Link>
            <Link href="/login" className="py-2 text-sm text-muted-foreground hover:text-foreground">Login</Link>
            <Link href="/register">
              <Button size="sm" className="mt-2 w-full">Get Started</Button>
            </Link>
          </div>
        </motion.div>
      )}
    </nav>
  );
}

/* ------------------------------------------------------------------ */
/*  Tool card                                                          */
/* ------------------------------------------------------------------ */
interface ToolDef {
  icon: LucideIcon;
  label: string;
  desc: string;
  href: string;
}

function ToolCard({ tool, index }: { tool: ToolDef; index: number }) {
  return (
    <FadeIn delay={index * 0.05}>
      <Link href={tool.href}>
        <motion.div
          whileHover={{ y: -4 }}
          transition={{ type: "spring", stiffness: 300 }}
          className="group flex items-start gap-3 p-4 rounded-xl border bg-card hover:shadow-md hover:border-primary/30 transition-all cursor-pointer h-full"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 shrink-0">
            <tool.icon className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-sm group-hover:text-primary transition-colors">{tool.label}</p>
            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">{tool.desc}</p>
          </div>
          <ArrowRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1 opacity-0 group-hover:opacity-100 transition-opacity" />
        </motion.div>
      </Link>
    </FadeIn>
  );
}

/* ------------------------------------------------------------------ */
/*  Tool categories                                                    */
/* ------------------------------------------------------------------ */
interface ToolCategory {
  title: string;
  description: string;
  tools: ToolDef[];
}

const toolCategories: ToolCategory[] = [
  {
    title: "Find & Compare",
    description: "Match beneficiaries to their best plan",
    tools: [
      { icon: Stethoscope, label: "Keep My Doctor", desc: "Find plans that include your doctors with network confidence scoring", href: "/keep-my-doctor" },
      { icon: Search, label: "Plan Finder", desc: "Search 171K+ plans by 15+ benefit criteria with ZIP code filtering", href: "/find" },
      { icon: GitCompare, label: "Compare Plans", desc: "Side-by-side comparison of up to 6 plans with best/worst highlighting", href: "/compare" },
      { icon: Calculator, label: "Money Calculator", desc: "Calculate exactly how much a beneficiary is leaving on the table", href: "/calculator" },
      { icon: Brain, label: "Smart Match", desc: "AI-powered plan matching — pick priorities, get ranked results", href: "/smart-match" },
      { icon: Shield, label: "Eligibility Check", desc: "Determine MA, PDP, Medigap, D-SNP, and C-SNP eligibility instantly", href: "/eligibility" },
      { icon: Gem, label: "Hidden Gems", desc: "Top-10% benefit plans from carriers with under 10% market share", href: "/gems" },
      { icon: CalendarCheck, label: "SEP Checker", desc: "Check 9 Special Enrollment Period types with agent scripts", href: "/sep/check" },
    ],
  },
  {
    title: "Market Intelligence",
    description: "Competitive analysis and opportunity discovery",
    tools: [
      { icon: BarChart3, label: "Market Intelligence", desc: "Underserved markets, competitive gaps, and marketing opportunities", href: "/intelligence" },
      { icon: Map, label: "Battleground Map", desc: "Interactive carrier territory map — click any state or county", href: "/battleground" },
      { icon: TrendingUp, label: "Carrier Movements", desc: "Track carrier expansion, exits, and market footprint changes", href: "/carrier-movements" },
      { icon: Swords, label: "AEP War Room", desc: "Real-time enrollment period command center with hot plans and alerts", href: "/warroom" },
      { icon: Clock, label: "Trends & Timeline", desc: "Historical carrier, benefit, and market trend analysis", href: "/trends" },
      { icon: Award, label: "Carrier Scorecards", desc: "Carrier performance metrics, star ratings, and growth trajectory", href: "/scorecards" },
      { icon: AlertTriangle, label: "Disruption Alerts", desc: "At-risk plans, terminations, and affected member counts", href: "/disruptions" },
      { icon: Repeat, label: "Crosswalk Tracker", desc: "CMS plan crosswalks — terminations, consolidations, area changes", href: "/crosswalk" },
    ],
  },
  {
    title: "Explore Geography",
    description: "Drill into state, county, and ZIP-level data",
    tools: [
      { icon: Globe, label: "State Overview", desc: "National heatmap of benefit intensity across all 56 states/territories", href: "/dashboard/states" },
      { icon: MapPin, label: "County Reports", desc: "Plan availability and carrier dominance at the county level", href: "/cities" },
      { icon: Hash, label: "ZIP Rankings", desc: "ZIP codes ranked by plan density and benefit richness", href: "/zips" },
    ],
  },
  {
    title: "Compliance & Exports",
    description: "Compliance-ready documents and data validation",
    tools: [
      { icon: FileSpreadsheet, label: "Benefit Grid", desc: "Generate carrier compliance grids matching CMS submission templates", href: "/benefit-grid" },
      { icon: Table2, label: "Matrix View", desc: "Side-by-side benefit grid for a carrier across counties", href: "/matrix" },
      { icon: FileText, label: "Change Report", desc: "Year-over-year plan changes for ANOC season and retention", href: "/changes" },
      { icon: BookOpen, label: "Plan Cheatsheets", desc: "One-page printable carrier comparison grids for appointments", href: "/cheatsheets" },
      { icon: Scale, label: "Regulatory Calendar", desc: "CMS deadlines, filing dates, and enrollment period dates", href: "/regulatory" },
      { icon: CheckCircle, label: "Data Validation", desc: "Automated quality checks against CMS rules", href: "/validation" },
    ],
  },
  {
    title: "Sales Pipelines",
    description: "Find and target high-value beneficiary segments",
    tools: [
      { icon: Users, label: "Turning 65 Pipeline", desc: "New Medicare enrollees by county — target highest-volume IEP markets", href: "/pipeline/turning-65" },
      { icon: Megaphone, label: "OEP Outreach", desc: "MA members on below-average plans ripe for switching during OEP", href: "/pipeline/oep-remorse" },
      { icon: HeartPulse, label: "D-SNP Pipeline", desc: "Dual-eligible beneficiaries with monthly plan change opportunities", href: "/pipeline/dsnp" },
    ],
  },
];

/* ------------------------------------------------------------------ */
/*  Agent Showcase Page                                                */
/* ------------------------------------------------------------------ */
export default function AgentShowcase() {
  const { data: summary } = useQuery<{ totalPlans: number; totalCarriers: number; totalStates: number; totalCities: number }>({
    queryKey: ["/api/summary"],
    queryFn: async () => {
      const res = await fetch("/api/summary");
      if (!res.ok) return { totalPlans: 171906, totalCarriers: 301, totalStates: 56, totalCities: 1934 };
      return res.json();
    },
  });

  const stats = summary || { totalPlans: 171906, totalCarriers: 301, totalStates: 56, totalCities: 1934 };

  return (
    <div className="min-h-screen bg-background">
      <ShowcaseNav />

      {/* Hero */}
      <section className="relative pt-28 pb-12 px-4 overflow-hidden">
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-20 left-1/3 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
          <div className="absolute top-40 right-1/3 w-80 h-80 bg-violet-500/5 rounded-full blur-3xl" />
        </div>

        <div className="max-w-5xl mx-auto text-center">
          <FadeIn>
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold tracking-tight mb-4">
              47+ Tools.{" "}
              <span className="bg-gradient-to-r from-primary to-violet-600 bg-clip-text text-transparent">
                Zero Guesswork.
              </span>
            </h1>
          </FadeIn>
          <FadeIn delay={0.1}>
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
              Every tool is powered by real CMS data. Click any tool to start using it immediately — no login required.
            </p>
          </FadeIn>

          {/* Live stats */}
          <FadeIn delay={0.2}>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl mx-auto">
              {[
                { label: "Plans", value: stats.totalPlans },
                { label: "Carriers", value: stats.totalCarriers },
                { label: "States", value: stats.totalStates },
                { label: "Counties", value: stats.totalCities },
              ].map((s) => (
                <div key={s.label} className="bg-card border rounded-xl p-4">
                  <p className="text-2xl font-bold text-primary">
                    <AnimatedCounter end={s.value} duration={1200} />
                  </p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              ))}
            </div>
          </FadeIn>
        </div>
      </section>

      {/* Tool Categories */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pb-16 space-y-12">
        {toolCategories.map((category) => (
          <div key={category.title}>
            <FadeIn>
              <div className="mb-5">
                <h2 className="text-xl font-bold">{category.title}</h2>
                <p className="text-sm text-muted-foreground">{category.description}</p>
              </div>
            </FadeIn>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {category.tools.map((tool, i) => (
                <ToolCard key={tool.href} tool={tool} index={i} />
              ))}
            </div>
          </div>
        ))}
      </section>

      {/* Soft CTA */}
      <FadeIn>
        <section className="bg-primary text-primary-foreground py-16 px-4">
          <div className="max-w-3xl mx-auto text-center">
            <h2 className="text-2xl sm:text-3xl font-bold mb-4">
              Ready for client management, SOA tracking, and lead capture?
            </h2>
            <p className="text-primary-foreground/80 mb-8 max-w-xl mx-auto">
              Create a free account to unlock the full agent suite — manage clients, track compliance, capture consumer leads, and more.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/register">
                <Button size="lg" variant="secondary" className="text-base px-8">
                  Create Free Account
                </Button>
              </Link>
              <Link href="/welcome">
                <Button size="lg" variant="outline" className="text-base px-8 border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10">
                  Learn More
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </FadeIn>

      {/* Footer */}
      <footer className="border-t bg-muted/30">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
            <div className="flex items-center gap-2.5">
              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary">
                <Diamond className="h-4 w-4 text-primary-foreground" />
              </div>
              <span className="font-semibold">Prism</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-muted-foreground">
              <Link href="/" className="hover:text-foreground transition-colors">Home</Link>
              <Link href="/for-you" className="hover:text-foreground transition-colors">Find My Plan</Link>
              <Link href="/pricing" className="hover:text-foreground transition-colors">Pricing</Link>
              <Link href="/privacy" className="hover:text-foreground transition-colors">Privacy</Link>
              <Link href="/terms" className="hover:text-foreground transition-colors">Terms</Link>
            </div>
          </div>
          <div className="border-t pt-4">
            <p className="text-xs text-muted-foreground leading-relaxed max-w-4xl mx-auto text-center mb-3">
              We do not offer every plan available in your area. Currently we represent
              organizations which offer products in your area. Please contact{" "}
              <a href="https://www.medicare.gov" target="_blank" rel="noopener noreferrer" className="underline hover:text-foreground">
                Medicare.gov
              </a>
              , 1-800-MEDICARE, or your local State Health Insurance Assistance Program
              (SHIP) to get information on all of your options.
            </p>
            <p className="text-xs text-muted-foreground text-center">
              &copy; 2026 Prism. Powered by CMS CY2026 PBP data.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
