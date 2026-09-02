import { execFile } from "node:child_process";
import { mkdir, readFile, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { prisma } from "@/lib/db";
import { resolveStoragePath } from "@/lib/storage";

const execFileAsync = promisify(execFile);

export type ExtendedSearchRow = {
  id: number;
  indicativ: string;
  an: number;
  denumireExacta: string;
  counts: number[];
  total: number;
};

export type ExtendedSearchResult = {
  keywords: string[];
  rows: ExtendedSearchRow[];
  pdfFiles: number;
  cachedPdfFiles: number;
  extractedPdfFiles: number;
  imageOnlyPdfFiles: number;
  missingPdfFiles: number;
  invalidPdfFiles: number;
};

type TextCacheMetadata = {
  sourcePath: string;
  size: number;
  mtimeMs: number;
};

type PdfTextResult = {
  text: string;
  state: "cached" | "extracted" | "image_only" | "missing" | "invalid";
};

export function normalizeExtendedSearchText(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function parseExtendedSearchKeywords(value: unknown) {
  if (typeof value !== "string") return [];
  const seen = new Set<string>();
  const result: string[] = [];

  for (const item of value.split(/[,;\n]+/)) {
    const keyword = item.trim();
    const normalized = normalizeExtendedSearchText(keyword);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(keyword);
  }

  return result;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function countExtendedSearchOccurrences(normalizedText: string, keyword: string) {
  const normalizedKeyword = normalizeExtendedSearchText(keyword);
  if (!normalizedKeyword) return 0;
  const expression = new RegExp(`(^|[^a-z0-9])${escapeRegExp(normalizedKeyword)}(?=$|[^a-z0-9])`, "g");
  return normalizedText.match(expression)?.length || 0;
}

function getSearchCacheRoot() {
  return path.resolve(process.env.REGLEMENTARI_SEARCH_CACHE_DIR || "backups/search-text-cache");
}

async function readCachedText(id: number, metadata: TextCacheMetadata) {
  const cacheRoot = getSearchCacheRoot();
  try {
    const cachedMetadata = JSON.parse(await readFile(path.join(cacheRoot, `${id}.json`), "utf8")) as TextCacheMetadata;
    if (
      cachedMetadata.sourcePath !== metadata.sourcePath ||
      cachedMetadata.size !== metadata.size ||
      cachedMetadata.mtimeMs !== metadata.mtimeMs
    ) {
      return null;
    }
    return await readFile(path.join(cacheRoot, `${id}.txt`), "utf8");
  } catch {
    return null;
  }
}

async function extractPdfText(id: number, storedPath: string): Promise<PdfTextResult> {
  const sourcePath = resolveStoragePath(storedPath);
  let sourceStat;
  try {
    sourceStat = await stat(sourcePath);
  } catch {
    return { text: "", state: "missing" };
  }

  const metadata: TextCacheMetadata = {
    sourcePath,
    size: sourceStat.size,
    mtimeMs: sourceStat.mtimeMs,
  };
  const cachedText = await readCachedText(id, metadata);
  if (cachedText !== null) {
    return {
      text: cachedText,
      state: normalizeExtendedSearchText(cachedText) ? "cached" : "image_only",
    };
  }

  const cacheRoot = getSearchCacheRoot();
  const outputPath = path.join(cacheRoot, `${id}.txt`);
  const temporaryPath = path.join(cacheRoot, `${id}.${process.pid}.tmp`);
  try {
    await mkdir(cacheRoot, { recursive: true });
    await execFileAsync(process.env.PDFTOTEXT_BIN || "pdftotext", ["-q", sourcePath, temporaryPath]);
    const text = await readFile(temporaryPath, "utf8");
    await rename(temporaryPath, outputPath);
    await writeFile(path.join(cacheRoot, `${id}.json`), JSON.stringify(metadata), "utf8");
    return {
      text,
      state: normalizeExtendedSearchText(text) ? "extracted" : "image_only",
    };
  } catch (error) {
    if (error instanceof Error && (error as NodeJS.ErrnoException).code === "ENOENT" && !process.env.PDFTOTEXT_BIN) {
      throw new Error("Instrumentul pdftotext nu este instalat pe server.");
    }
    return { text: "", state: "invalid" };
  }
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, task: (item: T) => Promise<R>) {
  const results = new Array<R>(items.length);
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await task(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

export async function runExtendedSearch(keywords: string[]): Promise<ExtendedSearchResult> {
  const items = await prisma.reglementare.findMany({
    orderBy: [{ indicativ: "asc" }, { an: "asc" }],
  });

  const inspected = await mapWithConcurrency(items, 3, async (item) => {
    const isPdf = path.extname(item.numeFisier).toLowerCase() === ".pdf";
    const pdf = isPdf
      ? await extractPdfText(item.id, item.caleFisier)
      : { text: "", state: "invalid" as const };
    const metadataText = normalizeExtendedSearchText([
      item.indicativ,
      String(item.an),
      item.tipReglementare,
      item.tipDocument,
      item.disciplina,
      item.domeniu,
      item.descriereNumeFisier,
      item.actualizeazaIndicativ,
      item.tipCladire,
      item.descriere,
      item.denumireExacta,
      item.limba,
      item.numeFisier,
    ].join(" "));
    const searchableText = `${metadataText} ${normalizeExtendedSearchText(pdf.text)}`;
    const counts = keywords.map((keyword) => countExtendedSearchOccurrences(searchableText, keyword));
    return { item, isPdf, pdfState: pdf.state, counts };
  });

  const pdfEntries = inspected.filter((entry) => entry.isPdf);
  const rows = inspected
    .map(({ item, counts }) => ({
      id: item.id,
      indicativ: item.indicativ,
      an: item.an,
      denumireExacta: item.denumireExacta,
      counts,
      total: counts.reduce((sum, count) => sum + count, 0),
    }))
    .filter((row) => row.total > 0)
    .sort((left, right) => right.total - left.total || left.indicativ.localeCompare(right.indicativ, "ro", { numeric: true }));

  return {
    keywords,
    rows,
    pdfFiles: pdfEntries.length,
    cachedPdfFiles: pdfEntries.filter((entry) => entry.pdfState === "cached").length,
    extractedPdfFiles: pdfEntries.filter((entry) => entry.pdfState === "extracted").length,
    imageOnlyPdfFiles: pdfEntries.filter((entry) => entry.pdfState === "image_only").length,
    missingPdfFiles: pdfEntries.filter((entry) => entry.pdfState === "missing").length,
    invalidPdfFiles: pdfEntries.filter((entry) => entry.pdfState === "invalid").length,
  };
}
