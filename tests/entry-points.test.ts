import { describe, it, expect } from "vitest";

// Main entry — backward compatibility
import {
  Terlik as MainTerlik,
  TerlikCore,
  getLanguageConfig,
  getSupportedLanguages,
} from "../src/index.js";

// Per-language entries
import {
  Terlik as TerlikTR,
  languageConfig as trConfig,
  createTerlik as createTerlikTR,
  TerlikCore as TerlikCoreTR,
} from "../src/lang/tr/index.js";
import {
  Terlik as TerlikEN,
  languageConfig as enConfig,
  createTerlik as createTerlikEN,
} from "../src/lang/en/index.js";
import {
  Terlik as TerlikES,
  languageConfig as esConfig,
  createTerlik as createTerlikES,
} from "../src/lang/es/index.js";
import {
  Terlik as TerlikDE,
  languageConfig as deConfig,
  createTerlik as createTerlikDE,
} from "../src/lang/de/index.js";

describe("Per-language entry points", () => {
  describe("Turkish (terlik.js/tr)", () => {
    it("detects Turkish profanity", () => {
      const t = new TerlikTR();
      expect(t.containsProfanity("siktir")).toBe(true);
      expect(t.containsProfanity("merhaba")).toBe(false);
    });

    it("cleans Turkish profanity", () => {
      const t = new TerlikTR();
      const cleaned = t.clean("siktir git");
      expect(cleaned).not.toBe("siktir git");
      expect(cleaned).toContain("git");
    });

    it("reports language as tr", () => {
      const t = new TerlikTR();
      expect(t.language).toBe("tr");
    });

    it("exports languageConfig with correct locale", () => {
      expect(trConfig).toBeDefined();
      expect(trConfig.locale).toBe("tr");
      expect(trConfig.dictionary).toBeDefined();
    });

    it("createTerlik factory works", () => {
      const t = createTerlikTR();
      expect(t.containsProfanity("siktir")).toBe(true);
      expect(t.language).toBe("tr");
    });

    it("re-exports TerlikCore", () => {
      expect(TerlikCoreTR).toBe(TerlikCore);
    });

    it("accepts options like mode and maskStyle", () => {
      const t = new TerlikTR({ mode: "strict", maskStyle: "replace", replaceMask: "[KÜFÜR]" });
      expect(t.clean("siktir git")).toContain("[KÜFÜR]");
    });
  });

  describe("English (terlik.js/en)", () => {
    it("detects English profanity", () => {
      const t = new TerlikEN();
      expect(t.containsProfanity("fuck")).toBe(true);
      expect(t.containsProfanity("hello")).toBe(false);
    });

    it("reports language as en", () => {
      const t = new TerlikEN();
      expect(t.language).toBe("en");
    });

    it("exports languageConfig with correct locale", () => {
      expect(enConfig.locale).toBe("en");
    });

    it("createTerlik factory works", () => {
      const t = createTerlikEN();
      expect(t.containsProfanity("fuck")).toBe(true);
    });
  });

  describe("Spanish (terlik.js/es)", () => {
    it("detects Spanish profanity", () => {
      const t = new TerlikES();
      expect(t.containsProfanity("mierda")).toBe(true);
      expect(t.containsProfanity("hola")).toBe(false);
    });

    it("reports language as es", () => {
      const t = new TerlikES();
      expect(t.language).toBe("es");
    });

    it("exports languageConfig with correct locale", () => {
      expect(esConfig.locale).toBe("es");
    });

    it("createTerlik factory works", () => {
      const t = createTerlikES();
      expect(t.containsProfanity("mierda")).toBe(true);
    });
  });

  describe("German (terlik.js/de)", () => {
    it("detects German profanity", () => {
      const t = new TerlikDE();
      expect(t.containsProfanity("scheiße")).toBe(true);
      expect(t.containsProfanity("hallo")).toBe(false);
    });

    it("reports language as de", () => {
      const t = new TerlikDE();
      expect(t.language).toBe("de");
    });

    it("exports languageConfig with correct locale", () => {
      expect(deConfig.locale).toBe("de");
    });

    it("createTerlik factory works", () => {
      const t = createTerlikDE();
      expect(t.containsProfanity("scheiße")).toBe(true);
    });
  });
});

describe("Main entry backward compatibility", () => {
  it("Terlik from main entry still works with all languages", () => {
    const tr = new MainTerlik({ language: "tr" });
    expect(tr.containsProfanity("siktir")).toBe(true);

    const en = new MainTerlik({ language: "en" });
    expect(en.containsProfanity("fuck")).toBe(true);

    const es = new MainTerlik({ language: "es" });
    expect(es.containsProfanity("mierda")).toBe(true);

    const de = new MainTerlik({ language: "de" });
    expect(de.containsProfanity("scheiße")).toBe(true);
  });

  it("Terlik defaults to Turkish", () => {
    const t = new MainTerlik();
    expect(t.language).toBe("tr");
    expect(t.containsProfanity("siktir")).toBe(true);
  });

  it("warmup() still works", () => {
    const map = MainTerlik.warmup(["tr", "en"]);
    expect(map.size).toBe(2);
    expect(map.get("tr")!.containsProfanity("siktir")).toBe(true);
    expect(map.get("en")!.containsProfanity("fuck")).toBe(true);
  });

  it("getSupportedLanguages returns all 4", () => {
    expect(getSupportedLanguages()).toEqual(
      expect.arrayContaining(["tr", "en", "es", "de"]),
    );
  });

  it("getLanguageConfig works", () => {
    const cfg = getLanguageConfig("tr");
    expect(cfg.locale).toBe("tr");
  });

  it("throws for unsupported language", () => {
    expect(() => new MainTerlik({ language: "xx" })).toThrow(/Unsupported language/);
  });
});

describe("TerlikCore export", () => {
  it("TerlikCore is exported from main entry", () => {
    expect(TerlikCore).toBeDefined();
    expect(typeof TerlikCore).toBe("function");
  });

  it("TerlikCore can be used with manual languageConfig", () => {
    const config = getLanguageConfig("en");
    const t = new TerlikCore(config);
    expect(t.language).toBe("en");
    expect(t.containsProfanity("fuck")).toBe(true);
  });

  it("per-language Terlik extends TerlikCore", () => {
    const t = new TerlikTR();
    expect(t).toBeInstanceOf(TerlikCore);
  });

  it("main Terlik extends TerlikCore", () => {
    const t = new MainTerlik();
    expect(t).toBeInstanceOf(TerlikCore);
  });
});
