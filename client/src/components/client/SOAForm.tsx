import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, AlertTriangle } from "lucide-react";

interface SOAFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clientId: number;
  clientName: string;
  onSubmit: (data: SOAFormData) => void;
  isSubmitting?: boolean;
}

export interface SOAFormData {
  clientId: number;
  beneficiaryName: string;
  soaDate: string;
  planTypes: string[];
  contactMethod: "In Person" | "Telephonic" | "Online";
  beneficiaryInitiated: boolean;
  signature: string;
}

const PLAN_TYPE_OPTIONS = [
  "MA",
  "MAPD",
  "PDP",
  "Medicare Supplement",
  "Dental/Vision/Hearing",
];

const CONTACT_METHODS = ["In Person", "Telephonic", "Online"] as const;

export function SOAForm({
  open,
  onOpenChange,
  clientId,
  clientName,
  onSubmit,
  isSubmitting = false,
}: SOAFormProps) {
  const today = new Date().toISOString().split("T")[0];
  const [beneficiaryName, setBeneficiaryName] = useState(clientName);
  const [soaDate, setSoaDate] = useState(today);
  const [planTypes, setPlanTypes] = useState<string[]>([]);
  const [contactMethod, setContactMethod] = useState<"In Person" | "Telephonic" | "Online">("In Person");
  const [beneficiaryInitiated, setBeneficiaryInitiated] = useState(false);
  const [signature, setSignature] = useState("");

  const togglePlanType = (pt: string) => {
    setPlanTypes((prev) =>
      prev.includes(pt) ? prev.filter((p) => p !== pt) : [...prev, pt]
    );
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      clientId,
      beneficiaryName,
      soaDate,
      planTypes,
      contactMethod,
      beneficiaryInitiated,
      signature,
    });
  };

  const isValid = beneficiaryName.trim() && soaDate && planTypes.length > 0 && signature.trim();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>New Scope of Appointment</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="soa-name">Beneficiary Name</Label>
            <Input
              id="soa-name"
              value={beneficiaryName}
              onChange={(e) => setBeneficiaryName(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="soa-date">SOA Date</Label>
            <Input
              id="soa-date"
              type="date"
              value={soaDate}
              onChange={(e) => setSoaDate(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <Label>Plan Types to Discuss</Label>
            <div className="grid grid-cols-2 gap-2">
              {PLAN_TYPE_OPTIONS.map((pt) => (
                <label
                  key={pt}
                  className="flex items-center gap-2 text-sm cursor-pointer"
                >
                  <Checkbox
                    checked={planTypes.includes(pt)}
                    onCheckedChange={() => togglePlanType(pt)}
                  />
                  {pt}
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Contact Method</Label>
            <div className="flex gap-4">
              {CONTACT_METHODS.map((method) => (
                <label
                  key={method}
                  className="flex items-center gap-2 text-sm cursor-pointer"
                >
                  <input
                    type="radio"
                    name="contactMethod"
                    value={method}
                    checked={contactMethod === method}
                    onChange={() => setContactMethod(method)}
                    className="accent-primary"
                  />
                  {method}
                </label>
              ))}
            </div>
          </div>

          {contactMethod === "Telephonic" && (
            <Alert variant="destructive" className="bg-yellow-50 border-yellow-300 text-yellow-800 dark:bg-yellow-950 dark:border-yellow-700 dark:text-yellow-200">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                SOA expires 48 hours after signing for telephonic contacts.
              </AlertDescription>
            </Alert>
          )}

          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <Checkbox
              checked={beneficiaryInitiated}
              onCheckedChange={(v) => setBeneficiaryInitiated(!!v)}
            />
            Beneficiary Initiated Contact
          </label>

          <div className="space-y-2">
            <Label htmlFor="soa-signature">Signature (type your name)</Label>
            <Input
              id="soa-signature"
              value={signature}
              onChange={(e) => setSignature(e.target.value)}
              placeholder="Type your name as signature"
              required
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!isValid || isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Submit SOA
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
