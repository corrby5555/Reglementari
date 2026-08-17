import type { Prisma } from "@prisma/client";
import type { Reglementare } from "@prisma/client";
import { prisma } from "@/lib/db";
import { parseIndicativeReferences, regulationReference } from "@/lib/indicative-references";

export type RegulationSortField = "indicativ" | "tipReglementare" | "tipDocument";
export type RegulationSortDirection = "asc" | "desc";

export type RegulationFilters = {
  q?: string;
  tipReglementare?: string;
  disciplina?: string;
  domeniu?: string;
  tipCladire?: string;
  limba?: string;
  an?: string;
  sort?: string;
  dir?: string;
};

export function buildWhere(filters: RegulationFilters): Prisma.ReglementareWhereInput {
  const where: Prisma.ReglementareWhereInput = {};

  if (filters.tipReglementare) where.tipReglementare = filters.tipReglementare;
  if (filters.disciplina) where.disciplina = filters.disciplina;
  if (filters.domeniu) where.domeniu = filters.domeniu;
  if (filters.tipCladire) where.tipCladire = { contains: filters.tipCladire };
  if (filters.limba) where.limba = filters.limba;
  if (filters.an && Number.isFinite(Number(filters.an))) where.an = Number(filters.an);

  if (filters.q) {
    where.OR = [
      { indicativ: { contains: filters.q } },
      { denumireExacta: { contains: filters.q } },
      { descriere: { contains: filters.q } },
      { tipCladire: { contains: filters.q } },
    ];
  }

  return where;
}

export async function listRegulations(filters: RegulationFilters = {}) {
  const rows = await prisma.reglementare.findMany({
    where: buildWhere(filters),
    orderBy: [{ indicativ: "asc" }, { an: "asc" }],
  });

  return sortRegulations(rows, filters.sort, filters.dir);
}

function indicativeSortKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim()
    .replace(/\d+/g, (match) => match.padStart(3, "0"));
}

export function sortRegulationsByIndicativ(rows: Reglementare[]) {
  return [...rows].sort((left, right) => {
    const byIndicativ = indicativeSortKey(left.indicativ).localeCompare(indicativeSortKey(right.indicativ), "ro", { sensitivity: "base" });
    if (byIndicativ !== 0) return byIndicativ;
    const byYear = left.an - right.an;
    if (byYear !== 0) return byYear;
    return left.denumireExacta.localeCompare(right.denumireExacta, "ro", { sensitivity: "base" });
  });
}

function isSortField(value: string | undefined): value is RegulationSortField {
  return value === "indicativ" || value === "tipReglementare" || value === "tipDocument";
}

function sortDirection(value: string | undefined): RegulationSortDirection {
  return value === "desc" ? "desc" : "asc";
}

function compareText(left: string, right: string) {
  return left.localeCompare(right, "ro", { sensitivity: "base" });
}

export function sortRegulations(rows: Reglementare[], sort?: string, dir?: string) {
  const field = isSortField(sort) ? sort : "indicativ";
  const direction = sortDirection(dir);
  const multiplier = direction === "desc" ? -1 : 1;

  if (field === "indicativ") {
    const sorted = sortRegulationsByIndicativ(rows);
    return direction === "desc" ? sorted.reverse() : sorted;
  }

  return [...rows].sort((left, right) => {
    const bySelectedField = compareText(String(left[field] || ""), String(right[field] || ""));
    if (bySelectedField !== 0) return bySelectedField * multiplier;

    const byIndicativ = indicativeSortKey(left.indicativ).localeCompare(indicativeSortKey(right.indicativ), "ro", { sensitivity: "base" });
    if (byIndicativ !== 0) return byIndicativ;

    return (left.an - right.an) || compareText(left.denumireExacta, right.denumireExacta);
  });
}

export async function getRegulation(id: number) {
  return prisma.reglementare.findUnique({ where: { id } });
}

export async function listUpdatesForIndicativ(indicativ: string, an: number, currentId: number) {
  const targetReference = regulationReference(indicativ, an);
  const rows = await prisma.reglementare.findMany({
    where: { NOT: { id: currentId } },
    orderBy: [{ an: "desc" }, { indicativ: "asc" }],
  });

  return rows.filter((item) => {
    const references = parseIndicativeReferences(item.actualizeazaIndicativ);
    return references.includes(indicativ) || references.includes(targetReference);
  });
}

export async function listRegulationsByReferences(references: string[], currentId: number) {
  if (references.length === 0) {
    return [];
  }

  const rows = await prisma.reglementare.findMany({
    where: { NOT: { id: currentId } },
    orderBy: [{ indicativ: "asc" }, { an: "desc" }],
  });

  return rows.filter((item) => {
    const itemReference = regulationReference(item.indicativ, item.an);
    return references.includes(itemReference) || references.includes(item.indicativ);
  });
}

export type UpdatedByReference = {
  id: number;
  indicativ: string;
};

export async function buildUpdatedByMap(rows: Array<{ id: number; indicativ: string; an: number }>) {
  const map: Record<number, UpdatedByReference[]> = {};
  if (rows.length === 0) {
    return map;
  }

  for (const row of rows) {
    map[row.id] = [];
  }

  const allRows = await prisma.reglementare.findMany({
    select: {
      id: true,
      indicativ: true,
      an: true,
      actualizeazaIndicativ: true,
    },
    orderBy: [{ an: "desc" }, { indicativ: "asc" }],
  });

  for (const target of rows) {
    const targetReference = regulationReference(target.indicativ, target.an);
    map[target.id] = allRows
      .filter((candidate) => candidate.id !== target.id)
      .filter((candidate) => {
        const references = parseIndicativeReferences(candidate.actualizeazaIndicativ);
        return references.includes(target.indicativ) || references.includes(targetReference);
      })
      .map((candidate) => ({
        id: candidate.id,
        indicativ: regulationReference(candidate.indicativ, candidate.an),
      }));
  }

  return map;
}
