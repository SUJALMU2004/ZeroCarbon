export default function Page() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 pb-14 sm:px-6 md:gap-8 md:px-8 md:pb-20 lg:pb-24">
      <section className="scroll-mt-28 rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-sm backdrop-blur-sm sm:p-8 md:scroll-mt-32 md:p-10 lg:p-12">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-emerald-600">ZeroCarbon</p>
        <h1 className="mt-4 max-w-3xl text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl lg:text-5xl">
          Premium climate-tech marketplace for verified carbon impact.
        </h1>
        <p className="mt-4 max-w-2xl text-sm text-slate-600 sm:text-base md:text-lg">
          Offset emissions, fund transparent projects, and move your organization toward measurable
          net-zero outcomes.
        </p>
      </section>

      <section
        id="how-to-offset-emissions"
        className="scroll-mt-28 rounded-3xl border border-slate-200 bg-white/75 p-6 shadow-sm backdrop-blur-sm sm:p-8 md:scroll-mt-32 md:p-10"
      >
        <h2 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">How to Offset Emissions</h2>
        <p className="mt-3 max-w-3xl text-slate-600">
          Calculate your footprint, choose certified projects, and purchase offsets with transparent
          verification records and retirement tracking.
        </p>
      </section>

      <section
        id="how-it-works"
        className="scroll-mt-28 rounded-3xl border border-slate-200 bg-white/75 p-6 shadow-sm backdrop-blur-sm sm:p-8 md:scroll-mt-32 md:p-10"
      >
        <h2 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">How It Works</h2>
        <p className="mt-3 max-w-3xl text-slate-600">
          ZeroCarbon matches buyers with high-integrity projects, verifies issuance data, and
          provides a clean dashboard for tracking impact milestones.
        </p>
      </section>

      <section
        id="projects"
        className="scroll-mt-28 rounded-3xl border border-slate-200 bg-white/75 p-6 shadow-sm backdrop-blur-sm sm:p-8 md:scroll-mt-32 md:p-10"
      >
        <h2 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">Projects</h2>
        <p className="mt-3 max-w-3xl text-slate-600">
          Explore reforestation, blue-carbon, and carbon-removal initiatives with region, methodology,
          and validation details that are easy to compare.
        </p>
      </section>
    </main>
  );
}
