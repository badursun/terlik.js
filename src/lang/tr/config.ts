import type { LanguageConfig } from "../types.js";
import dictionary from "./dictionary.json";
import { validateDictionary } from "../../dictionary/schema.js";

const validatedData = validateDictionary(dictionary);

export const config: LanguageConfig = {
  locale: "tr",

  charMap: {
    ç: "c",
    Ç: "c",
    ğ: "g",
    Ğ: "g",
    ı: "i",
    İ: "i",
    ö: "o",
    Ö: "o",
    ş: "s",
    Ş: "s",
    ü: "u",
    Ü: "u",
  },

  leetMap: {
    "0": "o",
    "1": "i",
    "2": "i",
    "3": "e",
    "4": "a",
    "5": "s",
    "6": "g",
    "7": "t",
    "8": "b",
    "9": "g",
    "@": "a",
    $: "s",
    "!": "i",
  },

  charClasses: {
    a: "[a4@àáâãäå]",
    b: "[b8ß]",
    c: "[cçÇ¢©]",
    d: "[d]",
    e: "[e3€èéêë]",
    f: "[f]",
    g: "[gğĞ69]",
    h: "[h#]",
    i: "[iıİ12!|ìíîï]",
    j: "[j]",
    k: "[k]",
    l: "[l1|]",
    m: "[m]",
    n: "[nñ]",
    o: "[o0öÖòóôõ]",
    p: "[p]",
    q: "[qk]",
    r: "[r]",
    s: "[s5$şŞß]",
    t: "[t7+]",
    u: "[uüÜùúûv]",
    v: "[vu]",
    w: "[w]",
    x: "[x]",
    y: "[y]",
    z: "[z2]",
  },

  numberExpansions: [
    ["100", "yuz"],
    ["50", "elli"],
    ["10", "on"],
    ["2", "iki"],
  ],

  dictionary: validatedData,
};
