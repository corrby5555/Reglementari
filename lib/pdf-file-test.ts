import { spawn } from "node:child_process";
import { access } from "node:fs/promises";
import path from "node:path";
import { prisma } from "@/lib/db";
import { resolveStoragePath } from "@/lib/storage";

export type ImagePdfRegulation = {
  id: number;
  indicativ: string;
  an: number;
  denumireExacta: string;
  numeFisier: string;
};

export type PdfFileTestResult = {
  tested: number;
  imagePdfs: ImagePdfRegulation[];
  missingFiles: number;
  invalidFiles: number;
};

type PdfTextResult = "has_text" | "image_only" | "invalid";

function inspectPdfText(filePath: string): Promise<PdfTextResult> {
  return new Promise((resolve, reject) => {
    const executable = process.env.PDFTOTEXT_BIN || "pdftotext";
    const processHandle = spawn(executable, ["-q", filePath, "-"], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    let hasText = false;
    let settled = false;

    processHandle.stdout.setEncoding("utf8");
    processHandle.stdout.on("data", (chunk: string) => {
      if (!hasText && /\S/.test(chunk)) {
        hasText = true;
        processHandle.kill();
      }
    });
    processHandle.on("error", (error) => {
      if (!settled) {
        settled = true;
        reject(error);
      }
    });
    processHandle.on("close", (code, signal) => {
      if (settled) return;
      settled = true;
      if (hasText && signal) {
        resolve("has_text");
      } else if (code === 0) {
        resolve(hasText ? "has_text" : "image_only");
      } else {
        resolve("invalid");
      }
    });
  });
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

export async function testRegulationPdfFiles(): Promise<PdfFileTestResult> {
  const rows = await prisma.reglementare.findMany({
    where: {
      OR: [
        { numeFisier: { endsWith: ".pdf" } },
        { numeFisier: { endsWith: ".PDF" } },
      ],
    },
    select: {
      id: true,
      indicativ: true,
      an: true,
      denumireExacta: true,
      numeFisier: true,
      caleFisier: true,
    },
    orderBy: [{ indicativ: "asc" }, { an: "asc" }],
  });

  const inspected = await mapWithConcurrency(rows, 4, async (item) => {
    const filePath = resolveStoragePath(item.caleFisier);
    try {
      await access(filePath);
    } catch {
      return { item, result: "missing" as const };
    }

    if (path.extname(filePath).toLowerCase() !== ".pdf") {
      return { item, result: "invalid" as const };
    }

    return { item, result: await inspectPdfText(filePath) };
  });

  return {
    tested: rows.length,
    imagePdfs: inspected
      .filter((entry) => entry.result === "image_only")
      .map(({ item }) => ({
        id: item.id,
        indicativ: item.indicativ,
        an: item.an,
        denumireExacta: item.denumireExacta,
        numeFisier: item.numeFisier,
      })),
    missingFiles: inspected.filter((entry) => entry.result === "missing").length,
    invalidFiles: inspected.filter((entry) => entry.result === "invalid").length,
  };
}
