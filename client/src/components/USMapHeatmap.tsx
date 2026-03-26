import { useState, memo } from "react";
import {
  ComposableMap,
  Geographies,
  Geography,
  Annotation,
} from "react-simple-maps";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { type StateData, benefitTypes, type BenefitType } from "@shared/schema";

const geoUrl = "https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json";

interface USMapHeatmapProps {
  data: StateData[];
  selectedBenefit?: BenefitType;
  onBenefitChange?: (benefit: BenefitType) => void;
  onStateClick?: (state: StateData) => void;
  className?: string;
}

const stateNameToAbbr: Record<string, string> = {
  "Alabama": "AL", "Alaska": "AK", "Arizona": "AZ", "Arkansas": "AR",
  "California": "CA", "Colorado": "CO", "Connecticut": "CT", "Delaware": "DE",
  "Florida": "FL", "Georgia": "GA", "Hawaii": "HI", "Idaho": "ID",
  "Illinois": "IL", "Indiana": "IN", "Iowa": "IA", "Kansas": "KS",
  "Kentucky": "KY", "Louisiana": "LA", "Maine": "ME", "Maryland": "MD",
  "Massachusetts": "MA", "Michigan": "MI", "Minnesota": "MN", "Mississippi": "MS",
  "Missouri": "MO", "Montana": "MT", "Nebraska": "NE", "Nevada": "NV",
  "New Hampshire": "NH", "New Jersey": "NJ", "New Mexico": "NM", "New York": "NY",
  "North Carolina": "NC", "North Dakota": "ND", "Ohio": "OH", "Oklahoma": "OK",
  "Oregon": "OR", "Pennsylvania": "PA", "Rhode Island": "RI", "South Carolina": "SC",
  "South Dakota": "SD", "Tennessee": "TN", "Texas": "TX", "Utah": "UT",
  "Vermont": "VT", "Virginia": "VA", "Washington": "WA", "West Virginia": "WV",
  "Wisconsin": "WI", "Wyoming": "WY"
};

