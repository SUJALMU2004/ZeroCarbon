export type ProjectType =
  | "forestry"
  | "agricultural"
  | "solar"
  | "methane"
  | "windmill";

export type OrganizationType =
  | "private_public_company"
  | "ngo"
  | "individual"
  | "government"
  | "other";

export type OwnershipType = "owned" | "leased" | "community";

export type PanelTechnology =
  | "monocrystalline"
  | "polycrystalline"
  | "thin_film"
  | "bifacial";

export type MethaneSourceType =
  | "municipal_solid_waste_landfill"
  | "agricultural_anaerobic_digester"
  | "coal_mine_gas"
  | "wastewater_treatment";

export type MethaneDestructionMethod =
  | "open_flare"
  | "enclosed_high_temperature_flare"
  | "internal_combustion_engine"
  | "boiler"
  | "bio_cng_vehicle_fuel"
  | "pipeline_injection";

export type WindmillTurbineModel =
  | "suzlon_s120_2_1_mw"
  | "vestas_v110_2_0_mw"
  | "ge_1_5_sle_1_5_mw"
  | "siemens_gamesa_sg_2_1_114_2_1_mw"
  | "envision_en_131_2_5_mw";

export type WindmillPowerOfftakerType =
  | "exported_to_state_grid"
  | "captive_consumption_industrial_facility";

export interface PhotoFile {
  file: File;
  previewUrl: string;
  exifLat: number | null;
  exifLng: number | null;
  exifValid: boolean;
}

export interface ProjectDraft {
  project_title: string;
  project_type: ProjectType | "";
  short_description: string;
  start_date: string;
  street_address: string;
  state: string;
  country: string;
  pin_code: string;
  latitude: number | null;
  longitude: number | null;
  polygon_geojson: object | null;
  land_area_hectares: number | null;
  claimed_capacity_mw: string;
  panel_technology: PanelTechnology | "";
  grid_region: string;
  methane_source_type: MethaneSourceType | "";
  methane_destruction_method: MethaneDestructionMethod | "";
  methane_generates_electricity: "yes" | "no" | "";
  claimed_methane_volume_m3: string;
  ch4_concentration: string;
  windmill_locations: Array<{ latitude: number; longitude: number }>;
  windmill_turbine_model: WindmillTurbineModel | "";
  windmill_hub_height_m: string;
  windmill_claimed_net_export_mwh: string;
  windmill_power_offtaker_type: WindmillPowerOfftakerType | "";
  organization_name: string;
  organization_type: OrganizationType | "";
  organization_type_other: string;
  seller_name: string;
  seller_email: string;
  ownership_type: OwnershipType | "";
  declaration_carbon_rights: boolean;
  declaration_document_use: boolean;
  species: string[];
  number_of_trees: string;
  planting_year: string;
  plantation_density: string;
  agreement_voluntary: boolean;
  agreement_right_to_sell: boolean;
  agreement_not_sold_elsewhere: boolean;
  agreement_marketplace: boolean;
  current_step: number;
  last_saved: string;
}

export const EMPTY_DRAFT: ProjectDraft = {
  project_title: "",
  project_type: "",
  short_description: "",
  start_date: "",
  street_address: "",
  state: "",
  country: "",
  pin_code: "",
  latitude: null,
  longitude: null,
  polygon_geojson: null,
  land_area_hectares: null,
  claimed_capacity_mw: "",
  panel_technology: "",
  grid_region: "",
  methane_source_type: "",
  methane_destruction_method: "",
  methane_generates_electricity: "",
  claimed_methane_volume_m3: "",
  ch4_concentration: "",
  windmill_locations: [],
  windmill_turbine_model: "",
  windmill_hub_height_m: "",
  windmill_claimed_net_export_mwh: "",
  windmill_power_offtaker_type: "",
  organization_name: "",
  organization_type: "",
  organization_type_other: "",
  seller_name: "",
  seller_email: "",
  ownership_type: "",
  declaration_carbon_rights: false,
  declaration_document_use: false,
  species: [],
  number_of_trees: "",
  planting_year: "",
  plantation_density: "",
  agreement_voluntary: false,
  agreement_right_to_sell: false,
  agreement_not_sold_elsewhere: false,
  agreement_marketplace: false,
  current_step: 1,
  last_saved: "",
};
