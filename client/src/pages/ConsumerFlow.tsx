import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, useInView } from "framer-motion";
import { useLocation } from "wouter";

// ── Types ──

interface PlanCard {
  rank: number;
  id: number;
  name: string;
  carrier: string;
  planType: string;
  premium: number;
  dental: number;
  otcPerYear: number;
  vision: number;
  pcpCopay: number;
  specialistCopay: number;
  drugDeductible: number;
  starRating: number;
  highlights: string[];
  savings: number;
  hasTransportation: boolean;
  hasFitness: boolean;
  hasMeals: boolean;
  hasTelehealth: boolean;
}

interface FindPlansResult {
  plans: PlanCard[];
  moneyOnTable: number;
  county: string;
  state: string;
  totalPlansAnalyzed: number;
}

type Priority = "low_cost" | "best_dental" | "best_drugs" | "everything";
type Medications = "none" | "few" | "many";

// ── Animated Counter ──

function AnimatedCounter({ target, duration = 2000, prefix = "$" }: { target: number; duration?: number; prefix?: string }) {
  const [value, setValue] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true });

  useEffect(() => {
    if (!isInView) return;
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * target));
      if (progress >= 1) clearInterval(interval);
    }, 16);
    return () => clearInterval(interval);
  }, [isInView, target, duration]);

  return (
    <span ref={ref} className="tabular-nums">
      {prefix}{value.toLocaleString()}
    </span>
  );
}

// ── Star Rating ──

