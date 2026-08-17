import { existsSync } from "node:fs";
import { copyFile, mkdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { stripDiacritics } from "@/lib/file-name-description";
import { disciplines, documentTypes, domainOptions } from "@/lib/options";
import type { RegulationInput } from "@/lib/validation";

export function slugifyFilePart(value: string) {
  return stripDiacritics(value)
    .replace(/[^a-zA-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 120);
}

export function folderPart(value: string) {
  return slugifyFilePart(value).toLowerCase() || "neclasificat";
}

export function generateBaseFileName(input: Pick<RegulationInput, "indicativ" | "an" | "descriereNumeFisier" | "descriere" | "denumireExacta">, extension: string) {
  const description = slugifyFilePart(input.descriereNumeFisier || input.descriere || input.denumireExacta) || "reglementare";
  const safeExtension = extension.replace(/[^a-zA-Z0-9]/g, "").toLowerCase() || "pdf";
  return `${input.indicativ}_${input.an}@${description}.${safeExtension}`;
}

export function getStorageRoot() {
  return path.resolve(process.env.REGLEMENTARI_STORAGE_DIR || "./storage/reglementari");
}

export function documentTypeFolder(tipDocument: RegulationInput["tipDocument"]) {
  const folders: Record<RegulationInput["tipDocument"], string> = {
    legislatie: "Reglementari",
    informatie: "Informatie",
    tehnic: "Tehnica",
  };

  return folders[tipDocument];
}

export function getTargetDirectory(input: Pick<RegulationInput, "tipDocument" | "disciplina" | "domeniu">) {
  const documentFolder = documentTypeFolder(input.tipDocument);
  const disciplineFolder = folderPart(input.disciplina);

  if (input.disciplina === "general") {
    return path.join(getStorageRoot(), documentFolder, disciplineFolder, folderPart(input.domeniu));
  }

  return path.join(getStorageRoot(), documentFolder, disciplineFolder);
}

export async function createStorageStructure() {
  for (const tipDocument of documentTypes) {
    const documentFolder = documentTypeFolder(tipDocument);
    for (const disciplina of disciplines) {
      const disciplineFolder = folderPart(disciplina);
      if (disciplina === "general") {
        for (const domeniu of domainOptions) {
          await mkdir(path.join(getStorageRoot(), documentFolder, disciplineFolder, folderPart(domeniu)), { recursive: true });
        }
      } else {
        await mkdir(path.join(getStorageRoot(), documentFolder, disciplineFolder), { recursive: true });
      }
    }
  }
}

export async function resolveAvailablePath(directory: string, fileName: string, currentPath = "") {
  const parsed = path.parse(fileName);
  let candidate = fileName;
  let counter = 1;

  while (existsSync(path.join(directory, candidate)) && path.resolve(path.join(directory, candidate)) !== path.resolve(currentPath)) {
    candidate = `${parsed.name}_${counter}${parsed.ext}`;
    counter += 1;
  }

  return {
    fileName: candidate,
    fullPath: path.join(directory, candidate),
  };
}

export async function saveRegulationFile(file: File, input: RegulationInput) {
  if (!file || file.size === 0) {
    throw new Error("Fișierul reglementării este obligatoriu.");
  }

  const originalExtension = path.extname(file.name).replace(".", "") || "pdf";
  const directory = getTargetDirectory(input);
  await mkdir(directory, { recursive: true });

  const baseFileName = generateBaseFileName(input, originalExtension);
  const target = await resolveAvailablePath(directory, baseFileName);
  const bytes = Buffer.from(await file.arrayBuffer());
  await writeFile(target.fullPath, bytes);

  return target;
}

export async function moveRegulationFile(currentPath: string, input: RegulationInput) {
  const currentExtension = path.extname(currentPath).replace(".", "") || "pdf";
  const directory = getTargetDirectory(input);
  await mkdir(directory, { recursive: true });

  const baseFileName = generateBaseFileName(input, currentExtension);
  const target = await resolveAvailablePath(directory, baseFileName, currentPath);

  if (path.resolve(currentPath) === path.resolve(target.fullPath)) {
    return target;
  }

  try {
    await rename(currentPath, target.fullPath);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EXDEV") {
      throw error;
    }

    await copyFile(currentPath, target.fullPath);
    await rm(currentPath, { force: true });
  }

  return target;
}

export async function replaceRegulationFile(file: File, currentPath: string, input: RegulationInput) {
  if (!file || file.size === 0) {
    return moveRegulationFile(currentPath, input);
  }

  const originalExtension = path.extname(file.name).replace(".", "") || "pdf";
  const directory = getTargetDirectory(input);
  await mkdir(directory, { recursive: true });

  const baseFileName = generateBaseFileName(input, originalExtension);
  const target = await resolveAvailablePath(directory, baseFileName, currentPath);
  const bytes = Buffer.from(await file.arrayBuffer());
  await writeFile(target.fullPath, bytes);

  if (path.resolve(currentPath) !== path.resolve(target.fullPath)) {
    await rm(currentPath, { force: true });
  }

  return target;
}

export async function deleteRegulationFile(filePath: string) {
  await rm(filePath, { force: true });
}
