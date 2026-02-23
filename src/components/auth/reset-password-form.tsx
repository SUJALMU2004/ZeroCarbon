"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { AuthError } from "@supabase/supabase-js";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

const MIN_PASSWORD_LENGTH = 8;
const INVALID_LINK_MESSAGE = "This reset link is invalid or has expired. Please request a new reset email.";

type RecoveryState = "checking" | "ready" | "invalid";

function getFriendlyResetErrorMessage(error: AuthError): string {
  const message = error.message ?? "";

  if (/password should be at least|weak password/i.test(message)) {
    return `Password is too weak. Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  }

  if (/auth session missing|jwt|session|expired/i.test(message)) {
    return INVALID_LINK_MESSAGE;
  }

  if (/invalid api key|project not found|api key/i.test(message)) {
    return "Authentication service configuration error. Please contact support.";
  }

  if (/failed to fetch|network request failed|network/i.test(message)) {
    return "Network error while connecting to authentication service. Please try again.";
  }

  return "Unable to reset password right now. Please try again.";
}

export function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tokenHash = searchParams.get("token_hash");
  const tokenType = searchParams.get("type");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [recoveryState, setRecoveryState] = useState<RecoveryState>("checking");
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    let isMounted = true;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" && isMounted) {
        setRecoveryState("ready");
      }
    });

    async function initializeRecoverySession() {
      try {
        const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
        const accessToken = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token");
        const hashType = hashParams.get("type");
        const hashError = hashParams.get("error_description");

        if (hashError) {
          if (isMounted) {
            setRecoveryState("invalid");
            setError(INVALID_LINK_MESSAGE);
          }
          return;
        }

        if (accessToken && refreshToken && hashType === "recovery") {
          const { error: setSessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (setSessionError) {
            if (isMounted) {
              setRecoveryState("invalid");
              setError(INVALID_LINK_MESSAGE);
            }
            return;
          }

          window.history.replaceState({}, document.title, `${window.location.pathname}${window.location.search}`);

          if (isMounted) {
            setRecoveryState("ready");
          }
          return;
        }

        if (tokenHash && tokenType === "recovery") {
          const { error: verifyError } = await supabase.auth.verifyOtp({
            token_hash: tokenHash,
            type: "recovery",
          });

          if (verifyError) {
            if (isMounted) {
              setRecoveryState("invalid");
              setError(INVALID_LINK_MESSAGE);
            }
            return;
          }

          if (isMounted) {
            setRecoveryState("ready");
          }
          return;
        }

        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session) {
          if (isMounted) {
            setRecoveryState("ready");
          }
          return;
        }

        if (isMounted) {
          setRecoveryState("invalid");
          setError(INVALID_LINK_MESSAGE);
        }
      } catch {
        if (isMounted) {
          setRecoveryState("invalid");
          setError("Unable to validate reset link. Please request a new one.");
        }
      }
    }

    void initializeRecoverySession();

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [tokenHash, tokenType]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccessMessage(null);

    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(`Password must be at least ${MIN_PASSWORD_LENGTH} characters long.`);
      return;
    }

    if (password !== confirmPassword) {
      setError("Password and confirm password do not match.");
      return;
    }

    if (recoveryState !== "ready") {
      setError(INVALID_LINK_MESSAGE);
      return;
    }

    setIsLoading(true);

    try {
      const supabase = createBrowserSupabaseClient();
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      });

      if (updateError) {
        setError(getFriendlyResetErrorMessage(updateError));
        return;
      }

      setSuccessMessage("Password updated successfully. Redirecting to login...");
      setPassword("");
      setConfirmPassword("");

      await supabase.auth.signOut();
      window.setTimeout(() => {
        router.replace("/login");
        router.refresh();
      }, 1200);
    } catch (caughtError) {
      if (caughtError instanceof Error && /missing required environment variable/i.test(caughtError.message)) {
        setError("Authentication service configuration error. Please contact support.");
      } else {
        setError("Unable to reset password right now. Please try again.");
      }
    } finally {
      setIsLoading(false);
    }
  }

  if (recoveryState === "checking") {
    return (
      <div className="mt-6 rounded-xl border border-slate-200 bg-white px-4 py-4 text-sm text-slate-600">
        Validating your reset link...
      </div>
    );
  }

  if (recoveryState === "invalid") {
    return (
      <div className="mt-6 space-y-4">
        <p
          aria-live="polite"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {error ?? INVALID_LINK_MESSAGE}
        </p>
        <p className="text-sm text-slate-600">
          Need a new link?{" "}
          <Link
            href="/forgot-password"
            className="font-semibold text-emerald-700 transition-colors duration-200 hover:text-emerald-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2"
          >
            Request password reset
          </Link>
        </p>
      </div>
    );
  }

  return (
    <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
      <div>
        <label htmlFor="new-password" className="mb-2 block text-sm font-medium text-slate-700">
          New Password
        </label>
        <input
          id="new-password"
          name="new-password"
          type="password"
          autoComplete="new-password"
          required
          disabled={isLoading}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-slate-900 outline-none transition-colors duration-200 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-200 disabled:cursor-not-allowed disabled:opacity-70"
          placeholder="Enter new password"
        />
      </div>

      <div>
        <label htmlFor="confirm-new-password" className="mb-2 block text-sm font-medium text-slate-700">
          Confirm New Password
        </label>
        <input
          id="confirm-new-password"
          name="confirm-new-password"
          type="password"
          autoComplete="new-password"
          required
          disabled={isLoading}
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-slate-900 outline-none transition-colors duration-200 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-200 disabled:cursor-not-allowed disabled:opacity-70"
          placeholder="Confirm new password"
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
            Updating password...
          </span>
        ) : (
          "Update password"
        )}
      </button>
    </form>
  );
}