function USMapHeatmapComponent({
  data,
  selectedBenefit = "Dental",
  onBenefitChange,
  onStateClick,
  className,
}: USMapHeatmapProps) {
  const [hoveredState, setHoveredState] = useState<StateData | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  const stateDataMap = new Map(data.map((s) => [s.abbreviation, s]));

  const getBenefitValue = (state: StateData, benefit: BenefitType): number => {
    switch (benefit) {
      case "Dental": return state.dentalCoverage;
      case "OTC": return state.otcCoverage;
      case "Flex Card": return state.flexCardCoverage;
      case "Groceries": return state.groceryCoverage;
      case "Transportation": return state.transportationCoverage;
      default: return state.dentalCoverage;
    }
  };

  const getIntensityColor = (value: number): string => {
    if (value >= 90) return "hsl(217, 91%, 60%)";
    if (value >= 85) return "hsl(217, 85%, 55%)";
    if (value >= 80) return "hsl(217, 75%, 50%)";
    if (value >= 70) return "hsl(217, 65%, 45%)";
    if (value >= 60) return "hsl(217, 55%, 40%)";
    return "hsl(217, 45%, 35%)";
  };

  const getBenefitAmount = (state: StateData, benefit: BenefitType): string => {
    switch (benefit) {
      case "Dental": return `$${state.avgDentalAllowance.toLocaleString()}`;
      case "OTC": return `$${state.avgOtcAllowance}/mo`;
      case "Flex Card": return `$${state.avgFlexCard}/mo`;
      case "Groceries": return `$${state.avgGroceryAllowance}/mo`;
      case "Transportation": return `$${state.avgTransportation.toLocaleString()}/yr`;
      default: return `$${state.avgDentalAllowance.toLocaleString()}`;
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    setTooltipPos({ x: e.clientX, y: e.clientY });
  };

  return (
    <Card className={cn("overflow-hidden", className)}>
      <CardHeader className="flex flex-row items-center justify-between gap-4 pb-4">
        <div>
          <CardTitle className="text-xl">State Benefits Heatmap</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Click on a state to view detailed benefits
          </p>
        </div>
        <Select
          value={selectedBenefit}
          onValueChange={(v) => onBenefitChange?.(v as BenefitType)}
        >
          <SelectTrigger className="w-40" data-testid="select-benefit-type">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {benefitTypes.map((benefit) => (
              <SelectItem key={benefit} value={benefit}>
                {benefit}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </CardHeader>
      <CardContent className="relative" onMouseMove={handleMouseMove}>
        <div className="w-full aspect-[1.6/1] min-h-[350px]">
          <ComposableMap
            projection="geoAlbersUsa"
            projectionConfig={{ scale: 1000 }}
            style={{ width: "100%", height: "100%" }}
          >
            <Geographies geography={geoUrl}>
              {({ geographies }) =>
                geographies.map((geo) => {
                  const stateName = geo.properties.name;
                  const abbr = stateNameToAbbr[stateName];
                  const stateInfo = abbr ? stateDataMap.get(abbr) : null;
                  const hasData = !!stateInfo;
                  const value = stateInfo ? getBenefitValue(stateInfo, selectedBenefit) : 0;
                  const fillColor = hasData ? getIntensityColor(value) : "hsl(var(--muted))";
                  const isHovered = hoveredState?.abbreviation === abbr;

                  return (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      fill={fillColor}
                      stroke="hsl(var(--background))"
                      strokeWidth={isHovered ? 2 : 0.75}
                      style={{
                        default: { outline: "none" },
                        hover: { outline: "none", filter: "brightness(1.15)" },
                        pressed: { outline: "none" },
                      }}
                      onMouseEnter={() => stateInfo && setHoveredState(stateInfo)}
                      onMouseLeave={() => setHoveredState(null)}
                      onClick={() => stateInfo && onStateClick?.(stateInfo)}
                      data-testid={abbr ? `state-${abbr.toLowerCase()}` : undefined}
                    />
                  );
                })
              }
            </Geographies>
          </ComposableMap>
        </div>

        {hoveredState && (
          <div 
            className="fixed bg-card border rounded-md p-4 shadow-lg min-w-60 z-50 pointer-events-none"
            style={{
              left: tooltipPos.x + 15,
              top: tooltipPos.y + 15,
            }}
          >
            <div className="flex items-center justify-between gap-4 mb-3">
              <h4 className="font-semibold">{hoveredState.name}</h4>
              <Badge variant="secondary">{hoveredState.planCount} plans</Badge>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between gap-6">
                <span className="text-muted-foreground">{selectedBenefit} Coverage:</span>
                <span className="font-medium">{getBenefitValue(hoveredState, selectedBenefit)}%</span>
              </div>
              <div className="flex justify-between gap-6">
                <span className="text-muted-foreground">Avg Amount:</span>
                <span className="font-mono font-medium">{getBenefitAmount(hoveredState, selectedBenefit)}</span>
              </div>
              <div className="flex justify-between gap-6">
                <span className="text-muted-foreground">PCP Copay:</span>
                <span className="font-mono">${hoveredState.pcpCopay}</span>
              </div>
            </div>
          </div>
        )}

        <div className="absolute bottom-4 right-4 bg-card border rounded-md p-3 shadow-sm">
          <p className="text-xs font-medium mb-2">Coverage Intensity</p>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded" style={{ background: "hsl(var(--muted))" }} title="No Data" />
            <div className="w-4 h-4 rounded" style={{ background: "hsl(217, 45%, 35%)" }} />
            <div className="w-4 h-4 rounded" style={{ background: "hsl(217, 55%, 40%)" }} />
            <div className="w-4 h-4 rounded" style={{ background: "hsl(217, 65%, 45%)" }} />
            <div className="w-4 h-4 rounded" style={{ background: "hsl(217, 75%, 50%)" }} />
            <div className="w-4 h-4 rounded" style={{ background: "hsl(217, 91%, 60%)" }} />
          </div>
          <div className="flex justify-between text-[10px] text-muted-foreground mt-1">
            <span>Low</span>
            <span>High</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export const USMapHeatmap = memo(USMapHeatmapComponent);
