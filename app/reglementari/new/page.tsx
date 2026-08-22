import Link from "next/link";
import { headers } from "next/headers";
import { AddRegulationForm } from "@/components/AddRegulationForm";
import { canWriteFromHeaders } from "@/lib/access-control";

export default function NewRegulationPage() {
  const canWrite = canWriteFromHeaders(headers());

  if (!canWrite) {
    return (
      <main className="page-shell">
        <div className="sheet border-amber-200 bg-amber-50 p-5 text-sm font-semibold text-amber-800">
          Acces doar pentru citire. Calculatorul curent nu are drept de adăugare reglementări.
          <div className="mt-3">
            <Link href="/" className="btn">Retur</Link>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="page-shell">
      <div>
        <p className="label">Catalog</p>
        <h1 className="text-3xl font-bold text-ink">Adaugă reglementare nouă</h1>
      </div>
      <AddRegulationForm />
    </main>
  );
}
