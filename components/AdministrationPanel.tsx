"use client";

import { useState } from "react";
import type { DatabaseBackupLogEntry } from "@/lib/backup-status";
import type { PdfFileTestResult } from "@/lib/pdf-file-test";

type AdministrationPanelProps = {
  entries: Array<DatabaseBackupLogEntry & { dateLabel: string; statusLabel: string }>;
};

export function AdministrationPanel({ entries }: AdministrationPanelProps) {
  const [showLog, setShowLog] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<PdfFileTestResult | null>(null);
  const [testError, setTestError] = useState("");

  async function testFiles() {
    if (testing) return;
    setTesting(true);
    setTestError("");
    setTestResult(null);
    try {
      const response = await fetch("/api/administrare/test-fisiere", { method: "POST" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || "Testarea fișierelor PDF a eșuat.");
      setTestResult(payload.data);
    } catch (error) {
      setTestError(error instanceof Error ? error.message : "Testarea fișierelor PDF a eșuat.");
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap gap-3">
        <button type="button" className="btn" onClick={() => setShowLog((value) => !value)}>
          {showLog ? "Ascundere log" : "Afișare log"}
        </button>
        <button type="button" className="btn btn-primary" onClick={testFiles} disabled={testing}>
          {testing ? "Se testează fișierele..." : "Test fișiere"}
        </button>
      </div>

      {showLog ? (
        <section className="sheet overflow-hidden">
          {entries.length === 0 ? (
            <p className="p-5 text-sm text-slate-500">Jurnalul nu conține încă mesaje. Înregistrarea începe la următoarea operație de backup.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="headcell text-left">Data și ora</th>
                    <th className="headcell text-left">Stare</th>
                    <th className="headcell text-left">Mesaj</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry, index) => (
                    <tr
                      key={`${entry.occurredAt}-${index}`}
                      className={
                        entry.status === "success"
                          ? "bg-emerald-50 text-emerald-900"
                          : entry.status === "failed"
                            ? "bg-red-50 text-red-900"
                            : "bg-slate-50 text-slate-700"
                      }
                    >
                      <td className="cell whitespace-nowrap">{entry.dateLabel}</td>
                      <td className="cell font-semibold">{entry.statusLabel}</td>
                      <td className="cell">{entry.message || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}

      {testError ? (
        <div className="sheet border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">{testError}</div>
      ) : null}

      {testResult ? (
        <section className="sheet overflow-hidden">
          <div className="border-b border-gridline bg-slate-50 p-4 text-sm text-slate-700">
            <span className="font-semibold">PDF-uri verificate: {testResult.tested}</span>
            {` · PDF-uri imagine: ${testResult.imagePdfs.length} · Fișiere lipsă: ${testResult.missingFiles} · PDF-uri nevalide: ${testResult.invalidFiles}`}
          </div>
          {testResult.imagePdfs.length === 0 ? (
            <p className="p-5 text-sm text-slate-500">Nu au fost găsite PDF-uri de tip imagine.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr>
                    <th className="headcell text-left">Indicativ</th>
                    <th className="headcell text-left">Denumire</th>
                    <th className="headcell text-left">Fișier</th>
                  </tr>
                </thead>
                <tbody>
                  {testResult.imagePdfs.map((item) => (
                    <tr key={item.id} className="bg-amber-50">
                      <td className="cell whitespace-nowrap font-semibold">
                        <a href={`/reglementari/${item.id}`} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
                          {item.indicativ} / {item.an}
                        </a>
                      </td>
                      <td className="cell">{item.denumireExacta}</td>
                      <td className="cell break-all font-mono text-xs">{item.numeFisier}</td>
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
