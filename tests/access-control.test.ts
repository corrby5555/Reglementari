import { afterEach, describe, expect, it } from "vitest";
import { accessForIp, getClientIp } from "../lib/access-control";

describe("control acces dupa IP", () => {
  const oldWriteIps = process.env.REGLEMENTARI_WRITE_IPS;
  const oldReadOnlyIps = process.env.REGLEMENTARI_READONLY_IPS;

  afterEach(() => {
    process.env.REGLEMENTARI_WRITE_IPS = oldWriteIps;
    process.env.REGLEMENTARI_READONLY_IPS = oldReadOnlyIps;
  });

  it("permite scrierea implicit cand nu exista reguli configurate", () => {
    delete process.env.REGLEMENTARI_WRITE_IPS;
    delete process.env.REGLEMENTARI_READONLY_IPS;

    expect(accessForIp("10.0.0.44")).toBe("write");
  });

  it("permite scriere pentru IP exact configurat", () => {
    process.env.REGLEMENTARI_WRITE_IPS = "10.0.0.12";
    process.env.REGLEMENTARI_READONLY_IPS = "10.0.0.0/24";

    expect(accessForIp("10.0.0.12")).toBe("write");
    expect(accessForIp("10.0.0.13")).toBe("read");
  });

  it("permite scriere pentru subnet CIDR configurat", () => {
    process.env.REGLEMENTARI_WRITE_IPS = "10.8.0.0/24";
    process.env.REGLEMENTARI_READONLY_IPS = "10.0.0.0/24";

    expect(accessForIp("10.8.0.21")).toBe("write");
    expect(accessForIp("10.9.0.21")).toBe("read");
  });

  it("citeste primul IP din x-forwarded-for", () => {
    const headers = new Headers({ "x-forwarded-for": "10.8.0.21, 10.0.0.245" });

    expect(getClientIp(headers)).toBe("10.8.0.21");
  });
});
