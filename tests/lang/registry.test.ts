import { describe, it, expect } from "vitest";
import { getLanguageConfig, getSupportedLanguages } from "../../src/lang/index.js";

describe("language registry", () => {
  it("returns config for all supported languages", () => {
    for (const lang of getSupportedLanguages()) {
      const config = getLanguageConfig(lang);
      expect(config.locale).toBe(lang);
      expect(config.charMap).toBeDefined();
      expect(config.leetMap).toBeDefined();
      expect(config.charClasses).toBeDefined();
      expect(config.dictionary).toBeDefined();
      expect(config.dictionary.entries.length).toBeGreaterThan(0);
      expect(config.dictionary.version).toBeGreaterThanOrEqual(1);
    }
  });

  it("throws for unsupported language", () => {
    expect(() => getLanguageConfig("xx")).toThrow(/Unsupported language/);
  });

  it("error message lists available languages", () => {
    expect(() => getLanguageConfig("xx")).toThrow(/tr/);
  });

  it("getSupportedLanguages returns all 4", () => {
    const langs = getSupportedLanguages();
    expect(langs).toContain("tr");
    expect(langs).toContain("en");
    expect(langs).toContain("es");
    expect(langs).toContain("de");
    expect(langs.length).toBe(4);
  });

  it("each config has valid charClasses with a-z keys", () => {
    for (const lang of getSupportedLanguages()) {
      const config = getLanguageConfig(lang);
      // At minimum, should have common letters
      expect(config.charClasses["a"]).toBeDefined();
      expect(config.charClasses["s"]).toBeDefined();
      expect(config.charClasses["t"]).toBeDefined();
    }
  });

  it("Turkish config has numberExpansions", () => {
    const config = getLanguageConfig("tr");
    expect(config.numberExpansions).toBeDefined();
    expect(config.numberExpansions!.length).toBeGreaterThan(0);
  });

  it("English config has no numberExpansions", () => {
    const config = getLanguageConfig("en");
    expect(config.numberExpansions).toBeUndefined();
  });
});
