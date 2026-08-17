import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { regulationReference } from "@/lib/indicative-references";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await prisma.reglementare.findMany({
    orderBy: [{ indicativ: "asc" }, { an: "desc" }],
    select: {
      id: true,
      indicativ: true,
      an: true,
      denumireExacta: true,
    },
  });

  return NextResponse.json({
    data: rows.map((item) => ({
      id: item.id,
      value: regulationReference(item.indicativ, item.an),
      label: regulationReference(item.indicativ, item.an),
    })),
  });
}
