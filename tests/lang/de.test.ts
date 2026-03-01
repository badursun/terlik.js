import { describe, it, expect } from "vitest";
import { Terlik } from "../../src/terlik.js";

describe("German profanity detection", () => {
  const terlik = new Terlik({ language: "de" });

  describe("root detection", () => {
    const roots = [
      { word: "scheiße", text: "das ist scheiße" },
      { word: "fick", text: "fick dich" },
      { word: "arsch", text: "du arsch" },
      { word: "hurensohn", text: "hurensohn" },
      { word: "hure", text: "du hure" },
      { word: "fotze", text: "blöde fotze" },
      { word: "wichser", text: "du wichser" },
      { word: "schwanz", text: "leck meinen schwanz" },
      { word: "schlampe", text: "du schlampe" },
      { word: "mistkerl", text: "so ein mistkerl" },
      { word: "idiot", text: "du idiot" },
      { word: "dumm", text: "bist du dumm" },
      { word: "depp", text: "du depp" },
      { word: "vollidiot", text: "so ein vollidiot" },
      { word: "missgeburt", text: "du missgeburt" },
      { word: "drecksau", text: "du drecksau" },
      { word: "dreck", text: "so ein dreck" },
      { word: "trottel", text: "du trottel" },
      { word: "schwuchtel", text: "du schwuchtel" },
      { word: "spast", text: "du spast" },
      { word: "miststück", text: "du miststück" },
      { word: "bastard", text: "du bastard" },
      { word: "penner", text: "du penner" },
      { word: "blödmann", text: "du blödmann" },
      { word: "vollpfosten", text: "so ein vollpfosten" },
      { word: "hackfresse", text: "du hackfresse" },
      { word: "pissnelke", text: "du pissnelke" },
      { word: "spacken", text: "du spacken" },
    ];

    for (const { word, text } of roots) {
      it(`detects ${word}`, () => {
        expect(terlik.containsProfanity(text)).toBe(true);
      });
    }
  });

  describe("variant detection", () => {
    const variants = [
      "scheisse", "scheiss", "beschissen", "scheissegal",
      "ficken", "ficker", "gefickt", "verfickt", "fickfehler",
      "arschloch", "arschgeige", "arschgesicht", "arschbacke", "arschlocher",
      "fotzen",
      "wichsen", "gewichst", "wixer",
      "schlampig", "schlamperei",
      "dummkopf", "dummheit",
      "dreckig", "drecksack",
      "vollidioten", "missgeburten",
      "schwuchteln",
      "spasten", "spasti",
      "miststueck",
      "bastarde",
      "blodmann",
    ];

    for (const v of variants) {
      it(`detects variant: ${v}`, () => {
        expect(terlik.containsProfanity(v)).toBe(true);
      });
    }
  });

  describe("ß handling", () => {
    it("detects scheiße with ß", () => {
      expect(terlik.containsProfanity("scheiße")).toBe(true);
    });

    it("detects scheisse without ß", () => {
      expect(terlik.containsProfanity("scheisse")).toBe(true);
    });

    it("detects SCHEISSE uppercase", () => {
      expect(terlik.containsProfanity("SCHEISSE")).toBe(true);
    });
  });

  describe("evasion detection", () => {
    it("detects separator: f.i.c.k", () => {
      expect(terlik.containsProfanity("f.i.c.k")).toBe(true);
    });

    it("detects separator: s.c.h.e.i.s.s.e", () => {
      expect(terlik.containsProfanity("s.c.h.e.i.s.s.e")).toBe(true);
    });
  });

  describe("whitelist — false positive prevention", () => {
    const safeWords = [
      "schwanger", "schwangerschaft", "geschichte",
    ];

    for (const word of safeWords) {
      it(`does not flag '${word}'`, () => {
        expect(terlik.containsProfanity(word)).toBe(false);
      });
    }
  });

  describe("clean text", () => {
    it("returns false for normal text", () => {
      expect(terlik.containsProfanity("hallo welt wie geht es dir")).toBe(false);
    });
  });

  describe("isolation", () => {
    it("does not detect Turkish profanity", () => {
      expect(terlik.containsProfanity("siktir git")).toBe(false);
    });

    it("does not detect English profanity", () => {
      expect(terlik.containsProfanity("what the fuck")).toBe(false);
    });

    it("does not detect Spanish profanity", () => {
      expect(terlik.containsProfanity("hijo de puta")).toBe(false);
    });
  });
});
