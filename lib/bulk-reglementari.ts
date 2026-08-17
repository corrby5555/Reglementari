import { existsSync, readdirSync, readFileSync } from "node:fs";
import { rm, writeFile } from "node:fs/promises";
import path from "node:path";
import * as XLSX from "xlsx";
import { normalizeFileDescription } from "@/lib/file-name-description";
import { disciplines, documentTypes, domainOptions, languages, regulationTypes } from "@/lib/options";

export type BulkRegulationRow = {
  rowIndex: number;
  sourceFileName: string;
  sourcePath: string;
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

export type BulkPdfCandidate = {
  fileName: string;
  path: string;
};

export type BulkRowError = {
  rowIndex: number;
  message: string;
  candidates?: BulkPdfCandidate[];
};

export class AmbiguousPdfError extends Error {
  candidates: BulkPdfCandidate[];

  constructor(candidates: BulkPdfCandidate[]) {
    super(`PDF ambiguu: ${candidates.map((item) => item.fileName).join(", ")}`);
    this.name = "AmbiguousPdfError";
    this.candidates = candidates;
  }
}

const columnAliases = {
  indicativ: ["indicativ", "cod", "cod reglementare"],
  indicativTip: ["tip"],
  indicativNumar: ["numar", "număr"],
  an: ["an", "data", "an aparitie", "an apariție", "an publicare"],
  tipReglementare: ["tip reglementare", "tip_reglementare", "tip regulament", "tip_regulament", "tip"],
  tipDocument: ["tip document", "tip_document", "document"],
  disciplina: ["disciplina", "disciplină", "specialitate"],
  domeniu: ["domeniu"],
  descriereNumeFisier: ["descriere nume fisier", "descriere nume fișier", "descriere_nume_fisier", "nume fisier nou", "nume fișier nou"],
  actualizeazaIndicativ: ["actualizeaza indicativ", "actualizează indicativ", "actualizeaza", "actualizează", "indicativ actualizat", "regulament actualizat"],
  tipCladire: ["cuvinte cheie", "cuvant cheie", "cuvânt cheie", "tip cladire", "tip clădire", "tip_cladire"],
  descriere: ["descriere"],
  denumireExacta: ["denumire exacta", "denumire exactă", "nume exact", "titlu", "denumire"],
  limba: ["limba", "limbă"],
  sourceFileName: ["fisier", "fișier", "nume fisier", "nume fișier", "pdf", "fisier pdf", "fișier pdf", "filename"],
} as const;

function stripDiacritics(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function normalizeHeader(value: string) {
  return stripDiacritics(value)
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeLoose(value: string) {
  return stripDiacritics(value).toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function valueFromRow(row: Record<string, unknown>, field: keyof typeof columnAliases) {
  const aliases = new Set(columnAliases[field].map(normalizeHeader));
  for (const [key, value] of Object.entries(row)) {
    if (aliases.has(normalizeHeader(key))) {
      return value == null ? "" : String(value).trim();
    }
  }

  return "";
}

function composeIndicativ(row: Record<string, unknown>, columnA?: unknown, columnB?: unknown) {
  const firstColumn = String(columnA ?? "").trim().replace(/[.\s]+$/g, "");
  const secondColumn = String(columnB ?? "").trim().replace(/^[.\s]+/g, "");
  if (firstColumn && secondColumn) return `${firstColumn}.${secondColumn}`;

  const explicit = valueFromRow(row, "indicativ");
  if (explicit) return explicit;

  const tip = valueFromRow(row, "indicativTip").trim().replace(/[.\s]+$/g, "");
  const numar = valueFromRow(row, "indicativNumar").trim().replace(/^[.\s]+/g, "");
  if (tip && numar) return `${tip}.${numar}`;
  return tip || numar;
}

function matchOption<T extends readonly string[]>(value: string, options: T, fallback: T[number]) {
  const normalized = normalizeLoose(value);
  if (!normalized) return fallback;
  return options.find((option) => normalizeLoose(option) === normalized) || fallback;
}

function matchOptionOrEmpty<T extends readonly string[]>(value: string, options: T) {
  const normalized = normalizeLoose(value);
  if (!normalized) return "";
  return options.find((option) => normalizeLoose(option) === normalized) || "";
}

function cellText(value: unknown) {
  return value == null ? "" : String(value).trim();
}

function normalizeRegulationType(value: string) {
  const normalized = normalizeLoose(value);
  if (!normalized) return regulationTypes[0];
  const exact = regulationTypes.find((option) => normalizeLoose(option) === normalized);
  if (exact) return exact;
  if (["np", "nt", "nm", "nte", "norma", "norme"].some((token) => normalized.includes(token))) return "norme (NP, NT, NM, NTE)";
  if (["it", "st", "pt", "prescriptie", "prescriptii"].some((token) => normalized.includes(token))) return "prescripții tehnice (IT, ST, PT)";
  if (["gp", "sc", "gt", "ghid"].some((token) => normalized.includes(token))) return "ghiduri (GP, SC, GT)";
  if (normalized.includes("standard")) return "standarde";
  if (normalized.includes("indrum")) return "îndrumătoare";
  if (normalized.includes("manual")) return "manuale";
  return regulationTypes[0];
}

function normalizeDocumentType(value: string) {
  const normalized = normalizeLoose(value);
  if (normalized.includes("legis")) return "legislatie";
  if (normalized.includes("reglement") || normalized.includes("regulament")) return "legislatie";
  if (normalized.includes("normativ") || normalized.includes("norma")) return "legislatie";
  if (["lege", "lg", "og", "hg", "om"].includes(normalized)) return "legislatie";
  if (normalized.includes("info")) return "informatie";
  if (normalized.includes("tehn")) return "tehnic";
  return matchOption(value, documentTypes, "legislatie");
}

function findPdfCandidates(sourceDir: string, sourceFileName: string, indicativ: string, an: number) {
  const candidates: string[] = [];
  const wantedName = sourceFileName ? normalizeLoose(sourceFileName.replace(/\.pdf$/i, "")) : "";
  const fallbackIndicativ = normalizeLoose(`${indicativ}_${an}`);

  function walk(directory: string) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const fullPath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
        continue;
      }

      if (!entry.isFile()) continue;
      if (path.extname(entry.name).toLowerCase() !== ".pdf") continue;

      const parsedName = normalizeLoose(path.parse(entry.name).name);
      if (
        (sourceFileName && normalizeLoose(entry.name) === normalizeLoose(sourceFileName)) ||
        (wantedName && parsedName === wantedName) ||
        (!sourceFileName && parsedName.includes(fallbackIndicativ))
      ) {
        candidates.push(fullPath);
      }
    }
  }

  walk(sourceDir);
  return candidates.map((candidate) => ({
    fileName: path.basename(candidate),
    path: candidate,
  }));
}

function findPdf(sourceDir: string, sourceFileName: string, indicativ: string, an: number, selectedSourcePath = "") {
  const candidates = findPdfCandidates(sourceDir, sourceFileName, indicativ, an);

  if (candidates.length === 0) {
    throw new Error(`Nu am găsit PDF-ul ${sourceFileName || `pentru ${indicativ}/${an}`} în folderul ${sourceDir}.`);
  }

  if (selectedSourcePath) {
    const selected = path.resolve(selectedSourcePath);
    const match = candidates.find((candidate) => path.resolve(candidate.path) === selected);
    if (!match) {
      throw new Error("Fișierul selectat nu se află în lista de PDF-uri candidate pentru rândul curent.");
    }

    return match.path;
  }

  if (candidates.length > 1) {
    throw new AmbiguousPdfError(candidates);
  }

  return candidates[0].path;
}

export function findCompanionWordFiles(pdfPath: string) {
  const directory = path.dirname(pdfPath);
  const baseName = normalizeLoose(path.parse(pdfPath).name);
  const matches: string[] = [];

  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const extension = path.extname(entry.name).toLowerCase();
    if ((extension === ".doc" || extension === ".docx") && normalizeLoose(path.parse(entry.name).name) === baseName) {
      matches.push(path.join(directory, entry.name));
    }
  }

  return matches;
}

