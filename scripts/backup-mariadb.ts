import { spawn } from "node:child_process";
import { createWriteStream, existsSync, mkdirSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { createGzip } from "node:zlib";
import {
  acquireDatabaseProtectionLock,
  assertDatabaseMatchesTrackedState,
  createDatabaseSnapshot,
  hasChangesSinceLatestBackup,
  writeBackupManifest,
  type BackupManifest,
} from "../lib/backup-protection";
import { appendBackupLog, getBackupRoot, getBackupStatusPath, type DatabaseBackupStatus } from "../lib/backup-status";
import { prisma } from "../lib/db";
import { loadEnv } from "./env";

loadEnv();

function databaseConfig() {
  const value = process.env.DATABASE_URL;
  if (!value) throw new Error("Lipsește variabila DATABASE_URL.");
  const url = new URL(value);
  const database = decodeURIComponent(url.pathname.replace(/^\//, ""));
  if (!database) throw new Error("DATABASE_URL nu conține numele bazei de date.");
  return {
    host: url.hostname,
    port: url.port || "3306",
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database,
  };
}

function pad(value: number) {
  return String(value).padStart(2, "0");
}

function timestamp(date: Date) {
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}_${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`;
}

function writeStatus(status: DatabaseBackupStatus) {
  mkdirSync(getBackupRoot(), { recursive: true });
  writeFileSync(getBackupStatusPath(), JSON.stringify(status, null, 2), "utf8");
  appendBackupLog(status);
}

function pruneOldBackups(retentionDays: number, now = new Date()) {
  const cutoff = now.getTime() - retentionDays * 24 * 60 * 60 * 1000;
  let removed = 0;
  for (const entry of readdirSync(getBackupRoot(), { withFileTypes: true })) {
    if (!entry.isFile() || !entry.name.endsWith(".sql.gz")) continue;
    const filePath = path.join(getBackupRoot(), entry.name);
    if (statSync(filePath).mtimeMs >= cutoff) continue;
    rmSync(filePath, { force: true });
    rmSync(`${filePath}.manifest.json`, { force: true });
    removed += 1;
  }
  return removed;
}

async function main() {
  const startedAt = new Date();
  const config = databaseConfig();
  const fileName = `${config.database}_${timestamp(startedAt)}.sql.gz`;
  const filePath = path.join(getBackupRoot(), fileName);
  const temporaryPath = `${filePath}.tmp`;
  const backupId = `${config.database}-${startedAt.toISOString()}`;
  const release = await acquireDatabaseProtectionLock();

  try {
    const snapshot = await createDatabaseSnapshot();
    const conditional = process.argv.includes("--if-changed");
    if (conditional) assertDatabaseMatchesTrackedState(snapshot);

    if (conditional && !hasChangesSinceLatestBackup(snapshot)) {
      writeStatus({
        id: `skipped-${startedAt.toISOString()}`,
        status: "skipped",
        startedAt: startedAt.toISOString(),
        finishedAt: new Date().toISOString(),
        message: "Backup omis: baza de date nu a avut modificări noi.",
      });
      console.log("Backup MariaDB omis: nu există modificări noi.");
      return;
    }

    writeStatus({ id: backupId, status: "running", startedAt: startedAt.toISOString(), fileName, filePath, message: "Backup în curs." });

    const args = [
      "--single-transaction",
      "--quick",
      "--routines",
      "--triggers",
      "--events",
      "--ssl=0",
      "--default-character-set=utf8mb4",
      "--host", config.host,
      "--port", config.port,
      "--user", config.user,
      "--databases", config.database,
    ];
    const dump = spawn(process.env.MYSQLDUMP_BIN || "mysqldump", args, {
      env: { ...process.env, MYSQL_PWD: config.password },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stderr = "";
    dump.stderr.setEncoding("utf8");
    dump.stderr.on("data", (chunk) => { stderr += chunk; });
    const exitPromise = new Promise<number | null>((resolveExit, rejectExit) => {
      dump.on("error", rejectExit);
      dump.on("close", resolveExit);
    });
    const [exitCode] = await Promise.all([exitPromise, pipeline(dump.stdout, createGzip({ level: 9 }), createWriteStream(temporaryPath))]);
    if (exitCode !== 0) {
      rmSync(temporaryPath, { force: true });
      throw new Error(stderr.trim() || `mysqldump s-a închis cu codul ${exitCode}.`);
    }

    renameSync(temporaryPath, filePath);
    const finishedAt = new Date();
    const manifest: BackupManifest = {
      version: 1,
      backupId,
      backupFileName: fileName,
      createdAt: finishedAt.toISOString(),
      snapshot,
    };
    writeBackupManifest(manifest, `${filePath}.manifest.json`);
    const retentionDays = Number(process.env.REGLEMENTARI_BACKUP_RETENTION_DAYS || 90);
    const removed = Number.isFinite(retentionDays) && retentionDays > 0 ? pruneOldBackups(retentionDays) : 0;
    const sizeBytes = statSync(filePath).size;
    writeStatus({
      id: backupId,
      status: "success",
      startedAt: startedAt.toISOString(),
      finishedAt: finishedAt.toISOString(),
      fileName,
      filePath,
      sizeBytes,
      message: `Backup reușit. Backupuri expirate eliminate: ${removed}.`,
    });
    console.log(`Backup MariaDB reușit: ${filePath}`);
  } finally {
    release();
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  const now = new Date();
  const message = error instanceof Error ? error.message : String(error);
  if (!existsSync(getBackupRoot())) mkdirSync(getBackupRoot(), { recursive: true });
  writeStatus({ id: `failed-${now.toISOString()}`, status: "failed", startedAt: now.toISOString(), finishedAt: now.toISOString(), message });
  console.error(`Backup MariaDB eșuat: ${message}`);
  process.exitCode = 1;
});
