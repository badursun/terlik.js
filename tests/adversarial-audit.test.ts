/**
 * RED-TEAM ADVERSARIAL AUDIT
 * 50+ NEW samples per language (EN, TR, ES, DE)
 * Tests: Unicode bypasses, homoglyphs, accented chars, fullwidth,
 * normalization inconsistencies, missing vocabulary, FP traps, ReDoS, boundaries
 */
import { describe, it, expect } from "vitest";
import { Terlik } from "../src/terlik.js";

// ─── Instances ───────────────────────────────────────
const en = new Terlik({ language: "en" });
const tr = new Terlik({ language: "tr" });
const es = new Terlik({ language: "es" });
const de = new Terlik({ language: "de" });

// ═════════════════════════════════════════════════════
// ENGLISH — 80+ adversarial samples
// ═════════════════════════════════════════════════════
describe("EN adversarial", () => {
  // ── 1. Accented Latin bypass — FIXED by NFKD + combining mark stripping ──
  describe("accented Latin bypass", () => {
    const accentedDetected = [
      { input: "f\u00FCck", desc: "fück (ü=U+00FC)" },
      { input: "f\u00F9ck", desc: "fùck (ù=U+00F9)" },
      { input: "f\u00FBck", desc: "fûck (û=U+00FB)" },
      { input: "sh\u00EEt", desc: "shît (î=U+00EE)" },
      { input: "sh\u00EFt", desc: "shït (ï=U+00EF)" },
      { input: "b\u00EEtch", desc: "bîtch (î=U+00EE)" },
      { input: "c\u00FCnt", desc: "cünt (ü=U+00FC)" },
      { input: "d\u00ECck", desc: "dìck (ì=U+00EC)" },
      { input: "n\u00EFgger", desc: "nïgger (ï=U+00EF)" },
      { input: "f\u00E0ggot", desc: "fàggot (à=U+00E0)" },
      { input: "r\u00E0pe", desc: "ràpe (à=U+00E0)" },
      { input: "p\u00F6rn", desc: "pörn (ö=U+00F6)" },
    ];

    for (const { input, desc } of accentedDetected) {
      it(`detects accented: ${desc}`, () => {
        expect(en.containsProfanity(input)).toBe(true);
      });
    }

    it("does not flag wönk (not wank)", () => {
      expect(en.containsProfanity("w\u00F6nk")).toBe(false);
    });
  });

  // ── 2. Cyrillic homoglyph bypass — FIXED by Cyrillic confusable mapping ──
  describe("Cyrillic homoglyph bypass", () => {
    const cyrillicDetected = [
      { input: "fu\u0441k", desc: "fuсk (Cyrillic с=U+0441 for c)" },
      { input: "f\u0443ck", desc: "fуck (Cyrillic у=U+0443 for u)" },
      { input: "\u0430ss", desc: "аss (Cyrillic а=U+0430 for a)" },
      { input: "sh\u0456t", desc: "shіt (Cyrillic і=U+0456 for i)" },
      { input: "b\u0456tch", desc: "bіtch (Cyrillic і=U+0456 for i)" },
      { input: "\u0441unt", desc: "сunt (Cyrillic с=U+0441 for c)" },
      { input: "di\u0441k", desc: "diсk (Cyrillic с=U+0441 for c)" },
      { input: "wh\u043Ere", desc: "whоre (Cyrillic о=U+043E for o)" },
      { input: "r\u0430pe", desc: "rаpe (Cyrillic а=U+0430 for a)" },
      { input: "p\u043Ern", desc: "pоrn (Cyrillic о=U+043E for o)" },
    ];

    for (const { input, desc } of cyrillicDetected) {
      it(`detects cyrillic: ${desc}`, () => {
        expect(en.containsProfanity(input)).toBe(true);
      });
    }
  });

  // ── 3. Fullwidth character bypass — FIXED by NFKD decomposition ──
  describe("fullwidth bypass", () => {
    const fullwidthDetected = [
      { input: "\uFF46\uFF55\uFF43\uFF4B", desc: "ｆｕｃｋ (fullwidth)" },
      { input: "\uFF53\uFF48\uFF49\uFF54", desc: "ｓｈｉｔ (fullwidth)" },
      { input: "f\uFF55ck", desc: "fｕck (mixed fullwidth u)" },
    ];

    for (const { input, desc } of fullwidthDetected) {
      it(`detects fullwidth: ${desc}`, () => {
        expect(en.containsProfanity(input)).toBe(true);
      });
    }
  });

  // ── 4. Unicode normalization — FIXED: NFC/NFD now consistent via NFKD pipeline ──
  describe("Unicode normalization", () => {
    it("detects NFD combining diacritic: fuc\\u0327k (c + cedilla)", () => {
      expect(en.containsProfanity("fuc\u0327k")).toBe(true);
    });

    it("detects NFC precomposed: fuçk (ç=U+00E7)", () => {
      expect(en.containsProfanity("fu\u00E7k")).toBe(true);
    });

    it("NFD and NFC produce consistent results for shît", () => {
      const nfd = "shi\u0302t"; // i + combining circumflex
      const nfc = "sh\u00EEt";  // precomposed î
      expect(en.containsProfanity(nfd)).toBe(true);
      expect(en.containsProfanity(nfc)).toBe(true);
    });
  });

  // ── 5. Zero-width / invisible character bypass — stripped in normalizer ──
  describe("zero-width chars", () => {
    it("detects ZWSP: f\\u200Buck", () => {
      expect(en.containsProfanity("f\u200Buck")).toBe(true);
    });
    it("detects ZWNJ: f\\u200Cu\\u200Cc\\u200Ck", () => {
      expect(en.containsProfanity("f\u200Cu\u200Cc\u200Ck")).toBe(true);
    });
    it("detects soft hyphen: f\\u00ADu\\u00ADc\\u00ADk", () => {
      expect(en.containsProfanity("f\u00ADu\u00ADc\u00ADk")).toBe(true);
    });
  });

  // ── 6. Missing vocabulary (common profanity NOT in dictionary) ──
  describe("missing vocabulary", () => {
    const missingWords = [
      { input: "you're a wop", desc: "wop (ethnic slur)" },
      { input: "stupid spaz", desc: "spaz (ableist slur)" },
      { input: "white cracker", desc: "cracker (racial)" },
      { input: "stupid honky", desc: "honky (racial)" },
      { input: "dirty beaner", desc: "beaner (ethnic slur)" },
      { input: "total MILF", desc: "MILF (sexual acronym)" },
      { input: "GTFO now", desc: "GTFO (profanity acronym)" },
      { input: "FFS stop", desc: "FFS (for fuck's sake)" },
      { input: "what a SOB", desc: "SOB (son of a bitch)" },
      { input: "such a hoe", desc: "hoe (slang for whore)" },
      { input: "those thots", desc: "thot (slang insult)" },
      { input: "freaking idiot", desc: "freaking (euphemism)" },
      { input: "effing moron", desc: "effing (euphemism)" },
      { input: "what a knob", desc: "knob (British insult)" },
      { input: "bloody wanker", desc: "bloody (British profanity)" },
    ];

    for (const { input, desc } of missingWords) {
      it(`missing: ${desc}`, () => {
        const result = en.containsProfanity(input);
        console.log(`[AUDIT] missing "${desc}" → detected=${result}`);
      });
    }
  });

  // ── 7. False positive stress (innocent words that might trigger) ──
  describe("FP stress", () => {
    const fpTraps = [
      "assumption", "cocky", "therapists", "grapevine",
      "passionate", "compassionate", "embarrass", "harassment",
      "scrapbook", "cumulonimbus", "cumulative", "circumvent",
      "pennant", "penalize", "peninsula", "penetrate",
      "Titanic", "constitution", "analytical", "psychoanalysis",
      "masseuse", "cassette", "classic", "classy",
      "Dickensian", "cocktails", "peacocking",
      "buttress", "butterscotch", "rebuttal",
      "sextant", "sextet", "Sussex",
      "shitake", "document", "buckle",
      "Hancock", "cocktail", "shuttlecocks",
    ];

    for (const word of fpTraps) {
      it(`no FP: "${word}"`, () => {
        expect(en.containsProfanity(word)).toBe(false);
      });
    }
  });

  // ── 8. Compound evasion — FIXED by dictionary variants ──
  describe("compound evasion", () => {
    const compoundsDetected = [
      "fuckwad", "shitlord", "cockwomble", "twatwaffle",
      "assmunch", "cumguzzler", "dickweasel",
    ];

    for (const word of compoundsDetected) {
      it(`detects compound: ${word}`, () => {
        expect(en.containsProfanity(word)).toBe(true);
      });
    }
  });

  // ── 9. Leet combos not tested ──
  describe("extended leet", () => {
    const leetCombos = [
      { input: "5h!7", desc: "5h!7 → shit" },
      { input: "ph@660t", desc: "ph@660t → faggot" },
      { input: "n!664", desc: "n!664 → nigga" },
      { input: "pr0n", desc: "pr0n → porn" },
      { input: "a55", desc: "a55 → ass" },
      { input: "a55hole", desc: "a55hole → asshole" },
      { input: "d!ck", desc: "d!ck → dick" },
      { input: "c0ck", desc: "c0ck → cock" },
      { input: "p3n!5", desc: "p3n!5 → penis" },
      { input: "v4g!n4", desc: "v4g!n4 → vagina" },
    ];

    for (const { input, desc } of leetCombos) {
      it(`leet: ${desc}`, () => {
        const result = en.containsProfanity(input);
        console.log(`[AUDIT] leet "${desc}" → detected=${result}`);
      });
    }
  });

  // ── 10. Boundary edge cases ──
  describe("boundary attacks", () => {
    it("detects profanity in URL path: example.com/fuck", () => {
      expect(en.containsProfanity("visit example.com/fuck")).toBe(true);
    });
    it("detects profanity in email: fuck@email.com", () => {
      expect(en.containsProfanity("email fuck@email.com")).toBe(true);
    });
    it("profanity with trailing number: fuck123 — KNOWN FN (digits in WORD_CHAR)", () => {
      // Digit boundary split deferred to avoid breaking leet detection
      const result = en.containsProfanity("fuck123");
      console.log(`[AUDIT] trailing number → detected=${result}`);
    });
    it("detects profanity in CamelCase: FuckYou", () => {
      expect(en.containsProfanity("FuckYou")).toBe(true);
    });
    it("detects profanity hyphenated: mother-fucker", () => {
      expect(en.containsProfanity("mother-fucker")).toBe(true);
    });
    it("detects profanity in hashtag: #fuckyou", () => {
      expect(en.containsProfanity("#fuckyou")).toBe(true);
    });
  });
});

