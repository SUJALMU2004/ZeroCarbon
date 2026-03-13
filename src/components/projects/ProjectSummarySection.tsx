interface SummaryRow {
  label: string;
  value: string;
}

interface ProjectSummarySectionProps {
  title: string;
  rows: SummaryRow[];
}

export default function ProjectSummarySection({
  title,
  rows,
}: ProjectSummarySectionProps) {
  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-black/5">
      <h2 className="text-lg font-semibold text-gray-900">{title}</h2>

      <dl className="mt-4 space-y-3">
        {rows.map((row) => (
          <div
            key={`${title}-${row.label}`}
            className="grid gap-1 border-b border-gray-100 pb-3 last:border-b-0 last:pb-0 sm:grid-cols-[220px,1fr]"
          >
            <dt className="text-sm font-medium text-gray-500">{row.label}</dt>
            <dd className="text-sm text-gray-800">{row.value || "-"}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

