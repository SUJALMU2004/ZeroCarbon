"use client";

import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";

type PhoneOtpModalProps = {
  isOpen: boolean;
  phone: string;
  isSubmitting: boolean;
  isResending: boolean;
  resendCooldownSeconds: number;
  errorMessage: string | null;
  onClose: () => void;
  onSubmit: (otpCode: string) => Promise<void>;
  onResend: () => Promise<void>;
};

function normalizeOtpCode(value: string): string {
  return value.replace(/\D/g, "").slice(0, 6);
}

export function PhoneOtpModal({
  isOpen,
  phone,
  isSubmitting,
  isResending,
  resendCooldownSeconds,
  errorMessage,
  onClose,
  onSubmit,
  onResend,
}: PhoneOtpModalProps) {
  const [otpCode, setOtpCode] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);
  const otpInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const frame = window.requestAnimationFrame(() => otpInputRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      if (isSubmitting) return;
      event.preventDefault();
      onClose();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  if (!isOpen) return null;

  async function handleSubmitOtp() {
    if (isSubmitting) {
      return;
    }
    const normalized = normalizeOtpCode(otpCode);
    if (normalized.length !== 6) {
      setLocalError("Please enter a valid 6-digit OTP.");
      return;
    }

    setLocalError(null);
    await onSubmit(normalized);
  }

  async function handleResend() {
    setLocalError(null);
    await onResend();
  }

  async function handleOtpInputKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key !== "Enter") {
      return;
    }

    event.preventDefault();
    await handleSubmitOtp();
  }

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-900/50 p-4 transition-opacity duration-200">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="phone-otp-title"
        className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl transition-all duration-200"
      >
        <h3 id="phone-otp-title" className="text-xl font-semibold tracking-tight text-slate-900">
          Verify Phone Number
        </h3>
        <p className="mt-2 text-sm text-slate-600">
          Enter the 6-digit OTP sent to <span className="font-semibold text-slate-800">{phone}</span>.
        </p>
        <p className="mt-1 text-xs text-slate-500">You can request a new OTP every 60 seconds.</p>

        <div className="mt-4 space-y-4">
          <div>
            <label htmlFor="phone-otp-code" className="mb-2 block text-sm font-medium text-slate-700">
              OTP Code
            </label>
            <input
              ref={otpInputRef}
              id="phone-otp-code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="123456"
              value={otpCode}
              onChange={(event) => setOtpCode(normalizeOtpCode(event.target.value))}
              onKeyDown={handleOtpInputKeyDown}
              disabled={isSubmitting}
              className="w-full rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-slate-900 outline-none transition-colors duration-200 focus:border-emerald-400 focus:ring-2 focus:ring-emerald-200 disabled:cursor-not-allowed disabled:opacity-70"
            />
          </div>

          <p className="text-xs text-slate-500">
            {resendCooldownSeconds > 0
              ? `Resend available in ${resendCooldownSeconds}s`
              : "You can resend OTP now."}
          </p>

          {localError ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {localError}
            </p>
          ) : null}

          {errorMessage ? (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {errorMessage}
            </p>
          ) : null}

          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={handleSubmitOtp}
              disabled={isSubmitting}
              className="inline-flex items-center justify-center rounded-xl border border-emerald-500 bg-gradient-to-r from-emerald-500 to-green-500 px-4 py-2.5 text-sm font-semibold text-white transition-all duration-200 hover:from-emerald-400 hover:to-green-400 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSubmitting ? "Verifying..." : "Verify OTP"}
            </button>

            <button
              type="button"
              onClick={handleResend}
              disabled={isResending || resendCooldownSeconds > 0 || isSubmitting}
              className="inline-flex items-center justify-center rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-800 transition-colors duration-200 hover:border-emerald-300 hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isResending
                ? "Resending..."
                : resendCooldownSeconds > 0
                  ? `Resend in ${resendCooldownSeconds}s`
                  : "Resend OTP"}
            </button>

            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="inline-flex items-center justify-center rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 transition-colors duration-200 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-70"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
