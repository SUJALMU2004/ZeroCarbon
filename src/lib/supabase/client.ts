import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabaseAnonKey, getSupabaseUrl } from "@/lib/supabase/env";

let browserClient: SupabaseClient | null = null;

// Browser-only client for auth actions initiated from client components.
export function createBrowserSupabaseClient() {
  if (typeof window === "undefined") {
    return createBrowserClient(getSupabaseUrl(), getSupabaseAnonKey());
  }

  if (browserClient) {
    return browserClient;
  }

  browserClient = createBrowserClient(getSupabaseUrl(), getSupabaseAnonKey());

  return browserClient;
}
