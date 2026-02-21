"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import type { AuthError } from "@supabase/supabase-js";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

function getFriendlyErrorMessage(error: AuthError): string {
  const message = error.message ?? "";
  const status = error.status;

  if (status === 401 || /invalid login credentials/i.test(message)) {
    return "Invalid email or password.";
  }

  if (/email not confirmed/i.test(message)) {
    return "Please confirm your email before logging in.";
  }

  if (/invalid api key|jwt|api key/i.test(message)) {
    return "Authentication service configuration error. Please contact support.";
  }

  if (/failed to fetch|network/i.test(message)) {
    return "Network error while connecting to authentication service. Please try again.";
  }

  return "Unable to sign in right now. Please try again.";
}

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const supabase = createBrowserSupabaseClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (signInError) {
        setError(getFriendlyErrorMessage(signInError));
        setIsLoading(false);
        return;
      }

      router.replace("/dashboard");
      router.refresh();
    } catch (caughtError) {
      if (caughtError instanceof Error && /missing required environment variable/i.test(caughtError.message)) {
        setError("Authentication service configuration error. Please contact support.");
      } else {
        setError("Network error while connecting to authentication service. Please try again.");
      }
      setIsLoading(false);
    }
  }

  return (
    <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
      <div>
        <label htmlFor="email" className="mb-2 block text-sm font-medium text-slate-700">
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          required
          disabled={isLoading}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-slate-900 outline-none transition-colors duration-200 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-200 disabled:cursor-not-allowed disabled:opacity-70"
          placeholder="you@company.com"
        />
      </div>

      <div>
        <label htmlFor="password" className="mb-2 block text-sm font-medium text-slate-700">
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          disabled={isLoading}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-slate-900 outline-none transition-colors duration-200 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-200 disabled:cursor-not-allowed disabled:opacity-70"
          placeholder="Enter your password"
        />
      </div>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      ) : null}

      <button
        type="submit"
        disabled={isLoading}
        className="w-full rounded-xl border border-emerald-500 bg-gradient-to-r from-emerald-500 to-green-500 px-4 py-2.5 text-sm font-semibold text-white transition-all duration-200 hover:from-emerald-400 hover:to-green-400 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isLoading ? "Signing in..." : "Login"}
      </button>
    </form>
  );
}