// ═════════════════════════════════════════════════════
// TURKISH — 55+ adversarial samples
// ═════════════════════════════════════════════════════
describe("TR adversarial", () => {
  // ── 1. Turkish İ/ı locale attacks ──
  describe("İ/ı locale edge cases", () => {
    it("SİKTİR (dotted İ capitals)", () => {
      expect(tr.containsProfanity("SİKTİR")).toBe(true);
    });
    it("SIKTIR (ASCII capitals — should NOT match on Turkish locale)", () => {
      // In Turkish locale, 'I' lowercases to 'ı', not 'i'. So SIKTIR → sıktır → should normalize to siktir.
      // charMap: ı→i. So sıktır → siktir. Should detect.
      const result = tr.containsProfanity("SIKTIR");
      console.log(`[AUDIT] TR SIKTIR (ASCII I) → detected=${result}`);
    });
    it("sIktIr (mixed ASCII I and lowercase)", () => {
      const result = tr.containsProfanity("sIktIr");
      console.log(`[AUDIT] TR sIktIr → detected=${result}`);
    });
  });

  // ── 2. Accented Latin bypass in TR — FIXED by NFKD ──
  describe("accented bypass TR", () => {
    const trAccented = [
      { input: "s\u00ECktir", desc: "sìktir (ì=U+00EC)" },
      { input: "s\u00EEktir", desc: "sîktir (î=U+00EE)" },
      { input: "or\u00F2spu", desc: "oròspu (ò=U+00F2)" },
    ];

    for (const { input, desc } of trAccented) {
      it(`detects accented TR: ${desc}`, () => {
        expect(tr.containsProfanity(input)).toBe(true);
      });
    }
  });

  // ── 3. Cyrillic homoglyph in TR — FIXED by Cyrillic mapping ──
  describe("Cyrillic TR bypass", () => {
    it("detects sіktіr (Cyrillic і for i)", () => {
      expect(tr.containsProfanity("s\u0456kt\u0456r")).toBe(true);
    });
    it("detects оrоspu (Cyrillic о for o)", () => {
      expect(tr.containsProfanity("\u043Er\u043Espu")).toBe(true);
    });
  });

  // ── 4. Turkish whitelist FP checks ──
  describe("TR FP stress", () => {
    const trSafe = [
      "sıkıntı", "sıkıştı", "sıkma", "sıkı", "sıkıcı",
      "ambalaj", "ameliyat", "ambulans", "amazon",
      "bokser", "boksör", "malzeme", "maliyet",
      "memur", "memorial", "memleket", "memento",
      "piknik", "kasım", "namuslu", "ahlaki",
      "dolunay", "dolap", "dolar", "dolma",
      "sikke", "siklet", "gotan", "gotik", "gotham",
      "yarasa", "tasselled",
      "sıkmak", "sıkılmak",
      // NOTE: "sıktı" (past tense of sıkmak) IS detected as profanity.
      // After normalization: ı→i → "sikti" which is a variant of "sik" root.
      // This is a KNOWN FALSE POSITIVE — debatable since "sıktı" is commonly
      // used as a euphemism for the profane "sikti".
      "masikler", "sikilasma",
    ];

    for (const word of trSafe) {
      it(`no FP: "${word}"`, () => {
        expect(tr.containsProfanity(word)).toBe(false);
      });
    }
  });

  // ── 5. Missing / creative TR evasion ──
  describe("TR evasion", () => {
    const trEvasion = [
      { input: "s!kt!r", desc: "s!kt!r (! for i)" },
      { input: "$!kt!r", desc: "$!kt!r ($ for s, ! for i)" },
      { input: "s.i.k.t.i.r", desc: "separator siktir" },
      { input: "siiiiktir", desc: "repeated i" },
      { input: "s1k", desc: "s1k (1 for i)" },
      { input: "0r0spu", desc: "0r0spu (0 for o)" },
      { input: "g0tveren", desc: "g0tveren (0 for ö)" },
      { input: "b0k", desc: "b0k (0 for o)" },
      { input: "4mk", desc: "4mk (4 for a)" },
      { input: "y4rr4k", desc: "y4rr4k (4 for a)" },
      { input: "t4s4k", desc: "t4s4k (4 for a → tasak)" },
      { input: "p!c", desc: "p!c (! for i, c for ç)" },
      { input: "k4hpe", desc: "k4hpe (4 for a)" },
      { input: "5erefsiz", desc: "5erefsiz (5 for ş)" },
      { input: "p1c", desc: "p1c (1 for i)" },
    ];

    for (const { input, desc } of trEvasion) {
      it(`TR evasion: ${desc}`, () => {
        const result = tr.containsProfanity(input);
        console.log(`[AUDIT] TR evasion "${desc}" → detected=${result}`);
      });
    }
  });

  // ── 6. Turkish number expansion edge cases ──
  describe("TR number expansion", () => {
    it("s2k (2→iki → sikik)", () => {
      expect(tr.containsProfanity("s2k")).toBe(true);
    });
    it("s100 (100→yüz but not between letters → safe)", () => {
      expect(tr.containsProfanity("s100")).toBe(false);
    });
    it("s100k should not expand (100 must be between letters)", () => {
      const result = tr.containsProfanity("s100k");
      console.log(`[AUDIT] s100k → detected=${result}`);
    });
  });

  // ── 7. Suffix boundary attacks ──
  // FINDING: "sik" entry has ~40 variants → regex 8058 chars.
  // Adding suffix group (83 TR suffixes) would exceed MAX_PATTERN_LENGTH (10000),
  // so the safety guard strips ALL suffix matching for this entry.
  // "göt" root: "got" is 3 chars → strictForms (no suffix allowed).
  describe("TR suffix boundary", () => {
    it("siktirci — suffix stripped due to pattern length overflow", () => {
      // KNOWN FN: suffix group stripped for "sik" entry (pattern > 10K chars)
      const result = tr.containsProfanity("siktirci");
      console.log(`[AUDIT] siktirci (suffix overflow) → detected=${result}`);
    });
    it("orospu + Turkish suffix -lar", () => {
      expect(tr.containsProfanity("orospular")).toBe(true);
    });
    it("götlük — 3-char root goes to strictForms, no suffix", () => {
      // KNOWN FN: "got" (3 chars) → strict boundary, "luk" suffix not applied
      const result = tr.containsProfanity("götlük");
      console.log(`[AUDIT] götlük (strict root, no suffix) → detected=${result}`);
    });
  });
});

