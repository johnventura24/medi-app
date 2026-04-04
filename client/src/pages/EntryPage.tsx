import { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "wouter";
import { motion, useInView } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import {
  Heart,
  Diamond,
  ArrowRight,
  Check,
  Menu,
  X,
  Shield,
  Stethoscope,
  Search,
  BarChart3,
  FileCheck,
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
function EntryNav() {
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
            <Link href="/tools" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Agent Tools
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
            <Link href="/tools" className="py-2 text-sm text-muted-foreground hover:text-foreground">Agent Tools</Link>
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
/*  Entry Page                                                         */
/* ------------------------------------------------------------------ */
export default function EntryPage() {
  const { isAuthenticated, isLoading } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    if (!isLoading && isAuthenticated) navigate("/dashboard");
  }, [isLoading, isAuthenticated, navigate]);

  if (isLoading) return null;
  if (isAuthenticated) return null;

  return (
    <div className="min-h-screen bg-background">
      <EntryNav />

      {/* Hero */}
      <section className="relative pt-32 pb-16 px-4 overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-20 left-1/4 w-96 h-96 bg-primary/5 rounded-full blur-3xl" />
          <div className="absolute top-40 right-1/4 w-80 h-80 bg-green-500/5 rounded-full blur-3xl" />
        </div>

        <div className="max-w-5xl mx-auto text-center">
          <FadeIn>
            <div className="inline-flex items-center gap-2 bg-primary/10 text-primary text-sm font-medium px-4 py-1.5 rounded-full mb-6">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              Powered by CMS CY2026 data
            </div>
          </FadeIn>

          <FadeIn delay={0.1}>
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight mb-4">
              Medicare{" "}
              <span className="bg-gradient-to-r from-primary to-green-600 bg-clip-text text-transparent">
                Made Clear
              </span>
            </h1>
          </FadeIn>

          <FadeIn delay={0.2}>
            <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-12">
              Whether you're finding your own plan or helping clients find theirs — start here.
            </p>
          </FadeIn>

          {/* Two Path Cards */}
          <div className="grid md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {/* Consumer Path */}
            <FadeIn delay={0.3}>
              <motion.div
                whileHover={{ y: -6 }}
                transition={{ type: "spring", stiffness: 300 }}
              >
                <Link href="/for-you">
                  <div className="relative group cursor-pointer rounded-2xl border-2 border-blue-200 dark:border-blue-900 bg-gradient-to-br from-blue-50 via-white to-green-50 dark:from-blue-950/30 dark:via-background dark:to-green-950/30 p-8 text-left shadow-sm hover:shadow-xl hover:border-blue-400 transition-all">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 dark:bg-blue-900/50">
                        <Heart className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold">Find My Plan</h2>
                        <p className="text-sm text-muted-foreground">For Medicare beneficiaries</p>
                      </div>
                    </div>

                    <p className="text-muted-foreground mb-5">
                      Answer 4 quick questions. See your best Medicare plans in 60 seconds.
                    </p>

                    <ul className="space-y-2 mb-6">
                      {["100% free — no signup required", "Real data from CMS, not estimates", "Get matched with a licensed agent"].map((item) => (
                        <li key={item} className="flex items-center gap-2 text-sm">
                          <Check className="h-4 w-4 text-green-600 shrink-0" />
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>

                    <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 font-semibold text-sm group-hover:gap-3 transition-all">
                      Find my plan <ArrowRight className="h-4 w-4" />
                    </div>
                  </div>
                </Link>
              </motion.div>
            </FadeIn>

            {/* Agent/FMO Path */}
            <FadeIn delay={0.4}>
              <motion.div
                whileHover={{ y: -6 }}
                transition={{ type: "spring", stiffness: 300 }}
              >
                <Link href="/tools">
                  <div className="relative group cursor-pointer rounded-2xl border-2 border-primary/20 bg-gradient-to-br from-primary/5 via-white to-violet-50 dark:from-primary/10 dark:via-background dark:to-violet-950/20 p-8 text-left shadow-sm hover:shadow-xl hover:border-primary/50 transition-all">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
                        <BarChart3 className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold">Agent & FMO Tools</h2>
                        <p className="text-sm text-muted-foreground">For licensed professionals</p>
                      </div>
                    </div>

                    <p className="text-muted-foreground mb-5">
                      47+ analytics tools powered by 171,906 real CMS plans. No login required to explore.
                    </p>

                    <ul className="space-y-2 mb-6">
                      {[
                        { icon: Search, text: "Plan Finder & Smart Match" },
                        { icon: Stethoscope, text: "Keep My Doctor — provider network check" },
                        { icon: BarChart3, text: "Market Intelligence & Battleground Maps" },
                        { icon: FileCheck, text: "Compliance Exports & Benefit Grids" },
                      ].map((item) => (
                        <li key={item.text} className="flex items-center gap-2 text-sm">
                          <item.icon className="h-4 w-4 text-primary shrink-0" />
                          <span>{item.text}</span>
                        </li>
                      ))}
                    </ul>

                    <div className="flex items-center gap-2 text-primary font-semibold text-sm group-hover:gap-3 transition-all">
                      Explore tools <ArrowRight className="h-4 w-4" />
                    </div>
                  </div>
                </Link>
              </motion.div>
            </FadeIn>
          </div>
        </div>
      </section>

      {/* Stats Strip */}
      <FadeIn>
        <section className="py-10 border-y bg-muted/30">
          <div className="max-w-4xl mx-auto px-4 grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <div>
              <p className="text-2xl sm:text-3xl font-bold text-primary">
                <AnimatedCounter end={171906} duration={1500} />
              </p>
              <p className="text-sm text-muted-foreground mt-1">Plans Analyzed</p>
            </div>
            <div>
              <p className="text-2xl sm:text-3xl font-bold text-primary">
                <AnimatedCounter end={301} duration={1200} />
              </p>
              <p className="text-sm text-muted-foreground mt-1">Carriers</p>
            </div>
            <div>
              <p className="text-2xl sm:text-3xl font-bold text-primary">
                <AnimatedCounter end={56} duration={1000} />
              </p>
              <p className="text-sm text-muted-foreground mt-1">States & Territories</p>
            </div>
            <div>
              <p className="text-2xl sm:text-3xl font-bold text-primary">
                <AnimatedCounter end={1934} duration={1200} />
              </p>
              <p className="text-sm text-muted-foreground mt-1">Counties Covered</p>
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
              <Link href="/welcome" className="hover:text-foreground transition-colors">About</Link>
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
