// todo: remove mock functionality - replace with real API data

export interface StateData {
  id: string;
  name: string;
  abbreviation: string;
  planCount: number;
  avgDentalAllowance: number;
  avgOtcAllowance: number;
  avgFlexCard: number;
  avgGroceryAllowance: number;
  avgTransportation: number;
  pcpCopay: number;
  specialistCopay: number;
  dentalCoverage: number;
  otcCoverage: number;
  flexCardCoverage: number;
  groceryCoverage: number;
  transportationCoverage: number;
}

export interface CityData {
  id: string;
  city: string;
  state: string;
  stateAbbr: string;
  planCount: number;
  carrierCount: number;
  topCarrier: string;
  maxDental: number;
  maxOtc: number;
  maxFlexCard: number;
  maxGrocery: number;
  avgPcpCopay: number;
}

export interface ZipData {
  id: string;
  zip: string;
  city: string;
  state: string;
  planCount: number;
  desirabilityScore: number;
  topBenefit: string;
  hasFlexCard: boolean;
  hasOtc: boolean;
  maxDental: number;
  maxOtc: number;
}

export interface CarrierData {
  id: string;
  name: string;
  statesServed: number;
  totalPlans: number;
  avgDentalAllowance: number;
  avgOtcAllowance: number;
  avgFlexCard: number;
  marketShare: number;
}

export interface PlanData {
  id: string;
  planName: string;
  carrier: string;
  planType: string;
  premium: number;
  deductible: number;
  moop: number;
  pcpCopay: number;
  specialistCopay: number;
  hospitalCopay: number;
  erCopay: number;
  dentalAllowance: number;
  otcAllowance: number;
  flexCard: number;
  groceryAllowance: number;
  transportation: number;
  vision: number;
  hearing: number;
  insulin: number;
  state: string;
  city: string;
  zip: string;
}

export interface TargetingRecommendation {
  id: string;
  location: string;
  locationType: 'state' | 'city' | 'zip';
  bestAngle: string;
  reasoning: string;
  score: number;
  metrics: {
    planCount: number;
    avgBenefit: number;
    coverage: number;
  };
}

