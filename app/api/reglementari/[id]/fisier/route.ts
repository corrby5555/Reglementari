import { stat, readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { getRegulation } from "@/lib/reglementari";
import { resolveStoragePath } from "@/lib/storage";

type FileRouteProps = {
  params: { id: string };
};

function contentTypeFor(fileName: string) {
  const extension = path.extname(fileName).toLowerCase();
  if (extension === ".pdf") return "application/pdf";
  if (extension === ".doc") return "application/msword";
  if (extension === ".docx") return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  return "application/octet-stream";
}

export async function GET(_: Request, { params }: FileRouteProps) {
  const id = Number(params.id);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "ID invalid." }, { status: 400 });
  }

  const item = await getRegulation(id);
  if (!item) {
    return NextResponse.json({ error: "Reglementarea nu există." }, { status: 404 });
  }

  try {
    const filePath = resolveStoragePath(item.caleFisier);
    await stat(filePath);
    const content = await readFile(filePath);
    return new NextResponse(content, {
      headers: {
        "Content-Type": contentTypeFor(item.numeFisier),
        "Content-Disposition": `inline; filename="${encodeURIComponent(item.numeFisier)}"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "Fișierul nu există pe disc." }, { status: 404 });
  }
}
