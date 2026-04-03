import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  ArrowLeft, 
  TrendingUp,
  MapPin,
  Building2,
  DollarSign,
  Stethoscope,
  Pill,
  CreditCard,
  ShoppingCart,
  Car,
  Eye,
  Ear,
  Heart
} from "lucide-react";
import { PageHeader } from "@/components/PageHeader";

interface BenefitDetailData {
  benefitType: string;
  avgBenefit: number;
  avgCoverage: number;
  topStates: {
    id: string;
    name: string;
    abbreviation: string;
    planCount: number;
    avgBenefit: number;
    coverage: number;
  }[];
  zipsWithBenefit: {
    zip: string;
    city: string;
    state: string;
    planCount: number;
    maxBenefit: number;
    desirabilityScore: number;
  }[];
  totalZips: number;
}

const benefitIcons: Record<string, JSX.Element> = {
  'dental': <Stethoscope className="h-6 w-6" />,
  'otc': <Pill className="h-6 w-6" />,
  'flex card': <CreditCard className="h-6 w-6" />,
  'groceries': <ShoppingCart className="h-6 w-6" />,
  'transportation': <Car className="h-6 w-6" />,
  'vision': <Eye className="h-6 w-6" />,
  'hearing': <Ear className="h-6 w-6" />,
  'insulin': <Heart className="h-6 w-6" />
};

export default function BenefitDetailView() {
  const params = useParams<{ type: string }>();
  const benefitType = params.type || 'dental';
  const [visibleZips, setVisibleZips] = useState(20);

  const { data, isLoading, isError } = useQuery<BenefitDetailData>({
    queryKey: ["/api/benefits", benefitType],
  });

  if (isLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-4 w-24 mb-2" />
                <Skeleton className="h-8 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  if (isError) {
    return (
      <div className="p-6 space-y-6">
        <Link href="/benefits">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div className="text-center py-12 text-muted-foreground">
          <p className="text-lg font-medium">Failed to load benefit data</p>
          <p className="text-sm mt-1">Please try again later or select a different benefit type.</p>
        </div>
      </div>
    );
  }

  const icon = benefitIcons[benefitType.toLowerCase()] || <DollarSign className="h-6 w-6" />;
  const displayName = benefitType.charAt(0).toUpperCase() + benefitType.slice(1);

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <Link href="/benefits">
          <Button variant="ghost" size="icon" data-testid="button-back">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
      </div>
      <PageHeader
        title={`${displayName} Benefits`}
        description="Detailed analysis across states and ZIP codes for this benefit type."
        helpText="Review which states and ZIP codes offer the richest benefits. Use this data to target your marketing efforts."
        dataSource="Data: CMS CY2026 PBP files broken down by state and ZIP code. Benefit availability percentages calculated from plans available in each geography."
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <DollarSign className="h-4 w-4" />
              <span className="text-sm">Average Benefit</span>
            </div>
            <p className="text-3xl font-bold" data-testid="text-avg-benefit">
              ${data?.avgBenefit?.toLocaleString() || 0}
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <TrendingUp className="h-4 w-4" />
              <span className="text-sm">Average Coverage</span>
            </div>
            <p className="text-3xl font-bold" data-testid="text-avg-coverage">
              {data?.avgCoverage || 0}%
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-2 text-muted-foreground mb-2">
              <MapPin className="h-4 w-4" />
              <span className="text-sm">ZIP Codes with Benefit</span>
            </div>
            <p className="text-3xl font-bold" data-testid="text-total-zips">
              {data?.totalZips?.toLocaleString() || 0}
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Top States for {displayName}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {(!data?.topStates || data.topStates.length === 0) && (
                <p className="text-sm text-muted-foreground text-center py-8">No state data available for this benefit type.</p>
              )}
              {data?.topStates?.map((state, index) => (
                <div 
                  key={state.id} 
                  className="flex items-center justify-between p-3 rounded-md bg-muted/50"
                  data-testid={`row-state-${state.abbreviation}`}
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg font-bold text-muted-foreground w-6">
                      {index + 1}
                    </span>
                    <div>
                      <p className="font-medium">{state.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {state.planCount.toLocaleString()} plans
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-lg">${state.avgBenefit.toLocaleString()}</p>
                    <Badge variant="secondary" className="text-xs">
                      {state.coverage}% coverage
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              ZIP Codes with {displayName} Benefits
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {(!data?.zipsWithBenefit || data.zipsWithBenefit.length === 0) && (
                <p className="text-sm text-muted-foreground text-center py-8">No ZIP code data available for this benefit type.</p>
              )}
              {data?.zipsWithBenefit?.slice(0, visibleZips).map((zip) => (
                <div 
                  key={zip.zip} 
                  className="flex items-center justify-between p-2 rounded-md hover-elevate"
                  data-testid={`row-zip-${zip.zip}`}
                >
                  <div className="flex items-center gap-3">
                    <Badge variant="outline">{zip.zip}</Badge>
                    <div>
                      <p className="font-medium text-sm">{zip.city}, {zip.state}</p>
                      <p className="text-xs text-muted-foreground">
                        {zip.planCount} plans
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">${zip.maxBenefit.toLocaleString()}</p>
                    <p className="text-xs text-muted-foreground">
                      Score: {zip.desirabilityScore}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            {data?.zipsWithBenefit && visibleZips < data.zipsWithBenefit.length && (
              <Button 
                variant="outline" 
                className="w-full mt-4"
                onClick={() => setVisibleZips(prev => prev + 20)}
                data-testid="button-load-more-zips"
              >
                Load More ({data.zipsWithBenefit.length - visibleZips} remaining)
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
