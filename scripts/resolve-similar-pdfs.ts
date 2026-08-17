import { existsSync, readFileSync, readdirSync } from "node:fs";
import { rm } from "node:fs/promises";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

type SimilarFile = {
  fileName: string;
  fullPath: string;
};

type Args = {
  sourceDir: string;
  dryRun: boolean;
};

type FileDecision = "p" | "d";

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

function normalizeFileName(value: string) {
  return stripDiacritics(path.parse(value).name)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function parseArgs(): Args {
  loadEnvLocal();

  const args = process.argv.slice(2);
  let sourceDir = process.env.REGLEMENTARI_BULK_DIR || path.join(process.cwd(), "..", "0_Reglementari");
  let dryRun = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--dir") {
      sourceDir = args[index + 1] || sourceDir;
      index += 1;
      continue;
    }

    if (arg === "--dry-run") {
      dryRun = true;
      continue;
    }

    if (arg === "--help" || arg === "-h") {
      console.log("Utilizare: npm run resolve:similar-pdfs -- [--dir /cale/folder] [--dry-run]");
      process.exit(0);
    }
  }

  return {
    sourceDir: path.resolve(sourceDir),
    dryRun,
  };
}

function collectPdfs(directory: string): SimilarFile[] {
  const files: SimilarFile[] = [];

  function walk(currentDirectory: string) {
    for (const entry of readdirSync(currentDirectory, { withFileTypes: true })) {
      const fullPath = path.join(currentDirectory, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
        continue;
      }

      if (entry.isFile() && path.extname(entry.name).toLowerCase() === ".pdf") {
        files.push({
          fileName: entry.name,
          fullPath,
        });
      }
    }
  }

  walk(directory);
  return files;
}

function groupSimilarFiles(files: SimilarFile[]) {
  const groups = new Map<string, SimilarFile[]>();
  for (const file of files) {
    const key = normalizeFileName(file.fileName);
    if (!key) continue;
    groups.set(key, [...(groups.get(key) || []), file]);
  }

  return Array.from(groups.values())
    .filter((group) => group.length > 1)
    .sort((left, right) => left[0].fileName.localeCompare(right[0].fileName, "ro"));
}

function openInPreview(files: SimilarFile[]) {
  for (const file of files) {
    const child = spawn("open", ["-a", "Preview", file.fullPath], {
      detached: true,
      stdio: "ignore",
    });
    child.unref();
  }
}

function shellDelete(file: SimilarFile) {
  const result = spawnSync("/bin/rm", ["-f", file.fullPath], {
    encoding: "utf8",
  });
  if (result.status === 0) {
    console.log(`Șters forțat: ${file.fileName}`);
    return true;
  }

  return false;
}

function getLockingProcesses(file: SimilarFile) {
  const result = spawnSync("/usr/sbin/lsof", ["-F", "pc", "--", file.fullPath], {
    encoding: "utf8",
  });
  if (result.status !== 0 && !result.stdout) {
    return [];
  }

  const processes: { pid: number; command: string }[] = [];
  let currentPid: number | null = null;
  for (const line of result.stdout.split(/\r?\n/)) {
    if (line.startsWith("p")) {
      currentPid = Number(line.slice(1));
      continue;
    }

    if (line.startsWith("c") && currentPid && Number.isInteger(currentPid)) {
      processes.push({ pid: currentPid, command: line.slice(1) });
      currentPid = null;
    }
  }

  return processes;
}

function killPreviewLocks(file: SimilarFile) {
  const safeCommands = new Set(["Preview", "QuickLookUIService", "qlmanage"]);
  const lockingProcesses = getLockingProcesses(file);
  const killed: string[] = [];

  for (const processInfo of lockingProcesses) {
    if (!safeCommands.has(processInfo.command)) {
      continue;
    }

    const result = spawnSync("/bin/kill", ["-9", String(processInfo.pid)], {
      encoding: "utf8",
    });
    if (result.status === 0) {
      killed.push(`${processInfo.command}(${processInfo.pid})`);
    }
  }

  if (killed.length > 0) {
    console.log(`Am închis procese care blocau fișierul: ${killed.join(", ")}`);
  } else if (lockingProcesses.length > 0) {
    console.log("Fișierul pare blocat de procese care nu sunt închise automat:");
    lockingProcesses.forEach((processInfo) => console.log(`- ${processInfo.command}(${processInfo.pid})`));
  }
}

async function deleteFileWithRetry(rl: readline.Interface, file: SimilarFile) {
  while (true) {
    try {
      await rm(file.fullPath, { force: true });
      console.log(`Șters: ${file.fileName}`);
      return "deleted" as const;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code;
      if (code !== "EBUSY" && code !== "EPERM") {
        throw error;
      }

      console.log("");
      console.log(`Fișier blocat: ${file.fileName}`);
      console.log(file.fullPath);
      console.log("Încerc ștergere forțată.");

      if (shellDelete(file)) {
        return "deleted" as const;
      }

      killPreviewLocks(file);

      if (shellDelete(file)) {
        return "deleted" as const;
      }

      const answer = (await rl.question("r = reîncearcă, s = sari peste acest fișier, q = ieșire: ")).trim().toLowerCase();
      if (answer === "q") {
        return "quit" as const;
      }
      if (answer === "s") {
        console.log(`Sărit: ${file.fileName}`);
        return "skipped" as const;
      }
    }
  }
}

