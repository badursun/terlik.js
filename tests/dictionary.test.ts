import { describe, it, expect } from "vitest";
import trData from "../src/lang/tr/dictionary.json";
import { validateDictionary } from "../src/dictionary/schema.js";

describe("dictionary JSON schema", () => {
  it("validates the actual tr.json without errors", () => {
    expect(() => validateDictionary(trData)).not.toThrow();
  });

  it("has a valid version", () => {
    expect(trData.version).toBeGreaterThanOrEqual(1);
  });

  it("has entries array", () => {
    expect(Array.isArray(trData.entries)).toBe(true);
    expect(trData.entries.length).toBeGreaterThan(0);
  });

  it("has whitelist array", () => {
    expect(Array.isArray(trData.whitelist)).toBe(true);
    expect(trData.whitelist.length).toBeGreaterThan(0);
  });

  it("has suffixes array", () => {
    expect(Array.isArray(trData.suffixes)).toBe(true);
  });

  describe("entries", () => {
    it("every entry has a non-empty root", () => {
      for (const entry of trData.entries) {
        expect(entry.root.length).toBeGreaterThan(0);
      }
    });

    it("no duplicate roots", () => {
      const roots = trData.entries.map((e) => e.root.toLowerCase());
      const unique = new Set(roots);
      expect(roots.length).toBe(unique.size);
    });

    it("every entry has valid severity", () => {
      const valid = ["high", "medium", "low"];
      for (const entry of trData.entries) {
        expect(valid).toContain(entry.severity);
      }
    });

    it("every entry has valid category", () => {
      const valid = ["sexual", "insult", "slur", "general"];
      for (const entry of trData.entries) {
        expect(valid).toContain(entry.category);
      }
    });

    it("every entry has boolean suffixable", () => {
      for (const entry of trData.entries) {
        expect(typeof entry.suffixable).toBe("boolean");
      }
    });

    it("every entry has variants array", () => {
      for (const entry of trData.entries) {
        expect(Array.isArray(entry.variants)).toBe(true);
      }
    });
  });

  describe("whitelist integrity", () => {
    it("contains known safe words", () => {
      const wl = new Set(trData.whitelist.map((w) => w.toLowerCase()));
      expect(wl.has("amsterdam")).toBe(true);
      expect(wl.has("sikke")).toBe(true);
      expect(wl.has("bokser")).toBe(true);
      expect(wl.has("malzeme")).toBe(true);
      expect(wl.has("memur")).toBe(true);
    });
  });
});

describe("validateDictionary rejection", () => {
  it("rejects null", () => {
    expect(() => validateDictionary(null)).toThrow();
  });

  it("rejects missing version", () => {
    expect(() =>
      validateDictionary({ suffixes: [], entries: [], whitelist: [] }),
    ).toThrow(/version/);
  });

  it("rejects duplicate roots", () => {
    expect(() =>
      validateDictionary({
        version: 1,
        suffixes: [],
        entries: [
          { root: "test", variants: [], severity: "high", category: "general", suffixable: false },
          { root: "test", variants: [], severity: "low", category: "insult", suffixable: false },
        ],
        whitelist: [],
      }),
    ).toThrow(/duplicate root/);
  });

  it("rejects invalid severity", () => {
    expect(() =>
      validateDictionary({
        version: 1,
        suffixes: [],
        entries: [
          { root: "test", variants: [], severity: "extreme", category: "general", suffixable: false },
        ],
        whitelist: [],
      }),
    ).toThrow(/severity/);
  });

  it("rejects invalid category", () => {
    expect(() =>
      validateDictionary({
        version: 1,
        suffixes: [],
        entries: [
          { root: "test", variants: [], severity: "high", category: "unknown", suffixable: false },
        ],
        whitelist: [],
      }),
    ).toThrow(/category/);
  });

  it("rejects empty root", () => {
    expect(() =>
      validateDictionary({
        version: 1,
        suffixes: [],
        entries: [
          { root: "", variants: [], severity: "high", category: "general", suffixable: false },
        ],
        whitelist: [],
      }),
    ).toThrow(/root/);
  });

  it("rejects invalid suffix format", () => {
    expect(() =>
      validateDictionary({
        version: 1,
        suffixes: ["ABC"],
        entries: [],
        whitelist: [],
      }),
    ).toThrow(/suffix/i);
  });

  it("rejects suffix longer than 10 chars", () => {
    expect(() =>
      validateDictionary({
        version: 1,
        suffixes: ["abcdefghijk"],
        entries: [],
        whitelist: [],
      }),
    ).toThrow(/suffix/i);
  });

  it("rejects too many suffixes", () => {
    const suffixes = Array.from({ length: 151 }, (_, i) => `suf${String.fromCharCode(97 + (i % 26))}${String.fromCharCode(97 + Math.floor(i / 26))}`);
    expect(() =>
      validateDictionary({
        version: 1,
        suffixes,
        entries: [],
        whitelist: [],
      }),
    ).toThrow(/maximum/);
  });

  it("rejects empty whitelist entry", () => {
    expect(() =>
      validateDictionary({
        version: 1,
        suffixes: [],
        entries: [],
        whitelist: ["valid", ""],
      }),
    ).toThrow(/empty/);
  });

  it("rejects duplicate whitelist entry", () => {
    expect(() =>
      validateDictionary({
        version: 1,
        suffixes: [],
        entries: [],
        whitelist: ["word", "word"],
      }),
    ).toThrow(/duplicate/);
  });
});
