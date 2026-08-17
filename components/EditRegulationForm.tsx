"use client";

import type { Reglementare } from "@prisma/client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { IndicativeMultiSelect } from "@/components/IndicativeMultiSelect";
import { UpdatedByIndicativesField } from "@/components/UpdatedByIndicativesField";
import { normalizeFileDescription } from "@/lib/file-name-description";
import { disciplines, documentTypes, domainOptions, languages, regulationTypes } from "@/lib/options";

type EditableRegulation = Omit<Reglementare, "dataAdaugare"> & {
  dataAdaugare: string | Date;
};

type SubmitState = {
  loading: boolean;
  error: string;
};

export function EditRegulationForm({ item }: { item: EditableRegulation }) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<SubmitState>({ loading: false, error: "" });
  const [keywordOptions, setKeywordOptions] = useState<string[]>([]);
  const [indicativ, setIndicativ] = useState(item.indicativ);
  const [an, setAn] = useState(String(item.an));
  const [descriereNumeFisier, setDescriereNumeFisier] = useState(normalizeFileDescription(item.descriereNumeFisier));
  const [replacementFileName, setReplacementFileName] = useState("");

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

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState({ loading: true, error: "" });

    const formData = new FormData(event.currentTarget);

    const response = await fetch(`/api/reglementari/${item.id}`, {
      method: "PATCH",
      body: formData,
    });

    const result = await response.json().catch(() => null);
    if (!response.ok) {
      setState({ loading: false, error: result?.error || "Reglementarea nu a putut fi actualizată." });
      return;
    }

    router.push(`/reglementari/${item.id}`);
    router.refresh();
  }

  return (
    <form onSubmit={submit} className="grid gap-5">
      {state.error ? <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{state.error}</div> : null}
      <section className="sheet grid gap-4 p-4">
        <div className="grid gap-3 md:grid-cols-[110px_85px_minmax(160px,0.8fr)_minmax(190px,1fr)_125px_90px]">
          <label className="grid gap-1">
            <span className="label">Indicativ</span>
            <input name="indicativ" className="field" value={indicativ} onChange={(event) => setIndicativ(event.target.value)} required />
          </label>
          <label className="grid gap-1">
            <span className="label">An</span>
            <input name="an" className="field" inputMode="numeric" value={an} onChange={(event) => setAn(event.target.value)} required />
          </label>
          <label className="grid gap-1">
            <span className="label">Tip reglementare</span>
            <select name="tipReglementare" className="field" defaultValue={item.tipReglementare} required>
              {regulationTypes.map((option) => <option key={option}>{option}</option>)}
            </select>
          </label>
          <label className="grid gap-1">
            <span className="label">Actualizează indicativ</span>
            <IndicativeMultiSelect defaultValue={item.actualizeazaIndicativ} excludeId={item.id} />
          </label>
          <label className="grid gap-1">
            <span className="label">Tip document</span>
            <select name="tipDocument" className="field" defaultValue={item.tipDocument} required>
              {documentTypes.map((option) => <option key={option}>{option}</option>)}
            </select>
          </label>
          <label className="grid gap-1">
            <span className="label">Limba</span>
            <select name="limba" className="field" defaultValue={item.limba} required>
              {languages.map((option) => <option key={option}>{option}</option>)}
            </select>
          </label>
        </div>
        <div className="grid gap-3 md:grid-cols-[150px_130px_minmax(160px,0.8fr)_minmax(180px,1fr)_minmax(160px,0.8fr)]">
          <label className="grid gap-1">
            <span className="label">Disciplina</span>
            <select name="disciplina" className="field" defaultValue={item.disciplina || "general"} required>
              {disciplines.map((option) => <option key={option}>{option}</option>)}
            </select>
          </label>
          <label className="grid gap-1">
            <span className="label">Domeniu</span>
            <select name="domeniu" className="field" defaultValue={item.domeniu || "general"} required>
              {domainOptions.map((option) => <option key={option}>{option}</option>)}
            </select>
          </label>
          <label className="grid gap-1">
            <span className="label">Descriere nume fișier</span>
            <input
              name="descriereNumeFisier"
              className="field"
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
            <UpdatedByIndicativesField indicativ={indicativ} an={an} excludeId={item.id} />
          </label>
          <label className="grid gap-1">
            <span className="label">Cuvinte cheie</span>
            <input name="tipCladire" className="field" list="building-options" defaultValue={item.tipCladire} />
            <datalist id="building-options">
              {keywordOptions.map((option) => <option key={option} value={option} />)}
            </datalist>
          </label>
        </div>
        <label className="grid gap-1">
          <span className="label">Denumire exactă</span>
          <input name="denumireExacta" className="field" defaultValue={item.denumireExacta} required />
        </label>
        <label className="grid gap-1">
          <span className="label">Descriere</span>
          <textarea name="descriere" className="textarea" defaultValue={item.descriere} />
        </label>
      </section>
      <section className="sheet grid gap-3 border-dashed p-5">
        <div className="grid gap-2 rounded-md border-2 border-dashed border-slate-300 bg-slate-50 p-5">
          <span className="text-sm font-bold text-ink">Fișier PDF</span>
          <span className="break-all text-xs text-slate-500">Fișier curent: {item.numeFisier}</span>
          <label className="flex flex-wrap items-center gap-2">
            <input
              ref={fileInputRef}
              name="file"
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              onChange={(event) => setReplacementFileName(event.target.files?.[0]?.name || "")}
            />
            <button type="button" className="btn" onClick={() => fileInputRef.current?.click()}>
              Alege PDF nou
            </button>
            {replacementFileName ? <span className="pill break-all">{replacementFileName}</span> : <span className="text-xs text-slate-500">Dacă nu alegi un PDF nou, fișierul curent este doar redenumit/mutat după noile caracteristici.</span>}
          </label>
        </div>
      </section>
      <div className="flex justify-end gap-2">
        <button type="button" className="btn" onClick={() => router.push(`/reglementari/${item.id}`)}>Renunță</button>
        <button type="submit" className="btn btn-primary" disabled={state.loading}>
          {state.loading ? "Se salvează..." : "Salvează modificările"}
        </button>
      </div>
    </form>
  );
}