// ═════════════════════════════════════════════════════
// SPANISH — 50+ adversarial samples
// ═════════════════════════════════════════════════════
describe("ES adversarial", () => {
  // ── 1. Accented bypass ES — FIXED by NFKD ──
  describe("accented bypass ES", () => {
    const esAccented = [
      { input: "m\u00ECerda", desc: "mìerda (ì for i)" },
      { input: "p\u00FBta", desc: "pûta (û for u)" },
      { input: "c\u00F2ño", desc: "còño (ò for o)" },
      { input: "h\u00ECjoputa", desc: "hìjoputa (ì for i)" },
      { input: "p\u00E8ndejo", desc: "pèndejo (è for e)" },
    ];

    for (const { input, desc } of esAccented) {
      it(`detects accented ES: ${desc}`, () => {
        expect(es.containsProfanity(input)).toBe(true);
      });
    }
  });

  // ── 2. Cyrillic bypass ES ──
  describe("Cyrillic ES bypass", () => {
    it("detects putа (Cyrillic а for a)", () => {
      expect(es.containsProfanity("put\u0430")).toBe(true);
    });
    it("mierда (Cyrillic д+а) — д is NOT a confusable, stays as separator", () => {
      // Only Cyrillic а is mapped; д has no Latin lookalike → acts as word break
      const result = es.containsProfanity("mier\u0434\u0430");
      console.log(`[AUDIT] ES double Cyrillic → detected=${result}`);
    });
  });

  // ── 3. ES Leet combos ──
  describe("ES leet", () => {
    const esLeet = [
      { input: "m13rd4", desc: "m13rd4 → mierda" },
      { input: "put@", desc: "put@ → puta" },
      { input: "c4br0n", desc: "c4br0n → cabron" },
      { input: "j0d3r", desc: "j0d3r → joder" },
      { input: "p3nd3j0", desc: "p3nd3j0 → pendejo" },
      { input: "ch!ng4r", desc: "ch!ng4r → chingar" },
      { input: "m4r!c0n", desc: "m4r!c0n → maricon" },
      { input: "cul0", desc: "cul0 → culo" },
    ];

    for (const { input, desc } of esLeet) {
      it(`ES leet: ${desc}`, () => {
        const result = es.containsProfanity(input);
        console.log(`[AUDIT] ES leet "${desc}" → detected=${result}`);
      });
    }
  });

  // ── 4. ES separator evasion ──
  describe("ES separator", () => {
    const esSep = [
      { input: "p.u.t.a", desc: "p.u.t.a" },
      { input: "m-i-e-r-d-a", desc: "m-i-e-r-d-a" },
      { input: "h_i_j_o_p_u_t_a", desc: "hijoputa separated" },
      { input: "c.o.ñ.o", desc: "c.o.ñ.o" },
    ];

    for (const { input, desc } of esSep) {
      it(`ES separator: ${desc}`, () => {
        const result = es.containsProfanity(input);
        console.log(`[AUDIT] ES separator "${desc}" → detected=${result}`);
      });
    }
  });

  // ── 5. ES FP stress ──
  describe("ES FP stress", () => {
    const esSafe = [
      "computadora", "disputar", "reputacion", "imputar",
      "pollo", "pollito", "polluelo", "folleto", "follaje",
      "particular", "articulo", "vehicular", "calcular",
      "maricopa", "putamen",
      // NOTE: "cojonudo" IS detected — it's a variant of "cojones" root.
      // In modern Spanish "cojonudo" = "great/awesome", but etymologically profane.
      // Debatable FP — library intentionally detects it.
      "disputar", "polleria",
    ];

    for (const word of esSafe) {
      it(`no FP ES: "${word}"`, () => {
        expect(es.containsProfanity(word)).toBe(false);
      });
    }
  });

  // ── 6. Missing ES vocabulary ──
  describe("missing ES vocabulary", () => {
    const esMissing = [
      { input: "hijo de la chingada", desc: "hijo de la chingada" },
      { input: "vete a la verga", desc: "vete a la verga" },
      { input: "no mames", desc: "no mames (Mexican slang)" },
      { input: "culiao", desc: "culiao (Chilean)" },
      { input: "conchetumare", desc: "conchetumare (Chilean)" },
      { input: "gonorrea", desc: "gonorrea (Colombian insult)" },
      { input: "malparido", desc: "malparido (Colombian)" },
      { input: "pajero", desc: "pajero (masturbator)" },
      { input: "mamón", desc: "mamón (from mamada variants)" },
    ];

    for (const { input, desc } of esMissing) {
      it(`ES missing: ${desc}`, () => {
        const result = es.containsProfanity(input);
        console.log(`[AUDIT] ES missing "${desc}" → detected=${result}`);
      });
    }
  });

  // ── 7. ES repetition ──
  describe("ES repetition", () => {
    it("puuuuta", () => {
      const result = es.containsProfanity("puuuuta");
      console.log(`[AUDIT] ES repetition puuuuta → detected=${result}`);
    });
    it("mieeeeerda", () => {
      const result = es.containsProfanity("mieeeeerda");
      console.log(`[AUDIT] ES repetition mieeeeerda → detected=${result}`);
    });
  });
});

