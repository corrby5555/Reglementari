export type AccessLevel = "read" | "write";
type HeaderReader = Pick<Headers, "get">;

function parseList(value: string | undefined) {
  return (value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeIp(value: string) {
  const trimmed = value.trim();
  if (trimmed.startsWith("::ffff:")) return trimmed.slice(7);
  if (trimmed === "::1") return "127.0.0.1";
  return trimmed;
}

export function getClientIp(headers: HeaderReader) {
  const forwardedFor = headers.get("x-forwarded-for") || "";
  const firstForwardedIp = forwardedFor.split(",")[0]?.trim();
  const candidate =
    headers.get("x-reglementari-client-ip") ||
    firstForwardedIp ||
    headers.get("x-real-ip") ||
    headers.get("cf-connecting-ip") ||
    headers.get("x-client-ip") ||
    "";

  return normalizeIp(candidate);
}

function ipv4ToNumber(ip: string) {
  const parts = ip.split(".");
  if (parts.length !== 4) return null;

  let result = 0;
  for (const part of parts) {
    if (!/^\d+$/.test(part)) return null;
    const value = Number(part);
    if (value < 0 || value > 255) return null;
    result = (result * 256) + value;
  }

  return result >>> 0;
}

function matchesCidr(ip: string, cidr: string) {
  const [rangeIp, prefixText] = cidr.split("/");
  const prefix = Number(prefixText);
  const ipNumber = ipv4ToNumber(ip);
  const rangeNumber = ipv4ToNumber(rangeIp);

  if (ipNumber === null || rangeNumber === null || !Number.isInteger(prefix) || prefix < 0 || prefix > 32) {
    return false;
  }

  const mask = prefix === 0 ? 0 : (0xffffffff << (32 - prefix)) >>> 0;
  return (ipNumber & mask) === (rangeNumber & mask);
}

function ipMatchesRule(ip: string, rule: string) {
  const normalizedIp = normalizeIp(ip);
  const normalizedRule = normalizeIp(rule);
  if (normalizedRule === "*") return true;
  if (normalizedRule.includes("/")) return matchesCidr(normalizedIp, normalizedRule);
  return normalizedIp === normalizedRule;
}

function matchesAny(ip: string, rules: string[]) {
  return rules.some((rule) => ipMatchesRule(ip, rule));
}

export function accessForIp(ip: string): AccessLevel {
  const writeRules = parseList(process.env.REGLEMENTARI_WRITE_IPS);
  const readOnlyRules = parseList(process.env.REGLEMENTARI_READONLY_IPS);

  if (writeRules.length === 0 && readOnlyRules.length === 0) {
    return "write";
  }

  if (matchesAny(ip, writeRules)) {
    return "write";
  }

  return "read";
}

export function canWriteFromHeaders(headers: HeaderReader) {
  return accessForIp(getClientIp(headers)) === "write";
}

export function forbiddenWriteResponse() {
  return Response.json(
    { error: "Acces doar pentru citire. Calculatorul curent nu are drept de modificare." },
    { status: 403 },
  );
}