export function getBulkSourceDir() {
  return path.resolve(process.env.REGLEMENTARI_BULK_DIR || path.join(process.cwd(), "..", "0_Reglementari"));
}

export function getBulkExcelPath() {
  const sourceDir = getBulkSourceDir();
  const xlsPath = path.join(sourceDir, "cuprins.xls");
  if (existsSync(xlsPath)) return xlsPath;
  return path.join(sourceDir, "cuprins.xlsx");
}

function getWorkbook() {
  const excelPath = getBulkExcelPath();
  if (!existsSync(excelPath)) {
    throw new Error(`Nu există ${excelPath}. Configurează REGLEMENTARI_BULK_DIR sau creează folderul 0_Reglementari.`);
  }

  const workbook = XLSX.read(readFileSync(excelPath), { type: "buffer", cellDates: false });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    throw new Error("Fișierul cuprins nu conține niciun sheet.");
  }

  return { workbook, sheetName, sheet, excelPath };
}

function buildRowFromTable(sourceDir: string, headerRow: unknown[], dataRow: unknown[], rowIndex: number, selectedSourcePath = ""): BulkRegulationRow {
  const firstRow = Object.fromEntries(
    headerRow.map((header, index) => {
      const fallback = index === 0 ? "__EMPTY" : `__EMPTY_${index}`;
      return [String(header || fallback).trim(), dataRow[index] ?? ""];
    }),
  );

  const sourceFileName = valueFromRow(firstRow, "sourceFileName");
  const sourceNameWithoutPdf = sourceFileName.replace(/\.pdf$/i, "").trim();
  const indicativ = composeIndicativ(firstRow, dataRow[0], dataRow[1]);
  const fallbackName = sourceNameWithoutPdf || indicativ || "reglementare";
  const denumireExacta = valueFromRow(firstRow, "denumireExacta") || fallbackName;
  const descriereNumeFisier = normalizeFileDescription(valueFromRow(firstRow, "descriereNumeFisier") || denumireExacta || fallbackName);
  const parsed = {
    indicativ,
    an: Number(valueFromRow(firstRow, "an")),
    tipReglementare: normalizeRegulationType(valueFromRow(firstRow, "tipReglementare")),
    tipDocument: normalizeDocumentType(valueFromRow(firstRow, "tipDocument")),
    domeniu: matchOptionOrEmpty(cellText(dataRow[6]) || valueFromRow(firstRow, "domeniu"), domainOptions),
    disciplina: matchOptionOrEmpty(cellText(dataRow[7]) || valueFromRow(firstRow, "disciplina"), disciplines),
    descriereNumeFisier,
    actualizeazaIndicativ: valueFromRow(firstRow, "actualizeazaIndicativ"),
    tipCladire: valueFromRow(firstRow, "tipCladire"),
    descriere: valueFromRow(firstRow, "descriere"),
    denumireExacta,
    limba: matchOption(valueFromRow(firstRow, "limba"), languages, "RO"),
  };

  if (!Number.isInteger(parsed.an)) {
    throw new Error(`An invalid pentru ${indicativ || "rândul curent"}.`);
  }

  const sourcePath = findPdf(sourceDir, sourceFileName, parsed.indicativ, parsed.an, selectedSourcePath);

  return {
    rowIndex,
    sourceFileName: selectedSourcePath ? path.basename(sourcePath) : sourceFileName || path.basename(sourcePath),
    sourcePath,
    values: parsed,
  };
}

