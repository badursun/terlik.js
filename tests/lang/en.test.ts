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
      // Phase 1 — new roots
      { word: "hell", text: "go to hell" },
      { word: "prick", text: "you prick" },
      { word: "screw", text: "screw you" },
      // Phase 3 — new roots
      { word: "porn", text: "watching porn" },
      { word: "blowjob", text: "gave a blowjob" },
      { word: "jizz", text: "jizz everywhere" },
      { word: "dildo", text: "bought a dildo" },
      { word: "orgasm", text: "had an orgasm" },
      { word: "orgy", text: "wild orgy" },
      { word: "hooker", text: "street hooker" },
      { word: "negro", text: "dirty negro" },
      { word: "masturbate", text: "caught masturbating" },
      { word: "semen", text: "covered in semen" },
      { word: "pussy", text: "wet pussy" },
      { word: "cum", text: "wants cum" },
      { word: "penis", text: "show me your penis" },
      { word: "tit", text: "nice tits" },
      { word: "vagina", text: "lick my vagina" },
      { word: "anal", text: "anal sex" },
      { word: "rape", text: "he raped her" },
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
      "unfucking", "fuckery",
      "shitty", "bullshit", "dipshit", "shithole",
      "shitbag", "shitload", "shithouse", "shitlist", "shitfaced",
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
      // Phase 1/3 new variants
      "hells", "pricks", "pricked", "pricking",
      "screwed", "screwing", "screws",
      "pornographic", "pornography", "porno",
      "blowjobs",
      "jizzed", "jizzing",
      "dildos",
      "orgasms", "orgasmic",
      "orgies",
      "hookers",
      "negroes",
      "masturbating", "masturbation",
      "pussies",
      "cumming", "cumshot",
      "penises",
      "tits", "titty", "titties",
      "vaginas", "vaginal",
      "raped", "raping", "rapist", "rapists",
      // Compound variants
      "fuckyou", "fuckoff", "fuckwad", "fuckup", "fuckall",
      "shitlord", "shitstain", "shitbrain",
      "cockwomble", "twatwaffle", "assmunch",
      "cumguzzler", "cumdumpster", "dickweasel",
      "thundercunt",
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

    // Phase 2 — new evasion tests
    it("detects ph→f evasion: phuck", () => {
      expect(terlik.containsProfanity("phuck you")).toBe(true);
    });

    it("detects ph→f evasion: phucking", () => {
      expect(terlik.containsProfanity("phucking idiot")).toBe(true);
    });

    it("detects #→h evasion: s#it", () => {
      expect(terlik.containsProfanity("s#it stain")).toBe(true);
    });

    it("detects 8→b evasion: 8itch", () => {
      expect(terlik.containsProfanity("8itch slap")).toBe(true);
    });

    it("detects 6→g evasion: ni66er", () => {
      expect(terlik.containsProfanity("ni66er")).toBe(true);
    });

    it("detects combined: n!66er", () => {
      expect(terlik.containsProfanity("n!66er")).toBe(true);
    });

    // CamelCase compound detection
    it("detects CamelCase: FuckYou", () => {
      expect(terlik.containsProfanity("FuckYou")).toBe(true);
    });

    it("detects CamelCase: ShitHead", () => {
      expect(terlik.containsProfanity("ShitHead")).toBe(true);
    });

    it("detects ALLCAPS+lower: SHITlord", () => {
      expect(terlik.containsProfanity("SHITlord")).toBe(true);
    });

    it("detects hashtag compound: #fuckyou", () => {
      expect(terlik.containsProfanity("#fuckyou")).toBe(true);
    });

    // Accented / Cyrillic / fullwidth bypass detection
    it("detects accented bypass: fück", () => {
      expect(terlik.containsProfanity("f\u00FCck")).toBe(true);
    });

    it("detects Cyrillic bypass: fuсk", () => {
      expect(terlik.containsProfanity("fu\u0441k")).toBe(true);
    });

    it("detects fullwidth: ｆｕｃｋ", () => {
      expect(terlik.containsProfanity("\uFF46\uFF55\uFF43\uFF4B")).toBe(true);
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
      // Phase 1 — new root whitelists
      "cocked",
      "hello", "shell", "seashell", "eggshell", "nutshell",
      "bombshell", "helium", "helicopter", "helmet",
      "prickle", "prickly",
      "screwdriver", "corkscrew",
      // Phase 2 — puck whitelist
      "puck", "pucks",
      // Phase 3 — new root whitelists
      "pussycat", "pussywillow", "pussyfoot",
      "penistone",
      "analysis", "analyst", "analog", "analogy", "analytical", "analyze",
      "grape", "drape", "scrape", "rapeseed",
      "therapist", "therapy",
      "title", "titan", "titillate",
      // CamelCase FP checks — must not flag legitimate camelCase
      "JavaScript", "CockpitDoor", "AssessmentReport",
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
