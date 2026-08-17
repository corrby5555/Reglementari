import { existsSync, readFileSync } from "node:fs";
import { copyFile, mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { Prisma, PrismaClient } from "@prisma/client";
import * as XLSX from "xlsx";
import { getTargetDirectory, generateBaseFileName, resolveAvailablePath } from "../lib/storage";
import { regulationSchema, type RegulationInput } from "../lib/validation";

type ImportArgs = {
  excelPath: string;
  sourceDir: string;
  sheet?: string;
  dryRun: boolean;
};

type ImportRow = RegulationInput & {
  sourceFileName: string;
  sourcePath: string;
};

const prisma = new PrismaClient();

const columnAliases = {
  indicativ: ["indicativ", "cod", "cod reglementare"],
  an: ["an", "an aparitie", "an apariție", "an publicare"],
  tipReglementare: ["tip reglementare", "tip_reglementare", "tip"],
  tipDocument: ["tip document", "tip_document", "document"],
  disciplina: ["disciplina", "disciplină"],
  domeniu: ["domeniu"],
  descriereNumeFisier: ["descriere nume fisier", "descriere nume fișier", "descriere_nume_fisier", "nume fisier nou", "nume fișier nou"],
  actualizeazaIndicativ: ["actualizeaza indicativ", "actualizează indicativ", "actualizeaza", "actualizează", "indicativ actualizat", "regulament actualizat"],
  tipCladire: ["cuvinte cheie", "cuvant cheie", "cuvânt cheie", "tip cladire", "tip clădire", "tip_cladire"],
  descriere: ["descriere"],
  denumireExacta: ["denumire exacta", "denumire exactă", "nume exact", "titlu", "denumire"],
  limba: ["limba", "limbă"],
  sourceFileName: ["fisier", "fișier", "nume fisier", "nume fișier", "pdf", "fisier pdf", "fișier pdf", "filename"],
} as const;

function loadEnvLocal() {
  if (!existsSync(".env.local")) {
    return;
  }

  const lines = readFileSync(".env.local", "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    process.env[key] ??= rawValue.replace(/^["']|["']$/g, "");
  }
}

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

function parseArgs(): ImportArgs {
  const args = process.argv.slice(2);
  const result: Partial<ImportArgs> = { dryRun: false };

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--dry-run") {
      result.dryRun = true;
      continue;
    }

    if (arg === "--excel") {
      result.excelPath = args[index + 1];
      index += 1;
      continue;
    }

    if (arg === "--source-dir") {
      result.sourceDir = args[index + 1];
      index += 1;
      continue;
    }

    if (arg === "--sheet") {
      result.sheet = args[index + 1];
      index += 1;
    }
  }

  if (!result.excelPath || !result.sourceDir) {
    throw new Error("Utilizare: npm run import:reglementari -- --excel /cale/fisier.xlsx --source-dir /cale/folder-pdf [--sheet Nume] [--dry-run]");
  }

  return result as ImportArgs;
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

function findPdf(sourceDir: string, sourceFileName: string, indicativ: string, an: number) {
  const candidates: string[] = [];
  const wantedName = sourceFileName ? normalizeLoose(path.parse(sourceFileName).name) : "";
  const fallbackIndicativ = normalizeLoose(`${indicativ}_${an}`);

  const entries = require("node:fs").readdirSync(sourceDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile()) {
      continue;
    }

    const extension = path.extname(entry.name).toLowerCase();
    if (extension !== ".pdf") {
      continue;
    }

    const parsedName = normalizeLoose(path.parse(entry.name).name);
    if (
      (sourceFileName && normalizeLoose(entry.name) === normalizeLoose(sourceFileName)) ||
      (wantedName && parsedName === wantedName) ||
      (!sourceFileName && parsedName.includes(fallbackIndicativ))
    ) {
      candidates.push(path.join(sourceDir, entry.name));
    }
  }

  if (candidates.length === 0) {
    throw new Error(`Nu am găsit PDF pentru ${indicativ}/${an}${sourceFileName ? ` (${sourceFileName})` : ""}.`);
  }

  if (candidates.length > 1) {
    throw new Error(`PDF ambiguu pentru ${indicativ}/${an}: ${candidates.map((item) => path.basename(item)).join(", ")}`);
  }

  return candidates[0];
}

function findCompanionWordFiles(pdfPath: string) {
  const directory = path.dirname(pdfPath);
  const baseName = normalizeLoose(path.parse(pdfPath).name);
  const matches: string[] = [];

  const entries = require("node:fs").readdirSync(directory, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile()) {
      continue;
    }

    const extension = path.extname(entry.name).toLowerCase();
    if (extension !== ".doc" && extension !== ".docx") {
      continue;
    }

    if (normalizeLoose(path.parse(entry.name).name) === baseName) {
      matches.push(path.join(directory, entry.name));
    }
  }

  return matches;
}

