import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const indicativ = (request.nextUrl.searchParams.get("indicativ") || "").trim();
  const an = Number(request.nextUrl.searchParams.get("an") || "");

  if (!indicativ || !Number.isFinite(an)) {
    return NextResponse.json({ exists: false });
  }

  const rows = await prisma.reglementare.findMany({
    where: { indicativ },
    select: {
      id: true,
      indicativ: true,
      an: true,
      denumireExacta: true,
    },
    orderBy: { an: "desc" },
  });

  const exact = rows.find((item) => item.an === an);
  if (exact) {
    return NextResponse.json({ exists: true, status: "existing", data: exact });
  }

  const newest = rows[0] || null;
  if (!newest) {
    return NextResponse.json({ exists: false, status: "available", data: null });
  }

  if (an > newest.an) {
    return NextResponse.json({ exists: false, status: "possible_update", data: newest });
  }

  return NextResponse.json({ exists: false, status: "too_old", data: newest });
}
