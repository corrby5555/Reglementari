import { constants } from "node:fs";
import { access } from "node:fs/promises";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getStorageRoot } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function GET() {
  const startedAt = Date.now();
  const checks = {
    database: "error",
    storage: "error",
  };

  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.database = "ok";

    await access(getStorageRoot(), constants.R_OK);
    checks.storage = "ok";

    return NextResponse.json(
      {
        status: "ok",
        service: "reglementari",
        ...checks,
        responseTimeMs: Date.now() - startedAt,
        checkedAt: new Date().toISOString(),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return NextResponse.json(
      {
        status: "error",
        service: "reglementari",
        ...checks,
        message: error instanceof Error ? error.message : "Verificarea dependențelor a eșuat.",
        responseTimeMs: Date.now() - startedAt,
        checkedAt: new Date().toISOString(),
      },
      { status: 503, headers: { "Cache-Control": "no-store" } },
    );
  }
}
