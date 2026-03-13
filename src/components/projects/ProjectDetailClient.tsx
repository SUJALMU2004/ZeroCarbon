"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  FileText,
  Leaf,
  Sun,
  Flame,
  Wheat,
  Wind,
  Shapes,
  Pencil,
  Upload,
  X,
  type LucideIcon,
} from "lucide-react";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { getProjectStatusMeta } from "@/lib/utils/projectStatus";
import {
  getNormalizedProjectAiValuation,
  type ProjectAiValuation,
  type ProjectSubmissionMetadata,
} from "@/lib/utils/projectMetadata";
import ProjectPhotoGrid from "@/components/projects/ProjectPhotoGrid";
import EditModeBanner from "@/components/projects/EditModeBanner";
import EditRequestModal from "@/components/projects/EditRequestModal";
import EditStickyBar from "@/components/projects/EditStickyBar";
import ProjectDetailMapLoader from "@/components/projects/ProjectDetailMapLoader";

interface ProjectPhotoItem {
  path: string;
  name: string;
  url: string;
}

interface OwnershipDocumentItem {
  path: string;
  name: string;
  url: string;
  extension: string;
}

interface ProjectDetailClientProps {
  projectId: string;
  userId: string;
  referenceId: string;
  projectName: string;
  projectType: string | null;
  status: string | null;
  createdAt: string;
  submittedAt: string | null;
  latitude: number | null;
  longitude: number | null;
  polygonGeojson: object | null;
  landAreaHectares: number | null;
  estimatedCo2PerYear: number | null;
  satelliteNdviCurrent: number | null;
  aiValuation: ProjectAiValuation;
  editPermitted: boolean;
  metadata: ProjectSubmissionMetadata;
  photoItems: ProjectPhotoItem[];
  ownershipDocumentItems: OwnershipDocumentItem[];
}

interface EditableFields {
  projectName: string;
  description: string;
  organizationName: string;
  organizationType: string;
  organizationTypeOther: string;
  sellerName: string;
  sellerEmail: string;
}

interface NewPhotoItem {
  file: File;
  previewUrl: string;
}

const PHOTO_MAX_BYTES = 10 * 1024 * 1024;
const PHOTO_ALLOWED_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/heic",
  "image/heif",
];

const IMAGE_EXTENSIONS = new Set([
  "jpg",
  "jpeg",
  "png",
  "webp",
  "heic",
  "heif",
]);

function getProjectTypeMeta(type: string | null): {
  label: string;
  Icon: LucideIcon;
} {
  if (type === "forestry") return { label: "Forestry", Icon: Leaf };
  if (type === "agricultural") return { label: "Agricultural", Icon: Wheat };
  if (type === "solar") return { label: "Solar", Icon: Sun };
  if (type === "methane") return { label: "Methane", Icon: Flame };
  if (type === "windmill") return { label: "Windmill", Icon: Wind };
  return { label: "Other", Icon: Shapes };
}

function formatDateTime(value: string | null): string {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
}

function cleanFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function resolveImageContentType(file: File): string | null {
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

function normalizeText(value: string): string {
  return value.trim();
}

function getPanelTechnologyLabel(value: string | null | undefined): string {
  if (!value) return "-";
  const normalized = value.toLowerCase().replaceAll("-", "_");
  if (normalized === "monocrystalline") return "Monocrystalline";
  if (normalized === "polycrystalline") return "Polycrystalline";
  if (normalized === "thin_film") return "Thin-Film";
  if (normalized === "bifacial") return "Bifacial";
  return value;
}

export default function ProjectDetailClient({
  projectId,
  userId,
  referenceId,
  projectName,
  projectType,
  status,
  createdAt,
  submittedAt,
  latitude,
  longitude,
  polygonGeojson,
  landAreaHectares,
  estimatedCo2PerYear,
  satelliteNdviCurrent,
  aiValuation,
  editPermitted,
  metadata,
  photoItems,
  ownershipDocumentItems,
}: ProjectDetailClientProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const initialFields = useMemo<EditableFields>(
    () => ({
      projectName,
      description: metadata.description ?? metadata.short_description ?? "",
      organizationName: metadata.organization_name ?? "",
      organizationType: metadata.organization_type ?? "",
      organizationTypeOther: metadata.organization_type_other ?? "",
      sellerName: metadata.seller_name ?? "",
      sellerEmail: metadata.seller_email ?? "",
    }),
    [
      metadata.description,
      metadata.organization_name,
      metadata.organization_type,
      metadata.organization_type_other,
      metadata.seller_email,
      metadata.seller_name,
      metadata.short_description,
      projectName,
    ],
  );

  const [fields, setFields] = useState<EditableFields>(initialFields);
  const [baseFields, setBaseFields] = useState<EditableFields>(initialFields);
  const [isEditPermitted, setIsEditPermitted] = useState(editPermitted);
  const [existingPhotos, setExistingPhotos] = useState<ProjectPhotoItem[]>(photoItems);
  const [newPhotos, setNewPhotos] = useState<NewPhotoItem[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isRequestSubmitting, setIsRequestSubmitting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    setFields(initialFields);
    setBaseFields(initialFields);
    setIsEditPermitted(editPermitted);
    setExistingPhotos(photoItems);
  }, [editPermitted, initialFields, photoItems]);

  useEffect(() => {
    return () => {
      newPhotos.forEach((item) => {
        URL.revokeObjectURL(item.previewUrl);
      });
    };
  }, [newPhotos]);

  const isLandProject = projectType === "forestry" || projectType === "agricultural";
  const isSolarProject = projectType === "solar";
  const statusMeta = getProjectStatusMeta(status ?? "pending");
  const typeMeta = getProjectTypeMeta(projectType);
  const TypeIcon = typeMeta.Icon;

  const canRequestEdit = status === "verified" && !isEditPermitted;

  const hasUnsavedChanges =
    isEditPermitted &&
    (fields.projectName !== baseFields.projectName ||
      fields.description !== baseFields.description ||
      fields.organizationName !== baseFields.organizationName ||
      fields.organizationType !== baseFields.organizationType ||
      fields.organizationTypeOther !== baseFields.organizationTypeOther ||
      fields.sellerName !== baseFields.sellerName ||
      fields.sellerEmail !== baseFields.sellerEmail ||
      newPhotos.length > 0);

  const resetNewPhotos = () => {
    newPhotos.forEach((item) => {
      URL.revokeObjectURL(item.previewUrl);
    });
    setNewPhotos([]);
  };

  const handlePickPhotos = (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;

    setError("");
    const accepted: NewPhotoItem[] = [];

    Array.from(fileList).forEach((file) => {
      const contentType = resolveImageContentType(file);
      if (!contentType) {
        setError(`Unsupported photo format: ${file.name}`);
        return;
      }
      if (file.size > PHOTO_MAX_BYTES) {
        setError(`Photo exceeds 10MB: ${file.name}`);
        return;
      }

      accepted.push({
        file,
        previewUrl: URL.createObjectURL(file),
      });
    });

    if (accepted.length > 0) {
      setNewPhotos((previous) => [...previous, ...accepted]);
    }
  };

  const handleRequestEdit = async (reason: string) => {
    setIsRequestSubmitting(true);
    setError("");

    try {
      const response = await fetch(`/api/projects/${projectId}/request-edit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ reason }),
      });

      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(body.error ?? "Unable to send edit request.");
      }

      setIsModalOpen(false);
      toast.success("Edit request sent. You will be notified by email when approved.");
    } catch (requestError) {
      const message =
        requestError instanceof Error
          ? requestError.message
          : "Unable to send edit request.";
      setError(message);
      toast.error(message);
    } finally {
      setIsRequestSubmitting(false);
    }
  };

  const uploadNewPhotos = async () => {
    if (newPhotos.length === 0) return [] as string[];

    const supabase = createBrowserSupabaseClient();
    const uploadedPaths: string[] = [];

    for (let index = 0; index < newPhotos.length; index += 1) {
      const item = newPhotos[index];
      const contentType = resolveImageContentType(item.file);
      if (!contentType) {
        throw new Error(`Unsupported photo format: ${item.file.name}`);
      }

      const path = `${userId}/${Date.now()}_${cleanFileName(item.file.name)}`;
      const { error: uploadError } = await supabase.storage
        .from("project-photos")
        .upload(path, item.file, { upsert: false, contentType });

      if (uploadError) {
        throw new Error(`Failed to upload photo ${item.file.name}: ${uploadError.message}`);
      }

      uploadedPaths.push(path);
    }

    return uploadedPaths;
  };

  const handleSave = async () => {
    if (!hasUnsavedChanges) return;

    setIsSaving(true);
    setError("");

    try {
      const uploadedPaths = await uploadNewPhotos();

      const response = await fetch(`/api/projects/${projectId}/save-edit`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          project_name: normalizeText(fields.projectName),
          description: normalizeText(fields.description),
          organization_name: normalizeText(fields.organizationName),
          organization_type: normalizeText(fields.organizationType),
          organization_type_other: normalizeText(fields.organizationTypeOther),
          seller_name: normalizeText(fields.sellerName),
          seller_email: normalizeText(fields.sellerEmail),
          new_photo_paths: uploadedPaths,
        }),
      });

      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
      };

      if (!response.ok) {
        throw new Error(body.error ?? "Unable to save changes.");
      }

      setBaseFields(fields);
      setIsEditPermitted(false);
      resetNewPhotos();
      toast.success("Changes saved successfully.");
      router.refresh();
    } catch (saveError) {
      const message =
        saveError instanceof Error ? saveError.message : "Unable to save changes.";
      setError(message);
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancelChanges = () => {
    setFields(baseFields);
    resetNewPhotos();
    setError("");
  };

  const species = metadata.species ?? [];
  const hasSubmissionMetadata =
    Boolean(metadata.description || metadata.short_description) ||
    Boolean(metadata.street_address || metadata.state || metadata.country) ||
    Boolean(metadata.organization_name || metadata.seller_name || metadata.seller_email) ||
    Boolean(metadata.ownership_document_urls?.length) ||
    Boolean(metadata.project_photo_urls?.length) ||
    Boolean(metadata.species?.length) ||
    Boolean(metadata.number_of_trees || metadata.planting_year || metadata.plantation_density);

  const valuationComputedAt = formatDateTime(aiValuation.computed_at);
  const normalizedValuation = getNormalizedProjectAiValuation(aiValuation);
  const valuationBasis = [
    species[0] ? `Species: ${species[0]}` : null,
    satelliteNdviCurrent !== null ? `NDVI: ${satelliteNdviCurrent.toFixed(4)}` : null,
    typeof normalizedValuation.effectiveSurvivingTreesPerHa === "number"
      ? `Effective trees/ha: ${normalizedValuation.effectiveSurvivingTreesPerHa.toLocaleString()}`
      : null,
    typeof normalizedValuation.verifiedAnnualEnergyMwh === "number"
      ? `Annual energy: ${normalizedValuation.verifiedAnnualEnergyMwh.toLocaleString()} MWh`
      : null,
    landAreaHectares !== null ? `Area: ${landAreaHectares} ha` : null,
  ]
    .filter((item): item is string => Boolean(item))
    .join(" · ");

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{fields.projectName || "Untitled Project"}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                <TypeIcon className="h-3.5 w-3.5" />
                {typeMeta.label}
              </span>
              <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusMeta.className}`}>
                {statusMeta.label}
              </span>
            </div>
            <p className="mt-3 text-sm text-gray-600">
              Submitted: {formatDateTime(submittedAt || createdAt)} · Reference: {referenceId}
            </p>
          </div>

          {canRequestEdit ? (
            <button
              type="button"
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <Pencil className="h-4 w-4" />
              Request Edit
            </button>
          ) : null}
        </div>
      </section>

      {isEditPermitted ? <EditModeBanner /> : null}

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {!hasSubmissionMetadata ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Detailed submission metadata is missing for this project record. This usually affects
          projects approved before metadata retention was enabled.
        </div>
      ) : null}

      <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
        <h2 className="text-lg font-semibold text-gray-900">Project Overview</h2>
        <div className="mt-4 space-y-4">
          <div>
            <p className="text-sm font-medium text-gray-500">Project Name</p>
            {isEditPermitted ? (
              <input
                value={fields.projectName}
                onChange={(event) =>
                  setFields((previous) => ({ ...previous, projectName: event.target.value }))
                }
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-green-500"
              />
            ) : (
              <p className="mt-1 text-sm text-gray-800">{fields.projectName || "-"}</p>
            )}
          </div>

          <div>
            <p className="text-sm font-medium text-gray-500">Description</p>
            {isEditPermitted ? (
              <textarea
                value={fields.description}
                onChange={(event) =>
                  setFields((previous) => ({ ...previous, description: event.target.value }))
                }
                rows={4}
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-green-500"
              />
            ) : (
              <p className="mt-1 text-sm text-gray-800">{fields.description || "-"}</p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <p className="text-sm font-medium text-gray-500">Estimated Carbon Credits</p>
              <p className="mt-1 text-sm text-gray-800">
                {estimatedCo2PerYear !== null ? `${estimatedCo2PerYear}` : "-"}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Submission Date</p>
              <p className="mt-1 text-sm text-gray-800">{formatDateTime(submittedAt || createdAt)}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
        <h2 className="text-lg font-semibold text-gray-900">Carbon Credit Valuation</h2>

        {normalizedValuation.status === "ready" &&
        typeof normalizedValuation.creditsAvailable === "number" &&
        typeof normalizedValuation.pricePerCreditInr === "number" &&
        typeof normalizedValuation.totalAssetValueInr === "number" ? (
          <div className="mt-4 grid gap-4 sm:grid-cols-3">
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
              <p className="text-xs font-medium text-gray-500">Credits Available</p>
              <p className="mt-2 text-xl font-bold text-gray-900">
                {normalizedValuation.creditsAvailable.toLocaleString()}
              </p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
              <p className="text-xs font-medium text-gray-500">Price per Credit</p>
              <p className="mt-2 text-xl font-bold text-gray-900">
                ₹{normalizedValuation.pricePerCreditInr.toLocaleString()}
              </p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
              <p className="text-xs font-medium text-gray-500">Total Asset Value</p>
              <p className="mt-2 text-xl font-bold text-gray-900">
                ₹{normalizedValuation.totalAssetValueInr.toLocaleString()}
              </p>
            </div>
          </div>
        ) : (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            {normalizedValuation.status === "pending_inputs"
              ? normalizedValuation.reason ||
                "Awaiting satellite verification or required inputs."
              : normalizedValuation.status === "not_applicable"
                ? normalizedValuation.reason ||
                  "AI valuation is available for verified forestry/agricultural/solar projects."
                : normalizedValuation.errorMessage ||
                  "AI valuation is temporarily unavailable."}
          </div>
        )}

        <div className="mt-4 text-xs text-gray-500">
          <p>Last computed: {valuationComputedAt}</p>
          {valuationBasis ? <p className="mt-1">{valuationBasis}</p> : null}
          {typeof aiValuation.input_fingerprint === "string" && aiValuation.input_fingerprint
            ? (
              <p className="mt-1">Input basis includes NDVI score and planting age.</p>
              )
            : null}
        </div>
      </section>

      <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
        <h2 className="text-lg font-semibold text-gray-900">Location</h2>
        <div className="mt-4">
          <ProjectDetailMapLoader
            projectType={projectType}
            latitude={latitude}
            longitude={longitude}
            polygonGeojson={polygonGeojson}
          />
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {isLandProject ? (
            <div>
              <p className="text-sm font-medium text-gray-500">Area</p>
              <p className="mt-1 text-sm text-gray-800">
                {landAreaHectares !== null ? `${landAreaHectares} hectares` : "-"}
              </p>
            </div>
          ) : (
            <div>
              <p className="text-sm font-medium text-gray-500">Coordinates</p>
              <p className="mt-1 text-sm text-gray-800">
                {latitude !== null && longitude !== null
                  ? `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`
                  : "-"}
              </p>
            </div>
          )}

          <div>
            <p className="text-sm font-medium text-gray-500">Country</p>
            <p className="mt-1 text-sm text-gray-800">{metadata.country || "-"}</p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-500">Region / State</p>
            <p className="mt-1 text-sm text-gray-800">{metadata.state || "-"}</p>
          </div>
          <div className="sm:col-span-2">
            <p className="text-sm font-medium text-gray-500">Address</p>
            <p className="mt-1 text-sm text-gray-800">{metadata.street_address || "-"}</p>
          </div>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
        <h2 className="text-lg font-semibold text-gray-900">Seller Information</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-sm font-medium text-gray-500">Organization Name</p>
            {isEditPermitted ? (
              <input
                value={fields.organizationName}
                onChange={(event) =>
                  setFields((previous) => ({ ...previous, organizationName: event.target.value }))
                }
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-green-500"
              />
            ) : (
              <p className="mt-1 text-sm text-gray-800">{fields.organizationName || "-"}</p>
            )}
          </div>

          <div>
            <p className="text-sm font-medium text-gray-500">Organization Type</p>
            {isEditPermitted ? (
              <input
                value={fields.organizationType}
                onChange={(event) =>
                  setFields((previous) => ({ ...previous, organizationType: event.target.value }))
                }
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-green-500"
              />
            ) : (
              <p className="mt-1 text-sm text-gray-800">{fields.organizationType || "-"}</p>
            )}
          </div>

          {fields.organizationType === "other" || fields.organizationTypeOther ? (
            <div className="sm:col-span-2">
              <p className="text-sm font-medium text-gray-500">Organization Type (Other)</p>
              {isEditPermitted ? (
                <input
                  value={fields.organizationTypeOther}
                  onChange={(event) =>
                    setFields((previous) => ({ ...previous, organizationTypeOther: event.target.value }))
                  }
                  className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-green-500"
                />
              ) : (
                <p className="mt-1 text-sm text-gray-800">{fields.organizationTypeOther || "-"}</p>
              )}
            </div>
          ) : null}

          <div>
            <p className="text-sm font-medium text-gray-500">Seller Name</p>
            {isEditPermitted ? (
              <input
                value={fields.sellerName}
                onChange={(event) =>
                  setFields((previous) => ({ ...previous, sellerName: event.target.value }))
                }
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-green-500"
              />
            ) : (
              <p className="mt-1 text-sm text-gray-800">{fields.sellerName || "-"}</p>
            )}
          </div>

          <div>
            <p className="text-sm font-medium text-gray-500">Seller Email</p>
            {isEditPermitted ? (
              <input
                value={fields.sellerEmail}
                onChange={(event) =>
                  setFields((previous) => ({ ...previous, sellerEmail: event.target.value }))
                }
                className="mt-1 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-green-500"
              />
            ) : (
              <p className="mt-1 text-sm text-gray-800">{fields.sellerEmail || "-"}</p>
            )}
          </div>
        </div>
      </section>

      <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
        <h2 className="text-lg font-semibold text-gray-900">Ownership Documents</h2>
        {ownershipDocumentItems.length === 0 ? (
          <p className="mt-3 text-sm text-gray-500">No ownership documents listed.</p>
        ) : (
          <div className="mt-4 space-y-4">
            {ownershipDocumentItems.map((doc, index) => {
              const extension = doc.extension.toLowerCase();
              const isImage = IMAGE_EXTENSIONS.has(extension);
              const isPdf = extension === "pdf";

              return (
                <article
                  key={doc.path}
                  className="rounded-xl border border-gray-200 p-4"
                >
                  <p className="mb-3 text-sm font-medium text-gray-700">
                    Document {index + 1}: {doc.name}
                  </p>

                  {isImage ? (
                    <div className="relative h-72 w-full overflow-hidden rounded-xl border border-gray-200">
                      <Image
                        src={doc.url}
                        alt={doc.name}
                        fill
                        unoptimized
                        className="object-contain bg-white"
                      />
                    </div>
                  ) : null}

                  {isPdf ? (
                    <embed
                      src={doc.url}
                      type="application/pdf"
                      className="h-[400px] w-full rounded-xl border border-gray-200"
                    />
                  ) : null}

                  {!isImage && !isPdf ? (
                    <div className="flex items-center gap-2 text-sm text-gray-700">
                      <FileText className="h-4 w-4 text-gray-500" />
                      <a
                        href={doc.url}
                        target="_blank"
                        rel="noreferrer"
                        className="font-medium text-green-700 underline"
                      >
                        Download {doc.name}
                      </a>
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </section>

      {isLandProject ? (
        <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
          <h2 className="text-lg font-semibold text-gray-900">Land Details</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <p className="text-sm font-medium text-gray-500">Species</p>
              <p className="mt-1 text-sm text-gray-800">
                {species.length > 0 ? species.join(", ") : "-"}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Number of Trees / Plants</p>
              <p className="mt-1 text-sm text-gray-800">{metadata.number_of_trees || "-"}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Planting Year</p>
              <p className="mt-1 text-sm text-gray-800">{metadata.planting_year || "-"}</p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-sm font-medium text-gray-500">Plantation Density</p>
              <p className="mt-1 text-sm text-gray-800">{metadata.plantation_density || "-"}</p>
            </div>
          </div>
        </section>
      ) : null}

      {isSolarProject ? (
        <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
          <h2 className="text-lg font-semibold text-gray-900">Solar Details</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div>
              <p className="text-sm font-medium text-gray-500">Claimed Capacity (MW)</p>
              <p className="mt-1 text-sm text-gray-800">
                {metadata.claimed_capacity_mw !== null &&
                metadata.claimed_capacity_mw !== undefined &&
                `${metadata.claimed_capacity_mw}`.trim().length > 0
                  ? `${metadata.claimed_capacity_mw}`
                  : "-"}
              </p>
            </div>
            <div>
              <p className="text-sm font-medium text-gray-500">Panel Technology</p>
              <p className="mt-1 text-sm text-gray-800">
                {getPanelTechnologyLabel(metadata.panel_technology)}
              </p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-sm font-medium text-gray-500">Grid Region</p>
              <p className="mt-1 text-sm text-gray-800">{metadata.grid_region || "-"}</p>
            </div>
          </div>
        </section>
      ) : null}

      <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
        <h2 className="text-lg font-semibold text-gray-900">Evidence Photos</h2>
        <div className="mt-4">
          <ProjectPhotoGrid photos={existingPhotos} />
        </div>

        {isEditPermitted ? (
          <div className="mt-4">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".jpg,.jpeg,.png,.heic,.heif,image/jpeg,image/png,image/heic,image/heif"
              className="hidden"
              onChange={(event) => {
                handlePickPhotos(event.target.files);
                event.currentTarget.value = "";
              }}
            />

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              <Upload className="h-4 w-4" />
              Add Photos
            </button>

            {newPhotos.length > 0 ? (
              <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {newPhotos.map((item, index) => (
                  <div key={`${item.file.name}-${index}`} className="overflow-hidden rounded-xl border border-gray-200">
                    <div className="relative h-36 w-full">
                      <Image
                        src={item.previewUrl}
                        alt={item.file.name}
                        fill
                        unoptimized
                        className="object-cover"
                      />
                    </div>
                    <div className="flex items-center justify-between border-t border-gray-100 px-3 py-2">
                      <span className="truncate text-xs text-gray-600">{item.file.name}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setNewPhotos((previous) => {
                            const target = previous[index];
                            if (target) {
                              URL.revokeObjectURL(target.previewUrl);
                            }
                            return previous.filter((_, itemIndex) => itemIndex !== index);
                          });
                        }}
                        className="rounded-full p-1 text-gray-500 hover:bg-gray-100"
                        aria-label="Remove selected photo"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
        <h2 className="text-lg font-semibold text-gray-900">Agreement</h2>
        <p className="mt-3 text-sm text-gray-700">
          Agreement accepted on {formatDateTime(submittedAt || createdAt)}.
        </p>
      </section>

      {isEditPermitted ? (
        <EditStickyBar
          isSaving={isSaving}
          canSave={hasUnsavedChanges}
          onCancel={handleCancelChanges}
          onSave={() => {
            void handleSave();
          }}
        />
      ) : null}

      <EditRequestModal
        key={isModalOpen ? "edit-modal-open" : "edit-modal-closed"}
        open={isModalOpen}
        isSubmitting={isRequestSubmitting}
        onClose={() => setIsModalOpen(false)}
        onSubmit={handleRequestEdit}
      />
    </div>
  );
}
