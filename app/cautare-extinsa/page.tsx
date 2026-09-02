import Link from "next/link";
import { ExtendedSearch } from "@/components/ExtendedSearch";

export default function ExtendedSearchPage() {
  return (
    <main className="page-shell">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="label">Catalog</p>
          <h1 className="text-3xl font-bold text-ink">Căutare extinsă în reglementări</h1>
        </div>
        <Link href="/" className="btn">Retur la catalog</Link>
      </div>
      <ExtendedSearch />
    </main>
  );
}
