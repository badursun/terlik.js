// ─── Types ───────────────────────────────────────────

/** Configuration for creating a language-specific normalizer. */
export interface NormalizerConfig {
  locale: string;
  charMap: Record<string, string>;
  leetMap: Record<string, string>;
  numberExpansions?: [string, string][];
}

// ─── Language-agnostic helpers ───────────────────────

function replaceFromMap(text: string, map: Record<string, string>): string {
  let result = "";
  for (const ch of text) {
    result += map[ch] ?? ch;
  }
  return result;
}

function buildNumberExpander(
  expansions: [string, string][],
): ((text: string) => string) | null {
  if (expansions.length === 0) return null;

  const regex = new RegExp(
    expansions
      .map(([num]) => {
        const escaped = num.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        return `(?<=[a-zA-ZÀ-ɏ])${escaped}(?=[a-zA-ZÀ-ɏ])`;
      })
      .join("|"),
    "g",
  );
  const lookup: Record<string, string> = Object.fromEntries(expansions);

  return (text: string) =>
    text.replace(regex, (match) => lookup[match] ?? match);
}

function removePunctuation(text: string): string {
  return text.replace(/(?<=[a-zA-ZÀ-ɏ])[.\-_*,;:!?]+(?=[a-zA-ZÀ-ɏ])/g, "");
}

function collapseRepeats(text: string): string {
  return text.replace(/(.)\1{2,}/g, "$1");
}

function trimWhitespace(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

// ─── Factory: creates a normalize function for any language ───

/**
 * Creates a language-specific normalize function using the given config.
 * The returned function applies a 6-stage pipeline: lowercase, char folding,
 * number expansion, leet decode, punctuation removal, repeat collapse.
 *
 * @param config - Language-specific normalization settings.
 * @returns A normalize function for the configured language.
 *
 * @example
 * ```ts
 * const normalize = createNormalizer({
 *   locale: "de",
 *   charMap: { ä: "a", ö: "o", ü: "u", ß: "ss" },
 *   leetMap: { "0": "o", "3": "e" },
 * });
 * normalize("Scheiße"); // "scheisse"
 * ```
 */
export function createNormalizer(config: NormalizerConfig): (text: string) => string {
  const expandNumbers = config.numberExpansions
    ? buildNumberExpander(config.numberExpansions)
    : null;

  return function normalize(text: string): string {
    let result = text;
    result = result.toLocaleLowerCase(config.locale);
    result = replaceFromMap(result, config.charMap);
    if (expandNumbers) {
      result = expandNumbers(result);
    }
    result = replaceFromMap(result, config.leetMap);
    result = removePunctuation(result);
    result = collapseRepeats(result);
    result = trimWhitespace(result);
    return result;
  };
}

// ─── Backward-compatible Turkish defaults ────────────
// Inline constants to avoid circular imports with lang/tr/config.ts

const TURKISH_CHAR_MAP: Record<string, string> = {
  ç: "c", Ç: "c", ğ: "g", Ğ: "g", ı: "i", İ: "i",
  ö: "o", Ö: "o", ş: "s", Ş: "s", ü: "u", Ü: "u",
};

const LEET_MAP: Record<string, string> = {
  "0": "o", "1": "i", "2": "i", "3": "e", "4": "a",
  "5": "s", "6": "g", "7": "t", "8": "b", "9": "g",
  "@": "a", $: "s", "!": "i",
};

const TR_NUMBER_MAP: [string, string][] = [
  ["100", "yuz"], ["50", "elli"], ["10", "on"], ["2", "iki"],
];

const _turkishNormalize = createNormalizer({
  locale: "tr",
  charMap: TURKISH_CHAR_MAP,
  leetMap: LEET_MAP,
  numberExpansions: TR_NUMBER_MAP,
});

/**
 * Normalizes text using the default Turkish locale pipeline.
 * Shorthand for `createNormalizer()` with Turkish defaults.
 *
 * @param text - The text to normalize.
 * @returns The normalized text.
 *
 * @example
 * ```ts
 * normalize("S.İ.K.T.İ.R"); // "siktir"
 * normalize("$1kt1r");       // "siktir"
 * ```
 */
export function normalize(text: string): string {
  return _turkishNormalize(text);
}

// ─── Individual exports for test backward compat ─────

function toLowercase(text: string): string {
  return text.toLocaleLowerCase("tr");
}

function replaceTurkishChars(text: string): string {
  return replaceFromMap(text, TURKISH_CHAR_MAP);
}

function replaceLeetspeak(text: string): string {
  return replaceFromMap(text, LEET_MAP);
}

function expandTurkishNumbers(text: string): string {
  const expander = buildNumberExpander(TR_NUMBER_MAP);
  return expander ? expander(text) : text;
}

export {
  toLowercase,
  replaceTurkishChars,
  replaceLeetspeak,
  expandTurkishNumbers,
  removePunctuation,
  collapseRepeats,
  trimWhitespace,
};
