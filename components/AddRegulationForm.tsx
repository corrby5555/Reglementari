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
  regulationId?: number;
};

export function AddRegulationForm() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<SubmitState>({ loading: false, error: "" });
  const [fileName, setFileName] = useState("");
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [keywordOptions, setKeywordOptions] = useState<string[]>([]);
  const [indicativ, setIndicativ] = useState("");
  const [an, setAn] = useState("");
  const [duplicate, setDuplicate] = useState<DuplicateState>({ loading: false, exists: false, message: "", tone: "neutral" });
  const [descriereNumeFisier, setDescriereNumeFisier] = useState("");

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
              regulationId: payload.data.id,
            });
            return;
          }

          if (payload.status === "possible_update") {
            setDuplicate({
              loading: false,
              exists: false,
              message: `Pare că noua reglementare este o actualizare a uneia deja existente: ${payload.data.indicativ}/${payload.data.an}: ${payload.data.denumireExacta}`,
              tone: "warning",
              regulationId: payload.data.id,
            });
            return;
          }

          if (payload.status === "too_old") {
            setDuplicate({
              loading: false,
              exists: false,
              message: `Reglementarea pare prea veche: există o reglementare mai nouă în baza de date, ${payload.data.indicativ}/${payload.data.an}: ${payload.data.denumireExacta}`,
              tone: "warning",
              regulationId: payload.data.id,
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

    const response = await fetch("/api/reglementari", {
      method: "POST",
      body: new FormData(event.currentTarget),
    });

    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      setState({ loading: false, error: payload?.error || "Reglementarea nu a putut fi salvată." });
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

  return (
    <form onSubmit={submit} className="grid gap-5">
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
            <select name="tipReglementare" className="field" required>
              {regulationTypes.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <label className="grid gap-1">
            <span className="label">Actualizează indicativ</span>
            <IndicativeMultiSelect defaultValue="" />
          </label>
          <label className="grid gap-1">
            <span className="label">Tip document</span>
            <select name="tipDocument" className="field" required>
              {documentTypes.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <label className="grid gap-1">
            <span className="label">Limba</span>
            <select name="limba" className="field" required>
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
            {duplicate.regulationId ? (
              <a
                href={`/reglementari/${duplicate.regulationId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="block underline decoration-current/40 underline-offset-2 hover:decoration-current"
                title="Deschide reglementarea într-un tab nou"
              >
                {duplicate.message}
              </a>
            ) : duplicate.message}
          </div>
        ) : null}
        <div className="grid gap-3 md:grid-cols-[150px_130px_minmax(160px,0.8fr)_minmax(180px,1fr)_minmax(160px,0.8fr)]">
          <label className="grid gap-1">
            <span className="label">Disciplina</span>
            <select name="disciplina" className="field" defaultValue="general" required>
              {disciplines.map((item) => <option key={item}>{item}</option>)}
            </select>
          </label>
          <label className="grid gap-1">
            <span className="label">Domeniu</span>
            <select name="domeniu" className="field" defaultValue="general" required>
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
            <input name="tipCladire" className="field" list="building-options" defaultValue="" />
            <datalist id="building-options">
              {keywordOptions.map((item) => <option key={item} value={item} />)}
            </datalist>
          </label>
        </div>
        <label className="grid gap-1">
          <span className="label">Denumire exactă</span>
          <input name="denumireExacta" className="field" required />
        </label>
        <label className="grid gap-1">
          <span className="label">Descriere</span>
          <textarea name="descriere" className="textarea" />
        </label>
      </section>
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
      <div className="flex justify-end gap-2">
        <button type="button" className="btn" onClick={() => router.push("/")}>Renunță</button>
        <button type="submit" className="btn btn-primary" disabled={state.loading || duplicate.exists || duplicate.loading}>
          {state.loading ? "Se salvează..." : "Salvează reglementarea"}
        </button>
      </div>
    </form>
  );
}
