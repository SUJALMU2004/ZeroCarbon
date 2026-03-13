"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import FormProgress from "@/components/verify-project/FormProgress";
import Form1ProjectInfo from "@/components/verify-project/Form1ProjectInfo";
import Form2Location from "@/components/verify-project/Form2Location";
import Form3SolarDetails from "@/components/verify-project/Form3SolarDetails";
import Form3SellerInfo from "@/components/verify-project/Form3SellerInfo";
import Form4Ownership from "@/components/verify-project/Form4Ownership";
import Form5MethaneDetails from "@/components/verify-project/Form5MethaneDetails";
import Form5WindmillDetails from "@/components/verify-project/Form5WindmillDetails";
import Form5LandDetails from "@/components/verify-project/Form5LandDetails";
import Form6Evidence from "@/components/verify-project/Form6Evidence";
import Form7Agreement from "@/components/verify-project/Form7Agreement";
import type { ProjectDraft, PhotoFile, ProjectType } from "@/types/verify-project";
import { EMPTY_DRAFT } from "@/types/verify-project";

interface ProjectVerifyFormProps {
  userId: string;
}

type ExistingProjectRow = {
  id: string;
  status: string | null;
  project_name: string | null;
  project_type: string | null;
  latitude: number | null;
  longitude: number | null;
  polygon_geojson: object | null;
  land_area_hectares: number | null;
  estimated_co2_per_year: number | null;
  project_start_date: string | null;
  review_notes: string | null;
  submitted_at: string | null;
  reviewed_at: string | null;
};

type Direction = "forward" | "backward";
type ViewMode = "loading" | "form";
const OWNERSHIP_ALLOWED_TYPES = ["application/pdf", "image/jpeg", "image/png"];
const OWNERSHIP_MAX_SIZE = 10 * 1024 * 1024;
const PHOTO_ALLOWED_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/heic",
  "image/heif",
];

type StepKey =
  | "project_info"
  | "location"
  | "solar_details"
  | "seller_info"
  | "ownership"
  | "methane_details"
  | "windmill_details"
  | "land_details"
  | "evidence"
  | "agreement";

const STEP_LABELS: Record<StepKey, string> = {
  project_info: "Project Info",
  location: "Location",
  solar_details: "Solar Details",
  seller_info: "Seller Info",
  ownership: "Ownership",
  methane_details: "Methane Details",
  windmill_details: "Windmill Details",
  land_details: "Land Details",
  evidence: "Evidence",
  agreement: "Agreement",
};

const SOLAR_PANEL_TECH_OPTIONS = [
  "monocrystalline",
  "polycrystalline",
  "thin_film",
  "bifacial",
] as const;

const SLIDE_VARIANTS = {
  enter: (direction: Direction) => ({
    x: direction === "forward" ? 400 : -400,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: Direction) => ({
    x: direction === "forward" ? -400 : 400,
    opacity: 0,
  }),
};

function isLandProject(type: ProjectType | "") {
  return type === "forestry" || type === "agricultural";
}

function isPolygonProject(type: ProjectType | "") {
  return type === "forestry" || type === "agricultural" || type === "solar";
}

function isProjectType(value: unknown): value is ProjectType {
  return (
    value === "forestry" ||
    value === "agricultural" ||
    value === "solar" ||
    value === "methane" ||
    value === "windmill"
  );
}

function asStringOrEmpty(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asWindmillLocations(
  value: unknown,
): Array<{ latitude: number; longitude: number }> {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      const latitude = Number((item as { latitude?: unknown })?.latitude);
      const longitude = Number((item as { longitude?: unknown })?.longitude);
      if (
        !Number.isFinite(latitude) ||
        latitude < -90 ||
        latitude > 90 ||
        !Number.isFinite(longitude) ||
        longitude < -180 ||
        longitude > 180
      ) {
        return null;
      }
      return { latitude, longitude };
    })
    .filter(
      (item): item is { latitude: number; longitude: number } => Boolean(item),
    );
}

