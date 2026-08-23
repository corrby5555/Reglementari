import { NextRequest, NextResponse } from "next/server";
import { canWriteFromHeaders, forbiddenWriteResponse } from "@/lib/access-control";
import { verifyDatabaseBeforeWrite } from "@/lib/backup-protection";

export async function POST(request: NextRequest) {
  if (!canWriteFromHeaders(request.headers)) return forbiddenWriteResponse();
  try {
    await verifyDatabaseBeforeWrite();
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Verificarea bazei de date a eșuat.";
    return NextResponse.json({ error: message }, { status: 409 });
  }
}
