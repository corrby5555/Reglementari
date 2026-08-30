"use client";

import { useEffect, useState } from "react";

type BackupStatusBannerProps = {
  id: string;
  status: "running" | "success" | "skipped" | "failed";
  statusLabel: string;
  dateLabel: string;
  message?: string;
};

export function BackupStatusBanner({ id, status, statusLabel, dateLabel, message }: BackupStatusBannerProps) {
  const storageKey = `reglementari-dismissed-backup-${id}-${status}`;
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    try {
      setVisible(window.localStorage.getItem(storageKey) !== "1");
    } catch {
      setVisible(true);
    }
  }, [storageKey]);

  function dismiss() {
    setVisible(false);
    try {
      window.localStorage.setItem(storageKey, "1");
    } catch {
      // Mesajul rămâne ascuns pentru sesiunea curentă chiar dacă stocarea nu este disponibilă.
    }
  }

  if (!visible) return null;

  return (
    <button
      type="button"
      onClick={dismiss}
      className={`sheet w-full p-3 text-left text-sm font-semibold transition hover:brightness-95 ${
        status === "failed"
          ? "border-red-300 bg-red-50 text-red-800"
          : status === "success"
            ? "border-emerald-300 bg-emerald-50 text-emerald-800"
            : "border-slate-300 bg-slate-50 text-slate-700"
      }`}
      title="Click pentru a ascunde mesajul"
    >
      Backup bază: {statusLabel} — {dateLabel}
      {message ? ` — ${message}` : ""}
    </button>
  );
}
