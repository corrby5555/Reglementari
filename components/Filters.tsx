"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { disciplines, domainOptions, languages, regulationTypes } from "@/lib/options";

function setValue(params: URLSearchParams, key: string, value: string) {
  if (value) params.set(key, value);
  else params.delete(key);
}

export function Filters() {
  const router = useRouter();
  const searchParams = useSearchParams();

  function update(formData: FormData) {
    const params = new URLSearchParams(searchParams.toString());
    ["q", "tipReglementare", "disciplina", "domeniu", "tipCladire", "limba", "an"].forEach((key) => {
      setValue(params, key, String(formData.get(key) || "").trim());
    });
    router.push(`/?${params.toString()}`);
  }

  return (
    <form action={update} className="sheet grid gap-3 p-4">
      <div className="grid gap-3 md:grid-cols-4">
        <label className="grid gap-1 md:col-span-2">
          <span className="label">Căutare</span>
          <input name="q" className="field" defaultValue={searchParams.get("q") || ""} placeholder="Indicativ, denumire, descriere, cuvinte cheie" />
        </label>
        <label className="grid gap-1">
          <span className="label">An</span>
          <input name="an" className="field" defaultValue={searchParams.get("an") || ""} inputMode="numeric" />
        </label>
        <label className="grid gap-1">
          <span className="label">Limba</span>
          <select name="limba" className="field" defaultValue={searchParams.get("limba") || ""}>
            <option value="">Toate</option>
            {languages.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
      </div>
      <div className="grid gap-3 md:grid-cols-4">
        <label className="grid gap-1">
          <span className="label">Tip reglementare</span>
          <select name="tipReglementare" className="field" defaultValue={searchParams.get("tipReglementare") || ""}>
            <option value="">Toate</option>
            {regulationTypes.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <label className="grid gap-1">
          <span className="label">Disciplina</span>
          <select name="disciplina" className="field" defaultValue={searchParams.get("disciplina") || ""}>
            <option value="">Toate</option>
            {disciplines.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <label className="grid gap-1">
          <span className="label">Domeniu</span>
          <select name="domeniu" className="field" defaultValue={searchParams.get("domeniu") || ""}>
            <option value="">Toate</option>
            {domainOptions.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
        <label className="grid gap-1">
          <span className="label">Cuvinte cheie</span>
          <input name="tipCladire" className="field" defaultValue={searchParams.get("tipCladire") || ""} />
        </label>
      </div>
      <div className="flex justify-end gap-2">
        <button className="btn btn-primary" type="submit">Filtrează</button>
        <button className="btn" type="button" onClick={() => router.push("/")}>Resetează</button>
      </div>
    </form>
  );
}
