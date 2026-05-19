import { describe, it, expect, afterEach } from "vitest";
import {
  scrubString,
  scrubValue,
  scrubEnabled,
} from "../src/shared/scrubber.js";

describe("scrubber", () => {
  it("redacts 64-hex private key with 0x prefix", () => {
    const s =
      "secret 0xabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdef1234 end";
    expect(scrubString(s)).toContain("REDACTED:private-key");
    expect(scrubString(s)).not.toContain("0xabcdef");
  });

  it("redacts xprv extended keys", () => {
    const s =
      "xprv9s21ZrQH143K2dGzfgEksjcfHkkAaP3a4Z6KFehWHpkjUQjV2NunqfeFkCKkF1XLcLg7uVTBJVjL6sJSiQ5Q3yMrxe44gMJa2gZuY5cn6Wfsdfafsfaasdfasfasdfasdfasdfsadfasdfasdfasdsdfasdfasdfasdfafasfsafdsa";
    expect(scrubString(s)).toContain("REDACTED:extended-key");
  });

  it("redacts 12-word mnemonic", () => {
    const m =
      "abandon ability able about above absent absorb abstract absurd abuse access accident";
    const out = scrubString(`mnemonic was ${m} keep`);
    expect(out).toContain("REDACTED:mnemonic");
  });

  it("does not redact a 5-word sentence", () => {
    const s = "this is just a sentence";
    expect(scrubString(s)).toBe(s);
  });

  it("redacts secret-named keys in objects", () => {
    const v = {
      user: "u",
      apiKey: "abc123",
      privateKey: "deadbeef",
      nested: { secret: "z" },
    };
    const out = scrubValue(v) as Record<string, unknown>;
    expect(out.user).toBe("u");
    expect(out.apiKey).toMatch(/REDACTED/);
    expect(out.privateKey).toMatch(/REDACTED/);
    expect((out.nested as Record<string, unknown>).secret).toMatch(/REDACTED/);
  });

  it("walks arrays", () => {
    const v = [
      "0xabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdef1234",
      "ok",
    ];
    const out = scrubValue(v) as string[];
    expect(out[0]).toMatch(/REDACTED:private-key/);
    expect(out[1]).toBe("ok");
  });

  it("preserves null and undefined", () => {
    expect(scrubValue(null)).toBe(null);
    expect(scrubValue(undefined)).toBe(undefined);
  });

  it("does not mutate the input", () => {
    const v = { apiKey: "abc", nested: { secret: "x" } };
    const snapshot = JSON.parse(JSON.stringify(v));
    scrubValue(v);
    expect(v).toEqual(snapshot);
  });

  describe("ODB_SCRUB env", () => {
    const original = process.env.ODB_SCRUB;
    afterEach(() => {
      if (original === undefined) delete process.env.ODB_SCRUB;
      else process.env.ODB_SCRUB = original;
    });

    it("is enabled by default", () => {
      delete process.env.ODB_SCRUB;
      expect(scrubEnabled()).toBe(true);
    });

    it("is disabled when ODB_SCRUB=0", () => {
      process.env.ODB_SCRUB = "0";
      expect(scrubEnabled()).toBe(false);
    });

    it("remains enabled for any other value", () => {
      process.env.ODB_SCRUB = "1";
      expect(scrubEnabled()).toBe(true);
    });
  });
});
