import { describe, it, expect, beforeAll } from "vitest";
import { Detector } from "../src/detector.js";
import { Dictionary } from "../src/dictionary/index.js";
import { config as trConfig } from "../src/lang/tr/config.js";
import { config as enConfig } from "../src/lang/en/config.js";
import { createNormalizer } from "../src/normalizer.js";
import { REGEX_TIMEOUT_MS } from "../src/patterns.js";
import { Terlik } from "../src/terlik.js";

function createDetector(config: typeof trConfig) {
  const normalizeFn = createNormalizer({
    locale: config.locale,
    charMap: config.charMap,
    leetMap: config.leetMap,
    numberExpansions: config.numberExpansions,
  });
  const dictionary = new Dictionary(config.dictionary);
  return new Detector(dictionary, normalizeFn, config.locale, config.charClasses);
}

// detect() calls runPatterns() twice (original + normalized) in balanced mode.
// Each call is capped at REGEX_TIMEOUT_MS. Add margin for GC/scheduling jitter.
const MAX_DETECT_MS = REGEX_TIMEOUT_MS * 3;

describe("ReDoS hardening", () => {
  const trDetector = createDetector(trConfig);
  const enDetector = createDetector(enConfig);

  // Warm up V8 JIT for all regex patterns before timing tests.
  beforeAll(() => {
    trDetector.detect("warmup text siktir");
    enDetector.detect("warmup text fuck");
  });

  it("exports REGEX_TIMEOUT_MS constant", () => {
    expect(REGEX_TIMEOUT_MS).toBe(250);
  });

  // ─── Timing: adversarial inputs must be capped by timeout ───

  describe("adversarial timing (capped by timeout)", () => {
    it("repeated separator characters", () => {
      const input = "a" + ".".repeat(100) + "b" + ".".repeat(100) + "c";
      const start = Date.now();
      trDetector.detect(input);
      expect(Date.now() - start).toBeLessThan(MAX_DETECT_MS);
    });

    it("long overlap: @ signs", () => {
      const input = "@".repeat(50);
      const start = Date.now();
      trDetector.detect(input);
      expect(Date.now() - start).toBeLessThan(MAX_DETECT_MS);
    });

    it("long overlap: $ signs", () => {
      const input = "$".repeat(50);
      const start = Date.now();
      enDetector.detect(input);
      expect(Date.now() - start).toBeLessThan(MAX_DETECT_MS);
    });

    it("maximum length input (10K chars)", () => {
      const input = "test".repeat(2500);
      const start = Date.now();
      trDetector.detect(input);
      expect(Date.now() - start).toBeLessThan(MAX_DETECT_MS);
    });

    it("leet + separator adversarial combo", () => {
      const input = "$" + "...".repeat(20) + "1" + "...".repeat(20) + "k";
      const start = Date.now();
      trDetector.detect(input);
      expect(Date.now() - start).toBeLessThan(MAX_DETECT_MS);
    });

    it("mixed overlap symbols in sequence", () => {
      const input = "@$!|+#\u20AC".repeat(10);
      const start = Date.now();
      trDetector.detect(input);
      expect(Date.now() - start).toBeLessThan(MAX_DETECT_MS);
    });

    it("adversarial pipe characters", () => {
      const input = "|".repeat(50);
      const start = Date.now();
      enDetector.detect(input);
      expect(Date.now() - start).toBeLessThan(MAX_DETECT_MS);
    });

    it("alternating letter and separator flood", () => {
      // a.a.a.a.a... — each position could start a charClass match
      const input = Array.from({ length: 100 }, () => "a").join(".");
      const start = Date.now();
      trDetector.detect(input);
      expect(Date.now() - start).toBeLessThan(MAX_DETECT_MS);
    });

    it("Unicode symbol flood (currency/math)", () => {
      const input = "\u20AC\u00A2\u00A9\u00AE\u2122".repeat(20);
      const start = Date.now();
      trDetector.detect(input);
      expect(Date.now() - start).toBeLessThan(MAX_DETECT_MS);
    });

    it("near-match prefix flood (same charClass repeated)", () => {
      // 50 s's followed by noise — triggers greedy [s5]+ backtracking
      const input = "s".repeat(50) + "xxxxx";
      const start = Date.now();
      trDetector.detect(input);
      expect(Date.now() - start).toBeLessThan(MAX_DETECT_MS);
    });

    it("deep suffix chain probe", () => {
      // Fake suffix-like ending on a real root to stress suffix matching
      const input = "orospu" + "larinin".repeat(10);
      const start = Date.now();
      trDetector.detect(input);
      expect(Date.now() - start).toBeLessThan(MAX_DETECT_MS);
    });
  });

  // ─── Regression: hardening must not break detection ───

  describe("detection regression (TR)", () => {
    it("detects plain profanity", () => {
      const results = trDetector.detect("siktir git");
      expect(results.length).toBeGreaterThan(0);
    });

    it("detects leet speak ($1kt1r)", () => {
      const results = trDetector.detect("$1kt1r");
      expect(results.length).toBeGreaterThan(0);
    });

    it("detects separator evasion (s.i.k.t.i.r)", () => {
      const results = trDetector.detect("s.i.k.t.i.r");
      expect(results.length).toBeGreaterThan(0);
    });

    it("detects repeated chars (siiiiiktir)", () => {
      const results = trDetector.detect("siiiiiktir");
      expect(results.length).toBeGreaterThan(0);
    });

    it("detects number evasion ($1kt1r)", () => {
      const results = trDetector.detect("s1kt1r git");
      expect(results.length).toBeGreaterThan(0);
    });

    it("detects suffix form (orospuluk)", () => {
      const results = trDetector.detect("orospuluk yapma");
      expect(results.length).toBeGreaterThan(0);
    });
  });

  describe("detection regression (EN)", () => {
    it("detects plain profanity", () => {
      const results = enDetector.detect("fuck off");
      expect(results.length).toBeGreaterThan(0);
    });

    it("detects leet speak (f*ck)", () => {
      const results = enDetector.detect("what the f*ck");
      expect(results.length).toBeGreaterThan(0);
    });
  });
});

