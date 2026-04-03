import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CheckCircle, XCircle, Loader2 } from "lucide-react";

interface VerifyNetworkButtonProps {
  npi: string;
  carrier: string;
  contractId?: string;
  onVerified?: (inNetwork: boolean) => void;
}

export function VerifyNetworkButton({ npi, carrier, contractId, onVerified }: VerifyNetworkButtonProps) {
  const [status, setStatus] = useState<"idle" | "saving" | "verified_in" | "verified_out">("idle");

  async function handleVerify(inNetwork: boolean) {
    setStatus("saving");
    try {
      const res = await fetch("/api/providers/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          npi,
          carrier,
          contractId: contractId || null,
          inNetwork,
          source: "agent_verified",
        }),
      });
      if (res.ok) {
        setStatus(inNetwork ? "verified_in" : "verified_out");
        onVerified?.(inNetwork);
      } else {
        setStatus("idle");
      }
    } catch {
      setStatus("idle");
    }
  }

  if (status === "verified_in") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-green-600 font-medium">
        <CheckCircle className="h-3.5 w-3.5" />
        Verified in-network
      </span>
    );
  }

  if (status === "verified_out") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-red-600 font-medium">
        <XCircle className="h-3.5 w-3.5" />
        Verified out-of-network
      </span>
    );
  }

  if (status === "saving") {
    return <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />;
  }

  return (
    <div className="inline-flex items-center gap-1">
      <span className="text-xs text-muted-foreground mr-1">I verified:</span>
      <Button
        size="sm"
        variant="outline"
        className="h-6 px-2 text-xs text-green-700 border-green-300 hover:bg-green-50"
        onClick={() => handleVerify(true)}
      >
        <CheckCircle className="h-3 w-3 mr-1" />
        In
      </Button>
      <Button
        size="sm"
        variant="outline"
        className="h-6 px-2 text-xs text-red-700 border-red-300 hover:bg-red-50"
        onClick={() => handleVerify(false)}
      >
        <XCircle className="h-3 w-3 mr-1" />
        Out
      </Button>
    </div>
  );
}
