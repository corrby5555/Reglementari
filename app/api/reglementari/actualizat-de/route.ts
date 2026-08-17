import { NextRequest, NextResponse } from "next/server";
import { regulationReference } from "@/lib/indicative-references";
import { listUpdatesForIndicativ } from "@/lib/reglementari";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const indicativ = params.get("indicativ")?.trim() || "";
  const an = Number(params.get("an"));
  const excludeId = Number(params.get("excludeId") || "0");

  if (!indicativ || !Number.isFinite(an)) {
    return NextResponse.json({ data: [] });
  }

  const rows = await listUpdatesForIndicativ(indicativ, an, Number.isFinite(excludeId) ? excludeId : 0);

  return NextResponse.json({
    data: rows.map((item) => regulationReference(item.indicativ, item.an)),
  });
}
