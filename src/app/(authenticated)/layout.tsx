import MobileBottomBar from "@/components/dashboard/MobileBottomBar";
import { createServerSupabaseClient } from "@/lib/supabase/server";

type ProfileRow = {
  dashboard_mode: "buyer" | "seller" | null;
};

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let currentMode: "buyer" | "seller" = "buyer";

  if (user) {
    const { data: profile, error } = await supabase
      .from("profiles")
      .select("dashboard_mode")
      .eq("id", user.id)
      .maybeSingle();

    if (!error && (profile as ProfileRow | null)?.dashboard_mode === "seller") {
      currentMode = "seller";
    }
  }

  return (
    <>
      <div className={user ? "pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-0" : ""}>
        {children}
      </div>

      {user ? <MobileBottomBar currentMode={currentMode} /> : null}
    </>
  );
}
