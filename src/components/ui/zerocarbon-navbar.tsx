"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { JSX } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { LogoutButton } from "@/components/auth/logout-button";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";

type NavLink = { label: string; href: string };
type ActionLink = {
  label: string;
  href: string;
  variant: "primary" | "secondary" | "ghost";
};
type AuthStatus = "loading" | "authenticated" | "unauthenticated";

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

function getInitials(email: string | null): string {
  if (!email) return "U";

  const localPart = email.split("@")[0] ?? "";
  const parts = localPart.split(/[\s._-]+/).filter(Boolean);

  if (parts.length === 0) return "U";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();

  return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
}

function getAvatarUrl(user: User | null): string | null {
  const maybeAvatar = user?.user_metadata?.avatar_url;
  return typeof maybeAvatar === "string" && maybeAvatar.length > 0 ? maybeAvatar : null;
}

function AvatarBadge({
  email,
  avatarUrl,
  className,
}: {
  email: string | null;
  avatarUrl: string | null;
  className: string;
}): JSX.Element {
  if (avatarUrl) {
    return (
      <span
        aria-hidden="true"
        className={`${className} overflow-hidden rounded-full border border-white/40 bg-slate-200 bg-cover bg-center`}
        style={{ backgroundImage: `url(${avatarUrl})` }}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className={`${className} inline-flex items-center justify-center rounded-full border border-white/40 bg-slate-800 text-xs font-semibold text-white`}
    >
      {getInitials(email)}
    </span>
  );
}

export function ZeroCarbonNavbar(): JSX.Element {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [authStatus, setAuthStatus] = useState<AuthStatus>("loading");
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const supabase = createBrowserSupabaseClient();
    let isMounted = true;

    const updateAuthState = (session: Session | null) => {
      if (!isMounted) return;
      const user = session?.user ?? null;

      if (!user) {
        setAuthStatus("unauthenticated");
        setUserEmail(null);
        setAvatarUrl(null);
        setIsProfileMenuOpen(false);
        return;
      }

      setAuthStatus("authenticated");
      setUserEmail(user.email ?? null);
      setAvatarUrl(getAvatarUrl(user));
    };

    const syncAuthState = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      updateAuthState(session);
    };

    void syncAuthState();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      updateAuthState(session);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsMenuOpen(false);
        setIsProfileMenuOpen(false);
      }
    };

    const onPointerDown = (event: PointerEvent) => {
      if (!isProfileMenuOpen) return;
      const target = event.target;
      if (!(target instanceof Node)) return;

      if (profileMenuRef.current?.contains(target)) return;
      setIsProfileMenuOpen(false);
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("pointerdown", onPointerDown);

    return () => {
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, [isProfileMenuOpen]);

  const isAuthenticated = authStatus === "authenticated";
  const isAuthLoading = authStatus === "loading";

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
            {isAuthLoading ? (
              <span className="h-10 w-10 animate-pulse rounded-full border border-white/30 bg-white/15" />
            ) : null}

            {!isAuthLoading && !isAuthenticated
              ? actionLinks.map((action) => (
                  <Link
                    key={action.href}
                    href={action.href}
                    className={`rounded-full px-3 py-2 text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 xl:px-4 ${actionClass(action.variant)}`}
                  >
                    {action.label}
                  </Link>
                ))
              : null}

            {isAuthenticated ? (
              <div className="relative" ref={profileMenuRef}>
                <button
                  type="button"
                  aria-label="Open profile menu"
                  aria-haspopup="menu"
                  aria-expanded={isProfileMenuOpen}
                  aria-controls="zerocarbon-profile-menu"
                  onClick={() => setIsProfileMenuOpen((prev) => !prev)}
                  className="rounded-full p-0.5 transition-all duration-200 hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2"
                >
                  <AvatarBadge email={userEmail} avatarUrl={avatarUrl} className="h-10 w-10" />
                </button>

                {isProfileMenuOpen ? (
                  <div
                    id="zerocarbon-profile-menu"
                    role="menu"
                    className="absolute right-0 top-12 z-50 w-52 rounded-2xl border border-white/25 bg-white/90 p-2 shadow-[0_12px_30px_rgba(15,23,42,0.2)] backdrop-blur-md"
                  >
                    <Link
                      role="menuitem"
                      href="/profile"
                      onClick={() => setIsProfileMenuOpen(false)}
                      className="block rounded-xl px-3 py-2 text-sm font-medium text-slate-800 transition-colors duration-200 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2"
                    >
                      Profile
                    </Link>
                    <Link
                      role="menuitem"
                      href="/dashboard"
                      onClick={() => setIsProfileMenuOpen(false)}
                      className="mt-1 block rounded-xl px-3 py-2 text-sm font-medium text-slate-800 transition-colors duration-200 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2"
                    >
                      Dashboard
                    </Link>

                    <hr className="my-2 border-slate-200" />

                    <LogoutButton
                      role="menuitem"
                      onLoggedOut={() => {
                        setIsProfileMenuOpen(false);
                        setIsMenuOpen(false);
                      }}
                      className="block w-full rounded-xl px-3 py-2 text-left text-sm font-semibold text-red-700 transition-colors duration-200 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2 disabled:opacity-70"
                    />
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          <button
            type="button"
            className="inline-flex h-11 w-11 items-center justify-center rounded-lg border border-white/30 bg-white/10 text-slate-900 transition-all duration-200 hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 lg:hidden"
            aria-label={isMenuOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={isMenuOpen}
            aria-controls="zerocarbon-mobile-menu"
            onClick={() => {
              setIsMenuOpen((prev) => !prev);
              setIsProfileMenuOpen(false);
            }}
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

              {isAuthLoading ? (
                <div className="rounded-lg px-3 py-2 text-sm text-slate-700">Loading account...</div>
              ) : null}

              {isAuthenticated ? (
                <>
                  <Link
                    href="/profile"
                    onClick={() => setIsMenuOpen(false)}
                    className="hidden rounded-lg px-3 py-2 text-sm font-medium text-slate-800 transition-colors duration-200 hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 md:block"
                  >
                    Profile
                  </Link>
                  <Link
                    href="/dashboard"
                    onClick={() => setIsMenuOpen(false)}
                    className="hidden rounded-lg px-3 py-2 text-sm font-medium text-slate-800 transition-colors duration-200 hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 md:block"
                  >
                    Dashboard
                  </Link>
                  <LogoutButton
                    onLoggedOut={() => {
                      setIsMenuOpen(false);
                      setIsProfileMenuOpen(false);
                    }}
                    className="w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-red-700 transition-colors duration-200 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 focus-visible:ring-offset-2 disabled:opacity-70"
                  />
                </>
              ) : null}

              {!isAuthLoading && !isAuthenticated
                ? actionLinks.map((action) => (
                    <Link
                      key={action.href}
                      href={action.href}
                      onClick={() => setIsMenuOpen(false)}
                      className={`whitespace-normal wrap-break-word rounded-full px-4 py-2 text-center text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 ${actionClass(action.variant)}`}
                    >
                      {action.label}
                    </Link>
                  ))
                : null}
            </div>
          </div>
        </div>
      </nav>
    </header>
  );
}
