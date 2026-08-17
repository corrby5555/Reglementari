import { spawn } from "node:child_process";
import { NextResponse } from "next/server";
import { getCurrentBulkRow } from "@/lib/bulk-reglementari";

function parseSkippedRows(request: Request) {
  const url = new URL(request.url);
  return (url.searchParams.get("skipRows") || "")
    .split(",")
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isInteger(value) && value > 1);
}

export async function POST(request: Request) {
  try {
    const payload = await request.json().catch(() => null);
    const row = getCurrentBulkRow(parseSkippedRows(request), payload?.selectedSourcePath || "");
    if (!row) {
      return NextResponse.json({ error: "Nu există PDF bulk de deschis." }, { status: 404 });
    }

    const child = spawn("open", ["-a", "Preview", row.sourcePath], {
      detached: true,
      stdio: "ignore",
    });
    child.unref();

    return NextResponse.json({ ok: true, fileName: row.sourceFileName });
  } catch (error) {
    const message = error instanceof Error ? error.message : "PDF-ul nu a putut fi deschis în Preview.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
