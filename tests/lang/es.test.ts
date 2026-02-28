import { describe, it, expect } from "vitest";
import { Terlik } from "../../src/terlik.js";

describe("Spanish profanity detection", () => {
  const terlik = new Terlik({ language: "es" });

  describe("root detection", () => {
    const roots = [
      { word: "mierda", text: "eso es una mierda" },
      { word: "puta", text: "hijo de puta" },
      { word: "cabron", text: "eres un cabron" },
      { word: "joder", text: "joder tio" },
      { word: "coño", text: "coño ya" },
      { word: "verga", text: "vete a la verga" },
      { word: "chingar", text: "no me chingar" },
      { word: "pendejo", text: "eres pendejo" },
      { word: "marica", text: "no seas marica" },
      { word: "carajo", text: "vete al carajo" },
      { word: "idiota", text: "eres idiota" },
      { word: "culo", text: "mueve el culo" },
      { word: "zorra", text: "esa zorra" },
      { word: "estupido", text: "eres estupido" },
      { word: "imbecil", text: "pedazo de imbecil" },
      { word: "gilipollas", text: "menudo gilipollas" },
      { word: "huevon", text: "que huevon" },
      { word: "pinche", text: "pinche idiota" },
    ];

    for (const { word, text } of roots) {
      it(`detects ${word}`, () => {
        expect(terlik.containsProfanity(text)).toBe(true);
      });
    }
  });

  describe("variant detection", () => {
    const variants = [
      "puto", "putas", "hijoputa", "putear",
      "jodido", "jodida", "jodiendo",
      "chingado", "chingada", "chingon", "chingona", "chingadera",
      "pendejos", "pendeja", "pendejada",
      "maricon", "maricones",
      "cabrones", "cabrona", "cabronazo",
      "mierdoso",
      "estupida", "estupidez",
    ];

    for (const v of variants) {
      it(`detects variant: ${v}`, () => {
        expect(terlik.containsProfanity(v)).toBe(true);
      });
    }
  });

  describe("evasion detection", () => {
    it("detects separator: m.i.e.r.d.a", () => {
      expect(terlik.containsProfanity("m.i.e.r.d.a")).toBe(true);
    });

    it("detects leet: m1erda", () => {
      expect(terlik.containsProfanity("m1erda")).toBe(true);
    });

    it("detects separator: p.u.t.a", () => {
      expect(terlik.containsProfanity("p.u.t.a")).toBe(true);
    });
  });

  describe("whitelist", () => {
    const safeWords = [
      "computadora", "disputar", "reputacion", "calcular",
      "particular", "vehicular",
    ];

    for (const word of safeWords) {
      it(`does not flag '${word}'`, () => {
        expect(terlik.containsProfanity(word)).toBe(false);
      });
    }
  });

  describe("isolation", () => {
    it("does not detect Turkish profanity", () => {
      expect(terlik.containsProfanity("siktir git")).toBe(false);
    });

    it("does not detect English profanity", () => {
      expect(terlik.containsProfanity("what the fuck")).toBe(false);
    });
  });
});
