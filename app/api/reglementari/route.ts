import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { listRegulations } from "@/lib/reglementari";
import { saveRegulationFile } from "@/lib/storage";
import { regulationSchema } from "@/lib/validation";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const rows = await listRegulations({
    q: params.get("q") || undefined,
    tipReglementare: params.get("tipReglementare") || undefined,
    disciplina: params.get("disciplina") || undefined,
    domeniu: params.get("domeniu") || undefined,
    tipCladire: params.get("tipCladire") || undefined,
    limba: params.get("limba") || undefined,
    an: params.get("an") || undefined,
  });

  return NextResponse.json({ data: rows });
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Fișierul reglementării este obligatoriu." }, { status: 400 });
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

    const savedFile = await saveRegulationFile(file, parsed);
    const created = await prisma.reglementare.create({
      data: {
        ...parsed,
        numeFisier: savedFile.fileName,
        caleFisier: savedFile.relativePath,
      },
    });

    return NextResponse.json({ id: created.id }, { status: 201 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Există deja o reglementare cu același indicativ și același an." }, { status: 409 });
    }

    const message = error instanceof Error ? error.message : "Reglementarea nu a putut fi salvată.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
