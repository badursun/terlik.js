import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Terlik } from "../src/terlik.js";

describe("Lazy Compilation", () => {
  describe("construction performance", () => {
    it("constructs quickly without eager pattern compilation", () => {
      const start = performance.now();
      new Terlik();
      const elapsed = performance.now() - start;
      // Previously ~225ms for pattern compilation; now should be much faster
      expect(elapsed).toBeLessThan(50);
    });
  });

  describe("transparent lazy compilation", () => {
    it("detect() in balanced mode compiles lazily and returns correct results", () => {
      const terlik = new Terlik();
      expect(terlik.containsProfanity("siktir git")).toBe(true);
      expect(terlik.containsProfanity("merhaba dunya")).toBe(false);
    });

    it("getMatches() triggers compilation and returns match details", () => {
      const terlik = new Terlik();
      const matches = terlik.getMatches("siktir git");
      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0].method).toBe("pattern");
    });

    it("clean() triggers compilation and masks profanity", () => {
      const terlik = new Terlik();
      const cleaned = terlik.clean("siktir git");
      expect(cleaned).not.toBe("siktir git");
      expect(cleaned).toContain("git");
    });
  });

  describe("strict mode does not trigger pattern compilation", () => {
    it("strict detect uses hash lookup, not patterns", () => {
      const terlik = new Terlik({ mode: "strict" });
      // Time the construction — should be fast (no compilation)
      const startConstruct = performance.now();
      const terlik2 = new Terlik({ mode: "strict" });
      const constructTime = performance.now() - startConstruct;

      // Run a strict detection
      const startDetect = performance.now();
      terlik2.containsProfanity("siktir");
      const detectTime = performance.now() - startDetect;

      // Strict detection should be very fast since it only uses hash lookups
      // If patterns were compiled, detect would take ~225ms
      expect(constructTime).toBeLessThan(50);
      expect(detectTime).toBeLessThan(50);

      // Verify it still detects correctly
      expect(terlik.containsProfanity("siktir")).toBe(true);
      expect(terlik.containsProfanity("merhaba")).toBe(false);
    });
  });

  describe("getPatterns() triggers compilation", () => {
    it("returns compiled patterns map", () => {
      const terlik = new Terlik();
      const patterns = terlik.getPatterns();
      expect(patterns.size).toBeGreaterThan(0);
      for (const [root, regex] of patterns) {
        expect(typeof root).toBe("string");
        expect(regex).toBeInstanceOf(RegExp);
      }
    });
  });

  describe("recompile after addWords/removeWords", () => {
    it("addWords triggers recompile and detects new word", () => {
      const terlik = new Terlik();
      expect(terlik.containsProfanity("xyztest123")).toBe(false);
      terlik.addWords(["xyztest123"]);
      expect(terlik.containsProfanity("xyztest123")).toBe(true);
    });

    it("removeWords triggers recompile and stops detecting removed word", () => {
      const terlik = new Terlik({ customList: ["xyztest456"] });
      expect(terlik.containsProfanity("xyztest456")).toBe(true);
      terlik.removeWords(["xyztest456"]);
      expect(terlik.containsProfanity("xyztest456")).toBe(false);
    });
  });

  describe("backgroundWarmup", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("schedules compilation via setTimeout when backgroundWarmup is true", () => {
      const terlik = new Terlik({ backgroundWarmup: true });

      // Before timers fire, patterns should not be compiled yet
      // We can verify by checking that construction was fast
      // (patterns are null internally)

      // Fire the setTimeout
      vi.runAllTimers();

      // After warmup, detection should work correctly
      expect(terlik.containsProfanity("siktir git")).toBe(true);
      expect(terlik.containsProfanity("merhaba")).toBe(false);
    });

    it("early detect() before setTimeout fires works correctly (idempotent)", () => {
      const terlik = new Terlik({ backgroundWarmup: true });

      // Call detect BEFORE setTimeout fires — should trigger sync compilation
      expect(terlik.containsProfanity("siktir")).toBe(true);

      // Now fire the timeout — compile() should be a no-op (idempotent)
      vi.runAllTimers();

      // Should still work correctly after timeout fires
      expect(terlik.containsProfanity("siktir")).toBe(true);
      expect(terlik.containsProfanity("merhaba")).toBe(false);
    });

    it("without backgroundWarmup, no setTimeout is scheduled", () => {
      const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");
      const callsBefore = setTimeoutSpy.mock.calls.length;

      new Terlik(); // no backgroundWarmup

      const callsAfter = setTimeoutSpy.mock.calls.length;
      expect(callsAfter).toBe(callsBefore);

      setTimeoutSpy.mockRestore();
    });
  });

  describe("warmup() static method still works", () => {
    it("warmup creates instances that are ready to use", () => {
      const cache = Terlik.warmup(["tr"]);
      const tr = cache.get("tr")!;
      expect(tr.containsProfanity("siktir")).toBe(true);
      expect(tr.containsProfanity("merhaba")).toBe(false);
    });
  });
});
