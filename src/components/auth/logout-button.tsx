"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

type LogoutButtonProps = {
  className?: string;
  onLoggedOut?: () => void;
  role?: string;
};

export function LogoutButton({ className, onLoggedOut, role }: LogoutButtonProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  async function handleLogout() {
    if (isLoading) return;

    setIsLoading(true);

    try {
      const supabase = createBrowserSupabaseClient();
      const { error } = await supabase.auth.signOut();

      if (error) {
        setIsLoading(false);
        return;
      }

      onLoggedOut?.();
      router.replace("/login");
      router.refresh();
    } catch {
      setIsLoading(false);
    }
  }

  return (
    <button
      type="button"
      role={role}
      disabled={isLoading}
      onClick={handleLogout}
      className={className}
    >
      {isLoading ? "Logging out..." : "Logout"}
    </button>
  );
}
