import { existsSync, readFileSync } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import path from "node:path";
import { PrismaClient } from "@prisma/client";
import { disciplines, documentTypes, domainOptions } from "../lib/options";

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

function stripDiacritics(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function folderPart(value: string) {
  return stripDiacritics(value)
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase() || "neclasificat";
}

function documentTypeFolder(tipDocument: (typeof documentTypes)[number]) {
  const folders: Record<(typeof documentTypes)[number], string> = {
    legislatie: "Reglementari",
    informatie: "Informatie",
    tehnic: "Tehnica",
  };

  return folders[tipDocument];
}

function getStorageRoot() {
  return path.resolve(process.env.REGLEMENTARI_STORAGE_DIR || "./storage/reglementari");
}

async function recreateStorageStructure(root: string) {
  for (const folder of ["Reglementari", "Informatie", "Tehnica"]) {
    await rm(path.join(root, folder), { recursive: true, force: true });
  }

  for (const tipDocument of documentTypes) {
    const documentFolder = documentTypeFolder(tipDocument);
    for (const disciplina of disciplines) {
      const disciplineFolder = folderPart(disciplina);
      if (disciplina === "general") {
        for (const domeniu of domainOptions) {
          await mkdir(path.join(root, documentFolder, disciplineFolder, folderPart(domeniu)), { recursive: true });
        }
      } else {
        await mkdir(path.join(root, documentFolder, disciplineFolder), { recursive: true });
      }
    }
  }
}

async function main() {
  loadEnvLocal();

  const root = getStorageRoot();
  if (root === path.parse(root).root) {
    throw new Error(`Refuz să șterg foldere direct în rădăcina sistemului: ${root}`);
  }

  const prisma = new PrismaClient();
  try {
    const deleted = await prisma.reglementare.deleteMany();
    await recreateStorageStructure(root);

    console.log(`Înregistrări șterse din baza de date: ${deleted.count}`);
    console.log(`Structură recreată în: ${root}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
