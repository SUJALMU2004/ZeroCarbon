"use client";

import { Check } from "lucide-react";

interface FormProgressProps {
  currentStep: number;
  totalSteps: number;
  stepLabels: string[];
}

export default function FormProgress({
  currentStep,
  totalSteps,
  stepLabels,
}: FormProgressProps) {
  const safeStep = Math.max(1, Math.min(currentStep, totalSteps));
  const progressWidth = (safeStep / totalSteps) * 100;

  return (
    <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
      <p className="text-sm text-gray-500">Step {safeStep} of {totalSteps}</p>
      <h2 className="mt-1 text-lg font-semibold text-gray-900">
        {stepLabels[safeStep - 1] ?? `Step ${safeStep}`}
      </h2>

      <div className="mt-4 h-2 w-full rounded-full bg-gray-100">
        <div
          className="h-2 rounded-full bg-green-600 transition-all duration-500 ease-in-out"
          style={{ width: `${progressWidth}%` }}
        />
      </div>

      <div className="mt-5 flex items-center">
        {Array.from({ length: totalSteps }).map((_, index) => {
          const stepNumber = index + 1;
          const isCompleted = stepNumber < safeStep;
          const isCurrent = stepNumber === safeStep;

          return (
            <div key={stepNumber} className="flex w-full items-center">
              <div className="flex items-center justify-center">
                {isCompleted ? (
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-green-600">
                    <Check className="h-3 w-3 text-white" />
                  </div>
                ) : isCurrent ? (
                  <div className="ring-2 ring-green-600 flex h-8 w-8 items-center justify-center rounded-full border-4 border-green-100 bg-green-600 text-xs font-bold text-white">
                    {stepNumber}
                  </div>
                ) : (
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gray-200 text-xs text-gray-400">
                    {stepNumber}
                  </div>
                )}
              </div>

              {stepNumber < totalSteps ? (
                <div
                  className={`h-0.5 flex-1 ${
                    stepNumber < safeStep ? "bg-green-600" : "bg-gray-200"
                  }`}
                />
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
