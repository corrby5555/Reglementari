import { headers } from "next/headers";
import { NextResponse } from "next/server";
import { canWriteFromHeaders } from "@/lib/access-control";
import { testRegulationPdfFiles } from "@/lib/pdf-file-test";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST() {
  if (!canWriteFromHeaders(headers())) {
    return NextResponse.json({ error: "Acces restricționat pentru adresa IP curentă." }, { status: 403 });
  }

  try {
    return NextResponse.json({ data: await testRegulationPdfFiles() });
  } catch (error) {
    const message = error instanceof Error && (error as NodeJS.ErrnoException).code === "ENOENT"
      ? "Instrumentul pdftotext nu este instalat pe server."
      : error instanceof Error
        ? error.message
        : "Testarea fișierelor PDF a eșuat.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
