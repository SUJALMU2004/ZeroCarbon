"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle2, Copy, Check } from "lucide-react";

interface ConfirmationHeroProps {
  referenceId: string;
}

export default function ConfirmationHero({ referenceId }: ConfirmationHeroProps) {
  const [copied, setCopied] = useState(false);

  const copyReference = async () => {
    try {
      await navigator.clipboard.writeText(referenceId);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <section className="rounded-2xl bg-white p-6 text-center shadow-sm ring-1 ring-black/5">
      <motion.div
        initial={{ scale: 0.7, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.35, ease: "easeOut" }}
        className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-green-50"
      >
        <CheckCircle2 className="h-12 w-12 text-green-600" />
      </motion.div>

      <h1 className="mt-4 text-2xl font-bold text-gray-900">Project Submitted for Evaluation</h1>
      <p className="mt-2 text-sm text-gray-600">
        Our team will review your submission and get back to you via email.
      </p>

      <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-green-200 bg-green-50 px-3 py-1.5">
        <span className="text-sm font-semibold text-green-700">{referenceId}</span>
        <button
          type="button"
          onClick={() => {
            void copyReference();
          }}
          className="rounded-full p-1 text-green-700 hover:bg-green-100"
          aria-label="Copy reference ID"
        >
          {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
        </button>
      </div>
    </section>
  );
}

