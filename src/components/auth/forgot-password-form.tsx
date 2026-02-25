"use client";

import { useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { AuthError } from "@supabase/supabase-js";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

const GENERIC_RESET_MESSAGE = "If an account exists for this email, a reset link has been sent.";

function getForgotPasswordErrorMessage(error: AuthError): string {
  const message = error.message ?? "";

  if (/invalid api key|jwt|api key|project not found/i.test(message)) {
    return "Authentication service configuration error. Please contact support.";
  }

  if (/failed to fetch|network request failed|network/i.test(message)) {
    return "Network error while connecting to authentication service. Please try again.";
  }

  if (error.status === 429 || /too many requests|rate limit|throttl/i.test(message)) {
    return "Too many reset requests. Please wait a moment and try again.";
  }

  if (/redirect|redirect_to|not allowed|not whitelisted/i.test(message)) {
    return "Unable to send reset email due to configuration. Please contact support.";
  }

  return "Unable to process your request right now. Please try again.";
}

export function ForgotPasswordForm() {
  const searchParams = useSearchParams();
  const emailQuery = searchParams.get("email")?.trim() ?? "";
  const inFlightRef = useRef(false);
  const [email, setEmail] = useState(emailQuery);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isLoading || inFlightRef.current) {
      return;
    }

    setError(null);
    setSuccessMessage(null);

    const normalizedEmail = email.trim();
    if (!normalizedEmail) {
      setError("Email is required.");
      return;
    }

    inFlightRef.current = true;
    setIsLoading(true);

    try {
      const supabase = createBrowserSupabaseClient();
      const redirectTo = `${window.location.origin}/reset-password`;
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
        redirectTo,
      });

      if (resetError) {
        setError(getForgotPasswordErrorMessage(resetError));
        return;
      }

      setSuccessMessage(GENERIC_RESET_MESSAGE);
    } catch (caughtError) {
      if (caughtError instanceof Error && /missing required environment variable/i.test(caughtError.message)) {
        setError("Authentication service configuration error. Please contact support.");
      } else {
        setError("Unable to process your request right now. Please try again.");
      }
    } finally {
      setIsLoading(false);
      inFlightRef.current = false;
    }
  }

  const loginHref = email.trim() ? `/login?email=${encodeURIComponent(email.trim())}` : "/login";

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
          onChange={(event) => {
            setEmail(event.target.value);
            if (error) {
              setError(null);
            }
            if (successMessage) {
              setSuccessMessage(null);
            }
          }}
          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-slate-900 outline-none transition-colors duration-200 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-200 disabled:cursor-not-allowed disabled:opacity-70"
          placeholder="you@company.com"
        />
      </div>

      {error ? (
        <p
          aria-live="polite"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {error}
        </p>
      ) : null}

      {successMessage ? (
        <p
          aria-live="polite"
          className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
        >
          {successMessage}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isLoading}
        className="inline-flex w-full items-center justify-center rounded-xl border border-emerald-500 bg-gradient-to-r from-emerald-500 to-green-500 px-4 py-2.5 text-sm font-semibold text-white transition-all duration-200 hover:from-emerald-400 hover:to-green-400 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isLoading ? (
          <span className="inline-flex items-center gap-2">
            <span
              aria-hidden="true"
            className="h-4 w-4 animate-spin rounded-full border-2 border-white/80 border-t-transparent"
            />
            Sending reset link...
          </span>
        ) : (
          "Send reset link"
        )}
      </button>

      <p className="text-sm text-slate-600">
        Remembered your password?{" "}
        <Link
          href={loginHref}
          className="font-semibold text-emerald-700 transition-colors duration-200 hover:text-emerald-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2"
        >
          Login
        </Link>
      </p>
    </form>
  );
}
