import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Download,
  Loader2,
  FileSpreadsheet,
  Stethoscope,
  CreditCard,
  Pill,
  DollarSign,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface PreviewSheet {
  sheet: string;
  headers: string[];
  rows: any[][];
  totalRows: number;
}

interface CarrierOption {
  id: string;
  name: string;
}

const SHEET_META: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  dental: { label: "Dental", icon: Stethoscope, color: "text-blue-600" },
  flex: { label: "Flex", icon: CreditCard, color: "text-purple-600" },
  otc: { label: "OTC", icon: Pill, color: "text-green-600" },
  partb: { label: "Part B", icon: DollarSign, color: "text-amber-600" },
};

export function BenefitGridExport() {
  const [carrier, setCarrier] = useState<string>("");
  const [state, setState] = useState<string>("");
  const [contractId, setContractId] = useState<string>("");
  const [isDownloading, setIsDownloading] = useState(false);
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  // Fetch carriers for dropdown
  const { data: carriers } = useQuery<CarrierOption[]>({
    queryKey: ["/api/carriers"],
    select: (data: any) =>
      (Array.isArray(data) ? data : []).map((c: any) => ({
        id: c.name,
        name: c.name,
      })),
  });

  // Fetch states for dropdown
  const { data: states } = useQuery<{ abbreviation: string; name: string }[]>({
    queryKey: ["/api/states"],
    select: (data: any) =>
      (Array.isArray(data) ? data : []).map((s: any) => ({
        abbreviation: s.abbreviation,
        name: s.name,
      })),
  });

  // Build query string for preview (exclude "__all__" sentinel values)
  const queryParams = new URLSearchParams();
  if (carrier && carrier !== "__all__") queryParams.set("carrier", carrier);
  if (state && state !== "__all__") queryParams.set("state", state);
  if (contractId) queryParams.set("contractId", contractId);
  const queryString = queryParams.toString();

  // Fetch preview counts
  const {
    data: previews,
    isLoading: previewLoading,
    refetch: refetchPreview,
  } = useQuery<PreviewSheet[]>({
    queryKey: [`/api/export/benefit-grid/preview${queryString ? "?" + queryString : ""}`],
    enabled: open,
  });

  const totalRows = previews
    ? previews.reduce((sum, p) => sum + p.totalRows, 0)
    : 0;

  async function handleDownload() {
    setIsDownloading(true);
    try {
      const url = `/api/export/benefit-grid${queryString ? "?" + queryString : ""}`;
      const res = await fetch(url, { credentials: "include" });
      if (!res.ok) throw new Error("Download failed");

      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);

      // Extract filename from Content-Disposition or generate one
      const disposition = res.headers.get("Content-Disposition");
      const match = disposition?.match(/filename="(.+)"/);
      a.download = match ? match[1] : "Benefit_Grid.xlsx";

      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(a.href);
    } catch (err) {
      toast({ title: "Export failed", description: "Please try again.", variant: "destructive" });
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="default" className="gap-2">
          <FileSpreadsheet className="h-4 w-4" />
          Generate Benefit Grid
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>Benefit Grid Export</DialogTitle>
          <DialogDescription>
            Generate a multi-sheet XLSX file matching carrier submission compliance templates.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          {/* Filters */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="carrier-select">Carrier</Label>
              <Select value={carrier} onValueChange={setCarrier}>
                <SelectTrigger id="carrier-select">
                  <SelectValue placeholder="All carriers" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All carriers</SelectItem>
                  {carriers?.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="state-select">State</Label>
              <Select value={state} onValueChange={setState}>
                <SelectTrigger id="state-select">
                  <SelectValue placeholder="All states" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All states</SelectItem>
                  {states
                    ?.sort((a, b) => a.abbreviation.localeCompare(b.abbreviation))
                    .map((s) => (
                      <SelectItem key={s.abbreviation} value={s.abbreviation}>
                        {s.abbreviation} - {s.name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="contract-id">Contract ID (optional)</Label>
            <Input
              id="contract-id"
              placeholder="e.g., H1234"
              value={contractId}
              onChange={(e) => setContractId(e.target.value)}
            />
          </div>

          {/* Preview counts */}
          <div className="space-y-2">
            <Label>Sheet Preview</Label>
            {previewLoading ? (
              <div className="grid grid-cols-2 gap-2">
                {[1, 2, 3, 4].map((i) => (
                  <Skeleton key={i} className="h-16" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {previews?.map((p) => {
                  const meta = SHEET_META[p.sheet];
                  if (!meta) return null;
                  const Icon = meta.icon;
                  return (
                    <Card key={p.sheet} className="border">
                      <CardContent className="p-3 flex items-center gap-3">
                        <Icon className={`h-5 w-5 ${meta.color} shrink-0`} />
                        <div className="min-w-0">
                          <div className="text-sm font-medium">{meta.label}</div>
                          <div className="text-xs text-muted-foreground">
                            {p.totalRows.toLocaleString()} rows
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
            {previews && (
              <p className="text-xs text-muted-foreground text-center">
                Total: {totalRows.toLocaleString()} rows across 4 sheets
              </p>
            )}
          </div>

          {/* Download button */}
          <Button
            onClick={handleDownload}
            disabled={isDownloading || totalRows === 0}
            className="w-full gap-2"
          >
            {isDownloading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Download className="h-4 w-4" />
                Download Benefit Grid ({totalRows.toLocaleString()} rows)
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
