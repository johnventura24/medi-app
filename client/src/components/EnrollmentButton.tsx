import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { ExternalLink, Phone } from "lucide-react";

interface EnrollmentButtonProps {
  carrier: string;
  state?: string;
  zip?: string;
  size?: "sm" | "default" | "lg";
  className?: string;
}

interface EnrollmentLinkResult {
  url: string | null;
  phone: string | null;
  type: "online" | "phone" | "both" | "unknown";
  carrierName: string;
}

export function EnrollmentButton({
  carrier,
  state,
  zip,
  size = "sm",
  className,
}: EnrollmentButtonProps) {
  const { data } = useQuery<EnrollmentLinkResult>({
    queryKey: ["/api/enrollment-link", carrier, state, zip],
    queryFn: async () => {
      const params = new URLSearchParams({ carrier });
      if (state) params.set("state", state);
      if (zip) params.set("zip", zip);
      const res = await fetch(`/api/enrollment-link?${params}`);
      if (!res.ok) return { url: null, phone: null, type: "unknown" as const, carrierName: carrier };
      return res.json();
    },
    staleTime: Infinity,
  });

  if (!data) return null;

  return (
    <div className={`flex items-center gap-2 ${className ?? ""}`}>
      {data.url && data.type !== "phone" ? (
        <Button
          size={size}
          variant="default"
          onClick={() => window.open(data.url!, "_blank")}
        >
          <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
          Enroll Online
        </Button>
      ) : data.type === "unknown" ? (
        <Button size={size} variant="outline" disabled>
          Contact {carrier}
        </Button>
      ) : null}
      {data.phone && data.phone !== "varies by state" && (
        <Button
          size={size}
          variant="outline"
          onClick={() => window.open(`tel:${data.phone}`, "_self")}
          title="Call to enroll"
        >
          <Phone className="h-3.5 w-3.5 mr-1.5" />
          {data.phone}
        </Button>
      )}
      {data.phone === "varies by state" && (
        <span className="text-xs text-muted-foreground">Phone varies by state</span>
      )}
    </div>
  );
}
