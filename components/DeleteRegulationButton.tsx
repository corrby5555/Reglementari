"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DeleteRegulationButton({ id }: { id: number }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function remove() {
    if (!window.confirm("Ștergi reglementarea din baza de date și fișierul PDF de pe server?")) {
      return;
    }

    setLoading(true);
    const response = await fetch(`/api/reglementari/${id}`, { method: "DELETE" });
    if (!response.ok) {
      const payload = await response.json().catch(() => null);
      setLoading(false);
      window.alert(payload?.error || "Reglementarea nu a putut fi ștearsă.");
      return;
    }

    router.push("/");
    router.refresh();
  }

  return (
    <button type="button" className="btn border-red-300 text-red-700 hover:bg-red-50" onClick={remove} disabled={loading}>
      {loading ? "Se șterge..." : "Șterge"}
    </button>
  );
}
