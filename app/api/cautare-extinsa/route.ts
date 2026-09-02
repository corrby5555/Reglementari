import { NextResponse } from "next/server";
import { parseExtendedSearchKeywords, runExtendedSearch } from "@/lib/extended-search";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const keywords = parseExtendedSearchKeywords(body?.keywords);
    if (keywords.length === 0) {
      return NextResponse.json({ error: "Introdu cel puțin un cuvânt cheie." }, { status: 400 });
    }
    if (keywords.length > 20 || keywords.some((keyword) => keyword.length > 100)) {
      return NextResponse.json({ error: "Poți căuta maximum 20 de cuvinte sau expresii, fiecare de cel mult 100 de caractere." }, { status: 400 });
    }
    return NextResponse.json({ data: await runExtendedSearch(keywords) });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Căutarea extinsă a eșuat." },
      { status: 500 },
    );
  }
}
