"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { IndicativeMultiSelect } from "@/components/IndicativeMultiSelect";
import { UpdatedByIndicativesField } from "@/components/UpdatedByIndicativesField";
import { normalizeFileDescription } from "@/lib/file-name-description";
import { disciplines, documentTypes, domainOptions, languages, regulationTypes } from "@/lib/options";

type SubmitState = {
  loading: boolean;
  error: string;
};

type DuplicateState = {
  loading: boolean;
  exists: boolean;
  message: string;
  tone: "neutral" | "success" | "warning" | "error";
};

type BulkRowData = {
  rowIndex: number;
  sourceFileName: string;
  values: {
    indicativ: string;
    an: number;
    tipReglementare: string;
    tipDocument: string;
    disciplina: string;
    domeniu: string;
    descriereNumeFisier: string;
    actualizeazaIndicativ: string;
    tipCladire: string;
    descriere: string;
    denumireExacta: string;
    limba: string;
  };
};

type BulkRowError = {
  rowIndex: number;
  message: string;
  candidates?: BulkPdfCandidate[];
};

type BulkPdfCandidate = {
  fileName: string;
  path: string;
};

type BulkState = {
  loading: boolean;
  error: string;
  errorRowIndex: number | null;
  candidates: BulkPdfCandidate[];
  done: boolean;
  row: BulkRowData | null;
  skippedErrors: BulkRowError[];
};

const BULK_SKIPPED_ROWS_KEY = "reglementari:bulk-skipped-rows";

