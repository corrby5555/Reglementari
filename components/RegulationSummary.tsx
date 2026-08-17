import Link from "next/link";
import type { Reglementare } from "@prisma/client";
import { regulationTypes } from "@/lib/options";
import type { RegulationFilters } from "@/lib/reglementari";

function summaryLabel(value: string) {
  return value.replace(/\s*\([^)]*\)/g, "").trim();
}

function filterHref(searchParams: RegulationFilters, tipReglementare?: string) {
  const params = new URLSearchParams();
  Object.entries(searchParams).forEach(([key, value]) => {
    if (typeof value === "string" && value && key !== "tipReglementare") {
      params.set(key, value);
    }
  });

  if (tipReglementare) {
    params.set("tipReglementare", tipReglementare);
  }

  const query = params.toString();
  return query ? `/?${query}` : "/";
}

export function RegulationSummary({ rows, searchParams }: { rows: Reglementare[]; searchParams: RegulationFilters }) {
  const counts = new Map<string, number>();
  const activeType = searchParams.tipReglementare || "";

  for (const row of rows) {
    counts.set(row.tipReglementare, (counts.get(row.tipReglementare) || 0) + 1);
  }

  return (
    <section className="sheet flex flex-wrap items-center gap-2 p-3 text-sm">
      <Link
        href={filterHref(searchParams)}
        className={`pill font-bold hover:bg-slate-200 ${activeType ? "" : "ring-1 ring-slate-400"}`}
      >
        Total: {rows.length}
      </Link>
      <span className="text-slate-300">|</span>
      {regulationTypes.map((type) => (
        <Link
          key={type}
          href={filterHref(searchParams, type)}
          className={`pill hover:bg-slate-200 ${activeType === type ? "ring-1 ring-slate-400" : ""}`}
        >
          {summaryLabel(type)}: {counts.get(type) || 0}
        </Link>
      ))}
    </section>
  );
}
