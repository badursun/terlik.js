import { describe, it, expect } from "vitest";
import { Detector } from "../src/detector.js";
import { Dictionary } from "../src/dictionary/index.js";
import { config as trConfig } from "../src/lang/tr/config.js";
import { createNormalizer } from "../src/normalizer.js";

describe("detector", () => {
  const normalizeFn = createNormalizer({
    locale: trConfig.locale,
    charMap: trConfig.charMap,
    leetMap: trConfig.leetMap,
    numberExpansions: trConfig.numberExpansions,
  });
  const dictionary = new Dictionary(trConfig.dictionary);
  const detector = new Detector(dictionary, normalizeFn, trConfig.locale, trConfig.charClasses);

  describe("pattern mode (balanced)", () => {
    it("detects plain profanity", () => {
      const results = detector.detect("bu adam siktir olsun", { mode: "balanced" });
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].root).toBe("sik");
    });

    it("detects leet speak", () => {
      const results = detector.detect("$1kt1r lan", { mode: "balanced" });
      expect(results.length).toBeGreaterThan(0);
    });

    it("detects with separators", () => {
      const results = detector.detect("s.i.k.t.i.r", { mode: "balanced" });
      expect(results.length).toBeGreaterThan(0);
    });

    it("detects with repeated characters", () => {
      const results = detector.detect("siiiktir", { mode: "balanced" });
      expect(results.length).toBeGreaterThan(0);
    });

    it("respects whitelist - sikke should not match", () => {
      const results = detector.detect("osmanlı sikke koleksiyonu", { mode: "balanced" });
      const sikkeFalsePositive = results.some(
        (r) => r.word.toLowerCase() === "sikke"
      );
      expect(sikkeFalsePositive).toBe(false);
    });

    it("detects orospu", () => {
      const results = detector.detect("orospu cocugu", { mode: "balanced" });
      expect(results.length).toBeGreaterThan(0);
      expect(results.some((r) => r.root === "orospu")).toBe(true);
    });

    it("returns empty for clean text", () => {
      const results = detector.detect("merhaba dunya nasilsin", { mode: "balanced" });
      expect(results.length).toBe(0);
    });
  });

  describe("strict mode", () => {
    it("detects exact matches after normalization", () => {
      const results = detector.detect("siktir git", { mode: "strict" });
      expect(results.length).toBeGreaterThan(0);
    });

    it("does not detect separated chars in strict mode", () => {
      const results = detector.detect("s i k t i r", { mode: "strict" });
      // In strict mode, each word is checked individually, "s" "i" "k" etc. won't match
      expect(results.length).toBe(0);
    });
  });

  describe("loose mode (with fuzzy)", () => {
    it("detects fuzzy matches", () => {
      const results = detector.detect("siktiir", {
        mode: "loose",
        enableFuzzy: true,
        fuzzyThreshold: 0.7,
      });
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe("getPatterns", () => {
    it("returns compiled patterns map", () => {
      const patterns = detector.getPatterns();
      expect(patterns).toBeInstanceOf(Map);
      expect(patterns.size).toBeGreaterThan(0);
      expect(patterns.has("sik")).toBe(true);
    });
  });
});