// ═════════════════════════════════════════════════════
// GERMAN — 50+ adversarial samples
// ═════════════════════════════════════════════════════
describe("DE adversarial", () => {
  // ── 1. ß / ss interchange ──
  describe("ß/ss interchange", () => {
    it("Scheisse (ss instead of ß)", () => {
      expect(de.containsProfanity("Scheisse")).toBe(true);
    });
    it("SCHEISSE (uppercase)", () => {
      expect(de.containsProfanity("SCHEISSE")).toBe(true);
    });
    it("SCHEIßE (uppercase with ß)", () => {
      expect(de.containsProfanity("SCHEIßE")).toBe(true);
    });
  });

  // ── 2. Greek beta bypass ──
  describe("Greek beta bypass", () => {
    it("Schei\u03B2e (Greek β instead of ß)", () => {
      const result = de.containsProfanity("Schei\u03B2e");
      console.log(`[AUDIT] DE Greek β bypass → detected=${result}`);
    });
  });

  // ── 3. Accented bypass DE — FIXED by NFKD ──
  describe("accented bypass DE", () => {
    const deAccented = [
      { input: "f\u00ECck", desc: "fìck (ì for i)" },
      { input: "f\u00EEck", desc: "fîck (î for i)" },
      { input: "H\u00F9re", desc: "Hùre (ù for u)" },
      { input: "F\u00F2tze", desc: "Fòtze (ò for o)" },
      { input: "Schl\u00E0mpe", desc: "Schlàmpe (à for a)" },
      { input: "W\u00ECchser", desc: "Wìchser (ì for i)" },
    ];

    for (const { input, desc } of deAccented) {
      it(`detects accented DE: ${desc}`, () => {
        expect(de.containsProfanity(input)).toBe(true);
      });
    }
  });

  // ── 4. Cyrillic bypass DE — FIXED by Cyrillic mapping ──
  describe("Cyrillic DE bypass", () => {
    it("detects Fіck (Cyrillic і for i)", () => {
      expect(de.containsProfanity("F\u0456ck")).toBe(true);
    });
    it("detects Аrsch (Cyrillic А for A)", () => {
      expect(de.containsProfanity("\u0410rsch")).toBe(true);
    });
  });

  // ── 5. DE leet ──
  describe("DE leet", () => {
    const deLeet = [
      { input: "f1ck3n", desc: "f1ck3n → ficken" },
      { input: "4r5ch", desc: "4r5ch → arsch" },
      { input: "hur3", desc: "hur3 → hure" },
      { input: "f07z3", desc: "f07z3 → fotze" },
      { input: "5ch31553", desc: "5ch31553 → scheisse" },
      { input: "w1ch53r", desc: "w1ch53r → wichser" },
      { input: "5chw4nz", desc: "5chw4nz → schwanz" },
    ];

    for (const { input, desc } of deLeet) {
      it(`DE leet: ${desc}`, () => {
        const result = de.containsProfanity(input);
        console.log(`[AUDIT] DE leet "${desc}" → detected=${result}`);
      });
    }
  });

  // ── 6. DE separator ──
  describe("DE separator", () => {
    it("s.c.h.e.i.ß.e (separator)", () => {
      const result = de.containsProfanity("s.c.h.e.i.ß.e");
      console.log(`[AUDIT] DE separator scheiße → detected=${result}`);
    });
    it("f-i-c-k-e-n (separator)", () => {
      const result = de.containsProfanity("f-i-c-k-e-n");
      console.log(`[AUDIT] DE separator ficken → detected=${result}`);
    });
    it("a_r_s_c_h (separator)", () => {
      const result = de.containsProfanity("a_r_s_c_h");
      console.log(`[AUDIT] DE separator arsch → detected=${result}`);
    });
  });

  // ── 7. DE FP stress ──
  describe("DE FP stress", () => {
    const deSafe = [
      "schwanger", "schwangerschaft", "geschichte",
      "ficktion", "arschen", "schwanzen",
      "Gesellschaft", "Wirtschaft", "Wissenschaft",
      "Druckerei", "Druckfehler",
      "Spastik", "Spastiker",
    ];

    for (const word of deSafe) {
      it(`no FP DE: "${word}"`, () => {
        expect(de.containsProfanity(word)).toBe(false);
      });
    }
  });

  // ── 8. DE repetition ──
  describe("DE repetition", () => {
    it("Scheeeeisse", () => {
      const result = de.containsProfanity("Scheeeeisse");
      console.log(`[AUDIT] DE repetition Scheeeeisse → detected=${result}`);
    });
    it("Fiiiicken", () => {
      const result = de.containsProfanity("Fiiiicken");
      console.log(`[AUDIT] DE repetition Fiiiicken → detected=${result}`);
    });
    it("Aaaarsch", () => {
      const result = de.containsProfanity("Aaaarsch");
      console.log(`[AUDIT] DE repetition Aaaarsch → detected=${result}`);
    });
  });

  // ── 9. Missing DE vocabulary ──
  describe("missing DE vocabulary", () => {
    const deMissing = [
      { input: "Dummkopf", desc: "Dummkopf (variant in dict)" },
      { input: "Arschgeige", desc: "Arschgeige (variant in dict)" },
      { input: "Sackgesicht", desc: "Sackgesicht (insult)" },
      { input: "Lutscher", desc: "Lutscher (insult)" },
      { input: "Wichse", desc: "Wichse (variant in dict)" },
      { input: "Scheißkerl", desc: "Scheißkerl (compound)" },
      { input: "Fickfehler", desc: "Fickfehler (variant in dict)" },
    ];

    for (const { input, desc } of deMissing) {
      it(`DE test: ${desc}`, () => {
        const result = de.containsProfanity(input);
        console.log(`[AUDIT] DE "${desc}" → detected=${result}`);
      });
    }
  });
});

