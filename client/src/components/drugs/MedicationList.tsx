import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { X, Plus } from "lucide-react";
import { DrugSearchAutocomplete } from "@/components/drugs/DrugSearchAutocomplete";
import { FormularyStatusBadge } from "@/components/drugs/FormularyStatusBadge";
import { useFormularyCheck } from "@/hooks/useDrugCosts";
import type { DrugSearchResult } from "@/hooks/useDrugSearch";

export interface MedicationEntry {
  rxcui?: string;
  name: string;
  dosage?: string;
  frequency?: string;
}

interface MedicationListProps {
  medications: MedicationEntry[];
  onChange: (meds: MedicationEntry[]) => void;
  showFormularyStatus?: boolean;
  planIds?: number[];
  contractIds?: string[];
}

export function MedicationList({
  medications,
  onChange,
  showFormularyStatus = false,
  contractIds = [],
}: MedicationListProps) {
  const rxcuis = medications
    .map((m) => m.rxcui)
    .filter((r): r is string => !!r);

  const { data: formularyData } = useFormularyCheck(
    contractIds,
    rxcuis,
    showFormularyStatus && contractIds.length > 0 && rxcuis.length > 0
  );

  const handleAdd = (drug: DrugSearchResult) => {
    const newMed: MedicationEntry = {
      rxcui: drug.rxcui,
      name: `${drug.name} ${drug.strength}`,
      dosage: drug.strength,
      frequency: "daily",
    };
    onChange([...medications, newMed]);
  };

  const handleRemove = (index: number) => {
    onChange(medications.filter((_, i) => i !== index));
  };

  const handleUpdate = (index: number, updates: Partial<MedicationEntry>) => {
    onChange(
      medications.map((m, i) => (i === index ? { ...m, ...updates } : m))
    );
  };

  const getFormularyStatus = (rxcui?: string) => {
    if (!rxcui || !formularyData?.results) return null;
    return formularyData.results.find((r) => r.rxcui === rxcui);
  };

  return (
    <div className="space-y-3">
      {medications.map((med, index) => {
        const formulary = getFormularyStatus(med.rxcui);

        return (
          <div
            key={`${med.rxcui ?? med.name}-${index}`}
            className="flex items-start gap-2 p-3 border rounded-lg bg-muted/30"
          >
            <div className="flex-1 min-w-0 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium truncate">{med.name}</span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Input
                  value={med.dosage ?? ""}
                  onChange={(e) =>
                    handleUpdate(index, { dosage: e.target.value })
                  }
                  placeholder="Dosage"
                  className="w-32 h-8 text-xs"
                />
                <Select
                  value={med.frequency ?? "daily"}
                  onValueChange={(v) => handleUpdate(index, { frequency: v })}
                >
                  <SelectTrigger className="w-32 h-8 text-xs">
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
              {showFormularyStatus && formulary && (
                <div className="flex flex-wrap gap-2 mt-1">
                  {formulary.plans.map((plan) => (
                    <div key={plan.planId} className="flex items-center gap-1">
                      <span className="text-[10px] text-muted-foreground">
                        {plan.contractId}:
                      </span>
                      <FormularyStatusBadge
                        covered={plan.covered}
                        tier={plan.tier}
                        tierLabel={plan.tierLabel}
                        priorAuth={plan.priorAuth}
                        stepTherapy={plan.stepTherapy}
                        quantityLimit={plan.quantityLimit}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive shrink-0"
              onClick={() => handleRemove(index)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        );
      })}

      <div className="space-y-2">
        <DrugSearchAutocomplete
          onSelect={handleAdd}
          placeholder="Add a medication..."
        />
        <p className="text-xs text-muted-foreground">
          Search by drug name to add medications to the list
        </p>
      </div>
    </div>
  );
}