export function AddRegulationForm({ bulk = false }: { bulk?: boolean }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<SubmitState>({ loading: false, error: "" });
  const [fileName, setFileName] = useState("");
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [keywordOptions, setKeywordOptions] = useState<string[]>([]);
  const [indicativ, setIndicativ] = useState("");
  const [an, setAn] = useState("");
  const [duplicate, setDuplicate] = useState<DuplicateState>({ loading: false, exists: false, message: "", tone: "neutral" });
  const [bulkState, setBulkState] = useState<BulkState>({ loading: bulk, error: "", errorRowIndex: null, candidates: [], done: false, row: null, skippedErrors: [] });
  const [selectedBulkSourcePath, setSelectedBulkSourcePath] = useState("");
  const [bulkCleanupWarning, setBulkCleanupWarning] = useState("");
  const [descriereNumeFisier, setDescriereNumeFisier] = useState("");

  function getSkippedRows() {
    if (typeof window === "undefined") return [];
    try {
      const parsed = JSON.parse(window.sessionStorage.getItem(BULK_SKIPPED_ROWS_KEY) || "[]");
      return Array.isArray(parsed) ? parsed.filter((value) => Number.isInteger(value)) : [];
    } catch {
      return [];
    }
  }

  function setSkippedRows(rows: number[]) {
    window.sessionStorage.setItem(BULK_SKIPPED_ROWS_KEY, JSON.stringify(Array.from(new Set(rows)).sort((a, b) => a - b)));
  }

  function skippedRowsQuery() {
    const skippedRows = getSkippedRows();
    const params = new URLSearchParams();
    if (skippedRows.length > 0) {
      params.set("skipRows", skippedRows.join(","));
    }
    return params.toString();
  }

  function adjustSkippedRowsAfterSavedRow(rowIndex: number) {
    const adjustedRows = getSkippedRows()
      .filter((value) => value !== rowIndex)
      .map((value) => (value > rowIndex ? value - 1 : value));
    setSkippedRows(adjustedRows);
  }

  async function skipBulkRow() {
    const rowIndex = bulkState.row?.rowIndex || bulkState.errorRowIndex;
    if (!rowIndex) {
      return;
    }

    if (!window.confirm(`Sari temporar peste rândul ${rowIndex} din cuprins.xls? Excelul și fișierele sursă rămân nemodificate.`)) {
      return;
    }

    setSkippedRows([...getSkippedRows(), rowIndex]);
    await loadBulkRow();
  }

  async function openBulkPdfInPreview(sourcePath = selectedBulkSourcePath) {
    setState({ loading: false, error: "" });

    const query = skippedRowsQuery();

    const response = await fetch(`/api/reglementari/bulk/open-preview${query ? `?${query}` : ""}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ selectedSourcePath: sourcePath }),
    });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      setState({ loading: false, error: payload?.error || "PDF-ul nu a putut fi deschis în Preview." });
    }
  }

  async function resetSkippedRows() {
    window.sessionStorage.removeItem(BULK_SKIPPED_ROWS_KEY);
    await loadBulkRow();
  }

  async function loadBulkRow(selectedSourcePath = "") {
    setBulkState((current) => ({ ...current, loading: true, error: "", errorRowIndex: null, candidates: [], done: false, row: null }));
    setState({ loading: false, error: "" });
    setFileName("");
    setSelectedBulkSourcePath(selectedSourcePath);

    const params = new URLSearchParams(skippedRowsQuery());
    if (selectedSourcePath) {
      params.set("selectedSourcePath", selectedSourcePath);
    }
    const query = params.toString();

    const response = await fetch(`/api/reglementari/bulk/current${query ? `?${query}` : ""}`, { cache: "no-store" });
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      setBulkState({ loading: false, error: payload?.error || "Nu se poate citi rândul bulk.", errorRowIndex: payload?.rowIndex || null, candidates: payload?.candidates || [], done: false, row: null, skippedErrors: payload?.skippedErrors || [] });
      setIndicativ("");
      setAn("");
      return;
    }

    if (!payload?.data) {
      setBulkState({ loading: false, error: "", errorRowIndex: null, candidates: [], done: true, row: null, skippedErrors: payload?.skippedErrors || [] });
      setIndicativ("");
      setAn("");
      return;
    }

    setBulkState({ loading: false, error: "", errorRowIndex: null, candidates: [], done: false, row: payload.data, skippedErrors: payload?.skippedErrors || [] });
    setIndicativ(payload.data.values.indicativ || "");
    setAn(String(payload.data.values.an || ""));
    setFileName(payload.data.sourceFileName || "");
    setDescriereNumeFisier(normalizeFileDescription(payload.data.values.descriereNumeFisier || ""));
  }

  useEffect(() => {
    let active = true;

    fetch("/api/cuvinte-cheie")
      .then((response) => response.ok ? response.json() : { data: [] })
      .then((payload) => {
        if (active && Array.isArray(payload.data)) {
          setKeywordOptions(payload.data);
        }
      })
      .catch(() => {
        if (active) {
          setKeywordOptions([]);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (bulk) {
      loadBulkRow();
    }
  }, [bulk]);

  useEffect(() => {
    if (!bulk) {
      setDescriereNumeFisier("");
    }
  }, [bulk]);

  useEffect(() => {
    const trimmedIndicativ = indicativ.trim();
    const trimmedAn = an.trim();

    if (!trimmedIndicativ || !trimmedAn || !Number.isFinite(Number(trimmedAn))) {
      setDuplicate({ loading: false, exists: false, message: "", tone: "neutral" });
      return;
    }

    const controller = new AbortController();
    setDuplicate({ loading: true, exists: false, message: "Se verifică existența regulamentului...", tone: "neutral" });

    const timeoutId = window.setTimeout(() => {
      const params = new URLSearchParams({ indicativ: trimmedIndicativ, an: trimmedAn });
      fetch(`/api/reglementari/exista?${params.toString()}`, { signal: controller.signal })
        .then((response) => response.ok ? response.json() : { exists: false })
        .then((payload) => {
          if (payload.status === "existing") {
            setDuplicate({
              loading: false,
              exists: true,
              message: `Indicativ existent: ${payload.data.indicativ}/${payload.data.an}: ${payload.data.denumireExacta}`,
              tone: "error",
            });
            return;
          }

          if (payload.status === "possible_update") {
            setDuplicate({
              loading: false,
              exists: false,
              message: `Pare că noua reglementare este o actualizare a uneia deja existente: ${payload.data.indicativ}/${payload.data.an}: ${payload.data.denumireExacta}`,
              tone: "warning",
            });
            return;
          }

          if (payload.status === "too_old") {
            setDuplicate({
              loading: false,
              exists: false,
              message: `Reglementarea pare prea veche: există o reglementare mai nouă în baza de date, ${payload.data.indicativ}/${payload.data.an}: ${payload.data.denumireExacta}`,
              tone: "warning",
            });
            return;
          }

          setDuplicate({ loading: false, exists: false, message: "Indicativul și anul sunt disponibile.", tone: "success" });
        })
        .catch((error) => {
          if (error.name !== "AbortError") {
            setDuplicate({ loading: false, exists: false, message: "", tone: "neutral" });
          }
        });
    }, 350);

    return () => {
      window.clearTimeout(timeoutId);
      controller.abort();
    };
  }, [indicativ, an]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (duplicate.exists) {
      setState({ loading: false, error: "Nu se acceptă mai multe regulamente cu același indicativ și același an." });
      return;
    }

    setState({ loading: true, error: "" });

    const form = event.currentTarget;
    const query = bulk ? skippedRowsQuery() : "";
    const response = await fetch(bulk ? `/api/reglementari/bulk/complete${query ? `?${query}` : ""}` : "/api/reglementari", {
      method: "POST",
      body: new FormData(form),
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      setState({ loading: false, error: payload?.error || "Reglementarea nu a putut fi salvată." });
      return;
    }

    if (bulk) {
      if (Number.isInteger(payload?.rowIndex)) {
        adjustSkippedRowsAfterSavedRow(payload.rowIndex);
      }
      setBulkCleanupWarning(payload?.cleanupWarning || "");
      setState({ loading: false, error: "" });
      await loadBulkRow();
      return;
    }

    router.push(`/reglementari/${payload.id}`);
  }

  function attachFile(file: File | undefined) {
    if (!file || !fileInputRef.current) {
      return;
    }

    const transfer = new DataTransfer();
    transfer.items.add(file);
    fileInputRef.current.files = transfer.files;
    setFileName(file.name);
  }

  function handleDrop(event: React.DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    event.stopPropagation();
    setIsDraggingFile(false);
    attachFile(event.dataTransfer.files?.[0]);
  }

  const bulkValues = bulkState.row?.values;
  const formKey = bulk ? `${bulkState.row?.rowIndex || "empty"}-${bulkState.row?.sourceFileName || "none"}-${selectedBulkSourcePath || "auto"}` : "manual";

  if (bulk && bulkState.loading) {
    return <div className="sheet p-5 text-sm font-semibold text-slate-600">Se citește primul rând din cuprins.xls...</div>;
  }

  if (bulk && bulkState.error) {
    return (
      <div className="sheet border-red-200 bg-red-50 p-5 text-sm font-semibold text-red-700">
        {bulkState.error}
        {bulkState.candidates.length > 0 ? (
          <div className="mt-4 grid gap-2 text-slate-800">
            <div className="font-bold text-red-700">Alege PDF-ul corect pentru acest rând:</div>
            {bulkState.candidates.map((candidate) => (
              <div key={candidate.path} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-red-200 bg-white p-2">
                <span className="break-all font-semibold">{candidate.fileName}</span>
                <div className="flex gap-2">
                  <button type="button" className="btn" onClick={() => openBulkPdfInPreview(candidate.path)}>Deschide</button>
                  <button type="button" className="btn btn-primary" onClick={() => loadBulkRow(candidate.path)}>Alege</button>
                </div>
              </div>
            ))}
          </div>
        ) : null}
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" className="btn" onClick={() => loadBulkRow()}>Reîncearcă</button>
          {bulkState.errorRowIndex ? <button type="button" className="btn border-red-300 bg-white text-red-700 hover:bg-red-50" onClick={skipBulkRow}>Sari peste</button> : null}
          {getSkippedRows().length > 0 ? <button type="button" className="btn" onClick={resetSkippedRows}>Resetează skip</button> : null}
        </div>
      </div>
    );
  }

  if (bulk && bulkState.done) {
    return (
      <div className="sheet p-5 text-sm font-semibold text-emerald-700">
        Nu mai există rânduri de importat în cuprins.xls.
        {getSkippedRows().length > 0 ? (
          <div className="mt-3">
            <button type="button" className="btn" onClick={resetSkippedRows}>Reia rândurile sărite</button>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <form key={formKey} onSubmit={submit} className="grid gap-5">
      {bulk && selectedBulkSourcePath ? <input type="hidden" name="selectedSourcePath" value={selectedBulkSourcePath} /> : null}
      {bulk ? (
        <div className="sheet border-teal-200 bg-teal-50 p-4 text-sm text-teal-900">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="font-bold">Import bulk: rândul {bulkState.row?.rowIndex} din cuprins.xls</div>
              <div className="mt-1">PDF sursă: <span className="font-semibold">{bulkState.row?.sourceFileName}</span></div>
            </div>
            <button type="button" className="btn border-red-300 bg-white text-red-700 hover:bg-red-50" onClick={skipBulkRow}>
              Sari peste
            </button>
          </div>
        </div>
      ) : null}
      {bulk && bulkState.skippedErrors.length > 0 ? (
        <div className="sheet border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <div className="font-bold">Rânduri sărite temporar în această sesiune</div>
          <div className="mt-1 grid gap-1">
            {bulkState.skippedErrors.map((item) => (
              <div key={item.rowIndex}>Rând {item.rowIndex}: {item.message}</div>
            ))}
          </div>
        </div>
      ) : null}
      {bulkCleanupWarning ? <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-800">{bulkCleanupWarning}</div> : null}
      {state.error ? <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{state.error}</div> : null}
      <section className="sheet grid gap-4 p-4">
        <div className="grid gap-3 md:grid-cols-[110px_85px_minmax(160px,0.8fr)_minmax(190px,1fr)_125px_90px]">
          <label className="grid gap-1">
            <span className="label">Indicativ</span>
            <input name="indicativ" className="field" placeholder="I.9" value={indicativ} onChange={(event) => setIndicativ(event.target.value)} required />
          </label>
          <label className="grid gap-1">
            <span className="label">An</span>
            <input name="an" className="field" inputMode="numeric" placeholder="2022" value={an} onChange={(event) => setAn(event.target.value)} required />
          </label>
          <label className="grid gap-1">
            <span className="label">Tip reglementare</span>
            <select name="tipReglementare" className="field" defaultValue={bulkValues?.tipReglementare} required>
              {regulationTypes.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <label className="grid gap-1">
            <span className="label">Actualizează indicativ</span>
            <IndicativeMultiSelect defaultValue={bulkValues?.actualizeazaIndicativ || ""} />
          </label>
          <label className="grid gap-1">
            <span className="label">Tip document</span>
            <select name="tipDocument" className="field" defaultValue={bulkValues?.tipDocument} required>
              {documentTypes.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <label className="grid gap-1">
            <span className="label">Limba</span>
            <select name="limba" className="field" defaultValue={bulkValues?.limba} required>
              {languages.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
        </div>
        {duplicate.message ? (
          <div className={`rounded-md border p-3 text-sm font-semibold ${
            duplicate.tone === "error"
              ? "border-red-200 bg-red-50 text-red-700"
              : duplicate.tone === "warning"
                ? "border-amber-200 bg-amber-50 text-amber-800"
                : duplicate.loading || duplicate.tone === "neutral"
                ? "border-slate-200 bg-slate-50 text-slate-600"
                : "border-emerald-200 bg-emerald-50 text-emerald-700"
          }`}>
            {duplicate.message}
          </div>
        ) : null}
        <div className="grid gap-3 md:grid-cols-[150px_130px_minmax(160px,0.8fr)_minmax(180px,1fr)_minmax(160px,0.8fr)]">
          <label className="grid gap-1">
            <span className="label">Disciplina</span>
            <select name="disciplina" className="field" defaultValue={bulk ? (bulkValues?.disciplina || "") : "general"} required>
              {bulk ? <option value="">Selectează disciplina</option> : null}
              {disciplines.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <label className="grid gap-1">
            <span className="label">Domeniu</span>
            <select name="domeniu" className="field" defaultValue={bulk ? (bulkValues?.domeniu || "") : "general"} required>
              {bulk ? <option value="">Selectează domeniul</option> : null}
              {domainOptions.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <label className="grid gap-1">
            <span className="label">Descriere nume fișier</span>
            <input
              name="descriereNumeFisier"
              className="field"
              placeholder="normativ_instalatii_sanitare"
              value={descriereNumeFisier}
              onChange={(event) => setDescriereNumeFisier(event.target.value)}
              onBlur={(event) => setDescriereNumeFisier(normalizeFileDescription(event.target.value))}
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              required
            />
          </label>
          <label className="grid gap-1">
            <span className="label">Actualizat de indicativele</span>
            <UpdatedByIndicativesField indicativ={indicativ} an={an} />
          </label>
          <label className="grid gap-1">
            <span className="label">Cuvinte cheie</span>
            <input name="tipCladire" className="field" list="building-options" defaultValue={bulkValues?.tipCladire || ""} />
            <datalist id="building-options">
              {keywordOptions.map((item) => <option key={item} value={item} />)}
            </datalist>
          </label>
        </div>
        <label className="grid gap-1">
          <span className="label">Denumire exactă</span>
          <input name="denumireExacta" className="field" defaultValue={bulkValues?.denumireExacta || ""} required />
        </label>
        <label className="grid gap-1">
          <span className="label">Descriere</span>
          <textarea name="descriere" className="textarea" defaultValue={bulkValues?.descriere || ""} />
        </label>
      </section>
      {bulk ? (
        <section className="sheet grid gap-3 border-dashed p-5">
          <div className="grid place-items-center gap-2 rounded-md border-2 border-dashed border-slate-300 bg-slate-50 p-8 text-center">
            <span className="text-sm font-bold text-ink">Fișierul reglementării</span>
            <span className="text-xs text-slate-500">Fișier asociat automat din folderul 0_Reglementari.</span>
            {fileName ? <span className="pill">{fileName}</span> : null}
            <div className="mt-2 flex flex-wrap justify-center gap-2">
              <button type="button" className="btn btn-primary" onClick={() => openBulkPdfInPreview()}>
                Deschide în Preview
              </button>
              <button type="button" className="btn" onClick={() => loadBulkRow()}>Reîncarcă rândul</button>
            </div>
          </div>
        </section>
      ) : (
      <section className="sheet grid gap-3 border-dashed p-5">
        <label
          className={`grid cursor-pointer place-items-center gap-2 rounded-md border-2 border-dashed p-8 text-center ${
            isDraggingFile
              ? "border-slate-700 bg-slate-100"
              : "border-slate-300 bg-slate-50 hover:bg-slate-100"
          }`}
          onDragEnter={(event) => {
            event.preventDefault();
            setIsDraggingFile(true);
          }}
          onDragOver={(event) => {
            event.preventDefault();
            event.dataTransfer.dropEffect = "copy";
          }}
          onDragLeave={(event) => {
            event.preventDefault();
            setIsDraggingFile(false);
          }}
          onDrop={handleDrop}
        >
          <span className="text-sm font-bold text-ink">Încarcă fișierul reglementării</span>
          <span className="text-xs text-slate-500">Trage fișierul aici sau apasă pentru selectare manuală.</span>
          <input
            ref={fileInputRef}
            name="file"
            type="file"
            className="sr-only"
            required
            onChange={(event) => setFileName(event.target.files?.[0]?.name || "")}
          />
          {fileName ? <span className="pill">{fileName}</span> : null}
        </label>
      </section>
      )}
      <div className="flex justify-end gap-2">
        <button type="button" className="btn" onClick={() => router.push("/")}>Renunță</button>
        <button type="submit" className="btn btn-primary" disabled={state.loading || duplicate.exists || duplicate.loading}>
          {state.loading ? "Se salvează..." : "Salvează reglementarea"}
        </button>
      </div>
    </form>
  );
}
