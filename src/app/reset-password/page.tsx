import { Suspense } from "react";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export default function ResetPasswordPage() {
  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-4xl items-center px-4 py-8 sm:px-6 sm:py-10 md:px-8">
      <section className="w-full rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-sm backdrop-blur-sm sm:p-8 md:p-12">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl md:text-4xl">
          Reset Password
        </h1>
        <p className="mt-3 text-slate-600">Create a new password for your ZeroCarbon account.</p>
        <Suspense
          fallback={
            <div className="mt-6 rounded-xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-600">
              Loading password reset form...
            </div>
          }
        >
          <ResetPasswordForm />
        </Suspense>
      </section>
    </main>
  );
}