function parseDecisionAnswer(answer: string, group: SimilarFile[]) {
  const decisions = new Map<number, FileDecision>();
  const tokens = answer
    .split(/[,\s]+/g)
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean);

  if (tokens.length === 0) {
    return { error: "Nu ai introdus nicio decizie." };
  }

  for (const token of tokens) {
    const match = token.match(/^(\d+)([dp])$/);
    if (!match) {
      return { error: `Token invalid: ${token}. Folosește forma 1d sau 2p.` };
    }

    const index = Number(match[1]) - 1;
    if (!Number.isInteger(index) || index < 0 || index >= group.length) {
      return { error: `Număr invalid: ${match[1]}.` };
    }

    if (decisions.has(index)) {
      return { error: `Fișierul ${match[1]} are două decizii.` };
    }

    decisions.set(index, match[2] as FileDecision);
  }

  const missing = group
    .map((_, index) => index)
    .filter((index) => !decisions.has(index));
  if (missing.length > 0) {
    return { error: `Lipsesc decizii pentru: ${missing.map((index) => index + 1).join(", ")}.` };
  }

  return { decisions };
}

async function resolveGroup(rl: readline.Interface, group: SimilarFile[], groupIndex: number, totalGroups: number, dryRun: boolean) {
  console.log("");
  console.log(`Grup ${groupIndex}/${totalGroups}: ${group.length} PDF-uri similare`);
  group.forEach((file, index) => {
    console.log(`${index + 1}. ${file.fileName}`);
    console.log(`   ${file.fullPath}`);
  });

  openInPreview(group);
  console.log("Am deschis fișierele în Preview.");

  while (true) {
    const answer = (await rl.question("Decizie pentru fiecare PDF: 1p = păstrează, 1d = șterge; r = redeschide, s = sari, q = ieșire: ")).trim().toLowerCase();

    if (answer === "q") {
      return "quit" as const;
    }

    if (answer === "s") {
      console.log("Grup sărit. Nu s-a șters nimic.");
      return "skip" as const;
    }

    if (answer === "r") {
      openInPreview(group);
      continue;
    }

    const parsed = parseDecisionAnswer(answer, group);
    if (parsed.error || !parsed.decisions) {
      console.log(parsed.error || "Alegere invalidă.");
      continue;
    }

    const kept = group.filter((_, index) => parsed.decisions?.get(index) === "p");
    const deleted = group.filter((_, index) => parsed.decisions?.get(index) === "d");

    console.log("");
    if (kept.length > 0) {
      console.log("Se păstrează:");
      kept.forEach((file) => console.log(`- ${file.fileName}`));
    } else {
      console.log("Nu se păstrează niciun fișier din acest grup.");
    }

    if (deleted.length > 0) {
      console.log("Se vor șterge:");
      deleted.forEach((file) => console.log(`- ${file.fileName}`));
    } else {
      console.log("Nu se șterge niciun fișier din acest grup.");
    }

    const confirmationPrompt = deleted.length === group.length
      ? "Ai marcat toate fișierele pentru ștergere. Scrie STERGE TOT pentru confirmare sau Enter pentru anulare: "
      : "Scrie STERGE pentru confirmare sau Enter pentru anulare: ";
    const expectedConfirmation = deleted.length === group.length ? "STERGE TOT" : "STERGE";
    const confirmation = (await rl.question(confirmationPrompt)).trim();
    if (confirmation !== expectedConfirmation) {
      console.log("Anulat. Nu s-a șters nimic pentru acest grup.");
      return "skip" as const;
    }

    if (dryRun) {
      console.log("Dry-run: nu s-a șters nimic.");
      return "resolved" as const;
    }

    for (const file of deleted) {
      const result = await deleteFileWithRetry(rl, file);
      if (result === "quit") {
        return "quit" as const;
      }
    }

    return "resolved" as const;
  }
}

async function main() {
  const args = parseArgs();
  if (!existsSync(args.sourceDir)) {
    throw new Error(`Folderul nu există: ${args.sourceDir}`);
  }

  console.log(`Folder analizat: ${args.sourceDir}`);
  if (args.dryRun) {
    console.log("Mod dry-run: nu se vor șterge fișiere.");
  }

  const groups = groupSimilarFiles(collectPdfs(args.sourceDir));
  if (groups.length === 0) {
    console.log("Nu am găsit PDF-uri cu nume similare.");
    return;
  }

  console.log(`Am găsit ${groups.length} grupuri de PDF-uri cu nume similare.`);

  const rl = readline.createInterface({ input, output });
  try {
    let resolved = 0;
    let skipped = 0;

    for (let index = 0; index < groups.length; index += 1) {
      const result = await resolveGroup(rl, groups[index], index + 1, groups.length, args.dryRun);
      if (result === "quit") {
        break;
      }
      if (result === "resolved") {
        resolved += 1;
      } else {
        skipped += 1;
      }
    }

    console.log("");
    console.log(`Finalizat. Grupuri rezolvate: ${resolved}. Grupuri sărite: ${skipped}.`);
  } finally {
    rl.close();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
