import Link from "next/link";
import { Suspense } from "react";
import type { Reglementare } from "@prisma/client";
import { Filters } from "@/components/Filters";
import { RegulationTable } from "@/components/RegulationTable";
import { RegulationSummary } from "@/components/RegulationSummary";
import { buildUpdatedByMap, listRegulations, type RegulationFilters, type UpdatedByReference } from "@/lib/reglementari";

type PageProps = {
  searchParams: RegulationFilters;
};

export default async function HomePage({ searchParams }: PageProps) {
  let rows: Reglementare[] = [];
  let summaryRows: Reglementare[] = [];
  let updatedByMap: Record<number, UpdatedByReference[]> = {};
  let error = "";

  try {
    rows = await listRegulations(searchParams);
    summaryRows = await listRegulations({ ...searchParams, tipReglementare: undefined });
    updatedByMap = await buildUpdatedByMap(rows);
  } catch (caught) {
    error = caught instanceof Error ? caught.message : "Conexiunea la baza de date nu a reușit.";
  }

  return (
    <main className="page-shell">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="label">Catalog intern</p>
          <h1 className="text-3xl font-bold text-ink">Reglementări tehnice</h1>
        </div>
        <Link href="/reglementari/new" className="btn btn-primary">Adaugă reglementare</Link>
      </div>
      <Suspense fallback={<div className="sheet p-4 text-sm text-slate-500">Se încarcă filtrele...</div>}>
        <Filters />
      </Suspense>
      {error ? (
        <div className="sheet border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700">
          Nu se poate citi catalogul. Verifică `DATABASE_URL` și rulează `npm run setup:db`.
          <div className="mt-2 font-normal">{error}</div>
        </div>
      ) : (
        <>
          <RegulationSummary rows={summaryRows} searchParams={searchParams} />
          <RegulationTable rows={rows} updatedByMap={updatedByMap} searchParams={searchParams} />
        </>
      )}
    </main>
  );
}