function StarRating({ rating }: { rating: number }) {
  const full = Math.floor(rating);
  const half = rating % 1 >= 0.25;
  const stars = [];
  for (let i = 0; i < 5; i++) {
    if (i < full) {
      stars.push(<span key={i} className="text-yellow-400 text-xl" aria-hidden="true">&#9733;</span>);
    } else if (i === full && half) {
      stars.push(<span key={i} className="text-yellow-400 text-xl" aria-hidden="true">&#9733;</span>);
    } else {
      stars.push(<span key={i} className="text-gray-400 text-xl" aria-hidden="true">&#9734;</span>);
    }
  }
  return (
    <div className="flex items-center gap-0.5" role="img" aria-label={`${rating} out of 5 stars`}>
      {stars}
      <span className="ml-1 text-sm text-gray-700">{rating.toFixed(1)}</span>
    </div>
  );
}

// ── TPMO Disclaimer ──

function ConsumerTPMO() {
  return (
    <div className="text-center px-4 py-4 border-t border-gray-200 bg-white/80">
      <p className="text-xs text-gray-600 max-w-2xl mx-auto leading-relaxed">
        We do not offer every plan available in your area. Currently we represent
        organizations which offer products in your area. Please contact{" "}
        <a href="https://www.medicare.gov" target="_blank" rel="noopener noreferrer" className="underline hover:text-blue-600">
          Medicare.gov
        </a>
        , 1-800-MEDICARE, or your local State Health Insurance Assistance Program
        (SHIP) to get information on all of your options.
      </p>
    </div>
  );
}

// ── Main Component ──

export default function ConsumerFlow() {
  const [screen, setScreen] = useState<"hero" | "quiz" | "results" | "thankyou">("hero");
  const [zipCode, setZipCode] = useState("");
  const [zipError, setZipError] = useState("");
  const [priority, setPriority] = useState<Priority | null>(null);
  const [seesSpecialist, setSeesSpecialist] = useState<boolean | null>(null);
  const [medications, setMedications] = useState<Medications | null>(null);
  const [wantsExtras, setWantsExtras] = useState<boolean | null>(null);
  const [quizStep, setQuizStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<FindPlansResult | null>(null);
  const [error, setError] = useState("");

  // Lead capture form
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [leadId, setLeadId] = useState<number | null>(null);

  // UTM params
  const [utmParams, setUtmParams] = useState<{ utmSource?: string; utmMedium?: string; utmCampaign?: string }>({});

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setUtmParams({
      utmSource: params.get("utm_source") || undefined,
      utmMedium: params.get("utm_medium") || undefined,
      utmCampaign: params.get("utm_campaign") || undefined,
    });
  }, []);

  const handleZipSubmit = () => {
    if (!/^\d{5}$/.test(zipCode)) {
      setZipError("Please enter a valid 5-digit ZIP code");
      return;
    }
    setZipError("");
    setScreen("quiz");
  };

  const handleFindPlans = async () => {
    if (!priority || seesSpecialist === null || !medications || wantsExtras === null) return;
    setLoading(true);
    setError("");
    try {
      const resp = await fetch("/api/consumer/find-plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          zipCode,
          priority,
          seesSpecialist,
          medications,
          wantsExtras,
        }),
      });
      if (!resp.ok) {
        const data = await resp.json();
        throw new Error(data.error || "Failed to find plans");
      }
      const data: FindPlansResult = await resp.json();
      setResults(data);
      setScreen("results");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleRequestAgent = async () => {
    if (!firstName || !lastName || !phone) return;
    if (!results) return;
    setSubmitting(true);
    try {
      const resp = await fetch("/api/consumer/request-agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName,
          lastName,
          email,
          phone,
          zipCode,
          quizAnswers: { priority, seesSpecialist, medications, wantsExtras },
          topPlanIds: results.plans.map(p => p.id),
          moneyOnTable: results.moneyOnTable,
          ...utmParams,
        }),
      });
      if (!resp.ok) throw new Error("Failed to submit");
      const data = await resp.json();
      setLeadId(data.leadId);
      setScreen("thankyou");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const quizComplete = priority !== null && seesSpecialist !== null && medications !== null && wantsExtras !== null;

  return (
    <div className="light min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
      <AnimatePresence mode="wait">
        {screen === "hero" && (
          <HeroScreen
            key="hero"
            zipCode={zipCode}
            setZipCode={setZipCode}
            zipError={zipError}
            onSubmit={handleZipSubmit}
          />
        )}
        {screen === "quiz" && (
          <QuizScreen
            key="quiz"
            zipCode={zipCode}
            priority={priority}
            setPriority={setPriority}
            seesSpecialist={seesSpecialist}
            setSeesSpecialist={setSeesSpecialist}
            medications={medications}
            setMedications={setMedications}
            wantsExtras={wantsExtras}
            setWantsExtras={setWantsExtras}
            quizStep={quizStep}
            setQuizStep={setQuizStep}
            quizComplete={quizComplete}
            loading={loading}
            error={error}
            onBack={() => setScreen("hero")}
            onSubmit={handleFindPlans}
          />
        )}
        {screen === "results" && results && (
          <ResultsScreen
            key="results"
            results={results}
            zipCode={zipCode}
            firstName={firstName}
            setFirstName={setFirstName}
            lastName={lastName}
            setLastName={setLastName}
            phone={phone}
            setPhone={setPhone}
            email={email}
            setEmail={setEmail}
            submitting={submitting}
            error={error}
            onRequestAgent={handleRequestAgent}
            onBack={() => setScreen("quiz")}
          />
        )}
        {screen === "thankyou" && results && (
          <ThankYouScreen
            key="thankyou"
            results={results}
            leadId={leadId}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ── Hero Screen ──

function HeroScreen({
  zipCode,
  setZipCode,
  zipError,
  onSubmit,
}: {
  zipCode: string;
  setZipCode: (v: string) => void;
  zipError: string;
  onSubmit: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, x: -100 }}
      transition={{ duration: 0.4 }}
      className="min-h-screen flex flex-col"
    >
      <header className="p-4 md:p-6">
        <div className="max-w-4xl mx-auto flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
            </svg>
          </div>
          <span className="text-xl font-bold text-blue-900">MediApp</span>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="max-w-2xl w-full text-center">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-4xl md:text-5xl lg:text-6xl font-bold text-blue-900 leading-tight mb-4"
          >
            Find Your Best
            <br />
            <span className="text-green-600">Medicare Plan</span>
            <br />
            in 60 Seconds
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-xl md:text-2xl text-gray-700 mb-10"
          >
            It's free. No pressure. Real data from CMS.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="max-w-md mx-auto"
          >
            <label htmlFor="zip-input" className="sr-only">Enter your ZIP code</label>
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                id="zip-input"
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={5}
                value={zipCode}
                onChange={(e) => setZipCode(e.target.value.replace(/\D/g, "").slice(0, 5))}
                onKeyDown={(e) => e.key === "Enter" && onSubmit()}
                placeholder="Enter your ZIP code"
                className="flex-1 text-center text-2xl py-4 px-6 rounded-2xl border-2 border-blue-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all bg-white shadow-sm"
                aria-describedby={zipError ? "zip-error" : undefined}
                aria-invalid={!!zipError}
              />
              <button
                onClick={onSubmit}
                className="bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-xl font-semibold py-4 px-8 rounded-2xl shadow-lg hover:shadow-xl transition-all focus:ring-4 focus:ring-blue-300 focus:outline-none"
              >
                Find My Plans
              </button>
            </div>
            {zipError && (
              <p id="zip-error" className="text-red-500 text-lg mt-3" role="alert">
                {zipError}
              </p>
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="mt-12 flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-8 text-gray-600 text-lg"
          >
            <span className="flex items-center gap-2">
              <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
              171,000+ plans analyzed
            </span>
            <span className="flex items-center gap-2">
              <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
              Real CMS data
            </span>
            <span className="flex items-center gap-2">
              <svg className="w-5 h-5 text-green-500" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
              100% free
            </span>
          </motion.div>
        </div>
      </main>

      <ConsumerTPMO />
    </motion.div>
  );
}

// ── Quiz Screen ──

function QuizScreen({
  zipCode,
  priority,
  setPriority,
  seesSpecialist,
  setSeesSpecialist,
  medications,
  setMedications,
  wantsExtras,
  setWantsExtras,
  quizStep,
  setQuizStep,
  quizComplete,
  loading,
  error,
  onBack,
  onSubmit,
}: {
  zipCode: string;
  priority: Priority | null;
  setPriority: (v: Priority) => void;
  seesSpecialist: boolean | null;
  setSeesSpecialist: (v: boolean) => void;
  medications: Medications | null;
  setMedications: (v: Medications) => void;
  wantsExtras: boolean | null;
  setWantsExtras: (v: boolean) => void;
  quizStep: number;
  setQuizStep: (v: number) => void;
  quizComplete: boolean;
  loading: boolean;
  error: string;
  onBack: () => void;
  onSubmit: () => void;
}) {
  const priorityOptions: { value: Priority; label: string; icon: string; desc: string }[] = [
    { value: "low_cost", label: "Low Monthly Cost", icon: "\uD83D\uDCB0", desc: "Keep my costs down" },
    { value: "best_dental", label: "Best Dental Coverage", icon: "\uD83E\uDDB7", desc: "Dental is important to me" },
    { value: "best_drugs", label: "Best Drug Coverage", icon: "\uD83D\uDC8A", desc: "I need good Rx coverage" },
    { value: "everything", label: "Everything Covered", icon: "\u2728", desc: "I want the most benefits" },
  ];

  const steps = [
    {
      question: "What matters most to you?",
      content: (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-lg mx-auto">
          {priorityOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => { setPriority(opt.value); setQuizStep(1); }}
              className={`p-5 rounded-2xl border-2 text-left transition-all focus:ring-4 focus:ring-blue-300 focus:outline-none hover:shadow-md ${
                priority === opt.value
                  ? "border-blue-500 bg-blue-50 shadow-md"
                  : "border-gray-300 bg-white hover:border-blue-300"
              }`}
              aria-pressed={priority === opt.value}
            >
              <span className="text-3xl block mb-2">{opt.icon}</span>
              <span className="text-lg font-semibold text-gray-800 block">{opt.label}</span>
              <span className="text-sm text-gray-600">{opt.desc}</span>
            </button>
          ))}
        </div>
      ),
    },
    {
      question: "Do you see a specialist regularly?",
      content: (
        <div className="flex gap-4 justify-center max-w-sm mx-auto">
          {([true, false] as const).map((val) => (
            <button
              key={String(val)}
              onClick={() => { setSeesSpecialist(val); setQuizStep(2); }}
              className={`flex-1 py-5 px-8 text-xl font-semibold rounded-2xl border-2 transition-all focus:ring-4 focus:ring-blue-300 focus:outline-none hover:shadow-md ${
                seesSpecialist === val
                  ? "border-blue-500 bg-blue-50 shadow-md"
                  : "border-gray-300 bg-white hover:border-blue-300"
              }`}
              aria-pressed={seesSpecialist === val}
            >
              {val ? "Yes" : "No"}
            </button>
          ))}
        </div>
      ),
    },
    {
      question: "How many prescriptions do you take?",
      content: (
        <div className="flex flex-col sm:flex-row gap-4 justify-center max-w-lg mx-auto">
          {([
            { value: "none" as Medications, label: "None" },
            { value: "few" as Medications, label: "1-3" },
            { value: "many" as Medications, label: "4 or more" },
          ]).map((opt) => (
            <button
              key={opt.value}
              onClick={() => { setMedications(opt.value); setQuizStep(3); }}
              className={`flex-1 py-5 px-6 text-xl font-semibold rounded-2xl border-2 transition-all focus:ring-4 focus:ring-blue-300 focus:outline-none hover:shadow-md ${
                medications === opt.value
                  ? "border-blue-500 bg-blue-50 shadow-md"
                  : "border-gray-300 bg-white hover:border-blue-300"
              }`}
              aria-pressed={medications === opt.value}
            >
              {opt.label}
            </button>
          ))}
        </div>
      ),
    },
    {
      question: "Do you want extras like OTC allowance, gym, or meals?",
      content: (
        <div className="flex flex-col sm:flex-row gap-4 justify-center max-w-lg mx-auto">
          {([
            { value: true, label: "Yes, definitely" },
            { value: false, label: "Not important" },
          ]).map((opt) => (
            <button
              key={String(opt.value)}
              onClick={() => setWantsExtras(opt.value)}
              className={`flex-1 py-5 px-6 text-xl font-semibold rounded-2xl border-2 transition-all focus:ring-4 focus:ring-blue-300 focus:outline-none hover:shadow-md ${
                wantsExtras === opt.value
                  ? "border-blue-500 bg-blue-50 shadow-md"
                  : "border-gray-300 bg-white hover:border-blue-300"
              }`}
              aria-pressed={wantsExtras === opt.value}
            >
              {opt.label}
            </button>
          ))}
        </div>
      ),
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, x: 100 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -100 }}
      transition={{ duration: 0.4 }}
      className="min-h-screen flex flex-col"
    >
      <header className="p-4 md:p-6">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <button
            onClick={onBack}
            className="text-blue-600 hover:text-blue-800 text-lg font-medium flex items-center gap-1 focus:outline-none focus:ring-2 focus:ring-blue-300 rounded-lg px-2 py-1"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            Back
          </button>
          <div className="text-sm text-gray-600 font-medium">
            Step 2 of 3 &middot; ZIP {zipCode}
          </div>
        </div>
      </header>

      {/* Progress bar */}
      <div className="max-w-md mx-auto w-full px-4 mb-8">
        <div className="h-2 bg-gray-300 rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-blue-500 rounded-full"
            initial={{ width: "33%" }}
            animate={{ width: "66%" }}
          />
        </div>
      </div>

      <main className="flex-1 flex items-start justify-center px-4 py-4 md:py-8">
        <div className="max-w-2xl w-full">
          {/* On mobile: show one question at a time; on desktop: show all */}
          <div className="md:hidden">
            <AnimatePresence mode="wait">
              <motion.div
                key={quizStep}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                <h2 className="text-2xl md:text-3xl font-bold text-blue-900 text-center mb-8">
                  {steps[quizStep].question}
                </h2>
                {steps[quizStep].content}
              </motion.div>
            </AnimatePresence>

            {/* Navigation dots */}
            <div className="flex justify-center gap-2 mt-8">
              {steps.map((_, i) => (
                <button
                  key={i}
                  onClick={() => setQuizStep(i)}
                  className={`w-3 h-3 rounded-full transition-all ${
                    i === quizStep ? "bg-blue-500 w-8" : "bg-gray-400"
                  }`}
                  aria-label={`Go to question ${i + 1}`}
                />
              ))}
            </div>
          </div>

          {/* Desktop: show all questions */}
          <div className="hidden md:block space-y-10">
            {steps.map((step, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.1 }}
              >
                <h2 className="text-2xl font-bold text-blue-900 text-center mb-5">
                  {step.question}
                </h2>
                {step.content}
              </motion.div>
            ))}
          </div>

          {/* Submit button */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: quizComplete ? 1 : 0.4 }}
            className="mt-10 text-center"
          >
            <button
              onClick={onSubmit}
              disabled={!quizComplete || loading}
              className="bg-green-600 hover:bg-green-700 active:bg-green-800 disabled:bg-gray-400 disabled:cursor-not-allowed text-white text-xl font-semibold py-4 px-12 rounded-2xl shadow-lg hover:shadow-xl transition-all focus:ring-4 focus:ring-green-300 focus:outline-none"
            >
              {loading ? (
                <span className="flex items-center gap-3">
                  <svg className="animate-spin h-6 w-6" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                  Finding your plans...
                </span>
              ) : (
                "See My Plans"
              )}
            </button>
            {error && (
              <p className="text-red-500 text-lg mt-4" role="alert">{error}</p>
            )}
          </motion.div>
        </div>
      </main>

      <ConsumerTPMO />
    </motion.div>
  );
}

