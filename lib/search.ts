import type { Reglementare } from "@prisma/client";

export function stripDiacritics(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

export function normalizeSearchText(value: string) {
  return stripDiacritics(value)
    .toLowerCase()
    .replace(/[._/\\-]+/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function compactSearchText(value: string) {
  return normalizeSearchText(value).replace(/\s+/g, "");
}

function searchTokens(value: string) {
  return normalizeSearchText(value).split(" ").filter(Boolean);
}

function singularizeLooseRomanian(value: string) {
  return value
    .replace(/urilor$/g, "")
    .replace(/elor$/g, "")
    .replace(/ilor$/g, "")
    .replace(/ului$/g, "")
    .replace(/uri$/g, "")
    .replace(/[aei]$/g, "");
}

function damerauLevenshtein(left: string, right: string) {
  const rows = left.length + 1;
  const columns = right.length + 1;
  const distances = Array.from({ length: rows }, () => Array(columns).fill(0));

  for (let row = 0; row < rows; row += 1) distances[row][0] = row;
  for (let column = 0; column < columns; column += 1) distances[0][column] = column;

  for (let row = 1; row < rows; row += 1) {
    for (let column = 1; column < columns; column += 1) {
      const cost = left[row - 1] === right[column - 1] ? 0 : 1;
      distances[row][column] = Math.min(
        distances[row - 1][column] + 1,
        distances[row][column - 1] + 1,
        distances[row - 1][column - 1] + cost,
      );

      if (row > 1 && column > 1 && left[row - 1] === right[column - 2] && left[row - 2] === right[column - 1]) {
        distances[row][column] = Math.min(distances[row][column], distances[row - 2][column - 2] + 1);
      }
    }
  }

  return distances[left.length][right.length];
}

function tokenMatches(queryToken: string, targetToken: string) {
  if (targetToken.includes(queryToken) || queryToken.includes(targetToken)) return true;

  const queryStem = singularizeLooseRomanian(queryToken);
  const targetStem = singularizeLooseRomanian(targetToken);
  if (queryStem.length >= 3 && targetStem.length >= 3 && (targetStem.includes(queryStem) || queryStem.includes(targetStem))) return true;

  if (queryToken.length < 4 || targetToken.length < 4) return false;

  const maxDistance = Math.min(queryToken.length, targetToken.length) <= 5 ? 2 : 3;
  return damerauLevenshtein(queryToken, targetToken) <= maxDistance;
}

function searchableText(row: Reglementare) {
  return [
    row.indicativ,
    `${row.indicativ} ${row.an}`,
    `${row.indicativ}/${row.an}`,
    row.denumireExacta,
    row.descriere,
    row.tipCladire,
  ].join(" ");
}

export function strictSearchScore(row: Reglementare, query: string) {
  const queryText = normalizeSearchText(query);
  if (!queryText) return 0;

  const compactQuery = compactSearchText(query);
  const compactIndicativ = compactSearchText(row.indicativ);
  const compactIndicativWithYear = compactSearchText(`${row.indicativ}${row.an}`);
  if (compactQuery && compactIndicativ === compactQuery) return 1000;
  if (compactQuery && compactIndicativWithYear === compactQuery) return 990;
  if (compactQuery && compactIndicativ.startsWith(compactQuery)) return 920;
  if (compactQuery && compactIndicativ.includes(compactQuery)) return 900;
  if (compactQuery && compactIndicativWithYear.includes(compactQuery)) return 880;

  const normalizedTitle = normalizeSearchText(row.denumireExacta);
  if (normalizedTitle.includes(queryText)) return normalizedTitle.startsWith(queryText) ? 760 : 720;

  const normalizedKeywords = normalizeSearchText(row.tipCladire);
  if (normalizedKeywords.includes(queryText)) return 680;

  const normalizedDescription = normalizeSearchText(row.descriere);
  if (normalizedDescription.includes(queryText)) return 620;

  const queryTokens = searchTokens(queryText);
  const targetTokens = searchTokens(searchableText(row));
  if (queryTokens.length > 0 && queryTokens.every((queryToken) => targetTokens.some((targetToken) => targetToken.includes(queryToken)))) {
    return 560;
  }

  return null;
}

export function permissiveSearchScore(row: Reglementare, query: string) {
  const strictScore = strictSearchScore(row, query);
  if (strictScore !== null) return strictScore;

  const queryTokens = searchTokens(query);
  if (queryTokens.length === 0) return 0;

  const targetTokens = searchTokens(searchableText(row));
  if (queryTokens.every((queryToken) => targetTokens.some((targetToken) => tokenMatches(queryToken, targetToken)))) {
    return 420;
  }

  return null;
}

export function searchScore(row: Reglementare, query: string, wideSearch = false) {
  return wideSearch ? permissiveSearchScore(row, query) : strictSearchScore(row, query);
}

export function matchesPermissiveSearch(row: Reglementare, query: string) {
  return permissiveSearchScore(row, query) !== null;
}
