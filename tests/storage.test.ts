import { describe, expect, it } from "vitest";
import { normalizeFileDescription } from "../lib/file-name-description";
import { generateBaseFileName, resolveStoragePath, slugifyFilePart, toStorageRelativePath } from "../lib/storage";

describe("file naming", () => {
  it("removes diacritics and unsafe characters", () => {
    expect(slugifyFilePart("Normativ pentru proiectarea instalațiilor sanitare")).toBe(
      "Normativ_pentru_proiectarea_instalatiilor_sanitare",
    );
  });

  it("generates the internal file name", () => {
    expect(
      generateBaseFileName(
        {
          indicativ: "I.9",
          an: 2022,
          descriereNumeFisier: "Normativ instalații sanitare",
          descriere: "Normativ pentru proiectarea instalațiilor",
          denumireExacta: "Normativ",
        },
        "PDF",
      ),
    ).toBe("I.9_2022@Normativ_instalatii_sanitare.pdf");
  });

  it("normalizes the file description field", () => {
    expect(normalizeFileDescription("Normativ instalații_2026 + test!")).toBe("normativ_instalatii_2026_test");
  });

  it("converts known mounted storage paths to relative paths", () => {
    expect(toStorageRelativePath("/Volumes/Documentatie/Reglementari/general/general/test.pdf")).toBe(
      "Reglementari/general/general/test.pdf",
    );
    expect(toStorageRelativePath("/mnt/reglementari-storage/Informatie/instalatii/test.pdf")).toBe("Informatie/instalatii/test.pdf");
  });

  it("resolves relative storage paths against the configured root", () => {
    process.env.REGLEMENTARI_STORAGE_DIR = "/tmp/reglementari-storage";
    expect(resolveStoragePath("Reglementari/general/general/test.pdf")).toBe(
      "/tmp/reglementari-storage/Reglementari/general/general/test.pdf",
    );
  });
});
