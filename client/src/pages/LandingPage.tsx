import { useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { motion, useInView } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Search,
  Calculator,
  FileSpreadsheet,
  TrendingUp,
  Brain,
  Users,
  Target,
  ArrowRight,
  Check,
  Clock,
  AlertTriangle,
  Eye,
  ChevronRight,
  Menu,
  X,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Animated counter                                                   */
/* ------------------------------------------------------------------ */
function AnimatedCounter({ end, duration = 2000, suffix = "" }: { end: number; duration?: number; suffix?: string }) {
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

  return (
    <span ref={ref}>
      {count.toLocaleString()}
      {suffix}
    </span>
  );
}

/* ------------------------------------------------------------------ */
/*  Fade-in section wrapper                                            */
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
/*  Navbar                                                             */
/* ------------------------------------------------------------------ */
function LandingNav() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-lg border-b">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
              <Target className="h-4.5 w-4.5 text-primary-foreground" />
            </div>
            <span className="font-semibold text-lg">MediApp</span>
          </Link>

          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Features
            </a>
            <Link href="/pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Pricing
            </Link>
            <Link href="/for-you" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Consumer Tool
            </Link>
            <Link href="/login" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Login
            </Link>
            <Link href="/register">
              <Button size="sm">Start Free Trial</Button>
            </Link>
          </div>

          {/* Mobile hamburger */}
          <button className="md:hidden p-2" onClick={() => setMobileOpen(!mobileOpen)}>
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="md:hidden border-t bg-background"
        >
          <div className="flex flex-col gap-1 p-4">
            <a href="#features" onClick={() => setMobileOpen(false)} className="py-2 text-sm text-muted-foreground hover:text-foreground">Features</a>
            <Link href="/pricing" className="py-2 text-sm text-muted-foreground hover:text-foreground">Pricing</Link>
            <Link href="/for-you" className="py-2 text-sm text-muted-foreground hover:text-foreground">Consumer Tool</Link>
            <Link href="/login" className="py-2 text-sm text-muted-foreground hover:text-foreground">Login</Link>
            <Link href="/register">
              <Button size="sm" className="mt-2 w-full">Start Free Trial</Button>
            </Link>
          </div>
        </motion.div>
      )}
    </nav>
  );
}

/* ------------------------------------------------------------------ */
/*  Feature card data                                                  */
/* ------------------------------------------------------------------ */
const features = [
  {
    icon: Search,
    title: "Plan Finder",
    description: "Search 171K plans by 15+ criteria. Match clients in 3 minutes.",
  },
  {
    icon: Calculator,
    title: "Money Calculator",
    description: "Show clients exactly how much they're leaving on the table.",
  },
  {
    icon: FileSpreadsheet,
    title: "Compliance Exports",
    description: "Benefit grids in your exact template format. One click.",
  },
  {
    icon: TrendingUp,
    title: "Market Intelligence",
    description: "See where carriers are weak. Find the gaps nobody else sees.",
  },
  {
    icon: Brain,
    title: "AI Plan Explainer",
    description: "Plain-English plan summaries. No more reading 200-page EOCs.",
  },
  {
    icon: Users,
    title: "Client Management",
    description: "Intake, scoring, recommendations, SOA tracking. All in one.",
  },
];

/* ------------------------------------------------------------------ */
/*  Pain points                                                        */
/* ------------------------------------------------------------------ */
const painPoints = [
  {
    icon: Clock,
    headline: "Medicare agents waste 30+ minutes per client",
    body: "comparing plans across 5 different tools.",
  },
  {
    icon: AlertTriangle,
    headline: "Compliance teams spend days building benefit grids",
    body: "that should take seconds.",
  },
  {
    icon: Eye,
    headline: "FMOs have no competitive intelligence",
    body: "to deploy agents effectively.",
  },
];

/* ------------------------------------------------------------------ */
/*  Stats                                                              */
/* ------------------------------------------------------------------ */
const stats = [
  "171,906 Medicare Advantage plans",
  "56 states and territories",
  "1,934 counties covered",
  "301 carriers analyzed",
  "CY2026 Plan Benefit Package data",
  "Updated for current enrollment period",
];

