"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Scatter,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type {
  BuyerDashboardEmissionRun,
  EmissionsRunResultMode,
} from "@/types/dashboard-emissions";

type BuyerEmissionsSummaryPanelProps = {
  companyName: string | null;
  initialItems: BuyerDashboardEmissionRun[];
  initialPage: number;
  pageSize: number;
  initialHasMore: boolean;
  initialTotalRuns: number;
};

type EmissionsHistoryResponse = {
  items?: BuyerDashboardEmissionRun[];
  page?: number;
  pageSize?: number;
  hasMore?: boolean;
  error?: string;
};

type ChartPoint = {
  runId: string;
  timestamp: number;
  createdAt: string;
  success_total_tco2e: number | null;
  totalCorporateTco2e: number | null;
  scope1Tco2e: number | null;
  scope2Tco2e: number | null;
  scope3Tco2e: number | null;
  auditStatus: BuyerDashboardEmissionRun["auditStatus"];
  resultMode: EmissionsRunResultMode;
};

function formatTonnes(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return "Unavailable";
  }

  return value.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatRunDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";

  return new Intl.DateTimeFormat("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
}

function statusStyles(run: BuyerDashboardEmissionRun): string {
  if (run.auditStatus === "FAILED") {
    return "bg-red-100 text-red-700";
  }

  if (run.resultMode === "partial") {
    return "bg-amber-100 text-amber-700";
  }

  return "bg-emerald-100 text-emerald-700";
}

function statusLabel(run: BuyerDashboardEmissionRun): string {
  if (run.auditStatus === "FAILED") {
    return "Failed";
  }
  return run.resultMode === "partial" ? "Partial" : "Full";
}

function mergeUniqueRuns(
  previous: BuyerDashboardEmissionRun[],
  incoming: BuyerDashboardEmissionRun[],
): BuyerDashboardEmissionRun[] {
  const seen = new Set<string>();
  const merged: BuyerDashboardEmissionRun[] = [];

  for (const run of [...previous, ...incoming]) {
    if (seen.has(run.id)) continue;
    seen.add(run.id);
    merged.push(run);
  }

  return merged;
}