function normalizeDraft(raw: Partial<ProjectDraft>): ProjectDraft {
  const merged: ProjectDraft = {
    ...EMPTY_DRAFT,
    ...raw,
  };

  return {
    ...merged,
    project_type: isProjectType(merged.project_type) ? merged.project_type : "",
    claimed_capacity_mw: asStringOrEmpty(merged.claimed_capacity_mw),
    panel_technology: (asStringOrEmpty(
      merged.panel_technology,
    ) as ProjectDraft["panel_technology"]) || "",
    grid_region: asStringOrEmpty(merged.grid_region),
    methane_source_type: (asStringOrEmpty(
      merged.methane_source_type,
    ) as ProjectDraft["methane_source_type"]) || "",
    methane_destruction_method: (asStringOrEmpty(
      merged.methane_destruction_method,
    ) as ProjectDraft["methane_destruction_method"]) || "",
    methane_generates_electricity: (asStringOrEmpty(
      merged.methane_generates_electricity,
    ) as ProjectDraft["methane_generates_electricity"]) || "",
    claimed_methane_volume_m3: asStringOrEmpty(merged.claimed_methane_volume_m3),
    ch4_concentration: asStringOrEmpty(merged.ch4_concentration),
    windmill_locations: asWindmillLocations(merged.windmill_locations),
    windmill_turbine_model: (asStringOrEmpty(
      merged.windmill_turbine_model,
    ) as ProjectDraft["windmill_turbine_model"]) || "",
    windmill_hub_height_m: asStringOrEmpty(merged.windmill_hub_height_m),
    windmill_claimed_net_export_mwh: asStringOrEmpty(
      merged.windmill_claimed_net_export_mwh,
    ),
    windmill_power_offtaker_type: (asStringOrEmpty(
      merged.windmill_power_offtaker_type,
    ) as ProjectDraft["windmill_power_offtaker_type"]) || "",
    species: Array.isArray(merged.species)
      ? merged.species.filter((item): item is string => typeof item === "string")
      : [],
    current_step: Number.isFinite(Number(merged.current_step))
      ? Math.max(1, Math.floor(Number(merged.current_step)))
      : 1,
    last_saved: asStringOrEmpty(merged.last_saved),
  };
}

function isSolarDetailsComplete(draft: ProjectDraft) {
  const capacity = Number(draft.claimed_capacity_mw);
  return (
    Number.isFinite(capacity) &&
    capacity > 0 &&
    SOLAR_PANEL_TECH_OPTIONS.includes(
      draft.panel_technology as (typeof SOLAR_PANEL_TECH_OPTIONS)[number],
    ) &&
    Boolean(draft.grid_region.trim())
  );
}

function isWindmillDetailsComplete(draft: ProjectDraft) {
  const hubHeight = Number(draft.windmill_hub_height_m);
  const claimedNetExport = Number(draft.windmill_claimed_net_export_mwh);

  return (
    Boolean(draft.windmill_turbine_model) &&
    Number.isFinite(hubHeight) &&
    hubHeight > 0 &&
    Number.isFinite(claimedNetExport) &&
    claimedNetExport > 0 &&
    Boolean(draft.windmill_power_offtaker_type)
  );
}

function getStepFlow(projectType: ProjectType | ""): StepKey[] {
  if (projectType === "solar") {
    return [
      "project_info",
      "location",
      "solar_details",
      "seller_info",
      "ownership",
      "evidence",
      "agreement",
    ];
  }

  if (isLandProject(projectType)) {
    return [
      "project_info",
      "location",
      "seller_info",
      "ownership",
      "land_details",
      "evidence",
      "agreement",
    ];
  }

  if (projectType === "methane") {
    return [
      "project_info",
      "location",
      "seller_info",
      "ownership",
      "methane_details",
      "evidence",
      "agreement",
    ];
  }

  if (projectType === "windmill") {
    return [
      "project_info",
      "location",
      "seller_info",
      "ownership",
      "windmill_details",
      "evidence",
      "agreement",
    ];
  }

  return [
    "project_info",
    "location",
    "seller_info",
    "ownership",
    "evidence",
    "agreement",
  ];
}

