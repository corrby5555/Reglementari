import { NextResponse } from "next/server";
import { getCurrentBulkRowWithErrors, getBulkExcelPath, getBulkSourceDir } from "@/lib/bulk-reglementari";

function parseSkippedRows(request: Request) {
  const url = new URL(request.url);
  return (url.searchParams.get("skipRows") || "")
    .split(",")
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isInteger(value) && value > 1);
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const selectedSourcePath = url.searchParams.get("selectedSourcePath") || "";
    const { row, errors, blockingError } = getCurrentBulkRowWithErrors(parseSkippedRows(request), selectedSourcePath);
    if (blockingError) {
      return NextResponse.json({
        error: blockingError.message,
        rowIndex: blockingError.rowIndex,
        candidates: blockingError.candidates || [],
        skippedErrors: errors,
        sourceDir: getBulkSourceDir(),
        excelPath: getBulkExcelPath(),
      }, { status: 400 });
    }

    return NextResponse.json({
      data: row
        ? {
            rowIndex: row.rowIndex,
            sourceFileName: row.sourceFileName,
            values: row.values,
          }
        : null,
      skippedErrors: errors,
      sourceDir: getBulkSourceDir(),
      excelPath: getBulkExcelPath(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Nu se poate citi fișierul bulk.";
    return NextResponse.json({ error: message, sourceDir: getBulkSourceDir(), excelPath: getBulkExcelPath() }, { status: 400 });
  }
}
