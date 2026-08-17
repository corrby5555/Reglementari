export function stripDiacritics(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function normalizeFileDescription(value: string) {
  return stripDiacritics(value)
    .toLocaleLowerCase("ro-RO")
    .replace(/[^a-z0-9_\s]+/g, "")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}
