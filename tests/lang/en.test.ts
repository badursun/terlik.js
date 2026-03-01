import { describe, it, expect } from "vitest";
import { Terlik } from "../../src/terlik.js";

describe("English profanity detection", () => {
  const terlik = new Terlik({ language: "en" });

  describe("root detection", () => {
    const roots = [
      { word: "fuck", text: "what the fuck" },
      { word: "shit", text: "this is shit" },
      { word: "bitch", text: "son of a bitch" },
      { word: "damn", text: "damn it" },
      { word: "asshole", text: "what an asshole" },
      { word: "dick", text: "don't be a dick" },
      { word: "cock", text: "what a cock" },
      { word: "cunt", text: "you cunt" },
      { word: "whore", text: "dirty whore" },
      { word: "slut", text: "she is a slut" },
      { word: "piss", text: "piss off" },
      { word: "wank", text: "go wank" },
      { word: "twat", text: "you twat" },
      { word: "bollocks", text: "that is bollocks" },
      { word: "crap", text: "what crap" },
      { word: "retard", text: "you retard" },
      { word: "faggot", text: "stupid faggot" },
      { word: "douche", text: "total douche" },
      { word: "spic", text: "dirty spic" },
      { word: "kike", text: "filthy kike" },
      { word: "chink", text: "stupid chink" },
      { word: "gook", text: "dirty gook" },
      { word: "tranny", text: "ugly tranny" },
      { word: "dyke", text: "stupid dyke" },
      { word: "coon", text: "dirty coon" },
      { word: "wetback", text: "filthy wetback" },
      { word: "bellend", text: "you bellend" },
      { word: "skank", text: "total skank" },
      { word: "scumbag", text: "what a scumbag" },
      { word: "turd", text: "you turd" },
      { word: "bugger", text: "bugger off" },
    ];

    for (const { word, text } of roots) {
      it(`detects ${word}`, () => {
        expect(terlik.containsProfanity(text)).toBe(true);
      });
    }
  });

  describe("variant detection", () => {
    const variants = [
      "fucking", "fucker", "motherfucker", "stfu",
      "fuckboy", "fucktard", "fuckhead", "wtf", "mofo",
      "shitty", "bullshit", "dipshit", "shithole",
      "shitbag", "shitload", "shithouse", "shitlist",
      "bitchy", "bitching", "bitchslap",
      "cocksucker", "cocksucking", "cockblock",
      "slutty", "whorish",
      "pissed", "pissing",
      "wanker", "wanking",
      "retarded",
      "nigga", "fag", "fags",
      "douchebag",
      "dickhead", "dickwad",
      "jackass", "dumbass", "smartass",
      "asscrack", "assclown",
      "goddamn",
      "spicks", "kikes", "chinks", "chinky", "gooks",
      "trannies", "dykes", "coons", "wetbacks",
      "bellends", "skanky", "scumbags", "turds",
      "buggered", "buggering", "buggery",
    ];

    for (const v of variants) {
      it(`detects variant: ${v}`, () => {
        expect(terlik.containsProfanity(v)).toBe(true);
      });
    }
  });

  describe("evasion detection", () => {
    it("detects separator: f.u.c.k", () => {
      expect(terlik.containsProfanity("f.u.c.k")).toBe(true);
    });

    it("detects leet: fck", () => {
      expect(terlik.containsProfanity("fck this")).toBe(true);
    });

    it("detects repetition: fuuuck", () => {
      expect(terlik.containsProfanity("fuuuck")).toBe(true);
    });

    it("detects leet: $h1t", () => {
      expect(terlik.containsProfanity("$h1t")).toBe(true);
    });

    it("detects leet: b1tch", () => {
      expect(terlik.containsProfanity("b1tch")).toBe(true);
    });
  });

  describe("whitelist — false positive prevention", () => {
    const safeWords = [
      "assassin", "assassinate", "assistant", "assessment",
      "class", "classic", "classify", "classroom", "grass", "grasshopper",
      "mass", "massive", "pass", "passage", "passenger",
      "passion", "passive", "passport", "assume", "asset",
      "assess", "dickens", "cocktail", "cockatoo", "cockatiel",
      "cockpit", "cockroach", "cockney", "peacock",
      "shuttlecock", "woodcock",
      "scrap", "piston", "bassist", "embassy", "hassle",
      "massage", "compass", "harass", "shiitake",
      "cocoon", "raccoon", "tycoon",
      "dike", "vandyke", "scunthorpe",
    ];

    for (const word of safeWords) {
      it(`does not flag '${word}'`, () => {
        expect(terlik.containsProfanity(word)).toBe(false);
      });
    }
  });

  describe("masking", () => {
    it("masks detected words", () => {
      const result = terlik.clean("what the fuck");
      expect(result).not.toContain("fuck");
      expect(result).toContain("*");
    });
  });

  describe("clean text", () => {
    it("returns false for normal text", () => {
      expect(terlik.containsProfanity("hello world how are you")).toBe(false);
    });
  });

  describe("isolation", () => {
    it("does not detect Turkish profanity", () => {
      expect(terlik.containsProfanity("siktir git")).toBe(false);
    });

    it("does not detect Spanish profanity", () => {
      expect(terlik.containsProfanity("mierda")).toBe(false);
    });

    it("does not detect German profanity", () => {
      expect(terlik.containsProfanity("scheiße")).toBe(false);
    });
  });
});
