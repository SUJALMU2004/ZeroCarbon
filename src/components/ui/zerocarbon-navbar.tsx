"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { JSX } from "react";

type NavLink = { label: string; href: string };
type ActionLink = {
  label: string;
  href: string;
  variant: "primary" | "secondary" | "ghost";
};

const navLinks: NavLink[] = [
  { label: "How To Offset Emissions", href: "/how-to-offset-emissions" },
  { label: "How It Works", href: "/how-it-works" },
  { label: "Projects", href: "/projects" },
];

const actionLinks: ActionLink[] = [
  { label: "Register Company", href: "/register-company", variant: "secondary" },
  { label: "Register / Login", href: "/login", variant: "ghost" },
];

function actionClass(variant: ActionLink["variant"]): string {
  if (variant === "primary") {
    return "border border-emerald-400/45 bg-gradient-to-r from-emerald-500 to-green-500 text-white shadow-[0_8px_24px_rgba(16,185,129,0.3)] hover:-translate-y-0.5 hover:from-emerald-400 hover:to-green-400";
  }

  if (variant === "secondary") {
    return "border border-sky-400/45 bg-gradient-to-r from-sky-500 to-blue-500 text-white shadow-[0_8px_24px_rgba(59,130,246,0.3)] hover:-translate-y-0.5 hover:from-sky-400 hover:to-blue-400";
  }

  return "border border-white/35 bg-white/10 text-slate-800 hover:bg-white/20";
}

export function ZeroCarbonNavbar(): JSX.Element {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  useEffect(() => {
    if (!isMenuOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsMenuOpen(false);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isMenuOpen]);

  return (
    <header className="fixed inset-x-0 top-0 z-50 px-3 pt-4 sm:px-4 lg:px-6">
      <nav
        aria-label="Primary"
        className="mx-auto w-full max-w-7xl rounded-2xl border border-white/20 bg-[rgba(255,255,255,0.1)] shadow-[0_12px_36px_rgba(15,23,42,0.15)] backdrop-blur-md"
      >
        <div className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5 lg:px-6">
          <Link
            href="/"
            className="rounded-md text-lg font-extrabold tracking-tight text-slate-900 transition-colors duration-200 hover:text-emerald-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2"
          >
            <Image src="/ZeroCarbon.png" alt="ZeroCarbon Logo" width={150} height={34} />
          </Link>

          <div className="hidden items-center gap-5 lg:flex xl:gap-8">
            {navLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="group relative text-sm font-medium text-slate-700 transition-colors duration-200 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2"
              >
                {link.label}
                <span className="absolute -bottom-1 left-0 h-0.5 w-full origin-left scale-x-0 bg-emerald-500 transition-transform duration-300 group-hover:scale-x-100 group-focus-visible:scale-x-100" />
              </Link>
            ))}
          </div>

          <div className="hidden items-center gap-2 lg:flex xl:gap-3">
            {actionLinks.map((action) => (
              <Link
                key={action.href}
                href={action.href}
                className={`rounded-full px-3 py-2 text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 xl:px-4 ${actionClass(action.variant)}`}
              >
                {action.label}
              </Link>
            ))}
          </div>

          <button
            type="button"
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-white/30 bg-white/10 text-slate-900 transition-all duration-200 hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 lg:hidden"
            aria-label={isMenuOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={isMenuOpen}
            aria-controls="zerocarbon-mobile-menu"
            onClick={() => setIsMenuOpen((prev) => !prev)}
          >
            <svg
              aria-hidden="true"
              viewBox="0 0 24 24"
              className="h-5 w-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              {isMenuOpen ? (
                <path d="M18 6 6 18M6 6l12 12" />
              ) : (
                <>
                  <path d="M3 6h18" />
                  <path d="M3 12h18" />
                  <path d="M3 18h18" />
                </>
              )}
            </svg>
          </button>
        </div>

        <div
          id="zerocarbon-mobile-menu"
          className={`grid overflow-hidden border-t border-white/20 px-4 transition-[grid-template-rows,opacity,padding] duration-300 ease-out lg:hidden ${
            isMenuOpen ? "grid-rows-[1fr] pb-4 opacity-100" : "grid-rows-[0fr] pb-0 opacity-0"
          }`}
        >
          <div className="min-h-0 overflow-hidden">
            <div className="flex flex-col gap-1 pt-2">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setIsMenuOpen(false)}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-slate-800 transition-colors duration-200 hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2"
                >
                  {link.label}
                </Link>
              ))}

              <hr className="my-2 border-white/30" />

              {actionLinks.map((action) => (
                <Link
                  key={action.href}
                  href={action.href}
                  onClick={() => setIsMenuOpen(false)}
                  className={`whitespace-normal wrap-break-word rounded-full px-4 py-2 text-center text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 ${actionClass(action.variant)}`}
                >
                  {action.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </nav>
    </header>
  );
}
