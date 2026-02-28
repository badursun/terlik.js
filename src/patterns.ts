import type { CompiledPattern, WordEntry } from "./types.js";

// \W is NOT Unicode-aware — ı, ş, ğ etc. count as \W in JS.
// Use negated Unicode letter/number class instead to avoid eating Turkish chars.
const SEPARATOR = "[^\\p{L}\\p{N}]{0,3}";

const MAX_PATTERN_LENGTH = 10000;
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

function buildSuffixGroup(
  suffixes: string[],
  charClasses: Record<string, string>,
): string {
  if (suffixes.length === 0) return "";

  // Convert each suffix to a char-class pattern with separators between chars
  const suffixPatterns = suffixes.map((suffix) => {
    const chars = [...suffix];
    const parts = chars.map((ch) => charToPattern(ch, charClasses));
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

    const formPatterns = sortedForms.map((w) =>
      wordToPattern(w, charClasses, normalizeFn),
    );
    const combined = formPatterns.join("|");

    // Determine if this entry gets suffix-aware boundary
    const useSuffix = entry.suffixable && suffixGroup.length > 0;

    let pattern: string;
    if (useSuffix) {
      // Suffix-aware: root + optional suffix chain (up to MAX_SUFFIX_CHAIN), then word boundary
      pattern = `(?<![\\p{L}\\p{N}])(?:${combined})${suffixGroup}{0,${MAX_SUFFIX_CHAIN}}(?![\\p{L}\\p{N}])`;
    } else {
      // Original: strict word boundary on both sides
      pattern = `(?<![\\p{L}\\p{N}])(?:${combined})(?![\\p{L}\\p{N}])`;
    }

    // Safety guard: if pattern is too long, fallback to non-suffix version
    if (pattern.length > MAX_PATTERN_LENGTH && useSuffix) {
      pattern = `(?<![\\p{L}\\p{N}])(?:${combined})(?![\\p{L}\\p{N}])`;
    }

    try {
      const regex = new RegExp(pattern, "giu");
      patterns.push({
        root: entry.root,
        severity: entry.severity,
        regex,
        variants: entry.variants,
      });
    } catch (err) {
      // Fallback: try without suffix if suffix caused the error
      if (useSuffix) {
        try {
          const fallbackPattern = `(?<![\\p{L}\\p{N}])(?:${combined})(?![\\p{L}\\p{N}])`;
          const regex = new RegExp(fallbackPattern, "giu");
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
