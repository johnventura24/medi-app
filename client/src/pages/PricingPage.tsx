import { useState } from "react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Diamond,
  Check,
  ArrowRight,
  ChevronDown,
  ChevronUp,
  Menu,
  X,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Navbar (shared style with landing)                                 */
/* ------------------------------------------------------------------ */
function PricingNav() {
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

          <div className="hidden md:flex items-center gap-8">
            <Link href="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Home
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
            <Link href="/" className="py-2 text-sm text-muted-foreground hover:text-foreground">Home</Link>
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
/*  Tier data                                                          */
/* ------------------------------------------------------------------ */
interface Tier {
  name: string;
  monthlyPrice: number | null;
  description: string;
  features: string[];
  cta: string;
  ctaLink: string;
  highlighted?: boolean;
}

const tiers: Tier[] = [
  {
    name: "Agent",
    monthlyPrice: 49,
    description: "For individual Medicare agents who want an edge.",
    features: [
      "Plan Finder",
      "Plan Comparison",
      "Money Calculator",
      "Hidden Gems",
      "Drug Cost Estimator",
      "5 clients/month",
      "5 exports/month",
    ],
    cta: "Start Free Trial",
    ctaLink: "/register",
  },
  {
    name: "Agency",
    monthlyPrice: 199,
    description: "For agencies and teams that need full power.",
    features: [
      "Everything in Agent",
      "Unlimited agents",
      "Compliance exports",
      "Benefit grid exports",
      "Market Intelligence",
      "Unlimited clients",
      "Unlimited exports",
      "SOA tracking",
      "AEP War Room",
    ],
    cta: "Start Free Trial",
    ctaLink: "/register",
    highlighted: true,
  },
  {
    name: "Enterprise",
    monthlyPrice: null,
    description: "For carriers, FMOs, and large organizations.",
    features: [
      "Everything in Agency",
      "API access",
      "White-label option",
      "Custom integrations",
      "Dedicated support",
      "Carrier data feeds",
      "SLA guarantee",
    ],
    cta: "Contact Sales",
    ctaLink: "/register",
  },
];

/* ------------------------------------------------------------------ */
/*  FAQ data                                                           */
/* ------------------------------------------------------------------ */
const faqs = [
  {
    q: "What's included in the free trial?",
    a: "You get full access to your chosen plan for 14 days. No credit card required. If you don't upgrade, your account simply pauses -- no charges, no surprises.",
  },
  {
    q: "Can I switch plans later?",
    a: "Absolutely. You can upgrade or downgrade at any time. When you upgrade, you get immediate access to the new features. Downgrades take effect at the next billing cycle.",
  },
  {
    q: "Where does the plan data come from?",
    a: "All plan data comes directly from the CMS Plan Benefit Package (PBP) files for Contract Year 2026. We process and structure this data to make it searchable and comparable.",
  },
  {
    q: "Is the consumer tool really free?",
    a: "Yes. The /for-you consumer tool is completely free for Medicare beneficiaries. No account required. It uses the same CMS data as the professional tools.",
  },
  {
    q: "Do you offer HIPAA-compliant data storage?",
    a: "Enterprise plans include HIPAA-compliant infrastructure and a signed BAA. Contact our sales team for details on our security and compliance certifications.",
  },
  {
    q: "What's the annual discount?",
    a: "Annual billing saves you 20% compared to monthly billing. That's like getting over 2 months free each year.",
  },
];

/* ------------------------------------------------------------------ */
/*  FAQ accordion item                                                 */
/* ------------------------------------------------------------------ */
function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border-b last:border-b-0">
      <button
        className="flex items-center justify-between w-full py-5 text-left"
        onClick={() => setOpen(!open)}
      >
        <span className="font-medium text-sm pr-4">{q}</span>
        {open ? (
          <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
      </button>
      {open && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          className="pb-5"
        >
          <p className="text-sm text-muted-foreground leading-relaxed">{a}</p>
        </motion.div>
      )}
    </div>
  );
}

