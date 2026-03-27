import { useState } from "react";
import { useRoute, useLocation } from "wouter";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { SOAForm, type SOAFormData } from "@/components/client/SOAForm";
import {
  ChevronLeft,
  Pencil,
  Sparkles,
  Loader2,
  Eye,
  Columns3,
  Download,
  MessageSquare,
  AlertTriangle,
  Plus,
  Clock,
  FileCheck,
  Pill,
  Stethoscope,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useClient } from "@/hooks/useClients";
import {
  useRecommendations,
  useInteractions,
  useSOA,
  type RecommendedPlan,
  type Interaction,
  type SOARecord,
} from "@/hooks/useRecommendations";
import { useToast } from "@/hooks/use-toast";
import { MedicationList, type MedicationEntry } from "@/components/drugs/MedicationList";
import { DrugCostEstimator } from "@/components/drugs/DrugCostEstimator";
import { ProviderSearchInput } from "@/components/providers/ProviderSearchInput";
import { NetworkStatusGrid } from "@/components/providers/NetworkStatusGrid";
import type { ProviderResult } from "@/hooks/useProviderSearch";

function statusBadgeClass(status: string): string {
  switch (status) {
    case "intake":
      return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
    case "plans_reviewed":
      return "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200";
    case "enrolled":
      return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
    case "archived":
      return "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400";
    default:
      return "";
  }
}

