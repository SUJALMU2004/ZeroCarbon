import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

type StorageBucket = "project-photos" | "verification-documents";

type SignedImageTransform = {
  width: number;
  height: number;
  quality: number;
  resize: "cover" | "contain" | "fill";
};

export const SIGNED_IMAGE_TRANSFORMS = {
  mapCard: {
    width: 360,
    height: 220,
    quality: 70,
    resize: "cover",
  },
  marketplaceCard: {
    width: 420,
    height: 260,
    quality: 72,
    resize: "cover",
  },
  productMain: {
    width: 1440,
    height: 1440,
    quality: 80,
    resize: "contain",
  },
  productThumb: {
    width: 320,
    height: 320,
    quality: 72,
    resize: "cover",
  },
  productProof: {
    width: 960,
    height: 960,
    quality: 78,
    resize: "contain",
  },
} as const satisfies Record<string, SignedImageTransform>;

interface ResolveSignedMediaUrlParams {
  signer: SupabaseClient | null;
  bucket: StorageBucket;
  path: string | null;
  projectId: string;
  logContext: string;
  expiresInSeconds?: number;
  transform?: SignedImageTransform;
}

export async function resolveSignedMediaUrl({
  signer,
  bucket,
  path,
  projectId,
  logContext,
  expiresInSeconds = 3600,
  transform,
}: ResolveSignedMediaUrlParams): Promise<string | null> {
  if (!path) return null;

  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }

  if (!signer) {
    console.error(logContext, {
      projectId,
      bucket,
      path,
      reason: "service_signer_unavailable",
    });
    return null;
  }

  const options = transform ? { transform } : undefined;
  const { data, error } = await signer.storage
    .from(bucket)
    .createSignedUrl(path, expiresInSeconds, options);

  if (error || !data?.signedUrl) {
    console.error(logContext, {
      projectId,
      bucket,
      path,
      reason: error?.message ?? "missing_signed_url",
    });
    return null;
  }

  return data.signedUrl;
}
