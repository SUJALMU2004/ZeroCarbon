import Link from "next/link";

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

      <section className="grid gap-4 md:grid-cols-3 md:gap-5">
        <article className="rounded-3xl border border-slate-200 bg-white/75 p-6 shadow-sm backdrop-blur-sm sm:p-8">
          <h2 className="text-xl font-semibold tracking-tight text-slate-900">How To Offset Emissions</h2>
          <p className="mt-3 text-slate-600">
            Learn how to measure your footprint, choose trusted projects, and retire credits with
            transparent records.
          </p>
          <Link
            href="/how-to-offset-emissions"
            className="mt-4 inline-flex text-sm font-semibold text-emerald-600 transition-colors duration-200 hover:text-emerald-700"
          >
            Learn more
          </Link>
        </article>

        <article className="rounded-3xl border border-slate-200 bg-white/75 p-6 shadow-sm backdrop-blur-sm sm:p-8">
          <h2 className="text-xl font-semibold tracking-tight text-slate-900">How It Works</h2>
          <p className="mt-3 text-slate-600">
            See how ZeroCarbon verifies projects, simplifies purchasing, and tracks measurable climate
            impact.
          </p>
          <Link
            href="/how-it-works"
            className="mt-4 inline-flex text-sm font-semibold text-emerald-600 transition-colors duration-200 hover:text-emerald-700"
          >
            Learn more
          </Link>
        </article>

        <article className="rounded-3xl border border-slate-200 bg-white/75 p-6 shadow-sm backdrop-blur-sm sm:p-8">
          <h2 className="text-xl font-semibold tracking-tight text-slate-900">Projects</h2>
          <p className="mt-3 text-slate-600">
            Explore climate initiatives across categories, with clear standards and comparability.
          </p>
          <Link
            href="/projects"
            className="mt-4 inline-flex text-sm font-semibold text-emerald-600 transition-colors duration-200 hover:text-emerald-700"
          >
            Learn more
          </Link>
        </article>
      </section>
    </main>
  );
}
