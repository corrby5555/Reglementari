import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await prisma.reglementare.findMany({
    distinct: ["tipCladire"],
    select: { tipCladire: true },
    where: { tipCladire: { not: "" } },
    orderBy: { tipCladire: "asc" },
  });

  const collator = new Intl.Collator("ro", { sensitivity: "base" });
  const data = rows
    .map((row) => row.tipCladire.trim())
    .filter(Boolean)
    .sort(collator.compare);

  return NextResponse.json({ data });
}
