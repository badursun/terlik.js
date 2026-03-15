import { describe, it, expect } from "vitest";
import { Terlik } from "../src/terlik.js";

describe("suffix engine", () => {
  const terlik = new Terlik();

  describe("suffixable roots catch suffixed forms", () => {
    it("detects siktiler (sik+tir+ler → sik+ti+ler)", () => {
      expect(terlik.containsProfanity("siktiler hepsini")).toBe(true);
    });

    it("detects sikerim (sik+er+im)", () => {
      expect(terlik.containsProfanity("sikerim seni")).toBe(true);
    });

    it("detects orospuluk (orospu+luk)", () => {
      expect(terlik.containsProfanity("orospuluk yapma")).toBe(true);
    });

    it("detects gotune (got+un+e)", () => {
      expect(terlik.containsProfanity("gotune sokayim")).toBe(true);
    });

    it("detects boktan (bok+tan)", () => {
      expect(terlik.containsProfanity("boktan bir gun")).toBe(true);
    });

    it("detects ibnelik (ibne+lik)", () => {
      expect(terlik.containsProfanity("ibnelik yapma")).toBe(true);
    });

    it("detects gavatlar (gavat+lar)", () => {
      expect(terlik.containsProfanity("gavatlar geldi")).toBe(true);
    });

    it("detects salaksin (salak+sin)", () => {
      expect(terlik.containsProfanity("salaksin sen")).toBe(true);
    });

    it("detects aptallarin (aptal+lar+in)", () => {
      expect(terlik.containsProfanity("aptallarin isi")).toBe(true);
    });

    it("detects kahpeler (kahpe+ler)", () => {
      expect(terlik.containsProfanity("kahpeler burada")).toBe(true);
    });

    it("detects pezevenkler (pezevenk+ler)", () => {
      expect(terlik.containsProfanity("pezevenkler toplandi")).toBe(true);
    });

    it("detects yavsaklik (yavsak+lik)", () => {
      expect(terlik.containsProfanity("yavsaklik etme")).toBe(true);
    });

    it("detects serefsizler (serefsiz+ler)", () => {
      expect(terlik.containsProfanity("serefsizler")).toBe(true);
    });

    it("detects pustlar (pust+lar)", () => {
      expect(terlik.containsProfanity("pustlar geldi")).toBe(true);
    });
  });

  describe("suffix chaining (up to 2)", () => {
    it("detects siktirler (sik+tir+ler) — 2 suffix chain", () => {
      expect(terlik.containsProfanity("siktirler hep")).toBe(true);
    });

    it("detects orospuluklar — suffix chain on long root", () => {
      expect(terlik.containsProfanity("orospuluklar")).toBe(true);
    });
  });

  describe("evasion + suffix", () => {
    it("detects s.i.k.t.i.r.l.e.r (separator evasion with suffix)", () => {
      expect(terlik.containsProfanity("s.i.k.t.i.r.l.e.r")).toBe(true);
    });

    it("detects $1kt1rler (leet + suffix)", () => {
      expect(terlik.containsProfanity("$1kt1rler")).toBe(true);
    });
  });

  describe("non-suffixable entries reject suffix forms", () => {
    it("does not false-positive on 'ama' (am is non-suffixable)", () => {
      expect(terlik.containsProfanity("ama neden")).toBe(false);
    });

    it("detects 'ami' (am + i variant)", () => {
      expect(terlik.containsProfanity("ami bozuk")).toBe(true);
    });
  });

  describe("false positive prevention", () => {
    it("does not flag 'ama'", () => {
      expect(terlik.containsProfanity("ama ben istemiyorum")).toBe(false);
    });

    it("flags 'ami' (am variant)", () => {
      expect(terlik.containsProfanity("ami problemi var")).toBe(true);
    });

    it("does not flag 'amen'", () => {
      expect(terlik.containsProfanity("amen dedi")).toBe(false);
    });

    it("does not flag 'sikke' (still protected)", () => {
      expect(terlik.containsProfanity("osmanlı sikke")).toBe(false);
    });

    it("does not flag 'amsterdam' (still protected)", () => {
      expect(terlik.containsProfanity("amsterdam")).toBe(false);
    });

    it("does not flag 'bokser' (still whitelisted)", () => {
      expect(terlik.containsProfanity("bokser kopek cinsi")).toBe(false);
    });

    it("does not flag 'dolmen'", () => {
      expect(terlik.containsProfanity("dolmen yapisi")).toBe(false);
    });

    it("does not flag 'dolunay' (still whitelisted)", () => {
      expect(terlik.containsProfanity("dolunay vardi")).toBe(false);
    });

    it("does not flag 'sıkma' (Turkish ı/ş safe)", () => {
      expect(terlik.containsProfanity("sıkma limon")).toBe(false);
    });

    it("does not flag 'sıkıntı'", () => {
      expect(terlik.containsProfanity("sıkıntı var")).toBe(false);
    });

    it("does not flag 'sıkıştı'", () => {
      expect(terlik.containsProfanity("sıkıştı araba")).toBe(false);
    });

    it("does not flag 'sıkı'", () => {
      expect(terlik.containsProfanity("sıkı çalış")).toBe(false);
    });

    it("does not flag 'amir'", () => {
      expect(terlik.containsProfanity("amir geldi")).toBe(false);
    });
  });
});
