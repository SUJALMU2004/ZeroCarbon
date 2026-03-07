export default function BuyerDashboardLoading() {
  return (
    <div className="animate-pulse">
      <div className="mb-8">
        <div className="h-7 w-48 rounded-lg bg-gray-200" />
        <div className="mt-2 h-4 w-64 rounded bg-gray-200" />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={`buyer-stat-${index}`} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="h-10 w-10 rounded-xl bg-gray-200" />
            <div className="mt-3 h-6 w-20 rounded bg-gray-200" />
            <div className="mt-2 h-3 w-24 rounded bg-gray-200" />
            <div className="mt-1 h-3 w-32 rounded bg-gray-100" />
          </div>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="h-64 rounded-2xl border border-gray-100 bg-white p-6" />
          <div className="h-64 rounded-2xl border border-gray-100 bg-white p-6" />
        </div>
        <div className="space-y-6">
          <div className="h-48 rounded-2xl border border-gray-100 bg-white p-6" />
          <div className="h-48 rounded-2xl border border-gray-100 bg-white p-6" />
        </div>
      </div>
    </div>
  );
}
