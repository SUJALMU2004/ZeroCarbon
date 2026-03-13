import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.dirname(fileURLToPath(import.meta.url));
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

const remotePatterns: NonNullable<NextConfig["images"]>["remotePatterns"] = [];
if (supabaseUrl) {
  try {
    const parsedUrl = new URL(supabaseUrl);
    remotePatterns.push({
      protocol: parsedUrl.protocol.replace(":", "") as "http" | "https",
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || "",
      pathname: "/storage/v1/object/**",
    });
  } catch {
    // Ignore invalid URL so build doesn't fail when env is misconfigured.
  }
}

const nextConfig: NextConfig = {
  turbopack: {
    root: repoRoot,
  },
  images: {
    remotePatterns,
  },
};

export default nextConfig;
