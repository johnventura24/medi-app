import { useState } from "react";
import { useLocation } from "wouter";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Plus,
  Trash2,
  Pencil,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useClients, type ClientMedication, type ClientDoctor, type BenefitWeights } from "@/hooks/useClients";
import { useToast } from "@/hooks/use-toast";

const STEPS = [
  "Demographics",
  "Health Profile",
  "Medications & Doctors",
  "Benefits & Priorities",
  "Review & Submit",
];

const CHRONIC_CONDITIONS = [
  "Diabetes",
  "COPD",
  "Heart Failure (CHF)",
  "Chronic Kidney Disease",
  "Cancer",
  "Depression/Anxiety",
  "Arthritis",
  "Hypertension",
  "Alzheimer's/Dementia",
  "Stroke History",
  "End-Stage Renal Disease",
  "HIV/AIDS",
  "None",
];

const MUST_HAVE_BENEFITS = [
  "Dental",
  "Vision",
  "OTC Allowance",
  "Transportation",
  "Meal Benefit",
  "Flex Card",
  "Fitness/SilverSneakers",
  "Telehealth",
  "In-Home Support",
  "Part B Giveback",
];

function StepIndicator({ currentStep, steps }: { currentStep: number; steps: string[] }) {
  return (
    <div className="flex items-center justify-center gap-1 mb-8">
      {steps.map((label, idx) => {
        const isComplete = idx < currentStep;
        const isCurrent = idx === currentStep;
        return (
          <div key={label} className="flex items-center">
            <div className="flex flex-col items-center">
              <div
                className={cn(
                  "flex items-center justify-center w-9 h-9 rounded-full text-sm font-semibold border-2 transition-colors",
                  isComplete
                    ? "bg-primary border-primary text-primary-foreground"
                    : isCurrent
                    ? "border-primary text-primary bg-background"
                    : "border-muted-foreground/30 text-muted-foreground bg-background"
                )}
              >
                {isComplete ? <Check className="h-4 w-4" /> : idx + 1}
              </div>
              <span
                className={cn(
                  "text-xs mt-1 max-w-[80px] text-center leading-tight",
                  isCurrent ? "text-primary font-medium" : "text-muted-foreground"
                )}
              >
                {label}
              </span>
            </div>
            {idx < steps.length - 1 && (
              <div
                className={cn(
                  "w-8 h-0.5 mx-1 mt-[-16px]",
                  isComplete ? "bg-primary" : "bg-muted-foreground/30"
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function ClientIntakeContent() {
  const [, navigate] = useLocation();
  const { createClient } = useClients();
  const { toast } = useToast();
  const [step, setStep] = useState(0);

  // Step 1: Demographics
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [gender, setGender] = useState<"Male" | "Female" | "Other" | "">("");
  const [zipCode, setZipCode] = useState("");

  // Step 2: Health Profile
  const [currentCoverage, setCurrentCoverage] = useState("");
  const [currentPlanName, setCurrentPlanName] = useState("");
  const [chronicConditions, setChronicConditions] = useState<string[]>([]);
  const [mobilityLevel, setMobilityLevel] = useState<"Independent" | "Limited Mobility" | "Homebound" | "">("");
  const [hospitalizedLast12, setHospitalizedLast12] = useState(false);

  // Step 3: Medications & Doctors
  const [medications, setMedications] = useState<ClientMedication[]>([]);
  const [doctors, setDoctors] = useState<ClientDoctor[]>([]);

  // Step 4: Benefits & Priorities
  const [maxPremium, setMaxPremium] = useState<number | null>(null);
  const [premiumNoLimit, setPremiumNoLimit] = useState(false);
  const [maxOop, setMaxOop] = useState<number | null>(null);
  const [oopNoLimit, setOopNoLimit] = useState(false);
  const [mustHaveBenefits, setMustHaveBenefits] = useState<string[]>([]);
  const [benefitWeights, setBenefitWeights] = useState<BenefitWeights>({
    lowPremium: 3,
    lowCopays: 3,
    dentalGenerosity: 3,
    drugCoverage: 3,
    supplementalBenefits: 3,
    starRating: 3,
  });
  const [notes, setNotes] = useState("");

  const toggleCondition = (condition: string) => {
    if (condition === "None") {
      setChronicConditions((prev) =>
        prev.includes("None") ? prev.filter((c) => c !== "None") : ["None"]
      );
    } else {
      setChronicConditions((prev) => {
        const without = prev.filter((c) => c !== "None");
        return without.includes(condition)
          ? without.filter((c) => c !== condition)
          : [...without, condition];
      });
    }
  };

  const toggleBenefit = (b: string) => {
    setMustHaveBenefits((prev) =>
      prev.includes(b) ? prev.filter((x) => x !== b) : [...prev, b]
    );
  };

  const addMedication = () =>
    setMedications((prev) => [...prev, { drugName: "", dosage: "", frequency: "daily" }]);

  const removeMedication = (idx: number) =>
    setMedications((prev) => prev.filter((_, i) => i !== idx));

  const updateMedication = (idx: number, field: keyof ClientMedication, value: string) =>
    setMedications((prev) =>
      prev.map((m, i) => (i === idx ? { ...m, [field]: value } : m))
    );

  const addDoctor = () =>
    setDoctors((prev) => [...prev, { name: "", npi: "" }]);

  const removeDoctor = (idx: number) =>
    setDoctors((prev) => prev.filter((_, i) => i !== idx));

  const updateDoctor = (idx: number, field: keyof ClientDoctor, value: string) =>
    setDoctors((prev) =>
      prev.map((d, i) => (i === idx ? { ...d, [field]: value } : d))
    );

  const canProceed = (): boolean => {
    switch (step) {
      case 0:
        return firstName.trim() !== "" && lastName.trim() !== "" && /^\d{5}$/.test(zipCode);
      default:
        return true;
    }
  };

  const handleSubmit = async () => {
    try {
      const result = await createClient.mutateAsync({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        dateOfBirth: dateOfBirth || undefined,
        gender: gender || undefined,
        zipCode,
        currentCoverage: currentCoverage || undefined,
        currentPlanName: currentPlanName || undefined,
        chronicConditions,
        mobilityLevel: mobilityLevel || undefined,
        hospitalizedLast12Months: hospitalizedLast12,
        medications,
        preferredDoctors: doctors,
        maxMonthlyPremium: premiumNoLimit ? null : maxPremium,
        maxAnnualOop: oopNoLimit ? null : maxOop,
        mustHaveBenefits,
        benefitWeights,
        notes: notes || undefined,
        status: "intake",
      });
      toast({
        title: "Client created",
        description: `${firstName} ${lastName} has been added.`,
      });
      navigate(`/clients/${result.id ?? result.client?.id ?? ""}`);
    } catch (err: unknown) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to create client",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate("/clients")}>
          <ChevronLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
        <h1 className="text-3xl font-bold tracking-tight">New Client Intake</h1>
      </div>

      <StepIndicator currentStep={step} steps={STEPS} />

      {/* Step 1: Demographics */}
      {step === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Demographics</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name *</Label>
                <Input
                  id="firstName"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name *</Label>
                <Input
                  id="lastName"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="dob">Date of Birth</Label>
                <Input
                  id="dob"
                  type="date"
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Gender</Label>
                <Select value={gender} onValueChange={(v) => setGender(v as typeof gender)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select gender" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Male">Male</SelectItem>
                    <SelectItem value="Female">Female</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="zip">ZIP Code *</Label>
              <Input
                id="zip"
                value={zipCode}
                onChange={(e) => setZipCode(e.target.value.replace(/\D/g, "").slice(0, 5))}
                maxLength={5}
                placeholder="e.g. 33101"
              />
              {zipCode && !/^\d{5}$/.test(zipCode) && (
                <p className="text-xs text-destructive">ZIP code must be 5 digits</p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Health Profile */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Health Profile</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Current Coverage</Label>
                <Select value={currentCoverage} onValueChange={setCurrentCoverage}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select coverage" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Original Medicare">Original Medicare</SelectItem>
                    <SelectItem value="Medicare Advantage">Medicare Advantage</SelectItem>
                    <SelectItem value="Medicaid">Medicaid</SelectItem>
                    <SelectItem value="Employer">Employer</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="planName">Current Plan Name</Label>
                <Input
                  id="planName"
                  value={currentPlanName}
                  onChange={(e) => setCurrentPlanName(e.target.value)}
                  placeholder="Optional"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Chronic Conditions</Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {CHRONIC_CONDITIONS.map((condition) => (
                  <label
                    key={condition}
                    className="flex items-center gap-2 text-sm cursor-pointer"
                  >
                    <Checkbox
                      checked={chronicConditions.includes(condition)}
                      onCheckedChange={() => toggleCondition(condition)}
                    />
                    {condition}
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Mobility Level</Label>
              <Select
                value={mobilityLevel}
                onValueChange={(v) => setMobilityLevel(v as typeof mobilityLevel)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select mobility level" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Independent">Independent</SelectItem>
                  <SelectItem value="Limited Mobility">Limited Mobility</SelectItem>
                  <SelectItem value="Homebound">Homebound</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-3">
              <Label htmlFor="hospitalized">Hospitalized in last 12 months?</Label>
              <Switch
                id="hospitalized"
                checked={hospitalizedLast12}
                onCheckedChange={setHospitalizedLast12}
              />
              <span className="text-sm text-muted-foreground">
                {hospitalizedLast12 ? "Yes" : "No"}
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Medications & Doctors */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Medications & Doctors</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">Medications</Label>
                <Button variant="outline" size="sm" onClick={addMedication}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Medication
                </Button>
              </div>
              {medications.length === 0 && (
                <p className="text-sm text-muted-foreground">No medications added.</p>
              )}
              {medications.map((med, idx) => (
                <div key={idx} className="flex items-end gap-2 p-3 bg-muted/50 rounded-md">
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs">Drug Name</Label>
                    <Input
                      value={med.drugName}
                      onChange={(e) => updateMedication(idx, "drugName", e.target.value)}
                      placeholder="Drug name"
                    />
                  </div>
                  <div className="w-28 space-y-1">
                    <Label className="text-xs">Dosage</Label>
                    <Input
                      value={med.dosage}
                      onChange={(e) => updateMedication(idx, "dosage", e.target.value)}
                      placeholder="e.g. 10mg"
                    />
                  </div>
                  <div className="w-36 space-y-1">
                    <Label className="text-xs">Frequency</Label>
                    <Select
                      value={med.frequency}
                      onValueChange={(v) => updateMedication(idx, "frequency", v)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="twice daily">Twice Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeMedication(idx)}
                    className="shrink-0"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-base font-semibold">Preferred Doctors</Label>
                <Button variant="outline" size="sm" onClick={addDoctor}>
                  <Plus className="h-4 w-4 mr-1" />
                  Add Doctor
                </Button>
              </div>
              {doctors.length === 0 && (
                <p className="text-sm text-muted-foreground">No doctors added.</p>
              )}
              {doctors.map((doc, idx) => (
                <div key={idx} className="flex items-end gap-2 p-3 bg-muted/50 rounded-md">
                  <div className="flex-1 space-y-1">
                    <Label className="text-xs">Doctor Name</Label>
                    <Input
                      value={doc.name}
                      onChange={(e) => updateDoctor(idx, "name", e.target.value)}
                      placeholder="Doctor name"
                    />
                  </div>
                  <div className="w-40 space-y-1">
                    <Label className="text-xs">NPI (optional)</Label>
                    <Input
                      value={doc.npi ?? ""}
                      onChange={(e) => updateDoctor(idx, "npi", e.target.value)}
                      placeholder="NPI number"
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => removeDoctor(idx)}
                    className="shrink-0"
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Benefits & Priorities */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>Benefits & Priorities</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Premium Slider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Max Monthly Premium</Label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={premiumNoLimit}
                    onCheckedChange={(v) => {
                      setPremiumNoLimit(!!v);
                      if (v) setMaxPremium(null);
                    }}
                  />
                  No limit
                </label>
              </div>
              {!premiumNoLimit && (
                <div className="space-y-1">
                  <Slider
                    value={[maxPremium ?? 150]}
                    onValueChange={([v]) => setMaxPremium(v)}
                    min={0}
                    max={300}
                    step={5}
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>$0</span>
                    <span className="font-mono font-medium text-foreground">
                      ${maxPremium ?? 150}/mo
                    </span>
                    <span>$300</span>
                  </div>
                </div>
              )}
            </div>

            {/* OOP Slider */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Max Annual Out-of-Pocket</Label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={oopNoLimit}
                    onCheckedChange={(v) => {
                      setOopNoLimit(!!v);
                      if (v) setMaxOop(null);
                    }}
                  />
                  No limit
                </label>
              </div>
              {!oopNoLimit && (
                <div className="space-y-1">
                  <Slider
                    value={[maxOop ?? 4000]}
                    onValueChange={([v]) => setMaxOop(v)}
                    min={0}
                    max={8850}
                    step={50}
                  />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>$0</span>
                    <span className="font-mono font-medium text-foreground">
                      ${(maxOop ?? 4000).toLocaleString()}
                    </span>
                    <span>$8,850</span>
                  </div>
                </div>
              )}
            </div>

            {/* Must-Have Benefits */}
            <div className="space-y-2">
              <Label>Must-Have Benefits</Label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {MUST_HAVE_BENEFITS.map((b) => (
                  <label key={b} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={mustHaveBenefits.includes(b)}
                      onCheckedChange={() => toggleBenefit(b)}
                    />
                    {b}
                  </label>
                ))}
              </div>
            </div>

            {/* Benefit Importance Weights */}
            <div className="space-y-4">
              <Label className="text-base font-semibold">Benefit Importance Weights</Label>
              {(
                [
                  { key: "lowPremium", label: "Low Premium" },
                  { key: "lowCopays", label: "Low Copays" },
                  { key: "dentalGenerosity", label: "Dental Generosity" },
                  { key: "drugCoverage", label: "Drug Coverage" },
                  { key: "supplementalBenefits", label: "Supplemental Benefits" },
                  { key: "starRating", label: "Star Rating" },
                ] as const
              ).map(({ key, label }) => (
                <div key={key} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-sm">{label}</Label>
                    <span className="text-sm font-mono font-medium">
                      {benefitWeights[key]}/5
                    </span>
                  </div>
                  <Slider
                    value={[benefitWeights[key]]}
                    onValueChange={([v]) =>
                      setBenefitWeights((prev) => ({ ...prev, [key]: v }))
                    }
                    min={1}
                    max={5}
                    step={1}
                  />
                </div>
              ))}
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Additional notes about the client..."
                rows={3}
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 5: Review & Submit */}
      {step === 4 && (
        <div className="space-y-4">
          {/* Demographics Review */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base">Demographics</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setStep(0)}>
                <Pencil className="h-3 w-3 mr-1" />
                Edit
              </Button>
            </CardHeader>
            <CardContent className="text-sm space-y-1">
              <p><span className="font-medium">Name:</span> {firstName} {lastName}</p>
              {dateOfBirth && <p><span className="font-medium">DOB:</span> {dateOfBirth}</p>}
              {gender && <p><span className="font-medium">Gender:</span> {gender}</p>}
              <p><span className="font-medium">ZIP:</span> {zipCode}</p>
            </CardContent>
          </Card>

          {/* Health Profile Review */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base">Health Profile</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setStep(1)}>
                <Pencil className="h-3 w-3 mr-1" />
                Edit
              </Button>
            </CardHeader>
            <CardContent className="text-sm space-y-1">
              {currentCoverage && <p><span className="font-medium">Coverage:</span> {currentCoverage}</p>}
              {currentPlanName && <p><span className="font-medium">Plan:</span> {currentPlanName}</p>}
              <div className="flex flex-wrap gap-1 mt-1">
                {chronicConditions.map((c) => (
                  <Badge key={c} variant="secondary" className="text-xs">{c}</Badge>
                ))}
                {chronicConditions.length === 0 && <span className="text-muted-foreground">None listed</span>}
              </div>
              {mobilityLevel && <p><span className="font-medium">Mobility:</span> {mobilityLevel}</p>}
              <p><span className="font-medium">Hospitalized (12mo):</span> {hospitalizedLast12 ? "Yes" : "No"}</p>
            </CardContent>
          </Card>

          {/* Medications & Doctors Review */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base">Medications & Doctors</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setStep(2)}>
                <Pencil className="h-3 w-3 mr-1" />
                Edit
              </Button>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              <p className="font-medium">Medications ({medications.length}):</p>
              {medications.length === 0 ? (
                <p className="text-muted-foreground">None</p>
              ) : (
                <ul className="list-disc list-inside space-y-0.5">
                  {medications.map((m, i) => (
                    <li key={i}>
                      {m.drugName} {m.dosage && `- ${m.dosage}`} ({m.frequency})
                    </li>
                  ))}
                </ul>
              )}
              <p className="font-medium mt-2">Doctors ({doctors.length}):</p>
              {doctors.length === 0 ? (
                <p className="text-muted-foreground">None</p>
              ) : (
                <ul className="list-disc list-inside space-y-0.5">
                  {doctors.map((d, i) => (
                    <li key={i}>
                      {d.name} {d.npi && `(NPI: ${d.npi})`}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {/* Benefits Review */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base">Benefits & Priorities</CardTitle>
              <Button variant="ghost" size="sm" onClick={() => setStep(3)}>
                <Pencil className="h-3 w-3 mr-1" />
                Edit
              </Button>
            </CardHeader>
            <CardContent className="text-sm space-y-2">
              <p>
                <span className="font-medium">Max Premium:</span>{" "}
                {premiumNoLimit ? "No limit" : `$${maxPremium ?? 150}/mo`}
              </p>
              <p>
                <span className="font-medium">Max OOP:</span>{" "}
                {oopNoLimit ? "No limit" : `$${(maxOop ?? 4000).toLocaleString()}`}
              </p>
              <div>
                <span className="font-medium">Must-Have Benefits:</span>
                <div className="flex flex-wrap gap-1 mt-1">
                  {mustHaveBenefits.length === 0 ? (
                    <span className="text-muted-foreground">None</span>
                  ) : (
                    mustHaveBenefits.map((b) => (
                      <Badge key={b} variant="secondary" className="text-xs">{b}</Badge>
                    ))
                  )}
                </div>
              </div>
              <div>
                <span className="font-medium">Importance Weights:</span>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-1">
                  {Object.entries(benefitWeights).map(([k, v]) => (
                    <div key={k} className="flex items-center gap-2">
                      <span className="capitalize text-muted-foreground">
                        {k.replace(/([A-Z])/g, " $1").trim()}:
                      </span>
                      <div className="flex gap-0.5">
                        {Array.from({ length: 5 }).map((_, i) => (
                          <div
                            key={i}
                            className={cn(
                              "w-3 h-3 rounded-sm",
                              i < v ? "bg-primary" : "bg-muted"
                            )}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              {notes && (
                <p><span className="font-medium">Notes:</span> {notes}</p>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between pt-4">
        <Button
          variant="outline"
          onClick={() => setStep((s) => Math.max(0, s - 1))}
          disabled={step === 0}
        >
          <ChevronLeft className="h-4 w-4 mr-1" />
          Previous
        </Button>

        {step < STEPS.length - 1 ? (
          <Button
            onClick={() => setStep((s) => s + 1)}
            disabled={!canProceed()}
          >
            Next
            <ChevronRight className="h-4 w-4 ml-1" />
          </Button>
        ) : (
          <Button onClick={handleSubmit} disabled={createClient.isPending}>
            {createClient.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save Client
          </Button>
        )}
      </div>
    </div>
  );
}

export default function ClientIntake() {
  return (
    <AuthGuard roles={["agent", "admin", "compliance"]}>
      <ClientIntakeContent />
    </AuthGuard>
  );
}
