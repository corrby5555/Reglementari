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
  const firstRowTypes = regulationTypes.slice(0, Math.ceil(regulationTypes.length / 2));
  const secondRowTypes = regulationTypes.slice(Math.ceil(regulationTypes.length / 2));

  for (const row of rows) {
    counts.set(row.tipReglementare, (counts.get(row.tipReglementare) || 0) + 1);
  }

  return (
    <section className="sheet grid gap-2 p-3 text-sm md:grid-cols-[auto_1fr]">
      <Link
        href={filterHref(searchParams)}
        className={`pill flex min-w-28 items-center justify-center font-bold hover:bg-slate-200 md:row-span-2 md:self-stretch ${activeType ? "" : "ring-1 ring-slate-400"}`}
      >
        Total: {rows.length}
      </Link>
      {[firstRowTypes, secondRowTypes].map((typeRow, index) => (
        <div key={index} className="grid gap-2 sm:grid-cols-2 lg:grid-cols-6">
          {typeRow.map((type) => (
            <Link
              key={type}
              href={filterHref(searchParams, type)}
              className={`pill justify-center text-center hover:bg-slate-200 ${activeType === type ? "ring-1 ring-slate-400" : ""}`}
            >
              {summaryLabel(type)}: {counts.get(type) || 0}
            </Link>
          ))}
        </div>
      ))}
    </section>
  );
}
