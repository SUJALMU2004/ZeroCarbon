"use client";

import { Minus, Plus } from "lucide-react";

interface ProjectQuantitySelectorProps {
  quantity: number;
  maxQuantity: number;
  onAdd: () => void;
  onSubtract: () => void;
}

export default function ProjectQuantitySelector({
  quantity,
  maxQuantity,
  onAdd,
  onSubtract,
}: ProjectQuantitySelectorProps) {
  return (
    <div className="inline-flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 p-2">
      <button
        type="button"
        onClick={onSubtract}
        disabled={quantity <= 1}
        className="rounded-lg border border-gray-200 bg-white p-2 text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
        aria-label="Decrease quantity"
      >
        <Minus className="h-4 w-4" />
      </button>

      <div className="min-w-12 text-center text-base font-semibold text-gray-900">{quantity}</div>

      <button
        type="button"
        onClick={onAdd}
        disabled={quantity >= maxQuantity}
        className="rounded-lg border border-gray-200 bg-white p-2 text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
        aria-label="Increase quantity"
      >
        <Plus className="h-4 w-4" />
      </button>
    </div>
  );
}