export const stateData: StateData[] = [
  { id: '1', name: 'Florida', abbreviation: 'FL', planCount: 342, avgDentalAllowance: 3500, avgOtcAllowance: 280, avgFlexCard: 420, avgGroceryAllowance: 180, avgTransportation: 1200, pcpCopay: 0, specialistCopay: 25, dentalCoverage: 94, otcCoverage: 89, flexCardCoverage: 72, groceryCoverage: 45, transportationCoverage: 68 },
  { id: '2', name: 'Texas', abbreviation: 'TX', planCount: 298, avgDentalAllowance: 3200, avgOtcAllowance: 260, avgFlexCard: 380, avgGroceryAllowance: 150, avgTransportation: 1100, pcpCopay: 0, specialistCopay: 30, dentalCoverage: 91, otcCoverage: 86, flexCardCoverage: 68, groceryCoverage: 38, transportationCoverage: 62 },
  { id: '3', name: 'California', abbreviation: 'CA', planCount: 412, avgDentalAllowance: 4000, avgOtcAllowance: 320, avgFlexCard: 480, avgGroceryAllowance: 200, avgTransportation: 1400, pcpCopay: 5, specialistCopay: 20, dentalCoverage: 96, otcCoverage: 92, flexCardCoverage: 78, groceryCoverage: 52, transportationCoverage: 74 },
  { id: '4', name: 'New York', abbreviation: 'NY', planCount: 256, avgDentalAllowance: 3800, avgOtcAllowance: 300, avgFlexCard: 450, avgGroceryAllowance: 190, avgTransportation: 1350, pcpCopay: 0, specialistCopay: 25, dentalCoverage: 93, otcCoverage: 88, flexCardCoverage: 75, groceryCoverage: 48, transportationCoverage: 70 },
  { id: '5', name: 'Pennsylvania', abbreviation: 'PA', planCount: 189, avgDentalAllowance: 2800, avgOtcAllowance: 220, avgFlexCard: 320, avgGroceryAllowance: 140, avgTransportation: 980, pcpCopay: 5, specialistCopay: 35, dentalCoverage: 85, otcCoverage: 78, flexCardCoverage: 58, groceryCoverage: 32, transportationCoverage: 55 },
  { id: '6', name: 'Ohio', abbreviation: 'OH', planCount: 167, avgDentalAllowance: 2600, avgOtcAllowance: 200, avgFlexCard: 300, avgGroceryAllowance: 160, avgTransportation: 900, pcpCopay: 5, specialistCopay: 30, dentalCoverage: 82, otcCoverage: 75, flexCardCoverage: 55, groceryCoverage: 42, transportationCoverage: 52 },
  { id: '7', name: 'Arizona', abbreviation: 'AZ', planCount: 145, avgDentalAllowance: 3100, avgOtcAllowance: 250, avgFlexCard: 360, avgGroceryAllowance: 145, avgTransportation: 1050, pcpCopay: 0, specialistCopay: 25, dentalCoverage: 88, otcCoverage: 82, flexCardCoverage: 65, groceryCoverage: 36, transportationCoverage: 60 },
  { id: '8', name: 'Illinois', abbreviation: 'IL', planCount: 178, avgDentalAllowance: 2900, avgOtcAllowance: 230, avgFlexCard: 340, avgGroceryAllowance: 170, avgTransportation: 1000, pcpCopay: 5, specialistCopay: 30, dentalCoverage: 86, otcCoverage: 80, flexCardCoverage: 60, groceryCoverage: 44, transportationCoverage: 58 },
  { id: '9', name: 'Michigan', abbreviation: 'MI', planCount: 134, avgDentalAllowance: 2500, avgOtcAllowance: 190, avgFlexCard: 280, avgGroceryAllowance: 155, avgTransportation: 850, pcpCopay: 10, specialistCopay: 35, dentalCoverage: 80, otcCoverage: 72, flexCardCoverage: 50, groceryCoverage: 40, transportationCoverage: 48 },
  { id: '10', name: 'Georgia', abbreviation: 'GA', planCount: 156, avgDentalAllowance: 3000, avgOtcAllowance: 240, avgFlexCard: 350, avgGroceryAllowance: 165, avgTransportation: 1020, pcpCopay: 0, specialistCopay: 25, dentalCoverage: 87, otcCoverage: 81, flexCardCoverage: 62, groceryCoverage: 41, transportationCoverage: 59 },
  { id: '11', name: 'North Carolina', abbreviation: 'NC', planCount: 142, avgDentalAllowance: 2850, avgOtcAllowance: 225, avgFlexCard: 330, avgGroceryAllowance: 148, avgTransportation: 960, pcpCopay: 5, specialistCopay: 30, dentalCoverage: 84, otcCoverage: 77, flexCardCoverage: 57, groceryCoverage: 35, transportationCoverage: 54 },
  { id: '12', name: 'New Jersey', abbreviation: 'NJ', planCount: 118, avgDentalAllowance: 3400, avgOtcAllowance: 270, avgFlexCard: 400, avgGroceryAllowance: 175, avgTransportation: 1150, pcpCopay: 0, specialistCopay: 25, dentalCoverage: 90, otcCoverage: 84, flexCardCoverage: 70, groceryCoverage: 43, transportationCoverage: 65 },
];

