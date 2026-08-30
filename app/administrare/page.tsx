import Link from "next/link";
import { headers } from "next/headers";
import { AdministrationPanel } from "@/components/AdministrationPanel";
import { canWriteFromHeaders } from "@/lib/access-control";
import { backupStatusLabel, formatBackupDate, readBackupLog } from "@/lib/backup-status";

export const dynamic = "force-dynamic";

export default function AdministrationPage() {
  if (!canWriteFromHeaders(headers())) {
    return (
      <main className="page-shell">
        <div className="sheet border-amber-200 bg-amber-50 p-5 text-sm font-semibold text-amber-800">
          Acces restricționat. Adresa IP curentă nu are drept de administrare.
          <div className="mt-3">
            <Link href="/" className="btn">Retur</Link>
          </div>
        </div>
      </main>
    );
  }

  const entries = readBackupLog().map((entry) => ({
    ...entry,
    dateLabel: formatBackupDate(entry.occurredAt),
    statusLabel: backupStatusLabel(entry.status),
  }));

  return (
    <main className="page-shell">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="label">Administrare</p>
          <h1 className="text-3xl font-bold text-ink">Jurnal backup bază de date</h1>
        </div>
        <Link href="/" className="btn">Retur la catalog</Link>
      </div>

      <AdministrationPanel entries={entries} />
    </main>
  );
}