function migrateLegacyStep(legacyStep: number, projectType: ProjectType | ""): number {
  const safeLegacyStep = Number.isFinite(legacyStep)
    ? Math.max(1, Math.floor(legacyStep))
    : 1;

  if (projectType === "solar") {
    if (safeLegacyStep <= 2) return safeLegacyStep;
    if (safeLegacyStep === 3) return 4;
    if (safeLegacyStep === 4) return 5;
    if (safeLegacyStep === 5) return 5;
    if (safeLegacyStep === 6) return 6;
    return 7;
  }

  if (projectType === "methane") {
    if (safeLegacyStep <= 4) return safeLegacyStep;
    if (safeLegacyStep === 5) return 5;
    if (safeLegacyStep === 6) return 7;
    return 7;
  }

  if (projectType === "windmill") {
    if (safeLegacyStep <= 4) return safeLegacyStep;
    if (safeLegacyStep === 5) return 6;
    return 7;
  }

  return Math.min(7, safeLegacyStep);
}

function formatSavedTime(value: string) {
  if (!value) return "";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function parseReviewNotesJson(value: string | null) {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    return typeof parsed === "object" && parsed !== null ? parsed : null;
  } catch {
    return null;
  }
}

function cleanFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function resolvePhotoContentType(file: File) {
  const explicitType = file.type.toLowerCase();

  if (explicitType === "image/jpg") return "image/jpeg";
  if (PHOTO_ALLOWED_CONTENT_TYPES.includes(explicitType)) return explicitType;

  const lowerName = file.name.toLowerCase();
  if (lowerName.endsWith(".jpg") || lowerName.endsWith(".jpeg")) {
    return "image/jpeg";
  }
  if (lowerName.endsWith(".png")) {
    return "image/png";
  }
  if (lowerName.endsWith(".heic")) {
    return "image/heic";
  }
  if (lowerName.endsWith(".heif")) {
    return "image/heif";
  }

  return null;
}