export const cityData: CityData[] = [
  { id: '1', city: 'Miami', state: 'Florida', stateAbbr: 'FL', planCount: 89, carrierCount: 12, topCarrier: 'Humana', maxDental: 4500, maxOtc: 360, maxFlexCard: 600, maxGrocery: 280, avgPcpCopay: 0 },
  { id: '2', city: 'Houston', state: 'Texas', stateAbbr: 'TX', planCount: 76, carrierCount: 10, topCarrier: 'UnitedHealthcare', maxDental: 4000, maxOtc: 320, maxFlexCard: 520, maxGrocery: 220, avgPcpCopay: 0 },
  { id: '3', city: 'Los Angeles', state: 'California', stateAbbr: 'CA', planCount: 112, carrierCount: 15, topCarrier: 'Kaiser', maxDental: 5000, maxOtc: 400, maxFlexCard: 680, maxGrocery: 300, avgPcpCopay: 5 },
  { id: '4', city: 'Phoenix', state: 'Arizona', stateAbbr: 'AZ', planCount: 58, carrierCount: 8, topCarrier: 'Aetna', maxDental: 3800, maxOtc: 300, maxFlexCard: 480, maxGrocery: 200, avgPcpCopay: 0 },
  { id: '5', city: 'Charlotte', state: 'North Carolina', stateAbbr: 'NC', planCount: 45, carrierCount: 7, topCarrier: 'Blue Cross', maxDental: 3500, maxOtc: 280, maxFlexCard: 420, maxGrocery: 180, avgPcpCopay: 5 },
  { id: '6', city: 'Orlando', state: 'Florida', stateAbbr: 'FL', planCount: 72, carrierCount: 11, topCarrier: 'Humana', maxDental: 4200, maxOtc: 340, maxFlexCard: 560, maxGrocery: 250, avgPcpCopay: 0 },
  { id: '7', city: 'Tampa', state: 'Florida', stateAbbr: 'FL', planCount: 68, carrierCount: 10, topCarrier: 'Aetna', maxDental: 4100, maxOtc: 330, maxFlexCard: 540, maxGrocery: 240, avgPcpCopay: 0 },
  { id: '8', city: 'Dallas', state: 'Texas', stateAbbr: 'TX', planCount: 71, carrierCount: 9, topCarrier: 'UnitedHealthcare', maxDental: 3900, maxOtc: 310, maxFlexCard: 500, maxGrocery: 210, avgPcpCopay: 0 },
  { id: '9', city: 'San Diego', state: 'California', stateAbbr: 'CA', planCount: 85, carrierCount: 12, topCarrier: 'Kaiser', maxDental: 4600, maxOtc: 370, maxFlexCard: 620, maxGrocery: 270, avgPcpCopay: 5 },
  { id: '10', city: 'Atlanta', state: 'Georgia', stateAbbr: 'GA', planCount: 62, carrierCount: 9, topCarrier: 'Anthem', maxDental: 3700, maxOtc: 290, maxFlexCard: 460, maxGrocery: 195, avgPcpCopay: 0 },
];

export const zipData: ZipData[] = [
  { id: '1', zip: '33101', city: 'Miami', state: 'FL', planCount: 34, desirabilityScore: 92, topBenefit: 'Dental', hasFlexCard: true, hasOtc: true, maxDental: 4500, maxOtc: 360 },
  { id: '2', zip: '33102', city: 'Miami', state: 'FL', planCount: 31, desirabilityScore: 88, topBenefit: 'OTC', hasFlexCard: true, hasOtc: true, maxDental: 4200, maxOtc: 350 },
  { id: '3', zip: '77001', city: 'Houston', state: 'TX', planCount: 28, desirabilityScore: 85, topBenefit: 'Flex Card', hasFlexCard: true, hasOtc: true, maxDental: 4000, maxOtc: 320 },
  { id: '4', zip: '90001', city: 'Los Angeles', state: 'CA', planCount: 42, desirabilityScore: 95, topBenefit: 'Dental', hasFlexCard: true, hasOtc: true, maxDental: 5000, maxOtc: 400 },
  { id: '5', zip: '85001', city: 'Phoenix', state: 'AZ', planCount: 24, desirabilityScore: 78, topBenefit: 'OTC', hasFlexCard: true, hasOtc: true, maxDental: 3800, maxOtc: 300 },
  { id: '6', zip: '28201', city: 'Charlotte', state: 'NC', planCount: 19, desirabilityScore: 72, topBenefit: 'Dental', hasFlexCard: false, hasOtc: true, maxDental: 3500, maxOtc: 280 },
  { id: '7', zip: '32801', city: 'Orlando', state: 'FL', planCount: 29, desirabilityScore: 86, topBenefit: 'Groceries', hasFlexCard: true, hasOtc: true, maxDental: 4200, maxOtc: 340 },
  { id: '8', zip: '33601', city: 'Tampa', state: 'FL', planCount: 27, desirabilityScore: 84, topBenefit: 'Dental', hasFlexCard: true, hasOtc: true, maxDental: 4100, maxOtc: 330 },
  { id: '9', zip: '75201', city: 'Dallas', state: 'TX', planCount: 26, desirabilityScore: 82, topBenefit: 'OTC', hasFlexCard: true, hasOtc: true, maxDental: 3900, maxOtc: 310 },
  { id: '10', zip: '92101', city: 'San Diego', state: 'CA', planCount: 35, desirabilityScore: 90, topBenefit: 'Dental', hasFlexCard: true, hasOtc: true, maxDental: 4600, maxOtc: 370 },
];

