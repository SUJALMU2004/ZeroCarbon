"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  COUNTRY_CODE_OPTIONS,
  DEFAULT_COUNTRY_CODE,
  filterCountryCodeOptions,
  type CountryCodeOption,
} from "@/lib/profile/country-codes";

type CountryComboboxProps = {
  value: string;
  disabled?: boolean;
  onChange: (dialCode: string) => void;
};

function getSelectedOption(value: string): CountryCodeOption {
  return (
    COUNTRY_CODE_OPTIONS.find((option) => option.dialCode === value) ??
    COUNTRY_CODE_OPTIONS.find((option) => option.dialCode === DEFAULT_COUNTRY_CODE) ??
    COUNTRY_CODE_OPTIONS[0]
  );
}

export function CountryCombobox({ value, disabled = false, onChange }: CountryComboboxProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const selected = useMemo(() => getSelectedOption(value), [value]);
  const filteredOptions = useMemo(() => filterCountryCodeOptions(search), [search]);

  useEffect(() => {
    if (!isOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (containerRef.current?.contains(target)) return;
      setIsOpen(false);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setIsOpen(false);
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    window.requestAnimationFrame(() => searchInputRef.current?.focus());
  }, [isOpen]);

  return (
    <div ref={containerRef} className="relative">
      <label className="mb-2 block text-sm font-medium text-slate-700">Country</label>
      <button
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        onClick={() => {
          if (disabled) return;
          setIsOpen((prev) => !prev);
        }}
        className="flex w-full items-center justify-between rounded-2xl border border-slate-300 bg-white px-3 py-2.5 text-left text-sm text-slate-900 transition-all duration-200 hover:border-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-200 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <span className="truncate">
          {selected.name} ({selected.dialCode})
        </span>
        <svg
          aria-hidden="true"
          viewBox="0 0 20 20"
          className={`h-4 w-4 text-slate-500 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
        >
          <path d="m5 8 5 5 5-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {isOpen ? (
        <div className="absolute z-40 mt-2 w-full rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
          <input
            ref={searchInputRef}
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search country or code"
            className="mb-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-900 outline-none transition-colors duration-200 focus:border-slate-300 focus:bg-white"
          />
          <ul role="listbox" className="max-h-56 overflow-auto">
            {filteredOptions.length === 0 ? (
              <li className="px-3 py-2 text-sm text-slate-500">No countries found</li>
            ) : (
              filteredOptions.map((option) => (
                <li key={`${option.iso2}-${option.dialCode}`}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(option.dialCode);
                      setIsOpen(false);
                      setSearch("");
                    }}
                    className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm text-slate-700 transition-colors duration-150 hover:bg-slate-100 hover:text-slate-900"
                  >
                    <span className="truncate">{option.name}</span>
                    <span className="ml-2 shrink-0 text-slate-500">{option.dialCode}</span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

