import type { DictionaryData } from "../dictionary/schema.js";

export interface LanguageConfig {
  /** BCP-47 locale tag for toLocaleLowerCase (e.g. "tr", "en", "es", "de") */
  locale: string;

  /** Diacritics normalization: language-specific characters to base Latin.
   *  e.g. Turkish: ç→c, ğ→g, ı→i; German: ä→a, ö→o, ü→u, ß→ss */
  charMap: Record<string, string>;

  /** Leet speak substitution map.
   *  e.g. "0"→"o", "1"→"i", "@"→"a", "$"→"s" */
  leetMap: Record<string, string>;

  /** Visual similarity regex character classes for the pattern engine.
   *  Each key is a base letter, value is a regex character class string.
   *  e.g. a: "[a4@àáâãäå]", s: "[s5$şŞß]" */
  charClasses: Record<string, string>;

  /** Optional number-to-word expansions applied between letters.
   *  e.g. Turkish: [["2", "iki"], ["10", "on"]]
   *  Most languages leave this undefined. */
  numberExpansions?: [string, string][];

  /** Validated dictionary data (entries, whitelist, suffixes, version). */
  dictionary: DictionaryData;
}
