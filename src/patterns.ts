import type { Category, CompiledPattern, WordEntry } from "./types.js";

// Explicit Latin + Turkish + European letter/digit range (À = U+00C0, ɏ = U+024F).
// Avoids \p{L}/\p{N} Unicode property escapes which cause V8 to build
// full Unicode category tables, resulting in ~67x slower JIT compilation.
// İ (U+0130) and ı (U+0131) are within the À-ɏ range.
const WORD_CHAR = "a-zA-Z0-9À-ɏ";
const SEPARATOR = `[^${WORD_CHAR}]{0,3}`;
const WORD_BOUNDARY_BEHIND = `(?<![${WORD_CHAR}])`;
const WORD_BOUNDARY_AHEAD = `(?![${WORD_CHAR}])`;

const MAX_PATTERN_LENGTH = 20000;
const MAX_SUFFIX_CHAIN = 2;

/** Safety timeout (ms) for regex execution in detection loops. */
export const REGEX_TIMEOUT_MS = 250;

function charToPattern(ch: string, charClasses: Record<string, string>): string {
  const cls = charClasses[ch.toLowerCase()];
  if (cls) return `${cls}+`;
  // Escape regex special chars for unknown characters
  return ch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "+";
}

function wordToPattern(
  word: string,
  charClasses: Record<string, string>,
  normalizeFn: (text: string) => string,
): string {
  const normalized = normalizeFn(word);
  const chars = [...normalized];
  const parts = chars.map((ch) => charToPattern(ch, charClasses));
  return parts.join(SEPARATOR);
}

/** Suffix-only char pattern: literal char + repetition, NO leet charClasses.
 *  Suffixes are grammatical endings — they should match literally (case-insensitive
 *  via regex 'i' flag) with repetition collapsing but without leet digit mappings.
 *  This prevents digits like "123" from matching as suffix characters. */
function charToLiteralPattern(ch: string): string {
  return ch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "+";
}

function buildSuffixGroup(
  suffixes: string[],
  _charClasses: Record<string, string>,
): string {
  if (suffixes.length === 0) return "";

  // Convert each suffix to a literal pattern (no leet charClasses)
  const suffixPatterns = suffixes.map((suffix) => {
    const chars = [...suffix];
    const parts = chars.map((ch) => charToLiteralPattern(ch));
    return parts.join(SEPARATOR);
  });

  // Sort by length descending so longer suffixes match first
  suffixPatterns.sort((a, b) => b.length - a.length);

  // Join with alternation, allow separator between root and suffix (evasion protection)
  return `(?:${SEPARATOR}(?:${suffixPatterns.join("|")}))`;
}

/**
 * Compiles dictionary entries into regex patterns for profanity detection.
 * Each entry produces a Unicode-aware regex with optional suffix support.
 * Falls back gracefully if pattern compilation fails.
 *
 * @param entries - Dictionary entries keyed by root word.
 * @param suffixes - Available grammatical suffixes for the language.
 * @param charClasses - Character class mappings for visual similarity matching.
 * @param normalizeFn - The language-specific normalize function.
 * @returns Array of compiled patterns ready for detection.
 */
