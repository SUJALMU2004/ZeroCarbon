"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";

type NotifyAvailabilityButtonProps = {
  email: string;
};

export function NotifyAvailabilityButton({ email }: NotifyAvailabilityButtonProps) {
  const [isNotified, setIsNotified] = useState(false);

  return (
    <div className="mt-6">
      <button
        type="button"
        onClick={() => setIsNotified(true)}
        className="rounded-xl bg-green-600 px-6 py-3 text-sm font-semibold text-white transition-all duration-200 hover:bg-green-700"
      >
        {isNotified ? "Notification Enabled" : "Notify Me When Available"}
      </button>

      <AnimatePresence>
        {isNotified ? (
          <motion.p
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 8 }}
            transition={{ duration: 0.2 }}
            className="mt-3 text-sm text-green-700"
          >
            You&apos;ll be notified at {email || "your account email"}.
          </motion.p>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
