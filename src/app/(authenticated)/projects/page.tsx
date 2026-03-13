import Link from "next/link";
import { redirect } from "next/navigation";
import MarketplaceProjectCard from "@/components/projects/MarketplaceProjectCard";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import {
  getNormalizedProjectAiValuation,
  getSubmissionDescription,
  parseProjectReviewNotes,
} from "@/lib/utils/projectMetadata";
import { getProjectReference } from "@/lib/utils/projectReference";
import {
  resolveSignedMediaUrl,
  SIGNED_IMAGE_TRANSFORMS,
} from "@/lib/utils/signedMedia";
import { computeRemainingCredits } from "@/lib/payments/math";

const ITEMS_PER_PAGE = 12;

type SearchParams = {
  q?: string | string[];
  page?: string | string[];
};

type ProjectRow = {
  id: string;
  project_name: string | null;
  project_type: string | null;
  created_at: string;
  satellite_ndvi_current: number | null;
  credits_reserved: number | null;
  credits_sold: number | null;
  review_notes: string | null;
};

type ListingRow = {
  id: string;
  referenceId: string;
  title: string;
  description: string;
  pricePerCreditInr: number | null;
  creditsRemaining: number | null;
  satelliteNdviCurrent: number | null;
  photoPaths: string[];
  searchText: string;
};

type MarketplaceSignerClient = ReturnType<typeof createServiceSupabaseClient>;

function getSingleSearchValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

function normalizePage(value: string): number {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return 1;
  }
  return parsed;
}

function getProjectTypeLabel(projectType: string | null): string {
  if (projectType === "forestry") return "Forestry";
  if (projectType === "agricultural") return "Agriculture";
  if (projectType === "solar") return "Solar Farm";
  if (projectType === "methane") return "Methane Capture";
  if (projectType === "windmill") return "Wind Mills";
  return "Project";
}

function getSearchText(row: {
  title: string;
  projectType: string | null;
  projectTypeLabel: string;
  id: string;
  referenceId: string;
}): string {
  return [
    row.title,
    row.projectType ?? "",
    row.projectTypeLabel,
    row.id,
    row.referenceId,
  ]
    .join(" ")
    .toLowerCase();
}

async function resolveSignedPhotoUrl(
  signer: MarketplaceSignerClient | null,
  projectId: string,
  photoPath: string | null,
): Promise<string | null> {
  return resolveSignedMediaUrl({
    signer,
    bucket: "project-photos",
    path: photoPath,
    projectId,
    logContext: "projects_listing_photo_signed_url_failed",
    transform: SIGNED_IMAGE_TRANSFORMS.marketplaceCard,
  });
}

async function resolveSignedPhotoUrls(
  signer: MarketplaceSignerClient | null,
  projectId: string,
  photoPaths: string[],
): Promise<string[]> {
  const limitedPaths = photoPaths.slice(0, 2);
  const signedUrls = await Promise.all(
    limitedPaths.map((path) => resolveSignedPhotoUrl(signer, projectId, path)),
  );
  return signedUrls.filter((url): url is string => Boolean(url));
}

