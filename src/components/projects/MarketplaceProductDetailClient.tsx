"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  BadgeCheck,
  CheckCircle2,
  FileBadge2,
  Flame,
  Leaf,
  Lock,
  MapPin,
  Shapes,
  Sun,
  Truck,
  Wheat,
  Wind,
  type LucideIcon,
} from "lucide-react";
import { getProjectStatusMeta } from "@/lib/utils/projectStatus";
import ProjectProductGallery from "@/components/projects/ProjectProductGallery";
import ProjectQuantitySelector from "@/components/projects/ProjectQuantitySelector";
import ProjectProofMapLoader from "@/components/projects/ProjectProofMapLoader";

interface ProjectSpecification {
  label: string;
  value: string;
}

interface OwnershipProof {
  name: string;
  url: string;
  extension: string;
}

interface GalleryImageItem {
  mainUrl: string;
  thumbUrl: string;
}

interface MarketplaceProductDetailClientProps {
  projectId: string;
  isOwner: boolean;
  manageHref: string;
  projectName: string;
  referenceId: string;
  projectType: string | null;
  status: string | null;
  submittedAtLabel: string;
  description: string;
  latitude: number | null;
  longitude: number | null;
  polygonGeojson: object | null;
  galleryImages: GalleryImageItem[];
  pricePerCreditInr: number | null;
  creditsAvailable: number | null;
  ndviCurrent: number | null;
  ndviTrend: string | null;
  confidenceBadge: string | null;
  confidenceScore: number | null;
  satelliteStatus: string | null;
  satelliteThumbnailUrl: string | null;
  ownershipProof: OwnershipProof | null;
  specifications: ProjectSpecification[];
}

function getProjectTypeMeta(type: string | null): { label: string; Icon: LucideIcon } {
  if (type === "forestry") return { label: "Forestry", Icon: Leaf };
  if (type === "agricultural") return { label: "Agricultural", Icon: Wheat };
  if (type === "solar") return { label: "Solar", Icon: Sun };
  if (type === "methane") return { label: "Methane", Icon: Flame };
  if (type === "windmill") return { label: "Windmill", Icon: Wind };
  return { label: "Project", Icon: Shapes };
}

function formatCurrency(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "Pending";
  return `INR ${value.toLocaleString()}`;
}

function formatCredits(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "Pending";
  return value.toLocaleString();
}

function formatNdvi(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "Pending";
  return value.toFixed(3);
}

function getSatelliteTrendLabel(trend: string | null): string {
  if (trend === "positive") return "Positive";
  if (trend === "negative") return "Negative";
  if (trend === "flat") return "Flat";
  return "Pending";
}

function getOwnershipIsImage(extension: string): boolean {
  return ["jpg", "jpeg", "png", "webp", "heic", "heif"].includes(extension);
}

function hasValidPolygonGeometry(geojson: object | null): boolean {
  if (!geojson) return false;

  const feature = geojson as {
    geometry?: {
      type?: string;
      coordinates?: number[][][];
    };
  };

  if (feature.geometry?.type !== "Polygon") return false;
  const ring = feature.geometry.coordinates?.[0];
  return Array.isArray(ring) && ring.length >= 3;
}

