"use client";

import { useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { AuthError } from "@supabase/supabase-js";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

const MIN_PASSWORD_LENGTH = 8;

type SignUpResponseData = {
  user: {
    email?: string | null;
    identities?: unknown;
  } | null;
  session: unknown;
};

function getFriendlySignupErrorMessage(error: AuthError): string {
  const message = error.message ?? "";

  if (/user already registered|already been registered|email.*already/i.test(message)) {
    return "An account with this email already exists. Please log in.";
  }

  if (/password should be at least|weak password/i.test(message)) {
    return `Password is too weak. Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  }

  if (/signup is disabled|signups not allowed/i.test(message)) {
    return "Registration is currently disabled. Please contact support.";
  }

  if (error.status === 429 || /too many requests|rate limit|throttl/i.test(message)) {
    return "Too many signup attempts. Please wait a moment and try again.";
  }

  if (/invalid api key|jwt|api key|project not found/i.test(message)) {
    return "Authentication service configuration error. Please contact support.";
  }

  if (/failed to fetch|network request failed|network/i.test(message)) {
    return "Network error while connecting to authentication service. Please try again.";
  }

  return "Unable to register right now. Please try again.";
}

function isDuplicateRegistrationResponse(
  error: AuthError | null,
  data: SignUpResponseData | null,
  email: string,
): boolean {
  const normalizedEmail = email.trim().toLowerCase();

  if (error) {
    const message = error.message ?? "";
    if (error.status === 422 || /user already registered|already been registered|email.*already/i.test(message)) {
      return true;
    }
    return false;
  }

  if (!data || !data.user || data.session) {
    return false;
  }

  const responseEmail = data.user.email?.toLowerCase();
  if (!responseEmail || responseEmail !== normalizedEmail) {
    return false;
  }

  const identities = data.user.identities;
  if (identities == null) {
    return true;
  }

  return Array.isArray(identities) && identities.length === 0;
}

export function RegisterForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const emailQuery = searchParams.get("email")?.trim() ?? "";
  const inFlightRef = useRef(false);
  const [email, setEmail] = useState(emailQuery);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
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

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`);
      return;
    }

    if (password !== confirmPassword) {
      setError("Password and confirm password do not match.");
      return;
    }

    inFlightRef.current = true;
    setIsLoading(true);

    try {
      const supabase = createBrowserSupabaseClient();
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
      });

      if (isDuplicateRegistrationResponse(signUpError, data, normalizedEmail)) {
        setError("User already exists. Please log in.");
        return;
      }

      if (signUpError) {
        setError(getFriendlySignupErrorMessage(signUpError));
        return;
      }

      if (data.session) {
        router.replace("/dashboard");
        router.refresh();
        return;
      }

      setSuccessMessage("Check your email to verify your account, then sign in.");
      setEmail(normalizedEmail);
      setPassword("");
      setConfirmPassword("");
    } catch (caughtError) {
      if (caughtError instanceof Error && /missing required environment variable/i.test(caughtError.message)) {
        setError("Authentication service configuration error. Please contact support.");
      } else {
        setError("Network error while connecting to authentication service. Please try again.");
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
          autoComplete="new-password"
          required
          disabled={isLoading}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-slate-900 outline-none transition-colors duration-200 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-200 disabled:cursor-not-allowed disabled:opacity-70"
          placeholder="Create a password"
        />
      </div>

      <div>
        <label htmlFor="confirm-password" className="mb-2 block text-sm font-medium text-slate-700">
          Confirm Password
        </label>
        <input
          id="confirm-password"
          name="confirm-password"
          type="password"
          autoComplete="new-password"
          required
          disabled={isLoading}
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-slate-900 outline-none transition-colors duration-200 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-200 disabled:cursor-not-allowed disabled:opacity-70"
          placeholder="Confirm your password"
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
            Creating account...
          </span>
        ) : (
          "Register"
        )}
      </button>

      <p className="text-sm text-slate-600">
        Already have an account?{" "}
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