export default function ProjectVerifyForm({ userId }: ProjectVerifyFormProps) {
  const router = useRouter();
  const draftKey = useMemo(() => `zerocarbon_project_draft_${userId}`, [userId]);
  const [draft, setDraft] = useState<ProjectDraft>(EMPTY_DRAFT);
  const [currentStep, setCurrentStep] = useState(1);
  const [direction, setDirection] = useState<Direction>("forward");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [viewMode, setViewMode] = useState<ViewMode>("loading");
  const [rejectionReason, setRejectionReason] = useState<string>("");
  const [restoredFromDraft, setRestoredFromDraft] = useState(false);
  const [lastSaved, setLastSaved] = useState("");
  const [ownershipFiles, setOwnershipFiles] = useState<File[]>([]);
  const [photos, setPhotos] = useState<Array<PhotoFile | null>>(
    Array(6).fill(null),
  );
  const [submitError, setSubmitError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgressLabel, setUploadProgressLabel] = useState("");
  const stepFlow = useMemo(() => getStepFlow(draft.project_type), [draft.project_type]);
  const totalSteps = stepFlow.length;
  const currentStepSafe = Math.max(1, Math.min(currentStep, totalSteps));
  const currentStepKey: StepKey = stepFlow[currentStepSafe - 1] ?? "project_info";
  const stepLabels = useMemo(
    () => stepFlow.map((stepKey) => STEP_LABELS[stepKey]),
    [stepFlow],
  );

  useEffect(() => {
    try {
      const raw = localStorage.getItem(draftKey);
      if (!raw) {
        setViewMode("form");
        return;
      }

      const parsed = JSON.parse(raw) as Partial<ProjectDraft>;
      const restored = normalizeDraft(parsed);
      const restoredProjectType = restored.project_type;
      const migratedStep = migrateLegacyStep(
        Number(restored.current_step) || 1,
        restoredProjectType,
      );
      const migratedFlow = getStepFlow(restoredProjectType);
      let nextStep = Math.max(1, Math.min(migratedFlow.length, migratedStep));

      if (
        restoredProjectType === "solar" &&
        !isSolarDetailsComplete(restored) &&
        nextStep > 3
      ) {
        nextStep = 3;
      }

      if (
        restoredProjectType === "windmill" &&
        !isWindmillDetailsComplete(restored) &&
        nextStep > 5
      ) {
        nextStep = 5;
      }

      setDraft(restored);
      setCurrentStep(nextStep);
      setLastSaved(restored.last_saved);
      setRestoredFromDraft(true);
    } catch {
      setDraft(EMPTY_DRAFT);
      setCurrentStep(1);
    } finally {
      setViewMode("form");
    }
  }, [draftKey]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      const payload: ProjectDraft = {
        ...draft,
        current_step: currentStepSafe,
        last_saved: new Date().toISOString(),
      };
      localStorage.setItem(draftKey, JSON.stringify(payload));
      setLastSaved(payload.last_saved);
    }, 500);

    return () => clearTimeout(timeout);
  }, [draft, currentStepSafe, draftKey]);

  useEffect(() => {
    if (currentStep > totalSteps) {
      setCurrentStep(totalSteps);
    }
  }, [currentStep, totalSteps]);

  useEffect(() => {
    let cancelled = false;
    const supabase = createBrowserSupabaseClient();

    async function fetchExistingProject() {
      const { data, error } = await supabase
        .from("carbon_projects")
        .select(
          "id, status, project_name, project_type, latitude, longitude, polygon_geojson, land_area_hectares, estimated_co2_per_year, project_start_date, review_notes, submitted_at, reviewed_at",
        )
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (cancelled) return;

      if (error || !data) {
        return;
      }

      const project = data as ExistingProjectRow;

      if (project.status === "rejected") {
        setRejectionReason(project.review_notes ?? "");

        if (!restoredFromDraft) {
          const notesData = parseReviewNotesJson(project.review_notes);
          const noteMetadata =
            notesData &&
            typeof notesData === "object" &&
            "submission_metadata" in notesData &&
            notesData.submission_metadata &&
            typeof notesData.submission_metadata === "object"
              ? (notesData.submission_metadata as Partial<ProjectDraft>)
              : (notesData as Partial<ProjectDraft> | null);

          setDraft((previous) => ({
            ...normalizeDraft({
              ...previous,
              project_title: project.project_name ?? "",
              project_type: (project.project_type as ProjectType | "") ?? "",
              latitude: project.latitude,
              longitude: project.longitude,
              polygon_geojson: project.polygon_geojson,
              land_area_hectares: project.land_area_hectares,
              start_date: project.project_start_date ?? "",
              ...(noteMetadata ?? {}),
            }),
          }));
        }
      }
    }

    void fetchExistingProject();

    return () => {
      cancelled = true;
    };
  }, [userId, restoredFromDraft]);

  useEffect(() => {
    return () => {
      photos.forEach((photo) => {
        if (photo?.previewUrl) {
          URL.revokeObjectURL(photo.previewUrl);
        }
      });
    };
  }, [photos]);

  const handleFieldChange = useCallback(
    <K extends keyof ProjectDraft>(key: K, value: ProjectDraft[K]) => {
      setDraft((previous) => ({ ...previous, [key]: value }));
      setErrors((previous) => {
        if (!previous[key as string]) return previous;
        const next = { ...previous };
        delete next[key as string];
        return next;
      });
    },
    [],
  );

  const scrollToFirstError = (nextErrors: Record<string, string>) => {
    const firstField = Object.keys(nextErrors)[0];
    if (!firstField) return;
    const element =
      document.getElementById(firstField) ??
      document.querySelector(`[name='${firstField}']`);
    if (element instanceof HTMLElement) {
      element.scrollIntoView({ behavior: "smooth", block: "center" });
      element.focus();
    }
  };

  const validateStep = (stepKey: StepKey): Record<string, string> => {
    const nextErrors: Record<string, string> = {};

    if (stepKey === "project_info") {
      if (!draft.project_title.trim()) nextErrors.project_title = "Project title is required.";
      if (draft.project_title.trim().length > 200) nextErrors.project_title = "Maximum 200 characters.";
      if (!draft.project_type) nextErrors.project_type = "Project type is required.";
      if (!draft.short_description.trim()) nextErrors.short_description = "Short description is required.";
      if (draft.short_description.trim().length > 500) nextErrors.short_description = "Maximum 500 characters.";
      if (!draft.start_date) {
        nextErrors.start_date = "Start date is required.";
      } else {
        const start = new Date(`${draft.start_date}T00:00:00`);
        if (Number.isNaN(start.getTime()) || start > new Date()) {
          nextErrors.start_date = "Start date cannot be in the future.";
        }
      }
    }

    if (stepKey === "location") {
      if (!draft.street_address.trim()) nextErrors.street_address = "Street address is required.";
      if (!draft.state.trim()) nextErrors.state = "State is required.";
      if (!draft.country.trim()) nextErrors.country = "Country is required.";
      if (!draft.pin_code.trim()) nextErrors.pin_code = "PIN code is required.";

      if (isPolygonProject(draft.project_type)) {
        if (!draft.polygon_geojson) nextErrors.polygon_geojson = "Polygon boundary is required.";
      } else if (draft.project_type === "windmill") {
        if (draft.windmill_locations.length < 1) {
          nextErrors.windmill_locations = "At least one windmill location is required.";
        }
      } else {
        if (draft.latitude === null || draft.longitude === null) {
          nextErrors.latitude = "Map pin location is required.";
        }
      }
    }

    if (stepKey === "solar_details" || (stepKey === "agreement" && draft.project_type === "solar")) {
      const capacity = Number(draft.claimed_capacity_mw);
      if (!draft.claimed_capacity_mw || !Number.isFinite(capacity) || capacity <= 0) {
        nextErrors.claimed_capacity_mw = "Claimed capacity must be a positive number.";
      }
      if (!draft.panel_technology) {
        nextErrors.panel_technology = "Panel technology is required.";
      }
      if (!draft.grid_region.trim()) {
        nextErrors.grid_region = "Grid region is required.";
      }
    }

    if (stepKey === "seller_info") {
      if (!draft.organization_name.trim()) nextErrors.organization_name = "Organization name is required.";
      if (!draft.organization_type) nextErrors.organization_type = "Organization type is required.";
      if (draft.organization_type === "other" && !draft.organization_type_other.trim()) {
        nextErrors.organization_type_other = "Please specify organization type.";
      }
      if (!draft.seller_name.trim()) nextErrors.seller_name = "Seller name is required.";
      if (!draft.seller_email.trim()) {
        nextErrors.seller_email = "Seller email is required.";
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.seller_email.trim())) {
        nextErrors.seller_email = "Enter a valid email address.";
      }
    }

    if (stepKey === "ownership") {
      if (!draft.ownership_type) nextErrors.ownership_type = "Ownership type is required.";
      if (ownershipFiles.length < 1) nextErrors.ownership_documents = "Upload at least one ownership document.";
      if (!draft.declaration_carbon_rights) nextErrors.declaration_carbon_rights = "This declaration is required.";
      if (!draft.declaration_document_use) nextErrors.declaration_document_use = "This declaration is required.";
    }

    if (
      (stepKey === "methane_details" ||
        (stepKey === "agreement" && draft.project_type === "methane")) &&
      draft.project_type === "methane"
    ) {
      if (!draft.methane_source_type) {
        nextErrors.methane_source_type = "Source type is required.";
      }
      if (!draft.methane_destruction_method) {
        nextErrors.methane_destruction_method = "Destruction method is required.";
      }
      if (!draft.methane_generates_electricity) {
        nextErrors.methane_generates_electricity = "Please select Yes or No.";
      }
      const claimedVolume = Number(draft.claimed_methane_volume_m3);
      if (
        !draft.claimed_methane_volume_m3 ||
        !Number.isFinite(claimedVolume) ||
        claimedVolume <= 0
      ) {
        nextErrors.claimed_methane_volume_m3 =
          "Claimed methane volume must be a positive number.";
      }
      const ch4Concentration = Number(draft.ch4_concentration);
      if (
        !draft.ch4_concentration ||
        !Number.isFinite(ch4Concentration) ||
        ch4Concentration <= 0 ||
        ch4Concentration > 100
      ) {
        nextErrors.ch4_concentration =
          "CH4 concentration must be greater than 0 and at most 100.";
      }
    }

    if (
      (stepKey === "windmill_details" ||
        (stepKey === "agreement" && draft.project_type === "windmill")) &&
      draft.project_type === "windmill"
    ) {
      if (!draft.windmill_turbine_model) {
        nextErrors.windmill_turbine_model = "Installed turbine model is required.";
      }
      const hubHeight = Number(draft.windmill_hub_height_m);
      if (
        !draft.windmill_hub_height_m ||
        !Number.isFinite(hubHeight) ||
        hubHeight <= 0
      ) {
        nextErrors.windmill_hub_height_m =
          "Tower hub height must be a positive number.";
      }
      const claimedNetExport = Number(draft.windmill_claimed_net_export_mwh);
      if (
        !draft.windmill_claimed_net_export_mwh ||
        !Number.isFinite(claimedNetExport) ||
        claimedNetExport <= 0
      ) {
        nextErrors.windmill_claimed_net_export_mwh =
          "Claimed net export must be a positive number.";
      }
      if (!draft.windmill_power_offtaker_type) {
        nextErrors.windmill_power_offtaker_type =
          "Power offtaker type is required.";
      }
    }

    if (stepKey === "land_details" && isLandProject(draft.project_type)) {
      if (draft.species.length < 1) nextErrors.species = "Select at least one species.";
      if (!draft.number_of_trees || Number(draft.number_of_trees) < 1) {
        nextErrors.number_of_trees = "Number of trees/plants must be at least 1.";
      }
      const year = Number(draft.planting_year);
      const currentYear = new Date().getFullYear();
      if (!draft.planting_year || Number.isNaN(year) || year < 1900 || year > currentYear) {
        nextErrors.planting_year = `Planting year must be between 1900 and ${currentYear}.`;
      }
      if (!draft.plantation_density || Number(draft.plantation_density) <= 0) {
        nextErrors.plantation_density = "Plantation density must be a positive number.";
      }
    }

    if (stepKey === "evidence") {
      if (!photos[0] || !photos[1]) {
        nextErrors.photos = "Photos 1 and 2 are required.";
      }
    }

    if (stepKey === "agreement") {
      if (!draft.agreement_voluntary) nextErrors.agreement_voluntary = "Required.";
      if (!draft.agreement_right_to_sell) nextErrors.agreement_right_to_sell = "Required.";
      if (!draft.agreement_not_sold_elsewhere) nextErrors.agreement_not_sold_elsewhere = "Required.";
      if (!draft.agreement_marketplace) nextErrors.agreement_marketplace = "Required.";
    }

    return nextErrors;
  };

  const goNext = () => {
    const nextErrors = validateStep(currentStepKey);
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      scrollToFirstError(nextErrors);
      return;
    }

    setErrors({});
    setDirection("forward");
    const nextStep = Math.min(totalSteps, currentStepSafe + 1);
    setCurrentStep(nextStep);
    setDraft((previous) => ({ ...previous, current_step: nextStep }));
  };

  const goBack = () => {
    if (currentStepSafe === 1) return;
    setDirection("backward");
    const prevStep = Math.max(1, currentStepSafe - 1);
    setCurrentStep(prevStep);
    setDraft((previous) => ({ ...previous, current_step: prevStep }));
  };

  const saveDraftNow = () => {
    const payload: ProjectDraft = {
      ...draft,
      current_step: currentStepSafe,
      last_saved: new Date().toISOString(),
    };
    localStorage.setItem(draftKey, JSON.stringify(payload));
    setLastSaved(payload.last_saved);
  };

  const uploadOwnershipDocuments = async (supabase: ReturnType<typeof createBrowserSupabaseClient>) => {
    const paths: string[] = [];

    for (let index = 0; index < ownershipFiles.length; index += 1) {
      const file = ownershipFiles[index];
      if (!OWNERSHIP_ALLOWED_TYPES.includes(file.type) || file.size > OWNERSHIP_MAX_SIZE) {
        throw new Error(`Invalid ownership file: ${file.name}`);
      }

      setUploadProgressLabel(`Uploading ownership ${index + 1} of ${ownershipFiles.length}...`);
      const path = `projects/${userId}/${Date.now()}_${cleanFileName(file.name)}`;
      const { error } = await supabase.storage
        .from("verification-documents")
        .upload(path, file, { upsert: false, contentType: file.type });

      if (error) throw new Error(`Failed to upload ownership document: ${file.name}`);
      paths.push(path);
    }
    return paths;
  };

  const uploadPhotos = async (supabase: ReturnType<typeof createBrowserSupabaseClient>) => {
    const validPhotos = photos.filter((photo): photo is PhotoFile => Boolean(photo));
    const paths: string[] = [];

    for (let index = 0; index < validPhotos.length; index += 1) {
      const photo = validPhotos[index];
      const contentType = resolvePhotoContentType(photo.file);
      if (!contentType) {
        throw new Error(`Unsupported photo format: ${photo.file.name}`);
      }

      setUploadProgressLabel(`Uploading photo ${index + 1} of ${validPhotos.length}...`);
      const path = `${userId}/${Date.now()}_${cleanFileName(photo.file.name)}`;
      const { error } = await supabase.storage
        .from("project-photos")
        .upload(path, photo.file, { upsert: false, contentType });
      if (error) {
        throw new Error(`Failed to upload photo ${photo.file.name}: ${error.message}`);
      }
      paths.push(path);
    }

    return {
      paths,
      gps: [],
    };
  };

  const handleFinalSubmit = async () => {
    const nextErrors = validateStep("agreement");
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      scrollToFirstError(nextErrors);
      return;
    }

    setErrors({});
    setSubmitError("");
    setIsSubmitting(true);

    try {
      const supabase = createBrowserSupabaseClient();
      const ownershipPaths = await uploadOwnershipDocuments(supabase);
      const photoResult = await uploadPhotos(supabase);

      setUploadProgressLabel("Submitting project...");

      const response = await fetch("/api/verify-project", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          project_title: draft.project_title,
          project_name: draft.project_title,
          project_type: draft.project_type,
          short_description: draft.short_description,
          project_start_date: draft.start_date,
          start_date: draft.start_date,
          street_address: draft.street_address,
          state: draft.state,
          country: draft.country,
          pin_code: draft.pin_code,
          latitude: draft.latitude,
          longitude: draft.longitude,
          polygon_geojson: draft.polygon_geojson,
          land_area_hectares: draft.land_area_hectares,
          claimed_capacity_mw: draft.claimed_capacity_mw,
          panel_technology: draft.panel_technology,
          grid_region: draft.grid_region,
          methane_source_type: draft.methane_source_type,
          methane_destruction_method: draft.methane_destruction_method,
          methane_generates_electricity: draft.methane_generates_electricity,
          claimed_methane_volume_m3: draft.claimed_methane_volume_m3,
          ch4_concentration: draft.ch4_concentration,
          windmill_locations: draft.windmill_locations,
          windmill_turbine_model: draft.windmill_turbine_model,
          windmill_hub_height_m: draft.windmill_hub_height_m,
          windmill_claimed_net_export_mwh: draft.windmill_claimed_net_export_mwh,
          windmill_power_offtaker_type: draft.windmill_power_offtaker_type,
          organization_name: draft.organization_name,
          organization_type: draft.organization_type,
          organization_type_other: draft.organization_type_other,
          seller_name: draft.seller_name,
          seller_email: draft.seller_email,
          ownership_type: draft.ownership_type,
          declaration_carbon_rights: draft.declaration_carbon_rights,
          declaration_document_use: draft.declaration_document_use,
          species: draft.species,
          number_of_trees: draft.number_of_trees,
          planting_year: draft.planting_year,
          plantation_density: draft.plantation_density,
          ownership_document_urls: ownershipPaths,
          project_photo_urls: photoResult.paths,
          photo_gps_data: photoResult.gps,
          agreement_voluntary: draft.agreement_voluntary,
          agreement_right_to_sell: draft.agreement_right_to_sell,
          agreement_not_sold_elsewhere: draft.agreement_not_sold_elsewhere,
          agreement_marketplace: draft.agreement_marketplace,
        }),
      });

      const body = (await response.json().catch(() => ({}))) as {
        success?: boolean;
        error?: string;
        projectId?: string;
        project_id?: string;
      };

      if (!response.ok) {
        throw new Error(body.error ?? "Unable to submit project.");
      }

      const nextProjectId = body.projectId ?? body.project_id;
      if (!nextProjectId) {
        throw new Error("Submission succeeded but project ID was missing.");
      }

      localStorage.removeItem(draftKey);
      router.push(`/verify-project/confirmation/${nextProjectId}`);
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : "Unable to submit project.",
      );
    } finally {
      setIsSubmitting(false);
      setUploadProgressLabel("");
    }
  };

  const renderedStep = () => {
    if (currentStepKey === "project_info") {
      return (
        <Form1ProjectInfo
          draft={draft}
          errors={errors}
          onFieldChange={handleFieldChange}
        />
      );
    }
    if (currentStepKey === "location") {
      return (
        <Form2Location
          draft={draft}
          errors={errors}
          onFieldChange={handleFieldChange}
        />
      );
    }
    if (currentStepKey === "solar_details") {
      return (
        <Form3SolarDetails
          draft={draft}
          errors={errors}
          onFieldChange={handleFieldChange}
        />
      );
    }
    if (currentStepKey === "seller_info") {
      return (
        <Form3SellerInfo
          draft={draft}
          errors={errors}
          onFieldChange={handleFieldChange}
        />
      );
    }
    if (currentStepKey === "ownership") {
      return (
        <Form4Ownership
          draft={draft}
          errors={errors}
          ownershipFiles={ownershipFiles}
          onFieldChange={handleFieldChange}
          onOwnershipFilesChange={setOwnershipFiles}
        />
      );
    }
    if (currentStepKey === "land_details") {
      return (
        <Form5LandDetails
          draft={draft}
          errors={errors}
          onFieldChange={handleFieldChange}
        />
      );
    }
    if (currentStepKey === "methane_details") {
      return (
        <Form5MethaneDetails
          draft={draft}
          errors={errors}
          onFieldChange={handleFieldChange}
        />
      );
    }
    if (currentStepKey === "windmill_details") {
      return (
        <Form5WindmillDetails
          draft={draft}
          errors={errors}
          onFieldChange={handleFieldChange}
        />
      );
    }
    if (currentStepKey === "evidence") {
      return (
        <Form6Evidence
          photos={photos}
          onPhotosChange={setPhotos}
        />
      );
    }
    return (
      <Form7Agreement
        draft={draft}
        errors={errors}
        isSubmitting={isSubmitting}
        onFieldChange={handleFieldChange}
        onSubmit={() => {
          void handleFinalSubmit();
        }}
      />
    );
  };

  if (viewMode === "loading") {
    return (
      <div className="rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-black/5">
        <Loader2 className="mx-auto h-5 w-5 animate-spin text-green-600" />
        <p className="mt-2 text-sm text-gray-600">Loading project details...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <FormProgress
          currentStep={currentStepSafe}
          totalSteps={totalSteps}
          stepLabels={stepLabels}
        />
      </div>

      {lastSaved ? (
        <p className="text-right text-xs text-gray-500">
          Draft saved {formatSavedTime(lastSaved)}
        </p>
      ) : null}

      {rejectionReason ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <p className="font-semibold">Previous submission was rejected</p>
          <p className="mt-1">{rejectionReason}</p>
        </div>
      ) : null}

      {submitError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {submitError}
        </div>
      ) : null}

      {uploadProgressLabel ? (
        <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-700">
          {uploadProgressLabel}
        </div>
      ) : null}

      <AnimatePresence mode="wait" custom={direction}>
        <motion.div
          key={currentStepKey}
          custom={direction}
          variants={SLIDE_VARIANTS}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.3, ease: "easeInOut" }}
        >
          {renderedStep()}
        </motion.div>
      </AnimatePresence>

      {currentStepSafe < totalSteps ? (
        <div className="flex items-center justify-between rounded-2xl bg-white p-4 shadow-sm ring-1 ring-black/5">
          {currentStepSafe === 1 ? (
            <button
              type="button"
              onClick={saveDraftNow}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              Save Draft
            </button>
          ) : (
            <button
              type="button"
              onClick={goBack}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              Back
            </button>
          )}

          <button
            type="button"
            onClick={goNext}
            className="rounded-lg bg-green-600 px-4 py-2 text-sm font-semibold text-white hover:bg-green-700"
          >
            Next
          </button>
        </div>
      ) : (
        <div className="flex justify-start">
          <button
            type="button"
            onClick={goBack}
            className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            Back
          </button>
        </div>
      )}
    </div>
  );
}
