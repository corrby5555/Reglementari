"use client";

import { useState } from "react";
import type { ExtendedSearchResult } from "@/lib/extended-search";

export function ExtendedSearch() {
  const [keywords, setKeywords] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ExtendedSearchResult | null>(null);

  async function search(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (loading) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const response = await fetch("/api/cautare-extinsa", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ keywords }),
      });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || "Căutarea extinsă a eșuat.");
      setResult(payload.data);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Căutarea extinsă a eșuat.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-5">
      <form onSubmit={search} className="sheet grid gap-3 p-4">
        <label className="grid gap-1">
          <span className="label">Cuvinte sau expresii cheie</span>
          <textarea
            className="textarea"
            value={keywords}
            onChange={(event) => setKeywords(event.target.value)}
            placeholder="securitate la incendiu, evacuare, hidranți"
            required
          />
        </label>
        <p className="text-xs text-slate-500">Separă termenii prin virgulă, punct și virgulă sau rând nou. Căutarea ignoră majusculele și diacriticele.</p>
        <div>
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? "Se analizează reglementările..." : "Rulează căutarea extinsă"}
          </button>
        </div>
      </form>

      {loading ? (
        <div className="sheet border-sky-200 bg-sky-50 p-4 text-sm font-semibold text-sky-800">
          Sunt analizate metadatele și conținutul PDF-urilor. Prima rulare poate dura câteva minute.
        </div>
      ) : null}
      {error ? <div className="sheet border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">{error}</div> : null}

      {result ? (
        <section className="sheet overflow-hidden">
          <div className="border-b border-gridline bg-slate-50 p-4 text-sm text-slate-700">
            <span className="font-semibold">Reglementări găsite: {result.rows.length}</span>
            {` · PDF-uri analizate: ${result.pdfFiles} · Extrase acum: ${result.extractedPdfFiles} · Din cache: ${result.cachedPdfFiles}`}
            {result.imageOnlyPdfFiles ? ` · PDF-uri imagine fără OCR: ${result.imageOnlyPdfFiles}` : ""}
            {result.missingPdfFiles ? ` · Fișiere lipsă: ${result.missingPdfFiles}` : ""}
            {result.invalidPdfFiles ? ` · PDF-uri nevalide: ${result.invalidPdfFiles}` : ""}
          </div>
          {result.rows.length === 0 ? (
            <p className="p-5 text-sm text-slate-500">Nu au fost găsite apariții pentru termenii introduși.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="headcell sticky left-0 z-10 min-w-44 text-left">Reglementare</th>
                    {result.keywords.map((keyword) => (
                      <th key={keyword} className="headcell min-w-32 text-center normal-case tracking-normal">{keyword}</th>
                    ))}
                    <th className="headcell text-center">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((row) => (
                    <tr key={row.id}>
                      <td className="cell sticky left-0 bg-white">
                        <a href={`/reglementari/${row.id}`} target="_blank" rel="noopener noreferrer" className="font-semibold text-accent hover:underline">
                          {row.indicativ} / {row.an}
                        </a>
                        <div className="mt-1 max-w-sm text-xs text-slate-500">{row.denumireExacta}</div>
                      </td>
                      {row.counts.map((count, index) => (
                        <td key={`${row.id}-${index}`} className={`cell text-center font-semibold ${count > 0 ? "bg-emerald-50 text-emerald-900" : "text-slate-400"}`}>
                          {count}
                        </td>
                      ))}
                      <td className="cell bg-slate-50 text-center font-bold">{row.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}
