import Link from "next/link";
import type { Reglementare } from "@prisma/client";
import type { RegulationFilters, RegulationSortField, UpdatedByReference } from "@/lib/reglementari";

type RegulationTableProps = {
  rows: Reglementare[];
  updatedByMap: Record<number, UpdatedByReference[]>;
  searchParams: RegulationFilters;
};

function sortHref(searchParams: RegulationFilters, field: RegulationSortField) {
  const params = new URLSearchParams();
  Object.entries(searchParams).forEach(([key, value]) => {
    if (typeof value === "string" && value) {
      params.set(key, value);
    }
  });

  const currentSort = searchParams.sort || "indicativ";
  const currentDirection = searchParams.dir === "desc" ? "desc" : "asc";
  const nextDirection = currentSort === field && currentDirection === "asc" ? "desc" : "asc";

  params.set("sort", field);
  params.set("dir", nextDirection);
  return `/?${params.toString()}`;
}

function SortHeader({ children, field, searchParams, className = "" }: { children: string; field: RegulationSortField; searchParams: RegulationFilters; className?: string }) {
  const active = (searchParams.sort || "indicativ") === field;
  const direction = searchParams.dir === "desc" ? "desc" : "asc";

  return (
    <Link href={sortHref(searchParams, field)} className={`inline-flex items-center justify-center gap-1 underline-offset-4 hover:underline ${active ? "underline" : ""} ${className}`}>
      <span>{children}</span>
      {active ? <span aria-hidden="true">{direction === "asc" ? "↑" : "↓"}</span> : null}
    </Link>
  );
}

export function RegulationTable({ rows, updatedByMap, searchParams }: RegulationTableProps) {
  if (rows.length === 0) {
    return (
      <div className="sheet p-6 text-sm text-slate-600">
        Nu există reglementări pentru criteriile curente.
      </div>
    );
  }

  return (
    <div className="sheet overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[1120px] table-auto border-collapse">
          <thead>
            <tr>
              <th className="headcell w-[150px] whitespace-nowrap text-center">
                <SortHeader field="indicativ" searchParams={searchParams}>Indicativ</SortHeader>
              </th>
              <th className="headcell text-center">Denumire exactă</th>
              <th className="headcell text-center">Actualizat prin</th>
              <th className="headcell text-center">
                <SortHeader field="tipReglementare" searchParams={searchParams}>Tip reglementare</SortHeader>
              </th>
              <th className="headcell text-center">
                <SortHeader field="tipDocument" searchParams={searchParams}>Tip document</SortHeader>
              </th>
              <th className="headcell text-center">Disciplină</th>
              <th className="headcell text-center">Limba</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((item) => (
              <tr key={item.id} className="hover:bg-slate-50">
                <td className="cell w-[150px] font-bold">
                  <Link href={`/reglementari/${item.id}`} className="text-accent hover:underline">
                    <span className="whitespace-nowrap">{item.indicativ}/</span>
                    <wbr />
                    <span className="whitespace-nowrap">{item.an}</span>
                  </Link>
                </td>
                <td className="cell min-w-[420px] whitespace-normal leading-5">{item.denumireExacta}</td>
                <td className="cell">
                  {(updatedByMap[item.id] || []).length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {updatedByMap[item.id].map((reference) => (
                        <Link key={reference.id} href={`/reglementari/${reference.id}`} className="pill text-accent hover:underline">
                          {reference.indicativ}
                        </Link>
                      ))}
                    </div>
                  ) : (
                    <span className="text-slate-400">-</span>
                  )}
                </td>
                <td className="cell"><span className="pill">{item.tipReglementare}</span></td>
                <td className="cell">{item.tipDocument}</td>
                <td className="cell">{item.disciplina}</td>
                <td className="cell">{item.limba}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
