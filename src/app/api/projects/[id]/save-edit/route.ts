import { NextResponse } from "next/server";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceSupabaseClient } from "@/lib/supabase/service";
import {
  parseProjectReviewNotes,
  serializeProjectReviewNotes,
  type ProjectSubmissionMetadata,
} from "@/lib/utils/projectMetadata";

type SaveEditPayload = {
  project_name?: unknown;
  description?: unknown;
  organization_name?: unknown;
  organization_type?: unknown;
  organization_type_other?: unknown;
  seller_name?: unknown;
  seller_email?: unknown;
  new_photo_paths?: unknown;
};

type ProjectRow = {
  id: string;
  user_id: string;
  edit_permitted: boolean | null;
  review_notes: string | null;
};

function invalid(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function normalizeOptionalText(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function parsePhotoPaths(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((entry) => normalizeOptionalText(entry))
    .filter((entry): entry is string => Boolean(entry));
}

function mergePhotoPaths(existingPaths: string[] | undefined, newPaths: string[]) {
  const merged = [...(existingPaths ?? []), ...newPaths];
  return Array.from(new Set(merged));
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> | { id: string } },
) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return invalid("Unauthorized.", 401);
  }

  const params = await Promise.resolve(context.params);
  const projectId = params.id;
  if (!projectId) {
    return invalid("Project ID is required.", 400);
  }

  let payload: SaveEditPayload;
  try {
    payload = (await request.json()) as SaveEditPayload;
  } catch {
    return invalid("Invalid request payload.", 400);
  }

  const nextProjectName = normalizeOptionalText(payload.project_name);
  if (nextProjectName && (nextProjectName.length < 2 || nextProjectName.length > 200)) {
    return invalid("Project name must be between 2 and 200 characters.");
  }

  const nextDescription = normalizeOptionalText(payload.description);
  if (nextDescription && nextDescription.length > 500) {
    return invalid("Description must be 500 characters or fewer.");
  }

  const newPhotoPaths = parsePhotoPaths(payload.new_photo_paths);

  const serviceClient = createServiceSupabaseClient();
  const { data: projectData, error: projectError } = await serviceClient
    .from("carbon_projects")
    .select("id, user_id, edit_permitted, review_notes")
    .eq("id", projectId)
    .maybeSingle();

  if (projectError) {
    console.error("save_edit_project_query_failed", {
      userId: user.id,
      projectId,
      reason: projectError.message,
    });
    return invalid("Unable to process request.", 500);
  }

  const project = (projectData ?? null) as ProjectRow | null;
  if (!project || project.user_id !== user.id) {
    return invalid("Project not found.", 404);
  }

  if (!project.edit_permitted) {
    return invalid("Edit permission is not enabled for this project.", 403);
  }

  const parsed = parseProjectReviewNotes(project.review_notes);
  const metadata: ProjectSubmissionMetadata = {
    ...parsed.submissionMetadata,
  };

  if (nextDescription !== null) {
    metadata.description = nextDescription;
  }

  const organizationName = normalizeOptionalText(payload.organization_name);
  if (organizationName !== null) {
    metadata.organization_name = organizationName;
  }

  const organizationType = normalizeOptionalText(payload.organization_type);
  if (organizationType !== null) {
    metadata.organization_type = organizationType;
  }

  const organizationTypeOther = normalizeOptionalText(payload.organization_type_other);
  if (organizationTypeOther !== null) {
    metadata.organization_type_other = organizationTypeOther;
  }

  const sellerName = normalizeOptionalText(payload.seller_name);
  if (sellerName !== null) {
    metadata.seller_name = sellerName;
  }

  const sellerEmail = normalizeOptionalText(payload.seller_email);
  if (sellerEmail !== null) {
    metadata.seller_email = sellerEmail;
  }

  metadata.project_photo_urls = mergePhotoPaths(metadata.project_photo_urls, newPhotoPaths);

  const nextReviewNotes = serializeProjectReviewNotes(parsed.raw, metadata);

  const updatePayload: {
    project_name?: string;
    review_notes: string;
    edit_permitted: boolean;
  } = {
    review_notes: nextReviewNotes,
    edit_permitted: false,
  };

  if (nextProjectName !== null) {
    updatePayload.project_name = nextProjectName;
  }

  const { error: updateError } = await serviceClient
    .from("carbon_projects")
    .update(updatePayload)
    .eq("id", project.id)
    .eq("user_id", user.id)
    .eq("edit_permitted", true);

  if (updateError) {
    console.error("save_edit_project_update_failed", {
      userId: user.id,
      projectId: project.id,
      reason: updateError.message,
    });
    return invalid("Unable to save changes.", 500);
  }

  return NextResponse.json({ success: true, projectId: project.id }, { status: 200 });
}

