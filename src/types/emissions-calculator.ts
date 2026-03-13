export type IndustrySector =
  | "it_services"
  | "manufacturing"
  | "logistics"
  | "energy"
  | "retail"
  | "agriculture"
  | "finance"
  | "healthcare"
  | "construction"
  | "other";

export type DgTrackingMethod = "fuel_logs" | "runtime_logs" | "no_dg_usage";
export type YesNoOption = "yes" | "no";
export type RefrigerantType = "r32" | "r410a" | "r22" | "r134a";
export type WaterSource = "municipal_piped" | "private_diesel_tanker";

export interface EmissionsCalculatorDraft {
  companyName: string;
  industrySector: IndustrySector | "";
  operatingState: string;
  employeeCount: string;
  annualRevenueInr: string;
  facilityAreaSqFt: string;
  dgTrackingMethod: DgTrackingMethod | "";
  dgFuelLiters: string;
  dgRuntimeHours: string;
  dgCapacityKva: string;
  naturalGasM3: string;
  coalTonnes: string;
  fleetDieselLiters: string;
  fleetPetrolLiters: string;
  refrigerantType: RefrigerantType | "";
  refrigerantRechargedKg: string;
  hasExactAnnualKwh: YesNoOption | "";
  annualGridKwh: string;
  annualElectricityBillInr: string;
  onSiteSolarGeneratedKwh: string;
  greenTariffPercentage: string;
  flightsDomestic: string;
  flightsInternational: string;
  commuteTwoWheelers: string;
  commuteCars: string;
  commutePublicTransit: string;
  commuteRemoteWork: string;
  tracksPhysicalMaterialWeights: YesNoOption | "";
  steelPurchasedTonnes: string;
  cementPurchasedTonnes: string;
  plasticsPurchasedTonnes: string;
  totalProcurementSpendInr: string;
  logisticsSpendInr: string;
  waterConsumedKl: string;
  waterSource: WaterSource | "";
  current_step: number;
  last_saved: string;
}

type Option<T extends string> = {
  value: T;
  label: string;
};

export const INDUSTRY_SECTOR_OPTIONS: Array<Option<IndustrySector>> = [
  { value: "it_services", label: "IT Services" },
  { value: "manufacturing", label: "Manufacturing" },
  { value: "logistics", label: "Logistics" },
  { value: "energy", label: "Energy" },
  { value: "retail", label: "Retail" },
  { value: "agriculture", label: "Agriculture" },
  { value: "finance", label: "Finance" },
  { value: "healthcare", label: "Healthcare" },
  { value: "construction", label: "Construction" },
  { value: "other", label: "Other" },
];

export const DG_TRACKING_OPTIONS: Array<Option<DgTrackingMethod>> = [
  { value: "fuel_logs", label: "Fuel Logs" },
  { value: "runtime_logs", label: "Runtime Logs" },
  { value: "no_dg_usage", label: "No DG Usage" },
];

export const REFRIGERANT_TYPE_OPTIONS: Array<Option<RefrigerantType>> = [
  { value: "r32", label: "R-32" },
  { value: "r410a", label: "R-410A" },
  { value: "r22", label: "R-22" },
  { value: "r134a", label: "R-134a" },
];

export const WATER_SOURCE_OPTIONS: Array<Option<WaterSource>> = [
  { value: "municipal_piped", label: "Municipal Piped" },
  { value: "private_diesel_tanker", label: "Private Diesel Tanker" },
];

export const YES_NO_OPTIONS: Array<Option<YesNoOption>> = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
];

export const EMPTY_EMISSIONS_DRAFT: EmissionsCalculatorDraft = {
  companyName: "",
  industrySector: "",
  operatingState: "",
  employeeCount: "",
  annualRevenueInr: "",
  facilityAreaSqFt: "",
  dgTrackingMethod: "",
  dgFuelLiters: "",
  dgRuntimeHours: "",
  dgCapacityKva: "",
  naturalGasM3: "",
  coalTonnes: "",
  fleetDieselLiters: "",
  fleetPetrolLiters: "",
  refrigerantType: "",
  refrigerantRechargedKg: "",
  hasExactAnnualKwh: "",
  annualGridKwh: "",
  annualElectricityBillInr: "",
  onSiteSolarGeneratedKwh: "",
  greenTariffPercentage: "",
  flightsDomestic: "",
  flightsInternational: "",
  commuteTwoWheelers: "25",
  commuteCars: "25",
  commutePublicTransit: "25",
  commuteRemoteWork: "25",
  tracksPhysicalMaterialWeights: "",
  steelPurchasedTonnes: "",
  cementPurchasedTonnes: "",
  plasticsPurchasedTonnes: "",
  totalProcurementSpendInr: "",
  logisticsSpendInr: "",
  waterConsumedKl: "",
  waterSource: "",
  current_step: 1,
  last_saved: "",
};