export default async function ProjectsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const searchQuery = getSingleSearchValue(params.q).trim();
  const requestedPage = normalizePage(getSingleSearchValue(params.page));
  const normalizedQuery = searchQuery.toLowerCase();

  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirect=/projects");
  }

  let marketplaceSigner: MarketplaceSignerClient | null = null;
  try {
    marketplaceSigner = createServiceSupabaseClient();
  } catch (error) {
    console.error("projects_listing_signer_init_failed", {
      reason: error instanceof Error ? error.message : "unknown_error",
    });
  }

  const { data, error } = await supabase
    .from("carbon_projects")
    .select(
      "id, project_name, project_type, created_at, satellite_ndvi_current, credits_reserved, credits_sold, review_notes",
    )
    .eq("status", "verified")
    .order("created_at", { ascending: false });

  if (error) {
    console.error("projects_listing_query_failed", {
      userId: user.id,
      reason: error.message,
    });
  }

  const verifiedRows: ListingRow[] = ((data ?? []) as ProjectRow[]).map((project) => {
    const parsedNotes = parseProjectReviewNotes(project.review_notes);
    const metadata = parsedNotes.submissionMetadata;
    const valuation = getNormalizedProjectAiValuation(metadata.ai_valuation);
    const title = project.project_name?.trim() || "Untitled Project";
    const description = getSubmissionDescription(metadata) || "No description yet";
    const referenceId = getProjectReference(project.id, project.created_at);
    const projectTypeLabel = getProjectTypeLabel(project.project_type);

    return {
      id: project.id,
      referenceId,
      title,
      description,
      pricePerCreditInr: valuation.pricePerCreditInr,
      creditsRemaining: computeRemainingCredits({
        valuationCredits: valuation.creditsAvailable,
        creditsReserved: project.credits_reserved,
        creditsSold: project.credits_sold,
      }),
      satelliteNdviCurrent: project.satellite_ndvi_current,
      photoPaths: metadata.project_photo_urls?.slice(0, 2) ?? [],
      searchText: getSearchText({
        title,
        projectType: project.project_type,
        projectTypeLabel,
        id: project.id,
        referenceId,
      }),
    };
  });

  const filteredRows = normalizedQuery
    ? verifiedRows.filter((row) => row.searchText.includes(normalizedQuery))
    : verifiedRows;

  const totalResults = filteredRows.length;
  const totalPages = Math.max(1, Math.ceil(totalResults / ITEMS_PER_PAGE));
  const currentPage = Math.min(requestedPage, totalPages);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const pagedRows = filteredRows.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const cards = await Promise.all(
    pagedRows.map(async (row) => ({
      ...row,
      projectImageUrls: await resolveSignedPhotoUrls(marketplaceSigner, row.id, row.photoPaths),
    })),
  );

  const hasProjects = verifiedRows.length > 0;
  const hasSearchResults = filteredRows.length > 0;

  const createPageHref = (page: number): string => {
    const query = new URLSearchParams();
    if (searchQuery) query.set("q", searchQuery);
    if (page > 1) query.set("page", String(page));
    const qs = query.toString();
    return qs ? `/projects?${qs}` : "/projects";
  };

  return (
    <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 md:px-8">
      <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">
              Projects Marketplace
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Search verified projects by project name, type, or project ID.
            </p>
          </div>

          <form method="get" action="/projects" className="flex w-full max-w-xl gap-2">
            <input
              type="text"
              name="q"
              defaultValue={searchQuery}
              placeholder="Search by project name, type, or ID"
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm text-gray-800 outline-none ring-0 transition focus:border-green-500"
            />
            <button
              type="submit"
              className="rounded-xl bg-green-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-green-700"
            >
              Search
            </button>
            {searchQuery ? (
              <Link
                href="/projects"
                className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-600 transition hover:bg-gray-50"
              >
                Clear
              </Link>
            ) : null}
          </form>
        </div>

        <p className="mt-4 text-sm text-gray-500">
          {totalResults} project{totalResults !== 1 ? "s" : ""}
          {searchQuery ? ` found for "${searchQuery}"` : " available"}
        </p>
      </section>

      {!hasProjects ? (
        <section className="mt-6 rounded-3xl border border-gray-200 bg-white p-10 text-center shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">No verified projects yet</h2>
          <p className="mt-2 text-sm text-gray-500">
            Verified projects will appear here once sellers complete review.
          </p>
        </section>
      ) : !hasSearchResults ? (
        <section className="mt-6 rounded-3xl border border-gray-200 bg-white p-10 text-center shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900">No matching projects</h2>
          <p className="mt-2 text-sm text-gray-500">
            Try searching by a different project name, type, or project ID.
          </p>
        </section>
      ) : (
        <section className="mt-6">
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
            {cards.map((card) => (
              <MarketplaceProjectCard
                key={card.id}
                projectId={card.id}
                projectImageUrls={card.projectImageUrls}
                referenceId={card.referenceId}
                title={card.title}
                pricePerCreditInr={card.pricePerCreditInr}
                creditsRemaining={card.creditsRemaining}
                satelliteNdviCurrent={card.satelliteNdviCurrent}
                description={card.description}
              />
            ))}
          </div>

          {totalPages > 1 ? (
            <div className="mt-8 flex items-center justify-between rounded-2xl border border-gray-100 bg-white px-4 py-3">
              <div className="text-sm text-gray-500">
                Page {currentPage} of {totalPages}
              </div>
              <div className="flex items-center gap-2">
                {currentPage > 1 ? (
                  <Link
                    href={createPageHref(currentPage - 1)}
                    className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                  >
                    Previous
                  </Link>
                ) : (
                  <span className="cursor-not-allowed rounded-lg border border-gray-100 px-3 py-1.5 text-sm font-medium text-gray-300">
                    Previous
                  </span>
                )}

                {currentPage < totalPages ? (
                  <Link
                    href={createPageHref(currentPage + 1)}
                    className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                  >
                    Next
                  </Link>
                ) : (
                  <span className="cursor-not-allowed rounded-lg border border-gray-100 px-3 py-1.5 text-sm font-medium text-gray-300">
                    Next
                  </span>
                )}
              </div>
            </div>
          ) : null}
        </section>
      )}
    </main>
  );
}