function formatDate(dateStr?: string): string {
  if (!dateStr) return "--";
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatDateTime(dateStr?: string): string {
  if (!dateStr) return "--";
  return new Date(dateStr).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

// Score gauge component
function ScoreGauge({ score, size = 80 }: { score: number; size?: number }) {
  const radius = (size - 10) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDasharray = circumference;
  const strokeDashoffset = circumference - (score / 100) * circumference;

  const color =
    score >= 80 ? "#22c55e" : score >= 60 ? "#eab308" : score >= 40 ? "#f97316" : "#ef4444";

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="currentColor"
          className="text-muted"
          strokeWidth={5}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={5}
          strokeLinecap="round"
          strokeDasharray={strokeDasharray}
          strokeDashoffset={strokeDashoffset}
          style={{ transition: "stroke-dashoffset 0.5s ease" }}
        />
      </svg>
      <span className="absolute text-sm font-bold">{score}</span>
    </div>
  );
}

function ScoreBreakdownBar({ label, value }: { label: string; value: number }) {
  const pct = Math.min(100, Math.max(0, value));
  const color =
    pct >= 80 ? "bg-green-500" : pct >= 60 ? "bg-yellow-500" : pct >= 40 ? "bg-orange-500" : "bg-red-500";

  return (
    <div className="space-y-0.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-mono font-medium">{value}</span>
      </div>
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full transition-all", color)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function PlanCard({ plan }: { plan: RecommendedPlan }) {
  const [, navigate] = useLocation();

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-start gap-4">
          {/* Rank Badge */}
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center font-bold text-sm">
            #{plan.rank}
          </div>

          {/* Score Gauge */}
          <div className="flex-shrink-0">
            <ScoreGauge score={plan.totalScore} />
          </div>

          {/* Plan Info */}
          <div className="flex-1 min-w-0 space-y-3">
            <div>
              <h3 className="font-semibold text-base truncate">{plan.planName}</h3>
              <p className="text-sm text-muted-foreground">{plan.carrier} - {plan.planType}</p>
            </div>

            {/* Score Breakdown */}
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              <ScoreBreakdownBar label="Premium" value={plan.scoreBreakdown.premiumScore} />
              <ScoreBreakdownBar label="Copays" value={plan.scoreBreakdown.copayScore} />
              <ScoreBreakdownBar label="Dental" value={plan.scoreBreakdown.dentalScore} />
              <ScoreBreakdownBar label="Drug Coverage" value={plan.scoreBreakdown.drugScore} />
              <ScoreBreakdownBar label="Supplemental" value={plan.scoreBreakdown.supplementalScore} />
              <ScoreBreakdownBar label="Star Rating" value={plan.scoreBreakdown.starRatingScore} />
            </div>

            {/* Key Metrics */}
            <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
              <span>Premium: <span className="font-mono font-medium text-foreground">${plan.premium}/mo</span></span>
              <span>MOOP: <span className="font-mono font-medium text-foreground">${plan.moop.toLocaleString()}</span></span>
              <span>PCP: <span className="font-mono font-medium text-foreground">${plan.pcpCopay}</span></span>
              {plan.starRating && (
                <span>Stars: <span className="font-mono font-medium text-foreground">{plan.starRating}</span></span>
              )}
            </div>

            {/* Warnings */}
            {plan.warnings && plan.warnings.length > 0 && (
              <Alert className="bg-yellow-50 border-yellow-300 dark:bg-yellow-950 dark:border-yellow-700 py-2 px-3">
                <AlertTriangle className="h-3 w-3 text-yellow-600" />
                <AlertDescription className="text-xs text-yellow-800 dark:text-yellow-200">
                  {plan.warnings.join("; ")}
                </AlertDescription>
              </Alert>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function OverviewTab({ clientId }: { clientId: string }) {
  const { data: client, isLoading } = useClient(clientId);

  if (isLoading || !client) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Client Info */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Client Information</CardTitle>
        </CardHeader>
        <CardContent className="text-sm space-y-1">
          <p><span className="font-medium">Name:</span> {client.firstName} {client.lastName}</p>
          {client.dateOfBirth && <p><span className="font-medium">DOB:</span> {formatDate(client.dateOfBirth)}</p>}
          <p><span className="font-medium">ZIP:</span> {client.zipCode}</p>
          {client.currentCoverage && <p><span className="font-medium">Coverage:</span> {client.currentCoverage}</p>}
          {client.mobilityLevel && <p><span className="font-medium">Mobility:</span> {client.mobilityLevel}</p>}
        </CardContent>
      </Card>

      {/* Health Profile */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Health Profile</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <p className="text-sm font-medium mb-1">Chronic Conditions</p>
            <div className="flex flex-wrap gap-1">
              {(client.chronicConditions ?? []).length === 0 ? (
                <span className="text-sm text-muted-foreground">None</span>
              ) : (
                client.chronicConditions.map((c) => (
                  <Badge key={c} variant="secondary" className="text-xs">{c}</Badge>
                ))
              )}
            </div>
          </div>
          <p className="text-sm">
            <span className="font-medium">Hospitalized (12 months):</span>{" "}
            {client.hospitalizedLast12Months ? (
              <Badge variant="destructive" className="text-xs">Yes</Badge>
            ) : (
              <span className="text-muted-foreground">No</span>
            )}
          </p>
        </CardContent>
      </Card>

      {/* Medications */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Medications</CardTitle>
        </CardHeader>
        <CardContent>
          {(client.medications ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No medications listed</p>
          ) : (
            <div className="space-y-2">
              {client.medications.map((m, i) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <Badge variant="outline" className="text-xs">{m.frequency}</Badge>
                  <span className="font-medium">{m.drugName}</span>
                  {m.dosage && <span className="text-muted-foreground">- {m.dosage}</span>}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Doctors */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Preferred Doctors</CardTitle>
        </CardHeader>
        <CardContent>
          {(client.preferredDoctors ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground">No doctors listed</p>
          ) : (
            <div className="space-y-1">
              {client.preferredDoctors.map((d, i) => (
                <p key={i} className="text-sm">
                  {d.name}
                  {d.npi && <span className="text-muted-foreground ml-2">(NPI: {d.npi})</span>}
                </p>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Must-Have Benefits */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Must-Have Benefits</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-1">
            {(client.mustHaveBenefits ?? []).length === 0 ? (
              <span className="text-sm text-muted-foreground">None specified</span>
            ) : (
              client.mustHaveBenefits.map((b) => (
                <Badge key={b} className="text-xs">{b}</Badge>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Benefit Weights */}
      {client.benefitWeights && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Benefit Importance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {(
                [
                  { key: "lowPremium", label: "Low Premium" },
                  { key: "lowCopays", label: "Low Copays" },
                  { key: "dentalGenerosity", label: "Dental Generosity" },
                  { key: "drugCoverage", label: "Drug Coverage" },
                  { key: "supplementalBenefits", label: "Supplemental Benefits" },
                  { key: "starRating", label: "Star Rating" },
                ] as const
              ).map(({ key, label }) => {
                const val = client.benefitWeights[key] ?? 3;
                return (
                  <div key={key} className="flex items-center gap-3">
                    <span className="text-sm w-40 text-muted-foreground">{label}</span>
                    <div className="flex gap-0.5 flex-1">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <div
                          key={i}
                          className={cn(
                            "h-4 flex-1 rounded-sm max-w-12",
                            i < val ? "bg-primary" : "bg-muted"
                          )}
                        />
                      ))}
                    </div>
                    <span className="text-sm font-mono w-6 text-right">{val}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function RecommendationsTab({ clientId }: { clientId: string }) {
  const [, navigate] = useLocation();
  const {
    recommendations,
    generatedAt,
    isLoading,
    generateRecommendations,
    isGenerating,
  } = useRecommendations(clientId);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          {generatedAt && (
            <p className="text-sm text-muted-foreground">
              Last generated: {formatDateTime(generatedAt)}
            </p>
          )}
        </div>
        <Button onClick={() => generateRecommendations()} disabled={isGenerating}>
          {isGenerating ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4 mr-2" />
          )}
          {isGenerating ? "Generating..." : "Generate Recommendations"}
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-48 w-full" />
          ))}
        </div>
      ) : recommendations.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Sparkles className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="font-semibold text-lg mb-1">No Recommendations Yet</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Click "Generate Recommendations" to find the best plans for this client.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="space-y-3">
            {recommendations.map((plan) => (
              <PlanCard key={plan.rank} plan={plan} />
            ))}
          </div>

          <div className="flex gap-2">
            {recommendations.length >= 3 && (
              <Button
                variant="outline"
                onClick={() => {
                  const ids = recommendations.slice(0, 3).map((p) => p.planId).join(",");
                  navigate(`/compare?ids=${ids}`);
                }}
              >
                <Columns3 className="h-4 w-4 mr-2" />
                Compare Top 3
              </Button>
            )}
            <Button variant="outline">
              <Download className="h-4 w-4 mr-2" />
              Export PDF
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function InteractionsTab({ clientId }: { clientId: string }) {
  const { interactions, isLoading } = useInteractions(clientId);

  const actionIcon = (action: string) => {
    switch (action) {
      case "view_plans":
        return <Eye className="h-4 w-4" />;
      case "compare":
        return <Columns3 className="h-4 w-4" />;
      case "export":
        return <Download className="h-4 w-4" />;
      case "discuss":
        return <MessageSquare className="h-4 w-4" />;
      case "recommend":
        return <Sparkles className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const actionLabel = (action: string) => {
    switch (action) {
      case "view_plans":
        return "Viewed Plans";
      case "compare":
        return "Compared Plans";
      case "export":
        return "Exported Report";
      case "discuss":
        return "Discussion";
      case "recommend":
        return "Generated Recommendations";
      default:
        return action;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-16 w-full" />
        ))}
      </div>
    );
  }

  if (interactions.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12 text-center">
          <Clock className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="font-semibold text-lg mb-1">No Interactions Yet</h3>
          <p className="text-sm text-muted-foreground">
            Interactions will appear here as you work with this client.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {interactions.map((interaction: Interaction) => (
        <Card key={interaction.id}>
          <CardContent className="flex items-center gap-4 py-3 px-4">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center">
              {actionIcon(interaction.action)}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium">{actionLabel(interaction.action)}</p>
              {interaction.details && (
                <p className="text-xs text-muted-foreground truncate">{interaction.details}</p>
              )}
            </div>
            <span className="text-xs text-muted-foreground whitespace-nowrap">
              {formatDateTime(interaction.createdAt)}
            </span>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

function SOATab({ clientId, clientName }: { clientId: string; clientName: string }) {
  const { soas, isLoading, createSOA } = useSOA(clientId);
  const { recommendations } = useRecommendations(clientId);
  const { toast } = useToast();
  const [soaFormOpen, setSoaFormOpen] = useState(false);

  const activeSoas = soas.filter((s) => s.status === "active");
  const hasRecommendations = recommendations.length > 0;
  const hasActiveSOA = activeSoas.length > 0;

  const handleSOASubmit = async (data: SOAFormData) => {
    try {
      await createSOA.mutateAsync({
        ...data,
        expiresAt: data.contactMethod === "Telephonic"
          ? new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString()
          : undefined,
      } as Parameters<typeof createSOA.mutateAsync>[0]);
      toast({ title: "SOA created", description: "Scope of Appointment has been recorded." });
      setSoaFormOpen(false);
    } catch (err: unknown) {
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to create SOA",
        variant: "destructive",
      });
    }
  };

  const getExpiryCountdown = (expiresAt?: string) => {
    if (!expiresAt) return null;
    const diff = new Date(expiresAt).getTime() - Date.now();
    if (diff <= 0) return "Expired";
    const hours = Math.floor(diff / (1000 * 60 * 60));
    const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    if (hours > 24) return `${Math.floor(hours / 24)}d ${hours % 24}h`;
    return `${hours}h ${mins}m`;
  };

  return (
    <div className="space-y-4">
      {hasRecommendations && !hasActiveSOA && (
        <Alert variant="destructive" className="bg-yellow-50 border-yellow-300 text-yellow-800 dark:bg-yellow-950 dark:border-yellow-700 dark:text-yellow-200">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            This client has recommendations but no active Scope of Appointment. Create an SOA before presenting plans.
          </AlertDescription>
        </Alert>
      )}

      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Scope of Appointments</h3>
        <Button onClick={() => setSoaFormOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          New SOA
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
      ) : soas.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <FileCheck className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="font-semibold text-lg mb-1">No SOAs</h3>
            <p className="text-sm text-muted-foreground">
              Create a Scope of Appointment before discussing plans.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {soas.map((soa: SOARecord) => (
            <Card
              key={soa.id}
              className={cn(soa.status === "expired" && "opacity-60")}
            >
              <CardContent className="py-3 px-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <FileCheck className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{formatDate(soa.soaDate)}</p>
                      <div className="flex flex-wrap gap-1 mt-0.5">
                        {(soa.planTypes ?? []).map((pt) => (
                          <Badge key={pt} variant="outline" className="text-[10px] py-0">
                            {pt}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="secondary"
                      className={cn(
                        "text-xs",
                        soa.contactMethod === "Telephonic"
                          ? "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200"
                          : soa.contactMethod === "Online"
                          ? "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200"
                          : "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200"
                      )}
                    >
                      {soa.contactMethod}
                    </Badge>
                    <Badge
                      variant={soa.status === "active" ? "default" : "secondary"}
                      className={cn(
                        "text-xs capitalize",
                        soa.status === "active"
                          ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200"
                          : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
                      )}
                    >
                      {soa.status}
                    </Badge>
                    {soa.expiresAt && soa.status === "active" && (
                      <span className="text-xs text-muted-foreground">
                        {getExpiryCountdown(soa.expiresAt)}
                      </span>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <SOAForm
        open={soaFormOpen}
        onOpenChange={setSoaFormOpen}
        clientId={Number(clientId)}
        clientName={clientName}
        onSubmit={handleSOASubmit}
        isSubmitting={createSOA.isPending}
      />
    </div>
  );
}

function DrugCostsTab({ clientId }: { clientId: string }) {
  const { recommendations } = useRecommendations(clientId);
  const { data: client } = useClient(clientId);
  const [medications, setMedications] = useState<MedicationEntry[]>(() => {
    if (!client?.medications) return [];
    return client.medications.map((m) => ({
      name: m.drugName,
      dosage: m.dosage,
      frequency: m.frequency,
    }));
  });

  const planIds = recommendations.map((r) => r.planId);

  const drugCostMedications = medications
    .filter((m) => m.rxcui)
    .map((m) => ({ rxcui: m.rxcui!, name: m.name }));

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Pill className="h-4 w-4" />
            Medications
          </CardTitle>
        </CardHeader>
        <CardContent>
          <MedicationList
            medications={medications}
            onChange={setMedications}
            showFormularyStatus={planIds.length > 0}
            planIds={planIds}
          />
        </CardContent>
      </Card>

      <DrugCostEstimator
        clientId={Number(clientId)}
        planIds={planIds}
        medications={drugCostMedications}
      />
    </div>
  );
}

function ProviderCheckTab({ clientId }: { clientId: string }) {
  const { recommendations } = useRecommendations(clientId);
  const { data: client } = useClient(clientId);
  const [selectedNpi, setSelectedNpi] = useState<string>("");

  const planIds = recommendations.map((r) => r.planId);

  const handleProviderSelect = (provider: ProviderResult) => {
    setSelectedNpi(provider.npi);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Stethoscope className="h-4 w-4" />
            Provider Search
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ProviderSearchInput onSelect={handleProviderSelect} />
        </CardContent>
      </Card>

      {selectedNpi && planIds.length > 0 && (
        <NetworkStatusGrid npi={selectedNpi} planIds={planIds} />
      )}

      {selectedNpi && planIds.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-sm text-muted-foreground">
            Generate recommendations first to check provider network status across plans.
          </CardContent>
        </Card>
      )}

      {/* Show preferred doctors from client profile */}
      {client?.preferredDoctors && client.preferredDoctors.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Preferred Doctors</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {client.preferredDoctors.map((doc, i) => (
              <div
                key={i}
                className="flex items-center justify-between p-2 border rounded-lg"
              >
                <div>
                  <p className="text-sm font-medium">{doc.name}</p>
                  {doc.npi && (
                    <p className="text-xs text-muted-foreground">NPI: {doc.npi}</p>
                  )}
                </div>
                {doc.npi && planIds.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedNpi(doc.npi!)}
                  >
                    Check Network
                  </Button>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ClientDetailContent() {
  const [, navigate] = useLocation();
  const [matched, params] = useRoute("/clients/:id");
  const clientId = params?.id;

  const { data: client, isLoading } = useClient(clientId);

  if (isLoading) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[50vh]">
        <h2 className="text-xl font-semibold mb-2">Client Not Found</h2>
        <p className="text-muted-foreground mb-4">The requested client does not exist.</p>
        <Button onClick={() => navigate("/clients")}>Back to Clients</Button>
      </div>
    );
  }

  const clientName = `${client.firstName} ${client.lastName}`;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => navigate("/clients")}>
            <ChevronLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">{clientName}</h1>
          <Badge
            variant="secondary"
            className={cn("capitalize text-xs", statusBadgeClass(client.status ?? "intake"))}
          >
            {(client.status ?? "intake").replace("_", " ")}
          </Badge>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Pencil className="h-4 w-4 mr-1" />
            Edit
          </Button>
          <Button size="sm" onClick={() => {
            const tabEl = document.querySelector('[data-value="recommendations"]') as HTMLElement;
            tabEl?.click();
          }}>
            <Sparkles className="h-4 w-4 mr-1" />
            Get Recommendations
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList className="flex-wrap h-auto gap-1">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="recommendations" data-value="recommendations">Recommendations</TabsTrigger>
          <TabsTrigger value="drug-costs">Drug Costs</TabsTrigger>
          <TabsTrigger value="provider-check">Provider Check</TabsTrigger>
          <TabsTrigger value="interactions">Interactions</TabsTrigger>
          <TabsTrigger value="soa">SOA</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <OverviewTab clientId={clientId!} />
        </TabsContent>

        <TabsContent value="recommendations" className="mt-4">
          <RecommendationsTab clientId={clientId!} />
        </TabsContent>

        <TabsContent value="drug-costs" className="mt-4">
          <DrugCostsTab clientId={clientId!} />
        </TabsContent>

        <TabsContent value="provider-check" className="mt-4">
          <ProviderCheckTab clientId={clientId!} />
        </TabsContent>

        <TabsContent value="interactions" className="mt-4">
          <InteractionsTab clientId={clientId!} />
        </TabsContent>

        <TabsContent value="soa" className="mt-4">
          <SOATab clientId={clientId!} clientName={clientName} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function ClientDetail() {
  return (
    <AuthGuard roles={["agent", "admin", "compliance"]}>
      <ClientDetailContent />
    </AuthGuard>
  );
}