export const carrierData: CarrierData[] = [
  { id: '1', name: 'Humana', statesServed: 48, totalPlans: 892, avgDentalAllowance: 3400, avgOtcAllowance: 275, avgFlexCard: 420, marketShare: 18.5 },
  { id: '2', name: 'UnitedHealthcare', statesServed: 50, totalPlans: 1245, avgDentalAllowance: 3200, avgOtcAllowance: 260, avgFlexCard: 380, marketShare: 24.2 },
  { id: '3', name: 'Aetna', statesServed: 42, totalPlans: 678, avgDentalAllowance: 3100, avgOtcAllowance: 250, avgFlexCard: 350, marketShare: 12.8 },
  { id: '4', name: 'Kaiser Permanente', statesServed: 8, totalPlans: 234, avgDentalAllowance: 4200, avgOtcAllowance: 340, avgFlexCard: 520, marketShare: 8.4 },
  { id: '5', name: 'Anthem BCBS', statesServed: 38, totalPlans: 567, avgDentalAllowance: 2900, avgOtcAllowance: 230, avgFlexCard: 320, marketShare: 10.6 },
  { id: '6', name: 'Cigna', statesServed: 35, totalPlans: 423, avgDentalAllowance: 2800, avgOtcAllowance: 220, avgFlexCard: 300, marketShare: 7.9 },
  { id: '7', name: 'Centene (Wellcare)', statesServed: 45, totalPlans: 756, avgDentalAllowance: 3000, avgOtcAllowance: 240, avgFlexCard: 360, marketShare: 14.2 },
  { id: '8', name: 'Molina Healthcare', statesServed: 18, totalPlans: 189, avgDentalAllowance: 2600, avgOtcAllowance: 200, avgFlexCard: 280, marketShare: 3.4 },
];

export const planData: PlanData[] = [
  { id: '1', planName: 'Humana Gold Plus', carrier: 'Humana', planType: 'HMO', premium: 0, deductible: 0, moop: 4500, pcpCopay: 0, specialistCopay: 25, hospitalCopay: 250, erCopay: 90, dentalAllowance: 4000, otcAllowance: 300, flexCard: 480, groceryAllowance: 200, transportation: 1200, vision: 250, hearing: 2500, insulin: 35, state: 'FL', city: 'Miami', zip: '33101' },
  { id: '2', planName: 'UHC Dual Complete', carrier: 'UnitedHealthcare', planType: 'HMO-POS', premium: 0, deductible: 0, moop: 5000, pcpCopay: 0, specialistCopay: 30, hospitalCopay: 295, erCopay: 95, dentalAllowance: 3500, otcAllowance: 280, flexCard: 420, groceryAllowance: 180, transportation: 1100, vision: 200, hearing: 2000, insulin: 35, state: 'TX', city: 'Houston', zip: '77001' },
  { id: '3', planName: 'Kaiser Senior Advantage', carrier: 'Kaiser Permanente', planType: 'HMO', premium: 25, deductible: 0, moop: 3900, pcpCopay: 5, specialistCopay: 20, hospitalCopay: 200, erCopay: 75, dentalAllowance: 5000, otcAllowance: 400, flexCard: 680, groceryAllowance: 300, transportation: 1500, vision: 300, hearing: 3000, insulin: 0, state: 'CA', city: 'Los Angeles', zip: '90001' },
  { id: '4', planName: 'Aetna Medicare Eagle', carrier: 'Aetna', planType: 'PPO', premium: 45, deductible: 175, moop: 6700, pcpCopay: 0, specialistCopay: 35, hospitalCopay: 320, erCopay: 100, dentalAllowance: 3200, otcAllowance: 250, flexCard: 380, groceryAllowance: 160, transportation: 950, vision: 175, hearing: 1800, insulin: 35, state: 'AZ', city: 'Phoenix', zip: '85001' },
  { id: '5', planName: 'Anthem MediBlue Plus', carrier: 'Anthem BCBS', planType: 'HMO', premium: 0, deductible: 0, moop: 4800, pcpCopay: 5, specialistCopay: 30, hospitalCopay: 275, erCopay: 90, dentalAllowance: 3000, otcAllowance: 240, flexCard: 350, groceryAllowance: 150, transportation: 900, vision: 200, hearing: 2200, insulin: 35, state: 'GA', city: 'Atlanta', zip: '30301' },
];

