import Link from "next/link";
import { Suspense } from "react";
import { headers } from "next/headers";
import type { Reglementare } from "@prisma/client";
import { Filters } from "@/components/Filters";
import { RegulationTable } from "@/components/RegulationTable";
import { RegulationSummary } from "@/components/RegulationSummary";
import { ProtectedWriteLink } from "@/components/ProtectedWriteLink";
import { readBackupStatus } from "@/lib/backup-status";
import { canWriteFromHeaders } from "@/lib/access-control";
import { buildUpdatedByMap, listRegulations, type RegulationFilters, type UpdatedByReference } from "@/lib/reglementari";

type PageProps = {
  searchParams: RegulationFilters;
};

export default async function HomePage({ searchParams }: PageProps) {
  let rows: Reglementare[] = [];
  let summaryRows: Reglementare[] = [];
  let updatedByMap: Record<number, UpdatedByReference[]> = {};
  let error = "";
  const canWrite = canWriteFromHeaders(headers());
  const backupStatus = readBackupStatus();

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
        {canWrite ? <ProtectedWriteLink href="/reglementari/new" className="btn btn-primary">Adaugă reglementare</ProtectedWriteLink> : null}
      </div>
      {backupStatus ? (
        <div className={`sheet p-3 text-sm font-semibold ${backupStatus.status === "failed" ? "border-red-300 bg-red-50 text-red-800" : backupStatus.status === "success" ? "border-emerald-300 bg-emerald-50 text-emerald-800" : "border-slate-300 bg-slate-50 text-slate-700"}`}>
          Backup bază: {backupStatus.status === "success" ? "reușit" : backupStatus.status === "failed" ? "eșuat" : backupStatus.status === "running" ? "în curs" : "omis, fără modificări"}
          {backupStatus.message ? ` — ${backupStatus.message}` : ""}
        </div>
      ) : null}
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
