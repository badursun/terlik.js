import { describe, it, expect } from "vitest";
import { Terlik } from "../../src/terlik.js";

describe("multi-language isolation", () => {
  const tr = new Terlik({ language: "tr" });
  const en = new Terlik({ language: "en" });
  const es = new Terlik({ language: "es" });
  const de = new Terlik({ language: "de" });

  it("Turkish instance detects Turkish, not others", () => {
    expect(tr.containsProfanity("siktir git")).toBe(true);
    expect(tr.containsProfanity("what the fuck")).toBe(false);
    expect(tr.containsProfanity("mierda")).toBe(false);
    expect(tr.containsProfanity("scheiße")).toBe(false);
  });

  it("English instance detects English, not others", () => {
    expect(en.containsProfanity("what the fuck")).toBe(true);
    expect(en.containsProfanity("siktir git")).toBe(false);
    expect(en.containsProfanity("mierda")).toBe(false);
    expect(en.containsProfanity("scheiße")).toBe(false);
  });

  it("Spanish instance detects Spanish, not others", () => {
    expect(es.containsProfanity("mierda")).toBe(true);
    expect(es.containsProfanity("siktir git")).toBe(false);
    expect(es.containsProfanity("what the fuck")).toBe(false);
    expect(es.containsProfanity("scheiße")).toBe(false);
  });

  it("German instance detects German, not others", () => {
    expect(de.containsProfanity("scheiße")).toBe(true);
    expect(de.containsProfanity("siktir git")).toBe(false);
    expect(de.containsProfanity("what the fuck")).toBe(false);
    expect(de.containsProfanity("mierda")).toBe(false);
  });

  it("addWords is instance-scoped", () => {
    const en2 = new Terlik({ language: "en" });
    en2.addWords(["foobar"]);
    expect(en2.containsProfanity("foobar")).toBe(true);
    expect(en.containsProfanity("foobar")).toBe(false);
    expect(tr.containsProfanity("foobar")).toBe(false);
  });

  it("language property is readable", () => {
    expect(tr.language).toBe("tr");
    expect(en.language).toBe("en");
    expect(es.language).toBe("es");
    expect(de.language).toBe("de");
  });

  it("default language is Turkish", () => {
    const defaultInstance = new Terlik();
    expect(defaultInstance.language).toBe("tr");
    expect(defaultInstance.containsProfanity("siktir")).toBe(true);
  });
});

describe("Terlik.warmup", () => {
  it("creates instances for all specified languages", () => {
    const cache = Terlik.warmup(["tr", "en", "es", "de"]);
    expect(cache.size).toBe(4);
    expect(cache.get("tr")).toBeInstanceOf(Terlik);
    expect(cache.get("en")).toBeInstanceOf(Terlik);
    expect(cache.get("es")).toBeInstanceOf(Terlik);
    expect(cache.get("de")).toBeInstanceOf(Terlik);
  });

  it("each instance works independently", () => {
    const cache = Terlik.warmup(["tr", "en"]);
    expect(cache.get("tr")!.containsProfanity("siktir")).toBe(true);
    expect(cache.get("en")!.containsProfanity("fuck")).toBe(true);
    expect(cache.get("tr")!.containsProfanity("fuck")).toBe(false);
    expect(cache.get("en")!.containsProfanity("siktir")).toBe(false);
  });

  it("passes base options to all instances", () => {
    const cache = Terlik.warmup(["tr", "en"], { mode: "strict" });
    // strict mode does not catch separated chars
    expect(cache.get("tr")!.containsProfanity("s i k t i r")).toBe(false);
    expect(cache.get("en")!.containsProfanity("f u c k")).toBe(false);
  });

  it("throws for unsupported language", () => {
    expect(() => Terlik.warmup(["tr", "xx"])).toThrow(/Unsupported language/);
  });
});