function getCurrentBulkRowResult(skippedRows: number[] = [], selectedSourcePath = ""): { row: BulkRegulationRow | null; errors: BulkRowError[]; blockingError?: BulkRowError } {
  const sourceDir = getBulkSourceDir();
  if (!existsSync(sourceDir)) {
    throw new Error(`Folderul bulk nu există: ${sourceDir}.`);
  }

  const { sheet } = getWorkbook();
  const tableRows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" });
  const headerRow = tableRows[0] || [];
  const skipped = new Set(skippedRows);
  const errors: BulkRowError[] = [];

  for (let index = 1; index < tableRows.length; index += 1) {
    const row = tableRows[index];
    const rowIndex = index + 1;
    if (!Array.isArray(row) || !row.some((cell) => String(cell || "").trim()) || skipped.has(rowIndex)) {
      continue;
    }

    try {
      return { row: buildRowFromTable(sourceDir, headerRow, row, rowIndex, selectedSourcePath), errors };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Rândul bulk nu a putut fi citit.";
      const candidates = error instanceof AmbiguousPdfError ? error.candidates : undefined;
      if (skippedRows.length > 0) {
        errors.push({ rowIndex, message, candidates });
        continue;
      }

      return { row: null, errors, blockingError: { rowIndex, message, candidates } };
    }
  }

  return { row: null, errors };
}

export function getCurrentBulkRow(skippedRows: number[] = [], selectedSourcePath = ""): BulkRegulationRow | null {
  return getCurrentBulkRowResult(skippedRows, selectedSourcePath).row;
}

export function getCurrentBulkRowWithErrors(skippedRows: number[] = [], selectedSourcePath = "") {
  return getCurrentBulkRowResult(skippedRows, selectedSourcePath);
}

export async function deleteBulkExcelRow(rowIndex: number) {
  const { workbook, sheetName, sheet, excelPath } = getWorkbook();
  const rows = XLSX.utils.sheet_to_json<unknown[]>(sheet, { header: 1, defval: "" });
  const zeroBasedIndex = rowIndex - 1;

  if (zeroBasedIndex <= 0 || zeroBasedIndex >= rows.length) {
    throw new Error(`Rândul ${rowIndex} nu există în cuprins.`);
  }

  rows.splice(zeroBasedIndex, 1);
  workbook.Sheets[sheetName] = XLSX.utils.aoa_to_sheet(rows);
  const buffer = XLSX.write(workbook, { bookType: path.extname(excelPath).toLowerCase() === ".xlsx" ? "xlsx" : "biff8", type: "buffer" });
  await writeFile(excelPath, buffer);
}

export async function cleanupBulkSourceFiles(sourcePath: string) {
  await rm(sourcePath, { force: true });
  for (const companionPath of findCompanionWordFiles(sourcePath)) {
    await rm(companionPath, { force: true });
  }

  if (existsSync(sourcePath)) {
    throw new Error(`PDF-ul sursă nu a putut fi șters: ${sourcePath}`);
  }
}

export function readCurrentBulkPdf() {
  const row = getCurrentBulkRow();
  if (!row) return null;
  return {
    row,
    bytes: readFileSync(row.sourcePath),
  };
}
