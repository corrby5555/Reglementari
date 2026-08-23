import { describe, expect, it } from "vitest";
import { getLocalDateKey, snapshotsMatch, type DatabaseSnapshot } from "../lib/backup-protection";

function snapshot(overrides: Partial<DatabaseSnapshot> = {}): DatabaseSnapshot {
  return {
    capturedAt: "2026-08-23T10:00:00.000Z",
    database: "reglementari",
    table: "reglementari",
    rowCount: 100,
    maxId: 105,
    checksum: "abc",
    ...overrides,
  };
}

describe("database backup protection", () => {
  it("acceptă două amprente identice", () => {
    expect(snapshotsMatch(snapshot(), snapshot({ capturedAt: "2026-08-24T10:00:00.000Z" }))).toBe(true);
  });

  it("detectează orice diferență de conținut", () => {
    expect(snapshotsMatch(snapshot(), snapshot({ checksum: "def" }))).toBe(false);
  });

  it("detectează dispariția unei reglementări", () => {
    expect(snapshotsMatch(snapshot(), snapshot({ rowCount: 99, maxId: 104, checksum: "def" }))).toBe(false);
  });

  it("folosește ziua din fusul Europe/Bucharest", () => {
    const previous = process.env.APP_TIME_ZONE;
    process.env.APP_TIME_ZONE = "Europe/Bucharest";
    expect(getLocalDateKey(new Date("2026-08-22T21:30:00.000Z"))).toBe("2026-08-23");
    process.env.APP_TIME_ZONE = previous;
  });
});
