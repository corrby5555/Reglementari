import { describe, expect, it } from "vitest";
import type { Reglementare } from "@prisma/client";
import { sortRegulations, sortRegulationsByIndicativ } from "../lib/reglementari";
import { matchesPermissiveSearch, permissiveSearchScore, strictSearchScore } from "../lib/search";

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

  it("ordoneaza numeric corect si cand numerele au lungimi foarte diferite", () => {
    const result = sortRegulationsByIndicativ([
      row("XX.12493"),
      row("XX.245"),
      row("XX.45"),
      row("XX.35"),
    ]);

    expect(result.map((item) => item.indicativ)).toEqual(["XX.35", "XX.45", "XX.245", "XX.12493"]);
  });

  it("ordoneaza natural indicativele cu subparti dupa cratima", () => {
    const result = sortRegulationsByIndicativ([
      row("P.118-10"),
      row("P.118"),
      row("P.118-2"),
      row("P.118-1"),
    ]);

    expect(result.map((item) => item.indicativ)).toEqual(["P.118", "P.118-1", "P.118-2", "P.118-10"]);
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

describe("cautarea permisiva in catalog", () => {
  const regulation = row("P.118", {
    an: 1999,
    denumireExacta: "Normativ privind securitatea la incendiu a construcțiilor școlare",
    descriere: "Soluții tehnice pentru școli și săli aglomerate.",
    tipCladire: "educație, școală",
  });

  it("gaseste indicative indiferent de separator", () => {
    expect(strictSearchScore(regulation, "P118")).not.toBeNull();
    expect(strictSearchScore(regulation, "P_118")).not.toBeNull();
    expect(strictSearchScore(regulation, "P-118")).not.toBeNull();
  });

  it("cautarea implicita gaseste cuvinte fara diacritice, dar nu corecteaza greseli", () => {
    expect(strictSearchScore(regulation, "școală")).not.toBeNull();
    expect(strictSearchScore(regulation, "scoala")).not.toBeNull();
    expect(strictSearchScore(regulation, "școli")).not.toBeNull();
    expect(strictSearchScore(regulation, "scloi")).toBeNull();
  });

  it("cautarea larga accepta mici greseli", () => {
    expect(matchesPermissiveSearch(regulation, "scloi")).toBe(true);
    expect(permissiveSearchScore(regulation, "scloi")).not.toBeNull();
  });
});