export function compilePatterns(
  entries: Map<string, WordEntry>,
  suffixes: string[] | undefined,
  charClasses: Record<string, string>,
  normalizeFn: (text: string) => string,
): CompiledPattern[] {
  const patterns: CompiledPattern[] = [];

  // Build suffix group once, shared across all suffixable entries
  const suffixGroup = suffixes && suffixes.length > 0
    ? buildSuffixGroup(suffixes, charClasses)
    : "";

  for (const [, entry] of entries) {
    const allForms = [entry.root, ...entry.variants];
    // Sort by length descending so longer variants match first
    const sortedForms = allForms
      .map((w) => normalizeFn(w))
      .filter((w) => w.length > 0)
      // Remove duplicates
      .filter((w, i, arr) => arr.indexOf(w) === i)
      .sort((a, b) => b.length - a.length);

    // Determine if this entry gets suffix-aware boundary
    const useSuffix = entry.suffixable && suffixGroup.length > 0;

    let pattern: string;
    if (useSuffix) {
      // Fully suffixable: all forms get suffix chain
      const formPatterns = sortedForms.map((w) =>
        wordToPattern(w, charClasses, normalizeFn),
      );
      const combined = formPatterns.join("|");
      pattern = `${WORD_BOUNDARY_BEHIND}(?:${combined})${suffixGroup}{0,${MAX_SUFFIX_CHAIN}}${WORD_BOUNDARY_AHEAD}`;
    } else if (suffixGroup.length > 0) {
      // Non-suffixable root but has variants: short forms (≤3 chars) get strict
      // boundary, longer variants (≥4 chars) get optional suffix chain.
      // This prevents false positives on the root (e.g. "sık"→"sik") while
      // still catching suffixed variants (e.g. "sikişse", "götvereni").
      const MIN_VARIANT_SUFFIX_LEN = 4;
      const strictForms: string[] = [];
      const suffixableForms: string[] = [];
      for (const w of sortedForms) {
        if (w.length >= MIN_VARIANT_SUFFIX_LEN) {
          suffixableForms.push(wordToPattern(w, charClasses, normalizeFn));
        } else {
          strictForms.push(wordToPattern(w, charClasses, normalizeFn));
        }
      }
      const parts: string[] = [];
      if (suffixableForms.length > 0) {
        parts.push(`(?:${suffixableForms.join("|")})${suffixGroup}{0,${MAX_SUFFIX_CHAIN}}`);
      }
      if (strictForms.length > 0) {
        parts.push(`(?:${strictForms.join("|")})`);
      }
      pattern = `${WORD_BOUNDARY_BEHIND}(?:${parts.join("|")})${WORD_BOUNDARY_AHEAD}`;
    } else {
      // No suffix group available: strict word boundary on both sides
      const formPatterns = sortedForms.map((w) =>
        wordToPattern(w, charClasses, normalizeFn),
      );
      const combined = formPatterns.join("|");
      pattern = `${WORD_BOUNDARY_BEHIND}(?:${combined})${WORD_BOUNDARY_AHEAD}`;
    }

    // Safety guard: if pattern is too long, fallback to non-suffix version
    if (pattern.length > MAX_PATTERN_LENGTH) {
      const formPatterns = sortedForms.map((w) =>
        wordToPattern(w, charClasses, normalizeFn),
      );
      const combined = formPatterns.join("|");
      pattern = `${WORD_BOUNDARY_BEHIND}(?:${combined})${WORD_BOUNDARY_AHEAD}`;
    }

    try {
      const regex = new RegExp(pattern, "gi");
      patterns.push({
        root: entry.root,
        severity: entry.severity,
        category: entry.category as Category | undefined,
        regex,
        variants: entry.variants,
      });
    } catch (err) {
      // Fallback: try without suffix if suffix caused the error
      if (useSuffix) {
        try {
          const fallbackForms = sortedForms.map((w) => wordToPattern(w, charClasses, normalizeFn)).join("|");
          const fallbackPattern = `${WORD_BOUNDARY_BEHIND}(?:${fallbackForms})${WORD_BOUNDARY_AHEAD}`;
          const regex = new RegExp(fallbackPattern, "gi");
          patterns.push({
            root: entry.root,
            severity: entry.severity,
            regex,
            variants: entry.variants,
          });
          console.warn(`[terlik] Pattern for "${entry.root}" failed with suffixes, using fallback: ${err instanceof Error ? err.message : String(err)}`);
        } catch (err2) {
          console.warn(`[terlik] Pattern for "${entry.root}" failed completely, skipping: ${err2 instanceof Error ? err2.message : String(err2)}`);
        }
      } else {
        console.warn(`[terlik] Pattern for "${entry.root}" failed, skipping: ${err instanceof Error ? err.message : String(err)}`);
      }
    }
  }

  return patterns;
}
