import { appendFileSync, existsSync, mkdirSync, readFileSync } from "node:fs";
import path from "node:path";

export type DatabaseBackupStatus = {
  id: string;
  status: "running" | "success" | "skipped" | "failed";
  startedAt: string;
  finishedAt?: string;
  fileName?: string;
  filePath?: string;
  sizeBytes?: number;
  message?: string;
};

export type DatabaseBackupLogEntry = {
  occurredAt: string;
  status: DatabaseBackupStatus["status"];
  message: string;
};

export function getBackupRoot() {
  return path.resolve(process.cwd(), process.env.REGLEMENTARI_BACKUP_DIR || "backups/daily-db");
}

export function getBackupStatusPath() {
  return path.join(getBackupRoot(), "status.json");
}

export function getBackupLogPath() {
  return path.join(getBackupRoot(), "backup-messages.log");
}

export function backupStatusLabel(status: DatabaseBackupStatus["status"]) {
  if (status === "success") return "reușit";
  if (status === "failed") return "eșuat";
  if (status === "running") return "în curs";
  return "omis, fără modificări";
}

export function backupStatusDate(status: DatabaseBackupStatus) {
  return status.finishedAt || status.startedAt;
}

export function formatBackupDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ro-RO", {
    dateStyle: "medium",
    timeStyle: "medium",
    timeZone: "Europe/Bucharest",
  }).format(date);
}

export function appendBackupLog(status: DatabaseBackupStatus) {
  mkdirSync(getBackupRoot(), { recursive: true });
  const entry: DatabaseBackupLogEntry = {
    occurredAt: backupStatusDate(status),
    status: status.status,
    message: status.message || "",
  };
  appendFileSync(getBackupLogPath(), `${JSON.stringify(entry)}\n`, "utf8");
}

export function readBackupLog(): DatabaseBackupLogEntry[] {
  if (!existsSync(getBackupLogPath())) return [];

  return readFileSync(getBackupLogPath(), "utf8")
    .split(/\r?\n/)
    .filter(Boolean)
    .flatMap((line) => {
      try {
        const entry = JSON.parse(line) as DatabaseBackupLogEntry;
        if (!entry.occurredAt || !entry.status || typeof entry.message !== "string") return [];
        return [entry];
      } catch {
        return [];
      }
    });
}

export function readBackupStatus(): DatabaseBackupStatus | null {
  if (!existsSync(getBackupStatusPath())) return null;
  try {
    return JSON.parse(readFileSync(getBackupStatusPath(), "utf8")) as DatabaseBackupStatus;
  } catch {
    return null;
  }
}
