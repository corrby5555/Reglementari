import { existsSync, readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";
import { toStorageRelativePath } from "../lib/storage";

function loadEnvLocal() {
  if (!existsSync(".env.local")) {
    return;
  }

  const lines = readFileSync(".env.local", "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    process.env[key] ??= rawValue.replace(/^["']|["']$/g, "");
  }
}

async function main() {
  loadEnvLocal();
  const prisma = new PrismaClient();

  try {
    const rows = await prisma.reglementare.findMany({
      select: {
        id: true,
        indicativ: true,
        an: true,
        caleFisier: true,
      },
      orderBy: [{ indicativ: "asc" }, { an: "asc" }],
    });

    let updated = 0;

    for (const row of rows) {
      const relativePath = toStorageRelativePath(row.caleFisier);
      if (relativePath === row.caleFisier) {
        continue;
      }

      await prisma.reglementare.update({
        where: { id: row.id },
        data: { caleFisier: relativePath },
      });
      updated += 1;
      console.log(`${row.indicativ}/${row.an}: ${row.caleFisier} -> ${relativePath}`);
    }

    console.log(`Conversie finalizată: ${updated} căi actualizate din ${rows.length} reglementări.`);
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