/* ================================================================== */
/*  MAIN COMPONENT                                                     */
/* ================================================================== */
export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <LandingNav />

      {/* ── Hero ────────────────────────────────────────────────── */}
      <section className="relative pt-32 pb-20 md:pt-44 md:pb-32 overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-green-500/5" />
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[800px] h-[800px] rounded-full bg-primary/5 blur-3xl" />
        </div>

        <div className="max-w-5xl mx-auto px-4 sm:px-6 text-center">
          <FadeIn>
            <div className="inline-flex items-center gap-2 rounded-full border bg-muted/50 px-4 py-1.5 text-sm text-muted-foreground mb-8">
              <span className="inline-block h-2 w-2 rounded-full bg-green-500 animate-pulse" />
              Powered by CMS CY2026 data
            </div>
          </FadeIn>

          <FadeIn delay={0.1}>
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.1] mb-6">
              The Medicare
              <br />
              <span className="text-primary">Intelligence Platform</span>
            </h1>
          </FadeIn>

          <FadeIn delay={0.2}>
            <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-4">
              Find the perfect plan for every client.
              <br className="hidden sm:block" />
              In seconds, not hours.
            </p>
          </FadeIn>

          <FadeIn delay={0.3}>
            <p className="text-sm text-muted-foreground mb-10 font-mono">
              <span className="text-foreground font-semibold">
                <AnimatedCounter end={171906} duration={2500} />
              </span>{" "}
              plans &middot;{" "}
              <span className="text-foreground font-semibold">
                <AnimatedCounter end={301} duration={2000} />
              </span>{" "}
              carriers &middot; Real CMS data
            </p>
          </FadeIn>

          <FadeIn delay={0.4}>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/register">
                <Button size="lg" className="text-base px-8 h-12">
                  Try Free — No Credit Card
                </Button>
              </Link>
              <Link href="/for-you">
                <Button variant="outline" size="lg" className="text-base px-8 h-12 gap-2">
                  See Demo <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ── Problem Section ─────────────────────────────────────── */}
      <section className="py-20 md:py-28 bg-muted/30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <FadeIn>
            <h2 className="text-3xl sm:text-4xl font-bold text-center mb-16">
              Medicare plan research is <span className="text-destructive">broken</span>
            </h2>
          </FadeIn>

          <div className="grid md:grid-cols-3 gap-8">
            {painPoints.map((point, i) => (
              <FadeIn key={i} delay={i * 0.15}>
                <Card className="border-none shadow-md bg-background h-full">
                  <CardContent className="pt-8 pb-8 px-6 text-center">
                    <div className="inline-flex items-center justify-center h-14 w-14 rounded-xl bg-destructive/10 mb-5">
                      <point.icon className="h-7 w-7 text-destructive" />
                    </div>
                    <h3 className="font-semibold text-lg mb-2">{point.headline}</h3>
                    <p className="text-muted-foreground text-sm">{point.body}</p>
                  </CardContent>
                </Card>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features Section ────────────────────────────────────── */}
      <section id="features" className="py-20 md:py-28 scroll-mt-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <FadeIn>
            <h2 className="text-3xl sm:text-4xl font-bold text-center mb-4">
              Everything you need to sell smarter
            </h2>
            <p className="text-center text-muted-foreground mb-16 max-w-2xl mx-auto">
              One platform replaces the 5 tools your team juggles today.
            </p>
          </FadeIn>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, i) => (
              <FadeIn key={i} delay={i * 0.1}>
                <motion.div whileHover={{ y: -4 }} transition={{ type: "spring", stiffness: 300 }}>
                  <Card className="h-full border shadow-sm hover:shadow-lg transition-shadow duration-300">
                    <CardContent className="pt-8 pb-8 px-6">
                      <div className="inline-flex items-center justify-center h-12 w-12 rounded-lg bg-primary/10 mb-4">
                        <feature.icon className="h-6 w-6 text-primary" />
                      </div>
                      <h3 className="font-semibold text-lg mb-2">{feature.title}</h3>
                      <p className="text-muted-foreground text-sm leading-relaxed">{feature.description}</p>
                    </CardContent>
                  </Card>
                </motion.div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── Social Proof / Stats ────────────────────────────────── */}
      <section className="py-20 md:py-28 bg-muted/30">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center">
          <FadeIn>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Powered by Real CMS Data</h2>
            <p className="text-muted-foreground mb-12">
              Not estimates. Not projections. The actual plan benefit package data from CMS.
            </p>
          </FadeIn>

          <div className="grid sm:grid-cols-2 gap-x-12 gap-y-4 text-left max-w-2xl mx-auto">
            {stats.map((stat, i) => (
              <FadeIn key={i} delay={i * 0.08}>
                <div className="flex items-center gap-3 py-2">
                  <Check className="h-5 w-5 text-green-500 shrink-0" />
                  <span className="text-sm">{stat}</span>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* ── Consumer Section ────────────────────────────────────── */}
      <section className="py-20 md:py-28">
        <div className="max-w-4xl mx-auto px-4 sm:px-6">
          <FadeIn>
            <Card className="border-2 border-primary/20 bg-primary/5">
              <CardContent className="py-12 px-8 sm:px-12 text-center">
                <h2 className="text-2xl sm:text-3xl font-bold mb-3">Also for Beneficiaries</h2>
                <p className="text-muted-foreground mb-2 max-w-xl mx-auto">
                  Help your clients find their best plan at{" "}
                  <span className="font-mono text-foreground text-sm">/for-you</span>
                </p>
                <p className="text-muted-foreground text-sm mb-8">
                  Free plan comparison. Real CMS data. No pressure.
                </p>
                <Link href="/for-you">
                  <Button variant="outline" size="lg" className="gap-2">
                    Try the Consumer Tool <ChevronRight className="h-4 w-4" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </FadeIn>
        </div>
      </section>

      {/* ── Final CTA ───────────────────────────────────────────── */}
      <section className="py-20 md:py-28 bg-primary text-primary-foreground">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <FadeIn>
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Ready to transform how you sell Medicare?
            </h2>
            <p className="text-primary-foreground/70 mb-10">
              14-day free trial. No credit card required.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/register">
                <Button size="lg" variant="secondary" className="text-base px-8 h-12">
                  Start Free Trial
                </Button>
              </Link>
              <Link href="/pricing">
                <Button
                  size="lg"
                  variant="outline"
                  className="text-base px-8 h-12 border-primary-foreground/30 text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
                >
                  View Pricing
                </Button>
              </Link>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────── */}
      <footer className="border-t bg-muted/30">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
          <div className="grid sm:grid-cols-2 md:grid-cols-4 gap-8 mb-10">
            {/* Brand */}
            <div>
              <div className="flex items-center gap-2.5 mb-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary">
                  <Target className="h-4 w-4 text-primary-foreground" />
                </div>
                <span className="font-semibold">MediApp</span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">
                The Medicare Intelligence Platform.
                <br />
                Powered by CMS CY2026 PBP data.
              </p>
            </div>

            {/* Product */}
            <div>
              <h4 className="font-semibold text-sm mb-3">Product</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#features" className="hover:text-foreground transition-colors">Features</a></li>
                <li><Link href="/pricing" className="hover:text-foreground transition-colors">Pricing</Link></li>
                <li><Link href="/for-you" className="hover:text-foreground transition-colors">Consumer Tool</Link></li>
              </ul>
            </div>

            {/* Account */}
            <div>
              <h4 className="font-semibold text-sm mb-3">Account</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="/login" className="hover:text-foreground transition-colors">Login</Link></li>
                <li><Link href="/register" className="hover:text-foreground transition-colors">Register</Link></li>
              </ul>
            </div>

            {/* Legal */}
            <div>
              <h4 className="font-semibold text-sm mb-3">Legal</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><span className="cursor-default">Privacy Policy</span></li>
                <li><span className="cursor-default">Terms of Service</span></li>
              </ul>
            </div>
          </div>

          {/* TPMO Disclaimer */}
          <div className="border-t pt-6">
            <p className="text-xs text-muted-foreground leading-relaxed max-w-4xl mx-auto text-center mb-4">
              We do not offer every plan available in your area. Currently we represent
              organizations which offer products in your area. Please contact{" "}
              <a
                href="https://www.medicare.gov"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-foreground"
              >
                Medicare.gov
              </a>
              , 1-800-MEDICARE, or your local State Health Insurance Assistance Program
              (SHIP) to get information on all of your options.
            </p>
            <p className="text-xs text-muted-foreground text-center">
              &copy; 2026 MediApp. Powered by CMS CY2026 PBP data.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