export default function MarketplaceProductDetailClient({
  projectId,
  isOwner,
  manageHref,
  projectName,
  referenceId,
  projectType,
  status,
  submittedAtLabel,
  description,
  latitude,
  longitude,
  polygonGeojson,
  galleryImages,
  pricePerCreditInr,
  creditsAvailable,
  ndviCurrent,
  ndviTrend,
  confidenceBadge,
  confidenceScore,
  satelliteStatus,
  satelliteThumbnailUrl,
  ownershipProof,
  specifications,
}: MarketplaceProductDetailClientProps) {
  const router = useRouter();
  const [quantity, setQuantity] = useState(1);
  const [selectedImage, setSelectedImage] = useState(0);

  const statusMeta = getProjectStatusMeta(status ?? "pending");
  const typeMeta = getProjectTypeMeta(projectType);
  const TypeIcon = typeMeta.Icon;
  const isPolygonProject = projectType === "forestry" || projectType === "agricultural";
  const showPolygonSnapshot = isPolygonProject && hasValidPolygonGeometry(polygonGeojson);

  const maxQuantity = useMemo(() => {
    if (creditsAvailable === null || !Number.isFinite(creditsAvailable) || creditsAvailable <= 0) {
      return 1;
    }
    return Math.max(1, Math.min(creditsAvailable, 1_000_000));
  }, [creditsAvailable]);

  const canBuy = useMemo(() => {
    const hasPrice =
      pricePerCreditInr !== null &&
      Number.isFinite(pricePerCreditInr) &&
      pricePerCreditInr > 0;
    const hasCredits =
      creditsAvailable !== null &&
      Number.isFinite(creditsAvailable) &&
      creditsAvailable > 0;
    return hasPrice && hasCredits;
  }, [creditsAvailable, pricePerCreditInr]);

  const totalPrice = useMemo(() => {
    if (pricePerCreditInr === null || !Number.isFinite(pricePerCreditInr)) {
      return null;
    }
    return pricePerCreditInr * quantity;
  }, [pricePerCreditInr, quantity]);

  const handleBuyNow = () => {
    if (!canBuy) return;
    router.push(`/projects/${projectId}/payment?quantity=${quantity}`);
  };

  const handleAddQuantity = () => {
    setQuantity((previous) => Math.min(previous + 1, maxQuantity));
  };

  const handleSubtractQuantity = () => {
    setQuantity((previous) => Math.max(previous - 1, 1));
  };

  return (
    <div className="min-h-full bg-gradient-to-br from-white via-slate-50 to-slate-100/60">
      <main className="mx-auto max-w-7xl px-5 py-6 sm:px-7 md:px-10 md:py-10 lg:px-12">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
          <div className="space-y-6">
            <ProjectProductGallery
              images={galleryImages}
              selectedImage={selectedImage}
              onSelectImage={setSelectedImage}
            />

            <section className="space-y-4 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-center gap-2">
                <BadgeCheck className="h-4 w-4 text-green-600" />
                <h3 className="text-sm font-semibold text-gray-900">Proof & Verification</h3>
              </div>

              <div className="rounded-xl border border-gray-200 bg-slate-50 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                      Satellite Proof
                    </p>
                    <p className="mt-1 text-sm font-medium text-slate-800">
                      Status: {satelliteStatus ?? "Pending"}
                    </p>
                  </div>
                  <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[11px] font-medium text-slate-700">
                    {confidenceBadge ?? "Pending"}
                  </span>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                  <p className="text-slate-600">
                    NDVI: <span className="font-semibold text-slate-900">{formatNdvi(ndviCurrent)}</span>
                  </p>
                  <p className="text-slate-600">
                    Trend: <span className="font-semibold text-slate-900">{getSatelliteTrendLabel(ndviTrend)}</span>
                  </p>
                  <p className="text-slate-600">
                    Confidence:
                    <span className="font-semibold text-slate-900">
                      {" "}
                      {confidenceScore !== null ? `${confidenceScore}/100` : "Pending"}
                    </span>
                  </p>
                </div>

                {showPolygonSnapshot ? (
                  <div className="mt-3 overflow-hidden rounded-lg border border-gray-200 bg-white">
                    <ProjectProofMapLoader
                      projectType={projectType}
                      latitude={latitude}
                      longitude={longitude}
                      polygonGeojson={polygonGeojson}
                    />
                  </div>
                ) : satelliteThumbnailUrl ? (
                  <div className="relative mt-3 h-40 overflow-hidden rounded-lg border border-gray-200 bg-white">
                    <Image
                      src={satelliteThumbnailUrl}
                      alt={`${projectName} satellite proof`}
                      fill
                      unoptimized
                      className="object-cover"
                    />
                  </div>
                ) : (
                  <p className="mt-3 text-sm text-slate-600">
                    Satellite snapshot is not available yet.
                  </p>
                )}
              </div>

              <div className="rounded-xl border border-gray-200 bg-slate-50 p-4">
                <div className="flex items-center gap-2">
                  <FileBadge2 className="h-4 w-4 text-slate-700" />
                  <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500">
                    Ownership Proof
                  </p>
                </div>

                {ownershipProof ? (
                  <div className="mt-3">
                    <p className="mb-2 text-sm font-medium text-slate-800">{ownershipProof.name}</p>
                    {getOwnershipIsImage(ownershipProof.extension) ? (
                      <div className="relative h-40 overflow-hidden rounded-lg border border-gray-200 bg-white">
                        <Image
                          src={ownershipProof.url}
                          alt={ownershipProof.name}
                          fill
                          unoptimized
                          className="object-contain"
                        />
                      </div>
                    ) : ownershipProof.extension === "pdf" ? (
                      <embed
                        src={ownershipProof.url}
                        type="application/pdf"
                        className="h-56 w-full rounded-lg border border-gray-200"
                      />
                    ) : (
                      <a
                        href={ownershipProof.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-2 text-sm font-medium text-green-700 underline"
                      >
                        View ownership document
                      </a>
                    )}
                  </div>
                ) : (
                  <p className="mt-2 text-sm text-slate-600">No ownership proof file available.</p>
                )}
              </div>
            </section>
          </div>

          <div className="space-y-6">
            <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700">
                  <TypeIcon className="h-3.5 w-3.5" />
                  {typeMeta.label}
                </span>
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${statusMeta.className}`}>
                  {statusMeta.label}
                </span>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                  {referenceId}
                </span>
              </div>

              <h1 className="mt-4 text-3xl font-semibold text-gray-900">{projectName}</h1>
              <p className="mt-2 text-sm text-gray-500">Submitted: {submittedAtLabel}</p>
              <p className="mt-4 text-sm leading-relaxed text-gray-700">{description}</p>

              {isOwner ? (
                <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
                  You own this project.{" "}
                  <Link href={manageHref} className="font-semibold underline">
                    Manage Project
                  </Link>
                </div>
              ) : null}
            </section>

            <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-gray-500">
                Pricing & Availability
              </h2>
              <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-green-100 bg-green-50 p-3">
                  <p className="text-xs font-medium text-green-700">Single Credit Cost</p>
                  <p className="mt-1 text-lg font-bold text-green-900">{formatCurrency(pricePerCreditInr)}</p>
                </div>
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
                  <p className="text-xs font-medium text-gray-600">Credits Available</p>
                  <p className="mt-1 text-lg font-bold text-gray-900">{formatCredits(creditsAvailable)}</p>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <h2 className="text-sm font-semibold uppercase tracking-[0.08em] text-gray-500">
                Project Specifications
              </h2>
              <div className="mt-4 grid grid-cols-2 gap-3">
                {specifications.map((spec) => (
                  <div key={spec.label} className="rounded-xl border border-gray-100 bg-gray-50 p-3">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-500">
                      {spec.label}
                    </p>
                    <p className="mt-1 text-sm font-medium text-gray-900">{spec.value}</p>
                  </div>
                ))}
              </div>
            </section>

            <section className="space-y-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-2 rounded-xl border border-green-100 bg-green-50 px-4 py-3 text-sm text-green-800">
                <CheckCircle2 className="h-4 w-4" />
                <span>Verified project records are available for due diligence.</span>
              </div>

              <div className="space-y-3">
                <label className="text-sm font-semibold text-gray-900">Quantity (credits)</label>
                <ProjectQuantitySelector
                  quantity={quantity}
                  maxQuantity={maxQuantity}
                  onAdd={handleAddQuantity}
                  onSubtract={handleSubtractQuantity}
                />
                <p className="text-xs text-gray-500">
                  Order Total:{" "}
                  <span className="font-semibold text-gray-800">
                    {totalPrice !== null ? formatCurrency(totalPrice) : "Pending"}
                  </span>
                </p>
              </div>

              <div className="grid grid-cols-1 gap-3">
                <button
                  type="button"
                  onClick={handleBuyNow}
                  disabled={!canBuy}
                  className="rounded-xl bg-green-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {canBuy ? "Buy with Credits" : "Buy Unavailable"}
                </button>
              </div>

              <div className="grid grid-cols-3 gap-3 border-t border-gray-100 pt-4">
                <div className="text-center">
                  <Lock className="mx-auto h-4 w-4 text-green-600" />
                  <p className="mt-1 text-[11px] font-medium text-gray-600">Secure</p>
                </div>
                <div className="text-center">
                  <Truck className="mx-auto h-4 w-4 text-green-600" />
                  <p className="mt-1 text-[11px] font-medium text-gray-600">Fast Settlement</p>
                </div>
                <div className="text-center">
                  <MapPin className="mx-auto h-4 w-4 text-green-600" />
                  <p className="mt-1 text-[11px] font-medium text-gray-600">Traceable</p>
                </div>
              </div>
            </section>
          </div>
        </div>
      </main>
    </div>
  );
}
