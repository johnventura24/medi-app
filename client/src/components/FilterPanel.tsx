import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { X, RotateCcw, Filter } from "lucide-react";
import { cn } from "@/lib/utils";
import { benefitTypes, type BenefitType } from "@shared/schema";

export interface FilterState {
  benefits: BenefitType[];
  minDental: number;
  maxDental: number;
  minOtc: number;
  maxOtc: number;
  carriers: string[];
  planTypes: string[];
  zeroPremium: boolean;
  zeroDeductible: boolean;
}

const defaultFilters: FilterState = {
  benefits: [],
  minDental: 0,
  maxDental: 5000,
  minOtc: 0,
  maxOtc: 400,
  carriers: [],
  planTypes: [],
  zeroPremium: false,
  zeroDeductible: false,
};

const carriers = ["Humana", "UnitedHealthcare", "Aetna", "Kaiser", "Anthem BCBS", "Cigna", "Centene", "Molina"];
const planTypes = ["HMO", "PPO", "HMO-POS", "PFFS"];

interface FilterPanelProps {
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  className?: string;
}

export function FilterPanel({ filters, onFiltersChange, className }: FilterPanelProps) {
  const [localFilters, setLocalFilters] = useState(filters);

  const activeFilterCount = [
    localFilters.benefits.length > 0,
    localFilters.minDental > 0 || localFilters.maxDental < 5000,
    localFilters.minOtc > 0 || localFilters.maxOtc < 400,
    localFilters.carriers.length > 0,
    localFilters.planTypes.length > 0,
    localFilters.zeroPremium,
    localFilters.zeroDeductible,
  ].filter(Boolean).length;

  const handleReset = () => {
    setLocalFilters(defaultFilters);
    onFiltersChange(defaultFilters);
  };

  const handleApply = () => {
    onFiltersChange(localFilters);
  };

  const toggleArrayItem = <K extends keyof FilterState>(
    key: K,
    item: FilterState[K] extends Array<infer U> ? U : never
  ) => {
    setLocalFilters((prev) => {
      const arr = prev[key] as unknown[];
      const newArr = arr.includes(item)
        ? arr.filter((i) => i !== item)
        : [...arr, item];
      return { ...prev, [key]: newArr };
    });
  };

  return (
    <div className={cn("bg-card border rounded-md p-4", className)}>
      <div className="flex items-center justify-between gap-4 mb-4">
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4" />
          <span className="font-semibold">Filters</span>
          {activeFilterCount > 0 && (
            <Badge variant="secondary" className="text-xs">
              {activeFilterCount} active
            </Badge>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleReset}
          data-testid="button-reset-filters"
        >
          <RotateCcw className="h-3 w-3 mr-1" />
          Reset
        </Button>
      </div>

      <Accordion type="multiple" defaultValue={["benefits", "amounts"]} className="space-y-2">
        <AccordionItem value="benefits" className="border-none">
          <AccordionTrigger className="text-sm py-2 hover:no-underline">
            Benefit Types
          </AccordionTrigger>
          <AccordionContent>
            <div className="grid grid-cols-2 gap-2">
              {benefitTypes.map((benefit) => (
                <label
                  key={benefit}
                  className="flex items-center gap-2 text-sm cursor-pointer"
                >
                  <Checkbox
                    checked={localFilters.benefits.includes(benefit)}
                    onCheckedChange={() => toggleArrayItem("benefits", benefit)}
                    data-testid={`checkbox-benefit-${benefit.toLowerCase().replace(/\s+/g, '-')}`}
                  />
                  {benefit}
                </label>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="amounts" className="border-none">
          <AccordionTrigger className="text-sm py-2 hover:no-underline">
            Benefit Amounts
          </AccordionTrigger>
          <AccordionContent className="space-y-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-xs">Dental Allowance</Label>
                <span className="text-xs font-mono text-muted-foreground">
                  ${localFilters.minDental.toLocaleString()} - ${localFilters.maxDental.toLocaleString()}
                </span>
              </div>
              <Slider
                value={[localFilters.minDental, localFilters.maxDental]}
                min={0}
                max={5000}
                step={100}
                onValueChange={([min, max]) =>
                  setLocalFilters((p) => ({ ...p, minDental: min, maxDental: max }))
                }
                data-testid="slider-dental"
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-2">
                <Label className="text-xs">OTC Allowance (monthly)</Label>
                <span className="text-xs font-mono text-muted-foreground">
                  ${localFilters.minOtc} - ${localFilters.maxOtc}
                </span>
              </div>
              <Slider
                value={[localFilters.minOtc, localFilters.maxOtc]}
                min={0}
                max={400}
                step={20}
                onValueChange={([min, max]) =>
                  setLocalFilters((p) => ({ ...p, minOtc: min, maxOtc: max }))
                }
                data-testid="slider-otc"
              />
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="carriers" className="border-none">
          <AccordionTrigger className="text-sm py-2 hover:no-underline">
            Carriers
          </AccordionTrigger>
          <AccordionContent>
            <div className="grid grid-cols-2 gap-2">
              {carriers.map((carrier) => (
                <label
                  key={carrier}
                  className="flex items-center gap-2 text-sm cursor-pointer"
                >
                  <Checkbox
                    checked={localFilters.carriers.includes(carrier)}
                    onCheckedChange={() => toggleArrayItem("carriers", carrier)}
                    data-testid={`checkbox-carrier-${carrier.toLowerCase().replace(/\s+/g, '-')}`}
                  />
                  {carrier}
                </label>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="plan-types" className="border-none">
          <AccordionTrigger className="text-sm py-2 hover:no-underline">
            Plan Types
          </AccordionTrigger>
          <AccordionContent>
            <div className="flex flex-wrap gap-2">
              {planTypes.map((type) => (
                <label
                  key={type}
                  className="flex items-center gap-2 text-sm cursor-pointer"
                >
                  <Checkbox
                    checked={localFilters.planTypes.includes(type)}
                    onCheckedChange={() => toggleArrayItem("planTypes", type)}
                    data-testid={`checkbox-plantype-${type.toLowerCase()}`}
                  />
                  {type}
                </label>
              ))}
            </div>
          </AccordionContent>
        </AccordionItem>

        <AccordionItem value="cost" className="border-none">
          <AccordionTrigger className="text-sm py-2 hover:no-underline">
            Cost Options
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={localFilters.zeroPremium}
                  onCheckedChange={(checked) =>
                    setLocalFilters((p) => ({ ...p, zeroPremium: !!checked }))
                  }
                  data-testid="checkbox-zero-premium"
                />
                $0 Premium Plans Only
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox
                  checked={localFilters.zeroDeductible}
                  onCheckedChange={(checked) =>
                    setLocalFilters((p) => ({ ...p, zeroDeductible: !!checked }))
                  }
                  data-testid="checkbox-zero-deductible"
                />
                $0 Deductible Plans Only
              </label>
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      {localFilters.benefits.length > 0 && (
        <div className="mt-4 pt-4 border-t">
          <p className="text-xs text-muted-foreground mb-2">Active benefit filters:</p>
          <div className="flex flex-wrap gap-1">
            {localFilters.benefits.map((b) => (
              <Badge
                key={b}
                variant="secondary"
                className="cursor-pointer"
                onClick={() => toggleArrayItem("benefits", b)}
              >
                {b}
                <X className="h-3 w-3 ml-1" />
              </Badge>
            ))}
          </div>
        </div>
      )}

      <Button
        className="w-full mt-4"
        onClick={handleApply}
        data-testid="button-apply-filters"
      >
        Apply Filters
      </Button>
    </div>
  );
}

export { defaultFilters };
