import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import type { Reglementare } from "@prisma/client";
import { prisma } from "./db";
import { getBackupRoot } from "./backup-status";

export type DatabaseSnapshot = {
  capturedAt: string;
  database: string;
  table: "reglementari";
  rowCount: number;
  maxId: number;
  checksum: string;
};

export type BackupManifest = {
  version: 1;
  backupId: string;
  backupFileName: string;
  createdAt: string;
  snapshot: DatabaseSnapshot;
};

type ProtectionState = {
  lastVerifiedDate?: string;
  lastVerifiedAt?: string;
  verifiedAgainstBackupId?: string;
  lastChangedAt?: string;
  lastKnownSnapshot?: DatabaseSnapshot;
  lastBackupAt?: string;
  lastBackupId?: string;
};

export function getLocalDateKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: process.env.APP_TIME_ZONE || "Europe/Bucharest",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function statePath() {
  return path.join(getBackupRoot(), "protection-state.json");
}

export function latestManifestPath() {
  return path.join(getBackupRoot(), "latest-manifest.json");
}

function lockPath() {
  return path.join(getBackupRoot(), ".database-protection.lock");
}

function readJson<T>(filePath: string): T | null {
  if (!existsSync(filePath)) return null;
  try {
    return JSON.parse(readFileSync(filePath, "utf8")) as T;
  } catch {
    return null;
  }
}

function writeJsonAtomic(filePath: string, value: unknown) {
  mkdirSync(getBackupRoot(), { recursive: true });
  const temporaryPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
  writeFileSync(temporaryPath, JSON.stringify(value, null, 2), "utf8");
  renameSync(temporaryPath, filePath);
}

function readState() {
  return readJson<ProtectionState>(statePath()) || {};
}

export function readLatestManifest() {
  return readJson<BackupManifest>(latestManifestPath());
}

function canonicalRow(row: Reglementare) {
  return {
    ...row,
    dataAdaugare: row.dataAdaugare.toISOString(),
  };
}

export async function createDatabaseSnapshot(): Promise<DatabaseSnapshot> {
  const rows = await prisma.reglementare.findMany({ orderBy: { id: "asc" } });
  const databaseRows = await prisma.$queryRawUnsafe<Array<{ databaseName: string | null }>>("SELECT DATABASE() AS databaseName");
  return {
    capturedAt: new Date().toISOString(),
    database: String(databaseRows[0]?.databaseName || ""),
    table: "reglementari",
    rowCount: rows.length,
    maxId: rows.reduce((maximum, row) => Math.max(maximum, row.id), 0),
    checksum: createHash("sha256").update(JSON.stringify(rows.map(canonicalRow))).digest("hex"),
  };
}

export function snapshotsMatch(left: DatabaseSnapshot, right: DatabaseSnapshot) {
  return left.database === right.database && left.table === right.table && left.rowCount === right.rowCount && left.maxId === right.maxId && left.checksum === right.checksum;
}

function sleep(milliseconds: number) {
  return new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds));
}

export async function acquireDatabaseProtectionLock() {
  mkdirSync(getBackupRoot(), { recursive: true });
  const directory = lockPath();
  const deadline = Date.now() + 15_000;

  while (Date.now() < deadline) {
    try {
      mkdirSync(directory);
      writeFileSync(path.join(directory, "owner.json"), JSON.stringify({ pid: process.pid, createdAt: new Date().toISOString() }), "utf8");
      let released = false;
      return () => {
        if (released) return;
        released = true;
        rmSync(directory, { recursive: true, force: true });
      };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
      try {
        if (Date.now() - statSync(directory).mtimeMs > 10 * 60 * 1000) {
          rmSync(directory, { recursive: true, force: true });
          continue;
        }
      } catch {
        continue;
      }
      await sleep(150);
    }
  }

  throw new Error("Baza de date este verificată sau salvată în acest moment. Încearcă din nou peste câteva secunde.");
}

function differenceError(expected: DatabaseSnapshot, current: DatabaseSnapshot) {
  return new Error(
    `Protecția bazei de date a detectat diferențe și a blocat operația. ` +
      `Stare validă: ${expected.rowCount} reglementări (ID maxim ${expected.maxId}); ` +
      `baza curentă: ${current.rowCount} reglementări (ID maxim ${current.maxId}). ` +
      `Verifică diferențele înainte de a continua.`,
  );
}

async function verifyWhileLocked(force = false) {
  const today = getLocalDateKey();
  const state = readState();
  if (!force && state.lastVerifiedDate === today) return;

  const manifest = readLatestManifest();
  if (!manifest) {
    throw new Error("Protecția bazei de date a blocat operația: nu există backupul inițial. Rulează mai întâi npm run backup:db.");
  }

  const expected = state.lastKnownSnapshot && new Date(state.lastKnownSnapshot.capturedAt).getTime() >= new Date(manifest.snapshot.capturedAt).getTime()
    ? state.lastKnownSnapshot
    : manifest.snapshot;
  const current = await createDatabaseSnapshot();
  if (!snapshotsMatch(expected, current)) throw differenceError(expected, current);

  writeJsonAtomic(statePath(), {
    ...state,
    lastVerifiedDate: today,
    lastVerifiedAt: new Date().toISOString(),
    verifiedAgainstBackupId: manifest.backupId,
  } satisfies ProtectionState);
}

export async function verifyDatabaseBeforeWrite() {
  const release = await acquireDatabaseProtectionLock();
  try {
    await verifyWhileLocked();
  } finally {
    release();
  }
}

export async function runProtectedDatabaseWrite<T>(operation: () => Promise<T>) {
  const release = await acquireDatabaseProtectionLock();
  try {
    await verifyWhileLocked();
    const result = await operation();
    const snapshot = await createDatabaseSnapshot();
    const state = readState();
    writeJsonAtomic(statePath(), { ...state, lastChangedAt: new Date().toISOString(), lastKnownSnapshot: snapshot } satisfies ProtectionState);
    return result;
  } finally {
    release();
  }
}

export function hasChangesSinceLatestBackup(current: DatabaseSnapshot) {
  const manifest = readLatestManifest();
  return !manifest || !snapshotsMatch(manifest.snapshot, current);
}

export function assertDatabaseMatchesTrackedState(current: DatabaseSnapshot) {
  const state = readState();
  if (!state.lastKnownSnapshot || snapshotsMatch(state.lastKnownSnapshot, current)) return;
  throw differenceError(state.lastKnownSnapshot, current);
}

export function writeBackupManifest(manifest: BackupManifest, filePath: string) {
  writeJsonAtomic(filePath, manifest);
  writeJsonAtomic(latestManifestPath(), manifest);
  const state = readState();
  writeJsonAtomic(statePath(), {
    ...state,
    lastBackupAt: manifest.createdAt,
    lastBackupId: manifest.backupId,
    lastKnownSnapshot: manifest.snapshot,
  } satisfies ProtectionState);
}
