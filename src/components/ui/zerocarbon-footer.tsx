import Link from "next/link";

const companyLinks = [
  { label: "Offset Emissions", href: "/how-to-offset-emissions" },
  { label: "How To Offset Emissions", href: "/how-to-offset-emissions" },
  { label: "Projects", href: "/projects" },
];

const resourceLinks = [
  { label: "How Carbon Credits Work", href: "/resources/how-carbon-credits-work" },
  { label: "Carbon Market Integrity", href: "/resources/carbon-market-integrity" },
  { label: "FAQ", href: "/resources/faq" },
  { label: "Sustainability Reports", href: "/resources/sustainability-reports" },
];

const legalLinks = [
  { label: "Privacy Policy", href: "/privacy-policy" },
  { label: "Terms of Service", href: "/terms-of-service" },
  { label: "Cookie Policy", href: "/cookie-policy" },
];

export function ZeroCarbonFooter() {
  return (
    <footer className="relative z-10 mt-10 border-t border-white/10 bg-[linear-gradient(180deg,#111827_0%,#0b1220_52%,#081112_100%)] text-slate-300">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-linear-to-b from-white/30 to-transparent opacity-25" />

      <div className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-10 border-b border-white/10 pb-10 md:grid-cols-2 lg:grid-cols-4">
          <section>
            <h2 className="text-xl font-semibold tracking-tight text-white">ZeroCarbon</h2>
            <p className="mt-4 max-w-sm text-sm leading-6 text-slate-300">
              ZeroCarbon is a transparent carbon credit marketplace enabling industries to offset
              emissions and empowering farmers to monetize climate projects.
            </p>
          </section>

          <section>
            <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-100">
              For Companies
            </h3>
            <ul className="mt-4 space-y-3">
              {companyLinks.map((item) => (
                <li key={item.label}>
                  <Link
                    href={item.href}
                    className="text-sm text-slate-300 transition-colors duration-200 hover:text-emerald-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-100">
              Resources
            </h3>
            <ul className="mt-4 space-y-3">
              {resourceLinks.map((item) => (
                <li key={item.label}>
                  <Link
                    href={item.href}
                    className="text-sm text-slate-300 transition-colors duration-200 hover:text-emerald-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
                  >
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h3 className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-100">
              Marketplace Pulse
            </h3>
            <div className="mt-4 rounded-2xl border border-emerald-200/20 bg-white/5 p-4">
              <p className="text-xs uppercase tracking-[0.15em] text-emerald-300">CO2 Offset Counter</p>
              <p className="mt-2 text-2xl font-semibold text-white">12,480 tCO2e</p>
              <p className="mt-2 text-xs text-slate-400">Placeholder metric updated in real time.</p>
            </div>
          </section>
        </div>

        <div className="flex flex-col gap-4 pt-6 text-sm text-slate-400 md:flex-row md:items-center md:justify-between">
          <p>&copy; 2026 ZeroCarbon. All rights reserved.</p>
          <nav aria-label="Footer legal links" className="flex flex-wrap items-center gap-x-6 gap-y-2">
            {legalLinks.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="transition-colors duration-200 hover:text-emerald-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </footer>
  );
}