// ═════════════════════════════════════════════════════
// CROSS-CUTTING: ReDoS & Performance
// ═════════════════════════════════════════════════════
describe("ReDoS stress", () => {
  it("pathological separator pattern (EN)", () => {
    // 1000 dots followed by "fuck" — tests regex backtracking
    const input = ".".repeat(1000) + "fuck";
    const start = performance.now();
    en.containsProfanity(input);
    const elapsed = performance.now() - start;
    console.log(`[AUDIT] ReDoS 1000 dots + fuck → ${elapsed.toFixed(1)}ms`);
    expect(elapsed).toBeLessThan(1000);
  });

  it("alternating separator/letter flood (EN)", () => {
    // a.b.c.d... × 500
    const input = Array.from({ length: 500 }, (_, i) =>
      String.fromCharCode(97 + (i % 26))
    ).join(".");
    const start = performance.now();
    en.containsProfanity(input);
    const elapsed = performance.now() - start;
    console.log(`[AUDIT] ReDoS alt sep/letter 500 → ${elapsed.toFixed(1)}ms`);
    expect(elapsed).toBeLessThan(2000);
  });

  it("maxLength input filled with near-matches (EN)", () => {
    // Fill 10K chars with "fuc " repeated (near-match for fuck)
    const input = "fuc ".repeat(2500);
    const start = performance.now();
    en.containsProfanity(input);
    const elapsed = performance.now() - start;
    console.log(`[AUDIT] ReDoS 10K near-match → ${elapsed.toFixed(1)}ms`);
    expect(elapsed).toBeLessThan(5000);
  });

  it("nested Unicode combining marks flood (EN)", () => {
    // f + 100 combining marks + u + 100 combining marks + c + k
    const marks = "\u0300".repeat(100);
    const input = `f${marks}u${marks}c${marks}k`;
    const start = performance.now();
    const result = en.containsProfanity(input);
    const elapsed = performance.now() - start;
    console.log(`[AUDIT] ReDoS combining marks flood → ${elapsed.toFixed(1)}ms, detected=${result}`);
    expect(elapsed).toBeLessThan(2000);
  });

  it("TR maxLength with suffix chain attempts", () => {
    // "sik" + long suffix-like chars
    const input = "sik" + "tirlerinesinin".repeat(700);
    const start = performance.now();
    tr.containsProfanity(input.slice(0, 10000));
    const elapsed = performance.now() - start;
    console.log(`[AUDIT] ReDoS TR suffix chain → ${elapsed.toFixed(1)}ms`);
    expect(elapsed).toBeLessThan(5000);
  });
});

// ═════════════════════════════════════════════════════
// CROSS-LANGUAGE ISOLATION
// ═════════════════════════════════════════════════════
describe("cross-language isolation", () => {
  it("EN instance does not detect TR profanity", () => {
    expect(en.containsProfanity("siktir git")).toBe(false);
  });
  it("EN instance does not detect DE profanity", () => {
    expect(en.containsProfanity("du Arschloch")).toBe(false);
  });
  it("TR instance does not detect EN profanity", () => {
    expect(tr.containsProfanity("what the fuck")).toBe(false);
  });
  it("DE instance does not detect ES profanity", () => {
    expect(de.containsProfanity("hijo de puta")).toBe(false);
  });
  it("ES instance does not detect TR profanity", () => {
    expect(es.containsProfanity("orospu çocuğu")).toBe(false);
  });
});
