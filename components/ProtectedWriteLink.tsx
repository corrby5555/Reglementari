"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function ProtectedWriteLink({ href, className, children }: { href: string; className?: string; children: React.ReactNode }) {
  const router = useRouter();
  const [checking, setChecking] = useState(false);

  async function open() {
    if (checking) return;
    setChecking(true);
    try {
      const response = await fetch("/api/backup/verify", { method: "POST" });
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(payload?.error || "Verificarea bazei de date a eșuat.");
      router.push(href);
    } catch (error) {
      window.alert(error instanceof Error ? error.message : "Verificarea bazei de date a eșuat.");
      setChecking(false);
    }
  }

  return (
    <button type="button" className={className} onClick={open} disabled={checking}>
      {checking ? "Se verifică baza..." : children}
    </button>
  );
}