// ── Results Screen ──

function ResultsScreen({
  results,
  zipCode,
  firstName,
  setFirstName,
  lastName,
  setLastName,
  phone,
  setPhone,
  email,
  setEmail,
  submitting,
  error,
  onRequestAgent,
  onBack,
}: {
  results: FindPlansResult;
  zipCode: string;
  firstName: string;
  setFirstName: (v: string) => void;
  lastName: string;
  setLastName: (v: string) => void;
  phone: string;
  setPhone: (v: string) => void;
  email: string;
  setEmail: (v: string) => void;
  submitting: boolean;
  error: string;
  onRequestAgent: () => void;
  onBack: () => void;
}) {
  const formRef = useRef<HTMLDivElement>(null);

  return (
    <motion.div
      initial={{ opacity: 0, x: 100 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -100 }}
      transition={{ duration: 0.4 }}
      className="min-h-screen flex flex-col"
    >
      <header className="p-4 md:p-6">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <button
            onClick={onBack}
            className="text-blue-600 hover:text-blue-800 text-lg font-medium flex items-center gap-1 focus:outline-none focus:ring-2 focus:ring-blue-300 rounded-lg px-2 py-1"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
            Back
          </button>
          <div className="text-sm text-gray-600 font-medium">
            Step 3 of 3 &middot; ZIP {zipCode}
          </div>
        </div>
      </header>

      {/* Progress bar */}
      <div className="max-w-md mx-auto w-full px-4 mb-6">
        <div className="h-2 bg-gray-300 rounded-full overflow-hidden">
          <div className="h-full bg-green-500 rounded-full w-full" />
        </div>
      </div>

      <main className="flex-1 px-4 py-4 md:py-8">
        <div className="max-w-3xl mx-auto">
          {/* Money on table hero */}
          {results.moneyOnTable > 0 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
              className="text-center mb-10"
            >
              <p className="text-xl text-gray-700 mb-2">
                Great news! Based on your ZIP <span className="font-bold">{zipCode}</span>:
              </p>
              <div className="bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-3xl p-8 md:p-10 shadow-xl">
                <p className="text-lg md:text-xl opacity-90 mb-2">You could get up to</p>
                <p className="text-5xl md:text-7xl font-bold tracking-tight">
                  <AnimatedCounter target={results.moneyOnTable} />
                  <span className="text-2xl md:text-3xl font-normal opacity-80">/year</span>
                </p>
                <p className="text-lg md:text-xl opacity-90 mt-2">in value vs. Original Medicare</p>
              </div>
              <p className="text-sm text-gray-600 mt-3">
                Based on {results.totalPlansAnalyzed} plans analyzed in {results.county}, {results.state}
              </p>
            </motion.div>
          )}

          {/* Plan cards */}
          <h2 className="text-2xl md:text-3xl font-bold text-blue-900 text-center mb-6">
            Your Top {results.plans.length} Plans
          </h2>

          <div className="space-y-5">
            {results.plans.map((plan, idx) => (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 + idx * 0.15 }}
                className="bg-white rounded-2xl border-2 border-gray-200 shadow-md hover:shadow-lg transition-shadow overflow-hidden"
              >
                {/* Rank badge */}
                <div className={`px-5 py-3 flex items-center justify-between ${
                  idx === 0 ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-800"
                }`}>
                  <span className="font-bold text-lg">
                    #{plan.rank} {idx === 0 ? "Best Match" : idx === 1 ? "Runner Up" : "Great Option"}
                  </span>
                  <StarRating rating={plan.starRating} />
                </div>

                <div className="p-5 md:p-6">
                  <h3 className="text-xl md:text-2xl font-bold text-gray-800 mb-1">{plan.name}</h3>
                  <p className="text-gray-600 text-lg mb-4">{plan.carrier} &middot; {plan.planType}</p>

                  {/* Key metrics */}
                  <div className="grid grid-cols-3 gap-4 mb-5">
                    <div className="text-center p-3 bg-blue-50 rounded-xl">
                      <div className="text-2xl md:text-3xl font-bold text-blue-700">${plan.premium}</div>
                      <div className="text-sm text-gray-700">per month</div>
                    </div>
                    <div className="text-center p-3 bg-green-50 rounded-xl">
                      <div className="text-2xl md:text-3xl font-bold text-green-700">${plan.dental.toLocaleString()}</div>
                      <div className="text-sm text-gray-700">dental</div>
                    </div>
                    <div className="text-center p-3 bg-purple-50 rounded-xl">
                      <div className="text-2xl md:text-3xl font-bold text-purple-700">${plan.otcPerYear}</div>
                      <div className="text-sm text-gray-700">OTC/year</div>
                    </div>
                  </div>

                  {/* Highlights */}
                  <div className="flex flex-wrap gap-2 mb-4">
                    {plan.highlights.slice(0, 6).map((h, i) => (
                      <span
                        key={i}
                        className="inline-flex items-center gap-1 text-sm bg-gray-100 text-gray-800 px-3 py-1.5 rounded-full"
                      >
                        <svg className="w-4 h-4 text-green-500 shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                        {h}
                      </span>
                    ))}
                  </div>

                  {/* Savings */}
                  {plan.savings > 0 && (
                    <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center">
                      <span className="text-green-700 font-semibold text-lg">
                        Saves you ${plan.savings.toLocaleString()}/year vs Original Medicare
                      </span>
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>

          {/* Dig deeper tools */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            className="mt-10"
          >
            <h3 className="text-xl font-bold text-blue-900 text-center mb-4">
              Want to dig deeper before deciding?
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                { label: "Check if your doctor is covered", href: "/keep-my-doctor" },
                { label: "Search your medications", href: "/find" },
                { label: "Compare plans side by side", href: "/compare" },
                { label: "Calculate your savings", href: "/calculator" },
              ].map((tool) => (
                <a
                  key={tool.href}
                  href={tool.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-between p-4 bg-white border-2 border-gray-200 rounded-xl hover:border-blue-300 hover:shadow-md transition-all text-sm font-medium text-gray-800 group"
                >
                  {tool.label}
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-400 group-hover:text-blue-500 transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                </a>
              ))}
            </div>
          </motion.div>

          {/* Agent request form */}
          <motion.div
            ref={formRef}
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            className="mt-12 mb-8"
          >
            <div className="bg-white rounded-3xl border-2 border-blue-100 shadow-lg p-6 md:p-10">
              <div className="text-center mb-8">
                <h2 className="text-2xl md:text-3xl font-bold text-blue-900 mb-2">
                  Want help choosing and enrolling?
                </h2>
                <p className="text-lg text-gray-700">
                  Talk to a licensed agent. It's <span className="font-semibold text-green-600">completely free</span>.
                </p>
              </div>

              <div className="max-w-md mx-auto space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="first-name" className="block text-sm font-medium text-gray-800 mb-1">
                      First Name
                    </label>
                    <input
                      id="first-name"
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      placeholder="John"
                      className="w-full text-lg py-3 px-4 rounded-xl border-2 border-gray-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all"
                      autoComplete="given-name"
                    />
                  </div>
                  <div>
                    <label htmlFor="last-name" className="block text-sm font-medium text-gray-800 mb-1">
                      Last Name
                    </label>
                    <input
                      id="last-name"
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      placeholder="Smith"
                      className="w-full text-lg py-3 px-4 rounded-xl border-2 border-gray-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all"
                      autoComplete="family-name"
                    />
                  </div>
                </div>

                <div>
                  <label htmlFor="phone-input" className="block text-sm font-medium text-gray-800 mb-1">
                    Phone Number <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="phone-input"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="(555) 123-4567"
                    className="w-full text-lg py-3 px-4 rounded-xl border-2 border-gray-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all"
                    autoComplete="tel"
                  />
                </div>

                <div>
                  <label htmlFor="email-input" className="block text-sm font-medium text-gray-800 mb-1">
                    Email <span className="text-gray-500">(optional)</span>
                  </label>
                  <input
                    id="email-input"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="john@example.com"
                    className="w-full text-lg py-3 px-4 rounded-xl border-2 border-gray-300 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all"
                    autoComplete="email"
                  />
                </div>

                <button
                  onClick={onRequestAgent}
                  disabled={!firstName || !lastName || !phone || submitting}
                  className="w-full bg-green-600 hover:bg-green-700 active:bg-green-800 disabled:bg-gray-400 disabled:cursor-not-allowed text-white text-xl font-semibold py-4 rounded-2xl shadow-lg hover:shadow-xl transition-all focus:ring-4 focus:ring-green-300 focus:outline-none"
                >
                  {submitting ? (
                    <span className="flex items-center justify-center gap-3">
                      <svg className="animate-spin h-6 w-6" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                      Submitting...
                    </span>
                  ) : (
                    "Get Free Help"
                  )}
                </button>

                {error && (
                  <p className="text-red-500 text-center text-lg" role="alert">{error}</p>
                )}

                <p className="text-center text-sm text-gray-600 mt-4">
                  No obligation. No pressure. A licensed agent will help you compare plans and enroll.
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </main>

      <ConsumerTPMO />
    </motion.div>
  );
}

// ── Thank You Screen ──

function ThankYouScreen({
  results,
  leadId,
}: {
  results: FindPlansResult;
  leadId: number | null;
}) {
  const bestPlan = results.plans[0];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.5 }}
      className="min-h-screen flex flex-col"
    >
      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="max-w-xl w-full text-center">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
            className="w-20 h-20 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-6"
          >
            <svg className="w-10 h-10 text-green-600" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          </motion.div>

          <h1 className="text-3xl md:text-4xl font-bold text-blue-900 mb-4">
            You're all set!
          </h1>

          <p className="text-xl text-gray-700 mb-8">
            A licensed Medicare agent will call you within <span className="font-bold text-blue-700">24 hours</span> to help you find the perfect plan.
          </p>

          {bestPlan && (
            <div className="bg-white rounded-2xl border-2 border-green-100 shadow-md p-6 mb-8 text-left">
              <p className="text-sm text-gray-600 mb-1">Your top plan match</p>
              <p className="text-xl font-bold text-gray-800">{bestPlan.name}</p>
              <p className="text-gray-600">{bestPlan.carrier}</p>
              {results.moneyOnTable > 0 && (
                <p className="text-green-600 font-semibold text-lg mt-2">
                  Potential savings: ${results.moneyOnTable.toLocaleString()}/year
                </p>
              )}
            </div>
          )}

          <div className="bg-blue-50 rounded-2xl p-6 text-left">
            <h2 className="text-lg font-bold text-blue-900 mb-4">What happens next:</h2>
            <ol className="space-y-3">
              {[
                "A licensed agent reviews your plan options",
                "They call you to discuss your needs",
                "You choose the plan that's right for you",
                "They help you enroll — it's free",
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-sm">
                    {i + 1}
                  </span>
                  <span className="text-lg text-gray-800 pt-0.5">{step}</span>
                </li>
              ))}
            </ol>
          </div>

          <p className="text-gray-600 mt-8 text-lg">
            Questions? Call <span className="font-semibold">1-800-MEDICARE</span>
          </p>
        </div>
      </main>

      <ConsumerTPMO />
    </motion.div>
  );
}
