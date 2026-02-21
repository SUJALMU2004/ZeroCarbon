export default function FaqPage() {
  return (
    <main className="mx-auto flex min-h-[70vh] w-full max-w-4xl items-center px-4 py-8 sm:px-6 sm:py-10 md:px-8">
      <section className="w-full rounded-3xl border border-slate-200 bg-white/80 p-6 shadow-sm backdrop-blur-sm sm:p-8 md:p-12">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl md:text-4xl">
          FAQ
        </h1>
        <p className="mt-3 text-slate-600">
          Find answers to common questions on project verification, purchasing workflow, retirement
          tracking, and company onboarding.
        </p>
        <p className="mt-3 text-slate-600">
          This section is a starter placeholder and can be expanded into a searchable knowledge base.
        </p>
      </section>
    </main>
  );
}
