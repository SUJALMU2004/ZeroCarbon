"use client";

import { useState } from "react";

interface EditRequestModalProps {
  open: boolean;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (reason: string) => Promise<void>;
}

export default function EditRequestModal({
  open,
  isSubmitting,
  onClose,
  onSubmit,
}: EditRequestModalProps) {
  const [reason, setReason] = useState("");
  const [error, setError] = useState("");
  if (!open) return null;

  const handleSubmit = async () => {
    const trimmed = reason.trim();
    if (trimmed.length < 10 || trimmed.length > 500) {
      setError("Reason must be between 10 and 500 characters.");
      return;
    }

    setError("");
    await onSubmit(trimmed);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl ring-1 ring-black/5">
        <h3 className="text-lg font-semibold text-gray-900">Request Edit Permission</h3>
        <p className="mt-2 text-sm text-gray-600">
          Describe what you&apos;d like to change. Your reason will be sent to the admin for approval.
        </p>

        <textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          rows={5}
          maxLength={500}
          className="mt-4 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-900 outline-none focus:border-green-500"
          placeholder="Explain what you need to edit..."
        />

        <div className="mt-1 text-right text-xs text-gray-500">
          {reason.trim().length}/500
        </div>

        {error ? <p className="mt-2 text-sm text-red-600">{error}</p> : null}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              void handleSubmit();
            }}
            disabled={isSubmitting}
            className="rounded-lg bg-green-600 px-3 py-2 text-sm font-semibold text-white hover:bg-green-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Sending..." : "Send Request"}
          </button>
        </div>
      </div>
    </div>
  );
}