/* ================================================================== */
/*  MAIN COMPONENT                                                     */
/* ================================================================== */
export default function PricingPage() {
  const [annual, setAnnual] = useState(false);

  function formatPrice(monthly: number | null) {
    if (monthly === null) return "Custom";
    const price = annual ? Math.round(monthly * 0.8) : monthly;
    return `$${price}`;
  }

  return (
    <div className="min-h-screen bg-background">
      <PricingNav />

      {/* ── Header ──────────────────────────────────────────────── */}
      <section className="pt-32 pb-16 md:pt-40 md:pb-20 text-center">
        <div className="max-w-3xl mx-auto px-4 sm:px-6">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="text-4xl sm:text-5xl font-bold tracking-tight mb-4"
          >
            Simple, transparent pricing
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="text-lg text-muted-foreground mb-8"
          >
            All plans include a 14-day free trial. No credit card required.
          </motion.p>

          {/* Toggle */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="inline-flex items-center gap-3 rounded-full border bg-muted/50 p-1"
          >
            <button
              onClick={() => setAnnual(false)}
              className={`rounded-full px-5 py-2 text-sm font-medium transition-all ${
                !annual ? "bg-background shadow text-foreground" : "text-muted-foreground"
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setAnnual(true)}
              className={`rounded-full px-5 py-2 text-sm font-medium transition-all flex items-center gap-2 ${
                annual ? "bg-background shadow text-foreground" : "text-muted-foreground"
              }`}
            >
              Annual
              <Badge variant="secondary" className="text-[10px] bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                Save 20%
              </Badge>
            </button>
          </motion.div>
        </div>
      </section>

      {/* ── Pricing cards ───────────────────────────────────────── */}
      <section className="pb-20 md:pb-28">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="grid md:grid-cols-3 gap-8 items-start">
            {tiers.map((tier, i) => (
              <motion.div
                key={tier.name}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.1 * i + 0.3 }}
              >
                <Card
                  className={`relative h-full ${
                    tier.highlighted
                      ? "border-primary shadow-lg shadow-primary/10 scale-[1.02]"
                      : "border shadow-sm"
                  }`}
                >
                  {tier.highlighted && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <Badge className="bg-primary text-primary-foreground px-3">
                        Most Popular
                      </Badge>
                    </div>
                  )}
                  <CardHeader className="pb-4">
                    <CardTitle className="text-xl">{tier.name}</CardTitle>
                    <CardDescription>{tier.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {/* Price */}
                    <div className="mb-6">
                      <span className="text-4xl font-bold">{formatPrice(tier.monthlyPrice)}</span>
                      {tier.monthlyPrice !== null && (
                        <span className="text-muted-foreground text-sm ml-1">
                          /{annual ? "mo, billed annually" : "month"}
                        </span>
                      )}
                    </div>

                    {/* CTA */}
                    <Link href={tier.ctaLink}>
                      <Button
                        className="w-full mb-6"
                        variant={tier.highlighted ? "default" : "outline"}
                        size="lg"
                      >
                        {tier.cta}
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </Button>
                    </Link>

                    {/* Features */}
                    <ul className="space-y-3">
                      {tier.features.map((feature, j) => (
                        <li key={j} className="flex items-start gap-3 text-sm">
                          <Check className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ─────────────────────────────────────────────────── */}
      <section className="py-20 md:py-28 bg-muted/30">
        <div className="max-w-2xl mx-auto px-4 sm:px-6">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-12">
            Frequently Asked Questions
          </h2>
          <div className="bg-background rounded-xl border divide-y">
            <div className="px-6">
              {faqs.map((faq, i) => (
                <FAQItem key={i} q={faq.q} a={faq.a} />
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── Bottom CTA ──────────────────────────────────────────── */}
      <section className="py-20 md:py-28">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center">
          <h2 className="text-2xl sm:text-3xl font-bold mb-4">Still have questions?</h2>
          <p className="text-muted-foreground mb-8">
            Start your free trial today, or contact us for a personalized demo.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/register">
              <Button size="lg" className="text-base px-8 h-12">
                Start Free Trial
              </Button>
            </Link>
            <Link href="/tools">
              <Button variant="outline" size="lg" className="text-base px-8 h-12">
                Explore Tools
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────── */}
      <footer className="border-t bg-muted/30 py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
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
            &copy; 2026 Prism. Powered by CMS CY2026 PBP data.
          </p>
        </div>
      </footer>
    </div>
  );
}
