"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { parseIndicativeReferences } from "@/lib/indicative-references";

type RegulationOption = {
  id: number;
  value: string;
  label: string;
};

type IndicativeMultiSelectProps = {
  defaultValue?: string;
  excludeId?: number;
};

export function IndicativeMultiSelect({ defaultValue = "", excludeId }: IndicativeMultiSelectProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<RegulationOption[]>([]);
  const [selected, setSelected] = useState<string[]>(() => parseIndicativeReferences(defaultValue));
  const [query, setQuery] = useState("");

  useEffect(() => {
    let active = true;

    fetch("/api/reglementari/optiuni")
      .then((response) => response.ok ? response.json() : { data: [] })
      .then((payload) => {
        if (active && Array.isArray(payload.data)) {
          setOptions(payload.data.filter((item: RegulationOption) => item.id !== excludeId));
        }
      })
      .catch(() => {
        if (active) {
          setOptions([]);
        }
      });

    return () => {
      active = false;
    };
  }, [excludeId]);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  const filteredOptions = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return options;
    }

    return options.filter((option) => option.value.toLowerCase().includes(normalizedQuery));
  }, [options, query]);

  function toggle(value: string) {
    setSelected((current) => (
      current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value]
    ));
  }

  function remove(value: string) {
    setSelected((current) => current.filter((item) => item !== value));
  }

  return (
    <div ref={wrapperRef} className="relative grid gap-1">
      {selected.map((value) => (
        <input key={value} type="hidden" name="actualizeazaIndicativ" value={value} />
      ))}
      <input
        className="field"
        value={query}
        placeholder={selected.length > 0 ? `${selected.length} selectate` : "Caută indicativ_an"}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
      />
      {selected.length > 0 ? (
        <div className="flex flex-wrap gap-1">
          {selected.map((value) => (
            <button
              key={value}
              type="button"
              className="rounded border border-gridline bg-slate-50 px-1.5 py-0.5 text-[11px] font-semibold text-ink"
              onClick={() => remove(value)}
            >
              {value} ×
            </button>
          ))}
        </div>
      ) : null}
      {open ? (
        <div className="absolute left-0 top-full z-30 mt-1 max-h-72 w-full overflow-auto rounded-md border border-gridline bg-white p-2 shadow-lg">
          {filteredOptions.length > 0 ? (
            filteredOptions.map((option) => (
              <label key={option.id} className="flex cursor-pointer items-start gap-2 rounded px-2 py-1.5 text-sm hover:bg-slate-50">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={selected.includes(option.value)}
                  onChange={() => toggle(option.value)}
                />
                <span className="leading-5 text-ink">{option.label}</span>
              </label>
            ))
          ) : (
            <p className="px-2 py-1.5 text-sm text-slate-500">Nu există indicative potrivite.</p>
          )}
        </div>
      ) : null}
    </div>
  );
}
