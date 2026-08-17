"use client";

import { useEffect, useState } from "react";

type UpdatedByIndicativesFieldProps = {
  indicativ: string;
  an: string | number;
  excludeId?: number;
};

export function UpdatedByIndicativesField({ indicativ, an, excludeId }: UpdatedByIndicativesFieldProps) {
  const [values, setValues] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const trimmedIndicativ = indicativ.trim();
    const trimmedAn = String(an).trim();

    if (!trimmedIndicativ || !trimmedAn || !Number.isFinite(Number(trimmedAn))) {
      setValues([]);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    const params = new URLSearchParams({ indicativ: trimmedIndicativ, an: trimmedAn });
    if (excludeId) {
      params.set("excludeId", String(excludeId));
    }

    setLoading(true);
    fetch(`/api/reglementari/actualizat-de?${params.toString()}`, { signal: controller.signal })
      .then((response) => response.ok ? response.json() : { data: [] })
      .then((payload) => {
        setValues(Array.isArray(payload.data) ? payload.data : []);
        setLoading(false);
      })
      .catch((error) => {
        if (error.name !== "AbortError") {
          setValues([]);
          setLoading(false);
        }
      });

    return () => controller.abort();
  }, [indicativ, an, excludeId]);

  return (
    <div className="field min-h-[42px] overflow-hidden bg-slate-50 text-slate-700">
      <span className={values.length > 0 ? "block truncate" : "block truncate text-slate-400"}>
        {loading ? "Se verifică..." : values.length > 0 ? values.join(", ") : "-"}
      </span>
    </div>
  );
}
