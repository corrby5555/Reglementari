import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getRegulation } from "@/lib/reglementari";
import { deleteRegulationFile, moveRegulationFile, replaceRegulationFile } from "@/lib/storage";
import { regulationSchema } from "@/lib/validation";

type DetailRouteProps = {
  params: { id: string };
};

export async function GET(_: Request, { params }: DetailRouteProps) {
  const id = Number(params.id);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "ID invalid." }, { status: 400 });
  }

  const item = await getRegulation(id);
  if (!item) {
    return NextResponse.json({ error: "Reglementarea nu există." }, { status: 404 });
  }

  return NextResponse.json({ data: item });
}

export async function PATCH(request: Request, { params }: DetailRouteProps) {
  const id = Number(params.id);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "ID invalid." }, { status: 400 });
  }

  try {
    const item = await getRegulation(id);
    if (!item) {
      return NextResponse.json({ error: "Reglementarea nu există." }, { status: 404 });
    }

    const contentType = request.headers.get("content-type") || "";
    let replacementFile: File | null = null;
    let rawInput: Record<string, unknown>;

    if (contentType.includes("multipart/form-data")) {
      const formData = await request.formData();
      const file = formData.get("file");
      replacementFile = file instanceof File && file.size > 0 ? file : null;
      rawInput = {
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
      };
    } else {
      rawInput = await request.json();
    }

    const parsed = regulationSchema.parse(rawInput);

    const duplicate = await prisma.reglementare.findFirst({
      where: {
        indicativ: parsed.indicativ,
        an: parsed.an,
        NOT: { id },
      },
      select: { id: true },
    });

    if (duplicate) {
      return NextResponse.json({ error: "Există deja o reglementare cu același indicativ și același an." }, { status: 409 });
    }

    const movedFile = replacementFile
      ? await replaceRegulationFile(replacementFile, item.caleFisier, parsed)
      : await moveRegulationFile(item.caleFisier, parsed);
    const updated = await prisma.reglementare.update({
      where: { id },
      data: {
        ...parsed,
        numeFisier: movedFile.fileName,
        caleFisier: movedFile.relativePath,
      },
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "Există deja o reglementare cu același indicativ și același an." }, { status: 409 });
    }

    const message = error instanceof Error ? error.message : "Reglementarea nu a putut fi actualizată.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(_: Request, { params }: DetailRouteProps) {
  const id = Number(params.id);
  if (!Number.isFinite(id)) {
    return NextResponse.json({ error: "ID invalid." }, { status: 400 });
  }

  try {
    const item = await getRegulation(id);
    if (!item) {
      return NextResponse.json({ error: "Reglementarea nu există." }, { status: 404 });
    }

    await prisma.reglementare.delete({ where: { id } });
    await deleteRegulationFile(item.caleFisier);

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Reglementarea nu a putut fi ștearsă.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
