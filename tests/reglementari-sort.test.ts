import { describe, expect, it } from "vitest";
import type { Reglementare } from "@prisma/client";
import { sortRegulations, sortRegulationsByIndicativ } from "../lib/reglementari";

function row(indicativ: string, overrides: Partial<Reglementare> = {}): Reglementare {
  return {
    id: 1,
    indicativ,
    an: 2026,
    tipReglementare: "normative",
    tipDocument: "legislatie",
    disciplina: "general",
    domeniu: "general",
    descriereNumeFisier: "",
    actualizeazaIndicativ: "",
    tipCladire: "",
    descriere: "",
    denumireExacta: indicativ,
    limba: "RO",
    numeFisier: "",
    caleFisier: "",
    dataAdaugare: new Date(),
    ...overrides,
  };
}

describe("sortarea reglementarilor dupa indicativ", () => {
  it("ordoneaza cifrele de dupa punct natural, cu padding implicit", () => {
    const result = sortRegulationsByIndicativ([
      row("C.40"),
      row("C.4"),
      row("C.39"),
      row("C.5"),
      row("C.3"),
    ]);

    expect(result.map((item) => item.indicativ)).toEqual(["C.3", "C.4", "C.5", "C.39", "C.40"]);
  });

  it("ordoneaza alfabetic dupa tip reglementare ascendent si descendent", () => {
    const rows = [
      row("C.1", { tipReglementare: "standarde" }),
      row("C.2", { tipReglementare: "ghiduri (GP, SC, GT)" }),
      row("C.3", { tipReglementare: "normative" }),
    ];

    expect(sortRegulations(rows, "tipReglementare", "asc").map((item) => item.tipReglementare)).toEqual([
      "ghiduri (GP, SC, GT)",
      "normative",
      "standarde",
    ]);
    expect(sortRegulations(rows, "tipReglementare", "desc").map((item) => item.tipReglementare)).toEqual([
      "standarde",
      "normative",
      "ghiduri (GP, SC, GT)",
    ]);
  });

  it("ordoneaza alfabetic dupa tip document", () => {
    const rows = [
      row("C.1", { tipDocument: "tehnic" }),
      row("C.2", { tipDocument: "informatie" }),
      row("C.3", { tipDocument: "legislatie" }),
    ];

    expect(sortRegulations(rows, "tipDocument", "asc").map((item) => item.tipDocument)).toEqual([
      "informatie",
      "legislatie",
      "tehnic",
    ]);
  });
});
