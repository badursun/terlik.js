import type { LanguageConfig } from "../types.js";
import dictionary from "./dictionary.json";
import { validateDictionary } from "../../dictionary/schema.js";

const validatedData = validateDictionary(dictionary);

export const config: LanguageConfig = {
  locale: "en",

  charMap: {},

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
    a: "[a4@]",
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
    o: "[o0]",
    p: "[p]",
    q: "[q]",
    r: "[r]",
    s: "[s5$]",
    t: "[t7+]",
    u: "[uv]",
    v: "[vu]",
    w: "[w]",
    x: "[x]",
    y: "[y]",
    z: "[z]",
  },

  dictionary: validatedData,
};
