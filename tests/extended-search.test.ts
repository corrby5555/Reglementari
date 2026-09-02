import { describe, expect, it } from "vitest";
import {
  countExtendedSearchOccurrences,
  normalizeExtendedSearchText,
  parseExtendedSearchKeywords,
} from "../lib/extended-search";

describe("căutarea extinsă", () => {
  it("separă și elimină duplicatele indiferent de diacritice", () => {
    expect(parseExtendedSearchKeywords("incendiu, evacuare\nÎNCENDIU; hidranți")).toEqual([
      "incendiu",
      "evacuare",
      "hidranți",
    ]);
  });

  it("normalizează majusculele, diacriticele și spațiile", () => {
    expect(normalizeExtendedSearchText("  Căi   de evacuare! ")).toBe("cai de evacuare");
  });

  it("numără cuvinte și expresii complete", () => {
    const text = normalizeExtendedSearchText("Evacuare și căi de evacuare. Planul de evacuare nu descrie evacuarea fumului.");
    expect(countExtendedSearchOccurrences(text, "evacuare")).toBe(3);
    expect(countExtendedSearchOccurrences(text, "căi de evacuare")).toBe(1);
  });
});
