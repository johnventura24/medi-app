import { BenefitCard } from "../BenefitCard";
import { Stethoscope, Pill, CreditCard, ShoppingCart } from "lucide-react";

export default function BenefitCardExample() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-6 p-6">
      <BenefitCard
        icon={<Stethoscope className="h-6 w-6 text-chart-1" />}
        title="Dental"
        value={3500}
        prefix="$"
        suffix="/yr"
        coverage={94}
        details={[
          { label: "Preventive", value: "100% covered" },
          { label: "Comprehensive", value: "$2,500 max" },
          { label: "Top State", value: "California" },
        ]}
        onViewDetails={() => console.log("View dental details")}
      />
      <BenefitCard
        icon={<Pill className="h-6 w-6 text-chart-2" />}
        title="OTC Allowance"
        value={280}
        prefix="$"
        suffix="/mo"
        coverage={89}
        details={[
          { label: "Quarterly", value: "$840" },
          { label: "Annual Total", value: "$3,360" },
          { label: "Top State", value: "Florida" },
        ]}
        onViewDetails={() => console.log("View OTC details")}
      />
      <BenefitCard
        icon={<CreditCard className="h-6 w-6 text-chart-3" />}
        title="Flex Card"
        value={420}
        prefix="$"
        suffix="/mo"
        coverage={72}
        details={[
          { label: "Use For", value: "Medical + More" },
          { label: "Annual Total", value: "$5,040" },
          { label: "Top State", value: "Texas" },
        ]}
        onViewDetails={() => console.log("View flex card details")}
      />
      <BenefitCard
        icon={<ShoppingCart className="h-6 w-6 text-chart-4" />}
        title="Groceries"
        value={180}
        prefix="$"
        suffix="/mo"
        coverage={45}
        details={[
          { label: "Quarterly", value: "$540" },
          { label: "Annual Total", value: "$2,160" },
          { label: "Top Region", value: "Midwest" },
        ]}
        onViewDetails={() => console.log("View grocery details")}
      />
    </div>
  );
}
