import { redirect } from "next/navigation";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { logout } from "@/app/dashboard/actions";

function formatCreatedAt(value: string | null): string {
  if (!value) {
    return "Unavailable";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Unavailable";
  }

  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  }).format(date);
}

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("role, created_at")
    .eq("id", user.id)
    .maybeSingle();

  const role = profileError ? "Not set" : profile?.role ?? "Not set";
  const createdAt = profileError ? "Unavailable" : formatCreatedAt(profile?.created_at ?? null);

  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-4xl items-center px-4 py-8 sm:px-6 sm:py-10 md:px-8">
      <section className="w-full rounded-3xl border border-slate-200 bg-white/85 p-6 shadow-sm backdrop-blur-sm sm:p-8 md:p-12">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl md:text-4xl">
          Dashboard
        </h1>
        <p className="mt-3 text-slate-600">Your account overview and profile details.</p>

        <div className="mt-6 grid gap-4 rounded-2xl border border-slate-200 bg-white p-5">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Email</p>
            <p className="mt-1 text-slate-900">{user.email ?? "Unavailable"}</p>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Role</p>
            <p className="mt-1 text-slate-900">{role}</p>
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Created At</p>
            <p className="mt-1 text-slate-900">{createdAt}</p>
          </div>

          <form action={logout} className="pt-2">
            <button
              type="submit"
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 transition-colors duration-200 hover:border-emerald-300 hover:text-emerald-700"
            >
              Logout
            </button>
          </form>
        </div>
      </section>
    </main>
  );
}
