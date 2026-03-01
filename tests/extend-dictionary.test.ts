import { describe, it, expect } from "vitest";
import { Terlik } from "../src/terlik.js";
import { mergeDictionaries } from "../src/dictionary/schema.js";
import type { DictionaryData } from "../src/dictionary/schema.js";

const baseDict: DictionaryData = {
  version: 1,
  suffixes: ["ler", "lar"],
  entries: [
    { root: "kötü", variants: [], severity: "low", category: "insult", suffixable: true },
  ],
  whitelist: ["safeword"],
};

const extDict: DictionaryData = {
  version: 1,
  suffixes: ["ler", "ci"],
  entries: [
    { root: "badword", variants: ["b4dword"], severity: "high", category: "general", suffixable: false },
  ],
  whitelist: ["safeword", "anothersafe"],
};

describe("mergeDictionaries", () => {
  it("merges entries from extension", () => {
    const merged = mergeDictionaries(baseDict, extDict);
    const roots = merged.entries.map((e) => e.root);
    expect(roots).toContain("kötü");
    expect(roots).toContain("badword");
  });

  it("skips duplicate roots (case-insensitive)", () => {
    const ext: DictionaryData = {
      version: 1,
      suffixes: [],
      entries: [
        { root: "Kötü", variants: ["bad"], severity: "high", category: "insult", suffixable: false },
      ],
      whitelist: [],
    };
    const merged = mergeDictionaries(baseDict, ext);
    expect(merged.entries.filter((e) => e.root.toLowerCase() === "kötü")).toHaveLength(1);
  });

  it("unions suffixes (deduplicates)", () => {
    const merged = mergeDictionaries(baseDict, extDict);
    expect(merged.suffixes).toContain("ler");
    expect(merged.suffixes).toContain("lar");
    expect(merged.suffixes).toContain("ci");
    expect(merged.suffixes.filter((s) => s === "ler")).toHaveLength(1);
  });

  it("unions whitelist (deduplicates)", () => {
    const merged = mergeDictionaries(baseDict, extDict);
    expect(merged.whitelist).toContain("safeword");
    expect(merged.whitelist).toContain("anothersafe");
    expect(merged.whitelist.filter((w) => w === "safeword")).toHaveLength(1);
  });

  it("preserves base version", () => {
    const merged = mergeDictionaries(baseDict, extDict);
    expect(merged.version).toBe(baseDict.version);
  });
});

describe("extendDictionary option", () => {
  it("detects words from extended dictionary", () => {
    const terlik = new Terlik({
      extendDictionary: {
        version: 1,
        suffixes: [],
        entries: [
          { root: "customcurse", variants: [], severity: "high", category: "general", suffixable: false },
        ],
        whitelist: [],
      },
    });
    expect(terlik.containsProfanity("customcurse")).toBe(true);
  });

  it("still detects built-in words", () => {
    const terlik = new Terlik({
      extendDictionary: {
        version: 1,
        suffixes: [],
        entries: [
          { root: "customcurse", variants: [], severity: "high", category: "general", suffixable: false },
        ],
        whitelist: [],
      },
    });
    expect(terlik.containsProfanity("siktir")).toBe(true);
  });

  it("merges whitelist from extension", () => {
    const terlik = new Terlik({
      extendDictionary: {
        version: 1,
        suffixes: [],
        entries: [],
        whitelist: ["siklet"],
      },
    });
    // siklet is already in TR whitelist, should still be safe
    expect(terlik.containsProfanity("siklet")).toBe(false);
  });

  it("works with customList simultaneously", () => {
    const terlik = new Terlik({
      customList: ["extraword"],
      extendDictionary: {
        version: 1,
        suffixes: [],
        entries: [
          { root: "extcurse", variants: [], severity: "high", category: "general", suffixable: false },
        ],
        whitelist: [],
      },
    });
    expect(terlik.containsProfanity("extraword")).toBe(true);
    expect(terlik.containsProfanity("extcurse")).toBe(true);
    expect(terlik.containsProfanity("siktir")).toBe(true);
  });

  it("throws on invalid extendDictionary schema", () => {
    expect(() => new Terlik({
      extendDictionary: { version: -1, suffixes: [], entries: [], whitelist: [] } as unknown as DictionaryData,
    })).toThrow(/version/);
  });

  it("throws on invalid entry in extendDictionary", () => {
    expect(() => new Terlik({
      extendDictionary: {
        version: 1,
        suffixes: [],
        entries: [
          { root: "", variants: [], severity: "high", category: "general", suffixable: false },
        ],
        whitelist: [],
      },
    })).toThrow(/root/);
  });

  it("disables pattern cache (different instances get separate patterns)", () => {
    const a = new Terlik();
    a.containsProfanity("warmup"); // compile & cache
    const b = new Terlik({
      extendDictionary: {
        version: 1,
        suffixes: [],
        entries: [
          { root: "xyznotreal", variants: [], severity: "high", category: "general", suffixable: false },
        ],
        whitelist: [],
      },
    });
    // extended instance should detect its custom word
    expect(b.containsProfanity("xyznotreal")).toBe(true);
    // standard instance should NOT detect the extended word
    expect(a.containsProfanity("xyznotreal")).toBe(false);
  });

  it("detects variants from extended dictionary", () => {
    const terlik = new Terlik({
      extendDictionary: {
        version: 1,
        suffixes: [],
        entries: [
          { root: "testroot", variants: ["t3str00t"], severity: "high", category: "general", suffixable: false },
        ],
        whitelist: [],
      },
    });
    expect(terlik.containsProfanity("testroot")).toBe(true);
  });

  it("extended suffixes work for suffixable entries", () => {
    const terlik = new Terlik({
      extendDictionary: {
        version: 1,
        suffixes: ["ler", "lar"],
        entries: [
          { root: "extword", variants: [], severity: "high", category: "general", suffixable: true },
        ],
        whitelist: [],
      },
    });
    expect(terlik.containsProfanity("extword")).toBe(true);
    expect(terlik.containsProfanity("extwordler")).toBe(true);
  });
});
