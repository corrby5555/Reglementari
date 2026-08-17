import { AddRegulationForm } from "@/components/AddRegulationForm";

export default function BulkRegulationPage() {
  return (
    <main className="page-shell">
      <div>
        <p className="label">Catalog</p>
        <h1 className="text-3xl font-bold text-ink">Import bulk reglementări</h1>
      </div>
      <AddRegulationForm bulk />
    </main>
  );
}
