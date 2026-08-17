import { AddRegulationForm } from "@/components/AddRegulationForm";

export default function NewRegulationPage() {
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