export const targetingRecommendations: TargetingRecommendation[] = [
  { id: '1', location: 'Miami, FL (33101)', locationType: 'zip', bestAngle: 'Dental', reasoning: 'This area has 8 plans offering >$4,000 dental with 94% plan coverage. Strong senior population with high MA adoption.', score: 95, metrics: { planCount: 34, avgBenefit: 4500, coverage: 94 } },
  { id: '2', location: 'Los Angeles, CA (90001)', locationType: 'zip', bestAngle: 'Dental + Flex Card', reasoning: '6 plans offer combo benefits: $5,000 dental + $680 flex card. Premium market with high-value seekers.', score: 93, metrics: { planCount: 42, avgBenefit: 5680, coverage: 96 } },
  { id: '3', location: 'Houston, TX', locationType: 'city', bestAngle: 'OTC Allowance', reasoning: '76 plans available with avg $320/mo OTC. Strong messaging opportunity: "$320/month for health essentials."', score: 88, metrics: { planCount: 76, avgBenefit: 320, coverage: 86 } },
  { id: '4', location: 'Florida', locationType: 'state', bestAngle: 'Groceries', reasoning: 'FL leads nation in grocery benefit availability (45% of plans). Message: "Get help with groceries each month."', score: 86, metrics: { planCount: 342, avgBenefit: 180, coverage: 45 } },
  { id: '5', location: 'Orlando, FL (32801)', locationType: 'zip', bestAngle: 'Groceries + OTC', reasoning: 'Unique combo: 12 plans offer both grocery ($250) and OTC ($340). Total monthly value messaging opportunity.', score: 84, metrics: { planCount: 29, avgBenefit: 590, coverage: 72 } },
  { id: '6', location: 'San Diego, CA', locationType: 'city', bestAngle: 'Transportation', reasoning: '85 plans with avg $1,400/yr transportation benefit. Great for seniors needing medical transport.', score: 82, metrics: { planCount: 85, avgBenefit: 1400, coverage: 74 } },
  { id: '7', location: 'Phoenix, AZ', locationType: 'city', bestAngle: 'Flex Card', reasoning: '58 plans with strong flex card offerings avg $480. Message: "Use your flex card anywhere."', score: 80, metrics: { planCount: 58, avgBenefit: 480, coverage: 65 } },
  { id: '8', location: 'Charlotte, NC (28201)', locationType: 'zip', bestAngle: 'Dental', reasoning: 'Underserved market with only 19 plans but strong dental ($3,500 max). Less competition.', score: 78, metrics: { planCount: 19, avgBenefit: 3500, coverage: 84 } },
];

export const benefitTypes = ['Dental', 'OTC', 'Flex Card', 'Groceries', 'Transportation', 'Vision', 'Hearing', 'Insulin'] as const;
export type BenefitType = typeof benefitTypes[number];

export const nationalAverages = {
  dentalAllowance: 3100,
  otcAllowance: 245,
  flexCard: 365,
  groceryAllowance: 160,
  transportation: 1050,
  pcpCopay: 3,
  specialistCopay: 28,
  moop: 5200,
};
