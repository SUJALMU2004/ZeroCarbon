import { redirect } from "next/navigation";
import { RegisterForm } from "@/components/auth/register-form";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export default async function RegisterPage() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/dashboard");
  }

  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-4xl items-center px-4 py-8 sm:px-6 sm:py-10 md:px-8">
      <section className="w-full rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-sm backdrop-blur-sm sm:p-8 md:p-12">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl md:text-4xl">
          Register
        </h1>
        <p className="mt-3 text-slate-600">
          Create your ZeroCarbon account to manage climate impact activity and track your profile.
        </p>
        <RegisterForm />
      </section>
    </main>
  );
}
