import { statSync } from "node:fs";
import { copyFile, mkdir, rm } from "node:fs/promises";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";
import { cleanupBulkSourceFiles, deleteBulkExcelRow, getCurrentBulkRow } from "@/lib/bulk-reglementari";
import { prisma } from "@/lib/db";
import { generateBaseFileName, getTargetDirectory, resolveAvailablePath } from "@/lib/storage";
import { regulationSchema } from "@/lib/validation";

function parseSkippedRows(request: Request) {
  const url = new URL(request.url);
  return (url.searchParams.get("skipRows") || "")
    .split(",")
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isInteger(value) && value > 1);
}

export async function POST(request: Request) {
  let targetPath = "";

  try {
    const formData = await request.formData();
    const selectedSourcePath = String(formData.get("selectedSourcePath") || "");
    const skippedRows = parseSkippedRows(request);
    const current = getCurrentBulkRow(skippedRows, selectedSourcePath);
    if (!current) {
      return NextResponse.json({ error: "Nu mai există rânduri în cuprins pentru import bulk." }, { status: 404 });
    }

    const parsed = regulationSchema.parse({
      indicativ: formData.get("indicativ"),
      an: formData.get("an"),
      tipReglementare: formData.get("tipReglementare"),
      tipDocument: formData.get("tipDocument"),
      disciplina: formData.get("disciplina"),
      domeniu: formData.get("domeniu"),
      descriereNumeFisier: formData.get("descriereNumeFisier"),
      actualizeazaIndicativ: formData.getAll("actualizeazaIndicativ"),
      tipCladire: formData.get("tipCladire"),
      descriere: formData.get("descriere"),
      denumireExacta: formData.get("denumireExacta"),
      limba: formData.get("limba"),
    });

    const existing = await prisma.reglementare.findFirst({
      where: { indicativ: parsed.indicativ, an: parsed.an },
      select: { id: true },
    });

    if (existing) {
      return NextResponse.json({ error: "Există deja o reglementare cu același indicativ și același an." }, { status: 409 });
    }

    const directory = getTargetDirectory(parsed);
    await mkdir(directory, { recursive: true });
    const target = await resolveAvailablePath(directory, generateBaseFileName(parsed, "pdf"));
    targetPath = target.fullPath;
    await copyFile(current.sourcePath, target.fullPath);
    const copiedFile = statSync(target.fullPath);
    if (!copiedFile.isFile() || copiedFile.size === 0) {
      throw new Error("Fișierul PDF nu a fost copiat corect în storage.");
    }

    const created = await prisma.reglementare.create({
      data: {
        ...parsed,
        numeFisier: target.fileName,
        caleFisier: target.fullPath,
      },
      select: { id: true },
    });

    let cleanupWarning = "";
    try {
      await cleanupBulkSourceFiles(current.sourcePath);
    } catch (cleanupError) {
      cleanupWarning = cleanupError instanceof Error ? cleanupError.message : "PDF-ul sursă nu a putut fi șters.";
    }

    await deleteBulkExcelRow(current.rowIndex);

    return NextResponse.json({ id: created.id, rowIndex: current.rowIndex, sourceDeleted: !cleanupWarning, cleanupWarning, ok: true });
  } catch (error) {
    if (targetPath) {
      await rm(targetPath, { force: true });
    }

    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Există deja o reglementare cu același indicativ și același an." }, { status: 409 });
    }

    const message = error instanceof Error ? error.message : "Reglementarea bulk nu a putut fi salvată.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
