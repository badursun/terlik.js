import { describe, it, expect } from "vitest";
import { Terlik } from "../src/terlik.js";

describe("edge cases", () => {
  const terlik = new Terlik();

  describe("false positive prevention", () => {
    it("does not flag 'sikke' (coin)", () => {
      expect(terlik.containsProfanity("osmanlı sikke koleksiyonu")).toBe(false);
    });

    it("does not flag 'amsterdam'", () => {
      expect(terlik.containsProfanity("amsterdam güzel şehir")).toBe(false);
    });

    it("does not flag 'ambulans'", () => {
      expect(terlik.containsProfanity("ambulans geldi")).toBe(false);
    });

    it("does not flag 'ameliyat'", () => {
      expect(terlik.containsProfanity("ameliyat olacak")).toBe(false);
    });

    it("does not flag 'malzeme'", () => {
      expect(terlik.containsProfanity("malzeme listesi")).toBe(false);
    });

    it("does not flag 'memur'", () => {
      expect(terlik.containsProfanity("devlet memuru")).toBe(false);
    });

    it("does not flag 'bokser' (boxer)", () => {
      expect(terlik.containsProfanity("bokser köpek cinsi")).toBe(false);
    });

    it("does not flag 'ama' (but)", () => {
      expect(terlik.containsProfanity("ama yapamam")).toBe(false);
    });

    it("flags 'ami' (am variant)", () => {
      expect(terlik.containsProfanity("ami sorunu")).toBe(true);
    });

    it("does not flag 'amen'", () => {
      expect(terlik.containsProfanity("amen dedi papaz")).toBe(false);
    });

    it("does not flag 'amir'", () => {
      expect(terlik.containsProfanity("amir bey geldi")).toBe(false);
    });

    it("does not flag 'dolmen'", () => {
      expect(terlik.containsProfanity("dolmen antik yapi")).toBe(false);
    });

    // New whitelist entries
    it("does not flag 'amazon'", () => {
      expect(terlik.containsProfanity("amazon siparis verdim")).toBe(false);
    });

    it("does not flag 'ambargo'", () => {
      expect(terlik.containsProfanity("ambargo uygulandi")).toBe(false);
    });

    it("does not flag 'amblem'", () => {
      expect(terlik.containsProfanity("amblem tasarimi")).toBe(false);
    });

    it("does not flag 'amfibi'", () => {
      expect(terlik.containsProfanity("amfibi arac")).toBe(false);
    });

    it("does not flag 'dolap'", () => {
      expect(terlik.containsProfanity("dolap kapagi")).toBe(false);
    });

    it("does not flag 'dolar'", () => {
      expect(terlik.containsProfanity("dolar kuru yukseldi")).toBe(false);
    });

    it("does not flag 'dolma'", () => {
      expect(terlik.containsProfanity("dolma yaprak sardim")).toBe(false);
    });

    it("does not flag 'dolmus'", () => {
      expect(terlik.containsProfanity("dolmus bekliyorum")).toBe(false);
    });

    it("does not flag 'malum'", () => {
      expect(terlik.containsProfanity("malum kisi")).toBe(false);
    });

    it("does not flag 'namus'", () => {
      expect(terlik.containsProfanity("namus meselesi")).toBe(false);
    });

    it("does not flag 'namuslu'", () => {
      expect(terlik.containsProfanity("namuslu adam")).toBe(false);
    });

    it("does not flag 'ahlak'", () => {
      expect(terlik.containsProfanity("ahlak dersi")).toBe(false);
    });

    it("does not flag 'ahlaki'", () => {
      expect(terlik.containsProfanity("ahlaki degerler")).toBe(false);
    });
  });

  describe("emoji handling", () => {
    it("detects profanity with surrounding emojis", () => {
      expect(terlik.containsProfanity("😡 siktir 😡")).toBe(true);
    });

    it("does not false-positive on emoji-only text", () => {
      expect(terlik.containsProfanity("😀😁😂🤣")).toBe(false);
    });
  });

  describe("long input", () => {
    it("handles input up to maxLength", () => {
      const longClean = "merhaba ".repeat(2000);
      expect(terlik.containsProfanity(longClean)).toBe(false);
    });

    it("truncates input beyond maxLength", () => {
      const t = new Terlik({ maxLength: 20 });
      // Place profanity after truncation point
      const text = "a".repeat(25) + " siktir";
      expect(t.containsProfanity(text)).toBe(false);
    });
  });

  describe("empty and special inputs", () => {
    it("handles empty string", () => {
      expect(terlik.containsProfanity("")).toBe(false);
      expect(terlik.clean("")).toBe("");
      expect(terlik.getMatches("")).toEqual([]);
    });

    it("handles whitespace only", () => {
      expect(terlik.containsProfanity("   ")).toBe(false);
    });

    it("handles numbers only", () => {
      expect(terlik.containsProfanity("123456")).toBe(false);
    });

    it("handles special characters only", () => {
      expect(terlik.containsProfanity("!@#$%^&*()")).toBe(false);
    });
  });

  describe("Turkish character variations", () => {
    it("detects with Turkish İ/ı", () => {
      expect(terlik.containsProfanity("SİKTİR")).toBe(true);
    });

    it("detects with mixed case Turkish", () => {
      expect(terlik.containsProfanity("Sİktİr")).toBe(true);
    });
  });

  describe("leet speak evasion", () => {
    it("detects $1kt1r", () => {
      expect(terlik.containsProfanity("$1kt1r lan")).toBe(true);
    });

    it("detects @pt@l", () => {
      expect(terlik.containsProfanity("@pt@l herif")).toBe(true);
    });

    it("detects 8ok (bok) — visual leet 8→b", () => {
      expect(terlik.containsProfanity("8ok herif")).toBe(true);
    });

    it("detects 6öt (göt) — visual leet 6→g", () => {
      expect(terlik.containsProfanity("senin 6öt")).toBe(true);
    });

    it("detects s2k via pattern char class (2≈i)", () => {
      // Pattern engine: [iıİ12!|...] char class matches "2" directly
      expect(terlik.containsProfanity("s2kt2r")).toBe(true);
    });
  });

  describe("character repetition evasion", () => {
    it("detects siiiiiktir", () => {
      expect(terlik.containsProfanity("siiiiiktir")).toBe(true);
    });

    it("detects orrrospu", () => {
      expect(terlik.containsProfanity("orrrospu")).toBe(true);
    });
  });

  describe("separator evasion", () => {
    it("detects s.i.k.t.i.r", () => {
      expect(terlik.containsProfanity("s.i.k.t.i.r")).toBe(true);
    });

    it("detects s-i-k-t-i-r", () => {
      expect(terlik.containsProfanity("s-i-k-t-i-r")).toBe(true);
    });

    it("detects s_i_k_t_i_r", () => {
      expect(terlik.containsProfanity("s_i_k_t_i_r")).toBe(true);
    });
  });

  describe("new variant detection", () => {
    it("detects aminakoyayim (amk variant)", () => {
      expect(terlik.containsProfanity("aminakoyayim")).toBe(true);
    });

    it("detects aminakoydum (amk variant)", () => {
      expect(terlik.containsProfanity("aminakoydum")).toBe(true);
    });

    it("detects aminakoydugumun (amk variant)", () => {
      expect(terlik.containsProfanity("aminakoydugumun")).toBe(true);
    });

    it("detects aq (amk abbreviation)", () => {
      expect(terlik.containsProfanity("bu ne aq")).toBe(true);
    });

    it("detects orospucocuklari (orospu variant)", () => {
      expect(terlik.containsProfanity("orospucocuklari")).toBe(true);
    });

    it("detects gotos (göt variant)", () => {
      expect(terlik.containsProfanity("gotos herif")).toBe(true);
    });

    it("detects yarrani (yarrak variant)", () => {
      expect(terlik.containsProfanity("yarrani ye")).toBe(true);
    });

    it("detects yarragimi (yarrak variant)", () => {
      expect(terlik.containsProfanity("yarragimi")).toBe(true);
    });

    it("detects yarragini (yarrak variant)", () => {
      expect(terlik.containsProfanity("yarragini")).toBe(true);
    });

    it("detects sktr (sik abbreviation)", () => {
      expect(terlik.containsProfanity("sktr lan")).toBe(true);
    });
  });

  describe("Turkish number evasion", () => {
    it("detects s2k (sikik)", () => {
      expect(terlik.containsProfanity("s2k herif")).toBe(true);
    });

    it("detects s2mle (sikimle)", () => {
      expect(terlik.containsProfanity("s2mle ugras")).toBe(true);
    });

    it("does not flag standalone numbers", () => {
      expect(terlik.containsProfanity("2023 yilinda")).toBe(false);
      expect(terlik.containsProfanity("skor 2-1 oldu")).toBe(false);
    });

    it("does not flag '100 kisi'", () => {
      expect(terlik.containsProfanity("100 kisi geldi")).toBe(false);
    });
  });
});