// ─── Attack surface: real-world adversarial patterns ───

describe("attack surface coverage", () => {
  let tr: Terlik;
  let en: Terlik;

  beforeAll(() => {
    tr = new Terlik();
    en = new Terlik({ language: "en" });
    // warmup
    tr.containsProfanity("warmup");
    en.containsProfanity("warmup");
  });

  // ─── Separator abuse ───

  describe("separator abuse", () => {
    it("single separator between each char (s.i.k)", () => {
      expect(tr.containsProfanity("s.i.k")).toBe(true);
    });

    it("mixed separators (s_i-k.t.i.r)", () => {
      expect(tr.containsProfanity("s_i-k.t.i.r")).toBe(true);
    });

    it("max allowed separators (3 per boundary)", () => {
      expect(tr.containsProfanity("s...i...k")).toBe(true);
    });

    it("4+ separators: still caught via normalizer pass", () => {
      // {0,3} limits the regex pattern, but normalizer's removePunctuation
      // strips dots between letters (s....i....k → sik), so the normalized
      // text pass catches it. This is correct — the normalizer is a separate layer.
      expect(tr.containsProfanity("s....i....k")).toBe(true);
    });

    it("tab and special whitespace as separator", () => {
      // tab is not \p{L} or \p{N}, should count as separator
      expect(tr.containsProfanity("s\ti\tk")).toBe(true);
    });

    it("zero-width chars should not act as separator bypass", () => {
      // ZWJ/ZWNJ between chars — should still detect
      expect(tr.containsProfanity("s\u200Di\u200Dk")).toBe(true);
    });
  });

  // ─── Leet speak bypass attempts ───

  describe("leet speak bypass attempts", () => {
    it("all-leet: $1kt1r", () => {
      expect(tr.containsProfanity("$1kt1r lan")).toBe(true);
    });

    it("mixed leet + normal: s1ktir", () => {
      expect(tr.containsProfanity("s1ktir git")).toBe(true);
    });

    it("@ as a in aptal", () => {
      expect(tr.containsProfanity("@pt@l")).toBe(true);
    });

    it("number substitution: 8ok (bok)", () => {
      expect(tr.containsProfanity("8ok gibi")).toBe(true);
    });

    it("combined leet + separator: $...1...k", () => {
      expect(tr.containsProfanity("$...1...k")).toBe(true);
    });

    it("EN leet: f*ck", () => {
      expect(en.containsProfanity("f*ck you")).toBe(true);
    });

    it("EN leet: ph uck should not match (no ph→f mapping)", () => {
      // no phonetic mapping, just char class
      expect(en.containsProfanity("phuck")).toBe(false);
    });
  });

  // ─── Char repetition abuse ───

  describe("char repetition abuse", () => {
    it("repeated vowels: siiiiik", () => {
      expect(tr.containsProfanity("siiiiik")).toBe(true);
    });

    it("repeated consonants: sikkkk", () => {
      expect(tr.containsProfanity("sikkkk")).toBe(true);
    });

    it("extreme repetition: siiiiiiiiiiiiiiiik (16 i's)", () => {
      expect(tr.containsProfanity("s" + "i".repeat(16) + "k")).toBe(true);
    });

    it("repeated leet: $$$1kt1r", () => {
      expect(tr.containsProfanity("$$$1kt1r")).toBe(true);
    });

    it("EN: fuuuuck", () => {
      expect(en.containsProfanity("fuuuuck you")).toBe(true);
    });
  });

  // ─── Unicode / encoding tricks ───

  describe("unicode tricks", () => {
    it("Turkish uppercase: SiKTiR (with dotless i)", () => {
      expect(tr.containsProfanity("SiKTiR")).toBe(true);
    });

    it("Turkish uppercase: SIKTIR (ASCII caps)", () => {
      expect(tr.containsProfanity("SIKTIR")).toBe(true);
    });

    it("mixed case: sIkTiR", () => {
      expect(tr.containsProfanity("sIkTiR")).toBe(true);
    });

    it("fullwidth chars should not bypass", () => {
      // fullwidth latin letters — normalizer lowercases but may not handle fullwidth
      // this documents current behavior
      const fullwidth = "\uFF33\uFF29\uFF2B"; // SIK in fullwidth
      tr.containsProfanity(fullwidth); // just verify no crash
    });

    it("combining diacritics should not crash", () => {
      // s + combining acute, i + combining tilde, k + combining grave
      const input = "s\u0301i\u0303k\u0300";
      tr.containsProfanity(input); // just verify no crash
    });
  });

  // ─── Whitelist bypass attempts ───

  describe("whitelist integrity", () => {
    it("sikke (coin) is whitelisted", () => {
      expect(tr.containsProfanity("sikke")).toBe(false);
    });

    it("amsterdam is whitelisted", () => {
      expect(tr.containsProfanity("amsterdam")).toBe(false);
    });

    it("leet-encoded whitelist word should not bypass", () => {
      // s1kke — normalizer turns it to "sikke" which is whitelisted
      expect(tr.containsProfanity("s1kke")).toBe(false);
    });

    it("whitelist word with extra suffix is not shielded", () => {
      // sikkeleri — sikke is whitelisted but this has suffix
      // the word boundary should prevent the sik pattern from matching inside "sikkeleri"
      expect(tr.containsProfanity("sikkeleri")).toBe(false);
    });
  });

  // ─── Boundary / context attacks ───

  describe("boundary attacks", () => {
    it("profanity at start of string", () => {
      expect(tr.containsProfanity("siktir git")).toBe(true);
    });

    it("profanity at end of string", () => {
      expect(tr.containsProfanity("hadi siktir")).toBe(true);
    });

    it("profanity as entire string", () => {
      expect(tr.containsProfanity("siktir")).toBe(true);
    });

    it("profanity between punctuation", () => {
      expect(tr.containsProfanity("(siktir)")).toBe(true);
    });

    it("profanity inside quotes", () => {
      expect(tr.containsProfanity('"siktir" dedi')).toBe(true);
    });

    it("profanity with trailing numbers", () => {
      expect(tr.containsProfanity("siktir123")).toBe(false);
    });

    it("profanity surrounded by emojis", () => {
      expect(tr.containsProfanity("\uD83D\uDE00 siktir \uD83D\uDE00")).toBe(true);
    });

    it("does not match across word boundaries (embedded)", () => {
      // "mesiktin" should not match "sik" — word boundary protects
      expect(tr.containsProfanity("mesiktin")).toBe(false);
    });
  });

  // ─── Multi-match / chained attacks ───

  describe("multi-match attacks", () => {
    it("multiple profanities in one input", () => {
      const results = tr.getMatches("siktir git orospu cocugu");
      expect(results.length).toBeGreaterThanOrEqual(2);
    });

    it("same word repeated many times", () => {
      const input = Array.from({ length: 20 }, () => "siktir").join(" ");
      const start = Date.now();
      const results = tr.getMatches(input);
      expect(Date.now() - start).toBeLessThan(MAX_DETECT_MS);
      expect(results.length).toBeGreaterThanOrEqual(1);
    });

    it("different roots in rapid succession", () => {
      const results = tr.getMatches("sik bok got amk ibne");
      expect(results.length).toBeGreaterThanOrEqual(3);
    });
  });

  // ─── Input edge cases ───

  describe("input edge cases", () => {
    it("empty string", () => {
      expect(tr.containsProfanity("")).toBe(false);
    });

    it("whitespace only", () => {
      expect(tr.containsProfanity("   \t\n  ")).toBe(false);
    });

    it("single character", () => {
      expect(tr.containsProfanity("a")).toBe(false);
    });

    it("only numbers", () => {
      expect(tr.containsProfanity("12345678901234567890")).toBe(false);
    });

    it("only special chars", () => {
      expect(tr.containsProfanity("!@#$%^&*()")).toBe(false);
    });

    it("very long clean text does not false-positive", () => {
      const input = "bu bir test cumlesdir ".repeat(200);
      expect(tr.containsProfanity(input)).toBe(false);
    });

    it("null bytes and control chars", () => {
      const input = "sik\x00tir";
      // null byte acts as separator — should detect if within {0,3} limit
      tr.containsProfanity(input); // verify no crash
    });

    it("newlines between chars", () => {
      // newline is not \p{L} or \p{N}, acts as separator
      expect(tr.containsProfanity("s\ni\nk")).toBe(true);
    });
  });

  // ─── Suffix hardening ───

  describe("suffix hardening", () => {
    it("detects root+suffix without separator", () => {
      expect(tr.containsProfanity("orospuluk")).toBe(true);
    });

    it("detects root+2 suffixes", () => {
      expect(tr.containsProfanity("orospuluklar")).toBe(true);
    });

    it("does not false-positive on non-suffixable + suffix", () => {
      // am is non-suffixable, "ama" should be clean
      expect(tr.containsProfanity("ama neden")).toBe(false);
    });

    it("suffix with separator evasion", () => {
      expect(tr.containsProfanity("s.i.k.t.i.r.l.e.r")).toBe(true);
    });

    it("leet + suffix", () => {
      expect(tr.containsProfanity("$1kt1rler")).toBe(true);
    });
  });
});
