import { existsSync, readFileSync } from "node:fs";
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

export function getBackupRoot() {
  return path.resolve(process.cwd(), process.env.REGLEMENTARI_BACKUP_DIR || "backups/daily-db");
}

export function getBackupStatusPath() {
  return path.join(getBackupRoot(), "status.json");
}

export function readBackupStatus(): DatabaseBackupStatus | null {
  if (!existsSync(getBackupStatusPath())) return null;
  try {
    return JSON.parse(readFileSync(getBackupStatusPath(), "utf8")) as DatabaseBackupStatus;
  } catch {
    return null;
  }
}
