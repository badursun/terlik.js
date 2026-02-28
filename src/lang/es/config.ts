import type { LanguageConfig } from "../types.js";
import dictionary from "./dictionary.json";
import { validateDictionary } from "../../dictionary/schema.js";

const validatedData = validateDictionary(dictionary);

export const config: LanguageConfig = {
  locale: "es",

  charMap: {
    ñ: "n",
    Ñ: "n",
    á: "a",
    Á: "a",
    é: "e",
    É: "e",
    í: "i",
    Í: "i",
    ó: "o",
    Ó: "o",
    ú: "u",
    Ú: "u",
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
    a: "[a4@áÁ]",
    b: "[b8]",
    c: "[c]",
    d: "[d]",
    e: "[e3éÉ]",
    f: "[f]",
    g: "[g9]",
    h: "[h#]",
    i: "[i1!|íÍ]",
    j: "[j]",
    k: "[k]",
    l: "[l1|]",
    m: "[m]",
    n: "[nñÑ]",
    o: "[o0óÓ]",
    p: "[p]",
    q: "[q]",
    r: "[r]",
    s: "[s5$]",
    t: "[t7+]",
    u: "[uvúÚ]",
    v: "[vu]",
    w: "[w]",
    x: "[x]",
    y: "[y]",
    z: "[z]",
  },

  dictionary: validatedData,
};
