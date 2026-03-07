import MobileBottomBar from "@/components/dashboard/MobileBottomBar";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <>
      <div className={user ? "pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-0" : ""}>
        {children}
      </div>

      {user ? <MobileBottomBar /> : null}
    </>
  );
}