export default function BuyerEmissionsSummaryPanel({
  companyName,
  initialItems,
  initialPage,
  pageSize,
  initialHasMore,
  initialTotalRuns,
}: BuyerEmissionsSummaryPanelProps) {
  const [items, setItems] = useState<BuyerDashboardEmissionRun[]>(initialItems);
  const [page, setPage] = useState(initialPage);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const latestRun = items[0] ?? null;

  const chartData = useMemo<ChartPoint[]>(() => {
    return [...items]
      .reverse()
      .map((run) => {
        const timestamp = new Date(run.createdAt).getTime();
        return {
          runId: run.id,
          timestamp: Number.isFinite(timestamp) ? timestamp : Date.now(),
          createdAt: run.createdAt,
          success_total_tco2e:
            run.auditStatus === "SUCCESS_ZERO_TRUST_VERIFIED" &&
            typeof run.totalCorporateTco2e === "number"
              ? run.totalCorporateTco2e
              : null,
          totalCorporateTco2e: run.totalCorporateTco2e,
          scope1Tco2e: run.scope1Tco2e,
          scope2Tco2e: run.scope2Tco2e,
          scope3Tco2e: run.scope3Tco2e,
          auditStatus: run.auditStatus,
          resultMode: run.resultMode,
        };
      });
  }, [items]);

  const successfulTotals = useMemo(
    () =>
      chartData
        .map((item) => item.success_total_tco2e)
        .filter((value): value is number => typeof value === "number"),
    [chartData],
  );
  const successPointCount = successfulTotals.length;

  const markerY = useMemo(() => {
    if (successfulTotals.length === 0) {
      return 0;
    }
    return Math.min(...successfulTotals);
  }, [successfulTotals]);

  const failedScatter = useMemo(
    () =>
      chartData
        .filter((item) => item.auditStatus === "FAILED")
        .map((item) => ({
          ...item,
          y: markerY,
        })),
    [chartData, markerY],
  );

  const partialScatter = useMemo(
    () =>
      chartData
        .filter(
          (item) =>
            item.auditStatus === "SUCCESS_ZERO_TRUST_VERIFIED" &&
            item.resultMode === "partial" &&
            typeof item.totalCorporateTco2e === "number",
        )
        .map((item) => ({
          ...item,
          y: item.totalCorporateTco2e as number,
        })),
    [chartData],
  );

  const successScatter = useMemo(
    () =>
      chartData
        .filter((item) => typeof item.success_total_tco2e === "number")
        .map((item) => ({
          ...item,
          y: item.success_total_tco2e as number,
        })),
    [chartData],
  );

  const xAxisDomain = useMemo<[number, number] | ["dataMin", "dataMax"]>(() => {
    if (chartData.length === 0) {
      return ["dataMin", "dataMax"];
    }

    const timestamps = chartData
      .map((point) => point.timestamp)
      .filter((value) => Number.isFinite(value));

    if (timestamps.length === 0) {
      return ["dataMin", "dataMax"];
    }

    const min = Math.min(...timestamps);
    const max = Math.max(...timestamps);

    if (min === max) {
      const sixHoursMs = 6 * 60 * 60 * 1000;
      return [min - sixHoursMs, max + sixHoursMs];
    }

    return [min, max];
  }, [chartData]);

  const yAxisDomain = useMemo<[number, number]>(() => {
    const values: number[] = [];
    values.push(...successfulTotals);

    for (const point of failedScatter) {
      values.push(point.y);
    }

    if (values.length === 0) {
      return [0, 10];
    }

    const min = Math.min(...values);
    const max = Math.max(...values);

    if (min === max) {
      const padding = Math.max(Math.abs(min) * 0.15, 1);
      return [Math.max(0, min - padding), max + padding];
    }

    const padding = Math.max((max - min) * 0.12, 0.5);
    return [Math.max(0, min - padding), max + padding];
  }, [failedScatter, successfulTotals]);

  const loadMore = async () => {
    if (!hasMore || isLoadingMore) return;

    setIsLoadingMore(true);
    setLoadError(null);

    try {
      const nextPage = page + 1;
      const response = await fetch(
        `/api/dashboard/buyer/emissions-history?page=${nextPage}&pageSize=${pageSize}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        },
      );

      const raw = (await response
        .json()
        .catch(() => null)) as EmissionsHistoryResponse | null;

      if (!response.ok) {
        setLoadError(
          raw?.error ??
            `Unable to load additional history (status ${response.status}).`,
        );
        return;
      }

      const incoming = Array.isArray(raw?.items) ? raw.items : [];
      setItems((previous) => mergeUniqueRuns(previous, incoming));
      setPage(nextPage);
      setHasMore(raw?.hasMore === true);
    } catch (error) {
      setLoadError(
        error instanceof Error
          ? error.message
          : "Unexpected error while loading more history.",
      );
    } finally {
      setIsLoadingMore(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="mt-6 flex min-h-56 flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-6 text-center">
        <p className="text-sm font-medium text-gray-700">
          {companyName ? `${companyName} has no emissions runs yet.` : "No emissions runs yet."}
        </p>
        <p className="mt-1 text-sm text-gray-500">
          Run your first emissions assessment to unlock trend charts and history.
        </p>
        <Link
          href="/dashboard/buyer/emissions"
          className="mt-4 inline-flex rounded-xl bg-green-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-green-700"
        >
          Add Latest Emission
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-6 space-y-5">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">
            Latest Total
          </p>
          <p className="mt-1 text-xl font-semibold text-emerald-800">
            {latestRun ? `${formatTonnes(latestRun.totalCorporateTco2e)} tCO2e` : "-"}
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Latest Mode
          </p>
          <p className="mt-1 text-xl font-semibold text-gray-900">
            {latestRun ? statusLabel(latestRun) : "-"}
          </p>
        </div>

        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
            Total Runs
          </p>
          <p className="mt-1 text-xl font-semibold text-gray-900">
            {initialTotalRuns.toLocaleString("en-IN")}
          </p>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-gradient-to-br from-white via-slate-50 to-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">
              Total Emissions Trend
            </h3>
            <p className="text-xs text-gray-500">
              Full and partial runs are plotted; failed runs are marked as red events.
            </p>
            {successPointCount === 1 ? (
              <p className="mt-1 text-xs font-medium text-emerald-700">
                Trend currently has one verified success point.
              </p>
            ) : null}
          </div>
          <Link
            href="/dashboard/buyer/emissions"
            className="inline-flex rounded-lg border border-green-200 bg-green-50 px-3 py-1.5 text-xs font-semibold text-green-700 transition-colors hover:bg-green-100"
          >
            Add Latest Emission
          </Link>
        </div>

        <div className="h-72 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chartData}
              margin={{ top: 12, right: 16, left: 8, bottom: 8 }}
            >
              <defs>
                <linearGradient id="buyerEmissionsArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.04} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
              <XAxis
                type="number"
                dataKey="timestamp"
                domain={xAxisDomain}
                tickFormatter={(value) =>
                  new Date(value).toLocaleDateString("en-IN", {
                    day: "2-digit",
                    month: "short",
                  })
                }
                tick={{ fill: "#6b7280", fontSize: 11 }}
              />
              <YAxis
                domain={yAxisDomain}
                tick={{ fill: "#6b7280", fontSize: 11 }}
                tickFormatter={(value) => `${value.toLocaleString("en-IN")}`}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload || payload.length === 0) return null;

                  const entry = payload[0]?.payload as ChartPoint | undefined;
                  if (!entry) return null;

                  const modeLabel =
                    entry.auditStatus === "FAILED"
                      ? "Failed"
                      : entry.resultMode === "partial"
                        ? "Partial"
                        : "Full";

                  return (
                    <div className="min-w-56 rounded-xl border border-gray-200 bg-white p-3 shadow-lg">
                      <p className="text-xs font-medium text-gray-500">
                        {formatRunDate(entry.createdAt)}
                      </p>
                      <p className="mt-1 text-sm font-semibold text-gray-900">
                        Run Status: {modeLabel}
                      </p>
                      <div className="mt-2 space-y-1 text-xs text-gray-700">
                        <p>Total: {formatTonnes(entry.totalCorporateTco2e)} tCO2e</p>
                        <p>Scope 1: {formatTonnes(entry.scope1Tco2e)} tCO2e</p>
                        <p>Scope 2: {formatTonnes(entry.scope2Tco2e)} tCO2e</p>
                        <p>
                          Scope 3:{" "}
                          {entry.scope3Tco2e === null
                            ? "Unavailable"
                            : `${formatTonnes(entry.scope3Tco2e)} tCO2e`}
                        </p>
                      </div>
                    </div>
                  );
                }}
              />

              <Area
                type="monotone"
                dataKey="success_total_tco2e"
                stroke="#059669"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#buyerEmissionsArea)"
                dot={{ r: 4, fill: "#059669", stroke: "#ecfdf5", strokeWidth: 1.5 }}
                activeDot={{
                  r: 5,
                  fill: "#047857",
                  stroke: "#d1fae5",
                  strokeWidth: 2,
                }}
                connectNulls
              />

              <Scatter
                data={successScatter}
                dataKey="y"
                fill="#059669"
                shape="circle"
              />

              <Scatter
                data={partialScatter}
                dataKey="y"
                fill="#d97706"
                shape="circle"
              />

              <Scatter
                data={failedScatter}
                dataKey="y"
                fill="#dc2626"
                shape="circle"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-4 py-3">
          <h3 className="text-sm font-semibold text-gray-900">
            Emissions Test History
          </h3>
        </div>
        <div className="divide-y divide-gray-100">
          {items.map((run) => (
            <article key={run.id} className="px-4 py-3">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-gray-900">
                  {formatRunDate(run.createdAt)}
                </p>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wide ${statusStyles(
                    run,
                  )}`}
                >
                  {statusLabel(run)}
                </span>
              </div>
              {run.auditStatus === "FAILED" ? (
                <div className="mt-2 text-xs text-red-700">
                  <p>
                    {run.failureStage
                      ? `Stage: ${run.failureStage}`
                      : "Stage: unavailable"}
                  </p>
                  <p className="mt-0.5">{run.errorMessage ?? "Unknown error"}</p>
                </div>
              ) : (
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-gray-700 md:grid-cols-4">
                  <p>Scope 1: {formatTonnes(run.scope1Tco2e)}</p>
                  <p>Scope 2: {formatTonnes(run.scope2Tco2e)}</p>
                  <p>
                    Scope 3:{" "}
                    {run.scope3Tco2e === null
                      ? "Unavailable"
                      : formatTonnes(run.scope3Tco2e)}
                  </p>
                  <p className="font-semibold text-gray-900">
                    Total: {formatTonnes(run.totalCorporateTco2e)}
                  </p>
                </div>
              )}
            </article>
          ))}
        </div>

        <div className="border-t border-gray-100 px-4 py-3">
          {loadError ? (
            <p className="mb-2 text-xs text-red-600">{loadError}</p>
          ) : null}
          {hasMore ? (
            <button
              type="button"
              onClick={loadMore}
              disabled={isLoadingMore}
              className="inline-flex rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoadingMore ? "Loading..." : "Show more"}
            </button>
          ) : (
            <p className="text-xs text-gray-500">No more runs.</p>
          )}
        </div>
      </div>
    </div>
  );
}
