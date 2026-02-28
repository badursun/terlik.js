import type { LanguageConfig } from "../types.js";
import dictionary from "./dictionary.json";
import { validateDictionary } from "../../dictionary/schema.js";

const validatedData = validateDictionary(dictionary);

export const config: LanguageConfig = {
  locale: "de",

  charMap: {
    ä: "a",
    Ä: "a",
    ö: "o",
    Ö: "o",
    ü: "u",
    Ü: "u",
    ß: "ss",
  },

  leetMap: {
    "0": "o",
    "1": "i",
    "3": "e",
    "4": "a",
    "5": "s",
    "7": "t",
    "@": "a",
    $: "s",
    "!": "i",
  },

  charClasses: {
    a: "[a4@äÄ]",
    b: "[b8]",
    c: "[c]",
    d: "[d]",
    e: "[e3]",
    f: "[f]",
    g: "[g9]",
    h: "[h#]",
    i: "[i1!|]",
    j: "[j]",
    k: "[k]",
    l: "[l1|]",
    m: "[m]",
    n: "[n]",
    o: "[o0öÖ]",
    p: "[p]",
    q: "[q]",
    r: "[r]",
    s: "[s5$ß]",
    t: "[t7+]",
    u: "[uvüÜ]",
    v: "[vu]",
    w: "[w]",
    x: "[x]",
    y: "[y]",
    z: "[z]",
  },

  dictionary: validatedData,
};
