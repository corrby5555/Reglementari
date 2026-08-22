import Link from "next/link";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { EditRegulationForm } from "@/components/EditRegulationForm";
import { canWriteFromHeaders } from "@/lib/access-control";
import { getRegulation } from "@/lib/reglementari";

type EditProps = {
  params: { id: string };
};

export default async function EditRegulationPage({ params }: EditProps) {
  const id = Number(params.id);
  if (!Number.isFinite(id)) notFound();

  const item = await getRegulation(id);
  if (!item) notFound();
  const canWrite = canWriteFromHeaders(headers());

  if (!canWrite) {
    return (
      <main className="page-shell">
        <div className="sheet border-amber-200 bg-amber-50 p-5 text-sm font-semibold text-amber-800">
          Acces doar pentru citire. Calculatorul curent nu are drept de modificare reglementări.
          <div className="mt-3">
            <Link href={`/reglementari/${item.id}`} className="btn">Retur</Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="page-shell">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="label">Catalog</p>
          <h1 className="text-3xl font-bold text-ink">Modifică reglementare</h1>
        </div>
        <Link href={`/reglementari/${item.id}`} className="btn">Retur</Link>
      </div>
      <EditRegulationForm item={{ ...item, dataAdaugare: item.dataAdaugare.toISOString() }} />
    </main>
  );
}
