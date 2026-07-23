import { describe, it, expect } from "vitest";
import { Terlik } from "../src/terlik.js";

describe("Terlik (integration)", () => {
  describe("containsProfanity", () => {
    const terlik = new Terlik();

    it("returns true for profane text", () => {
      expect(terlik.containsProfanity("siktir git")).toBe(true);
    });

    it("returns false for clean text", () => {
      expect(terlik.containsProfanity("merhaba dunya")).toBe(false);
    });

    it("returns false for empty input", () => {
      expect(terlik.containsProfanity("")).toBe(false);
    });

    it("returns false for null-ish input", () => {
      expect(terlik.containsProfanity(null as unknown as string)).toBe(false);
      expect(terlik.containsProfanity(undefined as unknown as string)).toBe(false);
    });
  });

  describe("getMatches", () => {
    const terlik = new Terlik();

    it("returns match details", () => {
      const matches = terlik.getMatches("siktir git");
      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0]).toHaveProperty("word");
      expect(matches[0]).toHaveProperty("root");
      expect(matches[0]).toHaveProperty("index");
      expect(matches[0]).toHaveProperty("severity");
      expect(matches[0]).toHaveProperty("method");
    });

    it("returns empty array for clean text", () => {
      expect(terlik.getMatches("merhaba")).toEqual([]);
    });

    it("returns correct index with irregular whitespace", () => {
      const matches = terlik.getMatches(" \tmerhaba \n  siktir  ", { mode: "strict" });
      const match = matches.find((m) => m.word === "siktir");
      expect(match?.index).toBe(13);
    });
  });

  describe("clean", () => {
    const terlik = new Terlik();

    it("masks profanity with stars by default", () => {
      const result = terlik.clean("siktir git");
      expect(result).not.toContain("siktir");
      expect(result).toContain("*");
    });

    it("supports partial mask", () => {
      const terlikPartial = new Terlik({ maskStyle: "partial" });
      const result = terlikPartial.clean("siktir git");
      expect(result).not.toBe("siktir git");
    });

    it("supports replace mask", () => {
      const terlikReplace = new Terlik({ maskStyle: "replace", replaceMask: "[küfür]" });
      const result = terlikReplace.clean("siktir git");
      expect(result).toContain("[küfür]");
    });

    it("returns clean text unchanged", () => {
      expect(terlik.clean("merhaba dunya")).toBe("merhaba dunya");
    });

    it("masks profanity at the correct position with irregular whitespace", () => {
      const result = terlik.clean(" \tmerhaba \n  siktir  ", { mode: "strict" });
      expect(result).toBe(" \tmerhaba \n  ******  ");
    });
  });

  describe("addWords / removeWords", () => {
    it("adds custom words", () => {
      const terlik = new Terlik();
      expect(terlik.containsProfanity("kodumun")).toBe(false);
      terlik.addWords(["kodumun"]);
      expect(terlik.containsProfanity("kodumun")).toBe(true);
    });

    it("removes words from dictionary", () => {
      const terlik = new Terlik();
      expect(terlik.containsProfanity("salak")).toBe(true);
      terlik.removeWords(["salak"]);
      expect(terlik.containsProfanity("salak")).toBe(false);
    });
  });

  describe("modes", () => {
    it("strict mode does not catch separated chars", () => {
      const terlik = new Terlik({ mode: "strict" });
      expect(terlik.containsProfanity("s i k t i r")).toBe(false);
    });

    it("balanced mode catches separated chars", () => {
      const terlik = new Terlik({ mode: "balanced" });
      expect(terlik.containsProfanity("s.i.k.t.i.r")).toBe(true);
    });

    it("loose mode enables fuzzy", () => {
      const terlik = new Terlik({ mode: "loose" });
      // Slightly misspelled
      const matches = terlik.getMatches("siktiir git");
      expect(matches.length).toBeGreaterThan(0);
    });
  });

  describe("custom options", () => {
    it("respects custom whitelist", () => {
      const terlik = new Terlik({ whitelist: ["testword"] });
      // whitelist is additive, built-in ones still work
      expect(terlik.containsProfanity("sikke")).toBe(false);
    });

    it("respects custom word list", () => {
      const terlik = new Terlik({ customList: ["hiyar"] });
      expect(terlik.containsProfanity("bu adam hiyar")).toBe(true);
    });

    it("respects maxLength", () => {
      const terlik = new Terlik({ maxLength: 5 });
      // Input gets truncated to 5 chars — profanity beyond limit not detected
      expect(terlik.containsProfanity("abcde siktir git")).toBe(false); // "abcde" — profanity truncated away
    });
  });

  describe("getPatterns", () => {
    it("returns patterns map", () => {
      const terlik = new Terlik();
      const patterns = terlik.getPatterns();
      expect(patterns).toBeInstanceOf(Map);
      expect(patterns.size).toBeGreaterThan(0);
    });
  });
});
