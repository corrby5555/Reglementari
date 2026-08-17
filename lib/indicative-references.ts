export function regulationReference(indicativ: string, an: number | string) {
  return `${indicativ.trim()}_${String(an).trim()}`;
}

export function parseIndicativeReferences(value: unknown) {
  if (Array.isArray(value)) {
    return normalizeReferences(value);
  }

  if (typeof value !== "string") {
    return [];
  }

  return normalizeReferences(value.split(/\r?\n|;|,/));
}

export function serializeIndicativeReferences(value: unknown) {
  return parseIndicativeReferences(value).join("\n");
}

export function normalizeReferences(values: unknown[]) {
  const seen = new Set<string>();
  const references: string[] = [];

  for (const item of values) {
    const value = normalizeReference(String(item ?? ""));
    if (!value || seen.has(value)) {
      continue;
    }

    seen.add(value);
    references.push(value);
  }

  return references;
}

function normalizeReference(value: string) {
  const trimmed = value.trim();
  const slashMatch = trimmed.match(/^(.+?)\s*\/\s*(\d{4})$/);
  if (slashMatch) {
    return regulationReference(slashMatch[1], slashMatch[2]);
  }

  const underscoreMatch = trimmed.match(/^(.+?)\s*_\s*(\d{4})$/);
  if (underscoreMatch) {
    return regulationReference(underscoreMatch[1], underscoreMatch[2]);
  }

  return trimmed;
}