function rowToImport(row: Record<string, unknown>, sourceDir: string): ImportRow {
  const parsed = regulationSchema.parse({
    indicativ: valueFromRow(row, "indicativ"),
    an: valueFromRow(row, "an"),
    tipReglementare: valueFromRow(row, "tipReglementare"),
    tipDocument: valueFromRow(row, "tipDocument"),
    disciplina: valueFromRow(row, "disciplina") || "general",
    domeniu: valueFromRow(row, "domeniu") || "general",
    descriereNumeFisier: valueFromRow(row, "descriereNumeFisier"),
    actualizeazaIndicativ: valueFromRow(row, "actualizeazaIndicativ"),
    tipCladire: valueFromRow(row, "tipCladire"),
    descriere: valueFromRow(row, "descriere"),
    denumireExacta: valueFromRow(row, "denumireExacta"),
    limba: valueFromRow(row, "limba") || "RO",
  });

  const sourceFileName = valueFromRow(row, "sourceFileName");
  const sourcePath = findPdf(sourceDir, sourceFileName, parsed.indicativ, parsed.an);

  return {
    ...parsed,
    sourceFileName,
    sourcePath,
  };
}

async function importOne(row: ImportRow, dryRun: boolean) {
  const directory = getTargetDirectory(row);
  const baseFileName = generateBaseFileName(row, "pdf");
  const target = await resolveAvailablePath(directory, baseFileName);
  const companionWordFiles = findCompanionWordFiles(row.sourcePath);

  if (dryRun) {
    return {
      indicativ: row.indicativ,
      an: row.an,
      sourcePath: row.sourcePath,
      targetPath: target.fullPath,
      companionWordFiles,
      dryRun: true,
    };
  }

  const existing = await prisma.reglementare.findFirst({
    where: { indicativ: row.indicativ, an: row.an },
    select: { id: true },
  });

  if (existing) {
    throw new Error(`Există deja în baza de date: ${row.indicativ}/${row.an}.`);
  }

  await mkdir(directory, { recursive: true });
  await copyFile(row.sourcePath, target.fullPath);

  try {
    const created = await prisma.reglementare.create({
      data: {
        indicativ: row.indicativ,
        an: row.an,
        tipReglementare: row.tipReglementare,
        tipDocument: row.tipDocument,
        disciplina: row.disciplina,
        domeniu: row.domeniu,
        descriereNumeFisier: row.descriereNumeFisier,
        actualizeazaIndicativ: row.actualizeazaIndicativ,
        tipCladire: row.tipCladire,
        descriere: row.descriere,
        denumireExacta: row.denumireExacta,
        limba: row.limba,
        numeFisier: target.fileName,
        caleFisier: target.relativePath,
      },
      select: { id: true },
    });

    await rm(row.sourcePath, { force: true });
    for (const companionPath of companionWordFiles) {
      await rm(companionPath, { force: true });
    }

    return {
      id: created.id,
      indicativ: row.indicativ,
      an: row.an,
      sourcePath: row.sourcePath,
      targetPath: target.fullPath,
      companionWordFiles,
      dryRun: false,
    };
  } catch (error) {
    await rm(target.fullPath, { force: true });
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      throw new Error(`Există deja în baza de date: ${row.indicativ}/${row.an}.`);
    }

    throw error;
  }
}

async function main() {
  loadEnvLocal();
  const args = parseArgs();
  const workbook = XLSX.readFile(args.excelPath, { cellDates: false });
  const sheetName = args.sheet || workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    throw new Error(`Nu există sheet-ul: ${sheetName}`);
  }

  const rawRows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" });
  const results = [];
  const errors = [];

  for (let index = 0; index < rawRows.length; index += 1) {
    try {
      const row = rowToImport(rawRows[index], args.sourceDir);
      const result = await importOne(row, args.dryRun);
      results.push(result);
      const companionText = result.companionWordFiles.length > 0
        ? `; Word auxiliare șterse: ${result.companionWordFiles.map((item) => path.basename(item)).join(", ")}`
        : "";
      console.log(`[OK] rând ${index + 2}: ${row.indicativ}/${row.an} -> ${result.targetPath}${companionText}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Eroare necunoscută.";
      errors.push({ row: index + 2, message });
      console.error(`[EROARE] rând ${index + 2}: ${message}`);
    }
  }

  console.log("");
  console.log(`Import ${args.dryRun ? "simulat" : "executat"}: ${results.length} OK, ${errors.length} erori.`);
  if (errors.length > 0) {
    process.exitCode = 1;
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
