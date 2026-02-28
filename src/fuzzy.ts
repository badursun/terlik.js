/**
 * Computes the Levenshtein edit distance between two strings.
 * Uses O(n) space optimization with two-row approach.
 *
 * @param a - First string.
 * @param b - Second string.
 * @returns The minimum number of single-character edits (insertions, deletions, substitutions).
 */
export function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;

  if (m === 0) return n;
  if (n === 0) return m;

  // Use two rows instead of full matrix for O(n) space
  let prev = new Array<number>(n + 1);
  let curr = new Array<number>(n + 1);

  for (let j = 0; j <= n; j++) prev[j] = j;

  for (let i = 1; i <= m; i++) {
    curr[0] = i;
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(
        prev[j] + 1, // deletion
        curr[j - 1] + 1, // insertion
        prev[j - 1] + cost, // substitution
      );
    }
    [prev, curr] = [curr, prev];
  }

  return prev[n];
}

/**
 * Computes the Levenshtein similarity ratio between two strings.
 * Returns a value between 0 (completely different) and 1 (identical).
 *
 * @param a - First string.
 * @param b - Second string.
 * @returns Similarity ratio (0–1).
 */
export function levenshteinSimilarity(a: string, b: string): number {
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1;
  return 1 - levenshteinDistance(a, b) / maxLen;
}

function bigrams(str: string): Set<string> {
  const set = new Set<string>();
  for (let i = 0; i < str.length - 1; i++) {
    set.add(str.slice(i, i + 2));
  }
  return set;
}

/**
 * Computes the Dice coefficient (bigram similarity) between two strings.
 * Returns a value between 0 (no shared bigrams) and 1 (identical bigrams).
 *
 * @param a - First string (must be at least 2 characters for meaningful result).
 * @param b - Second string (must be at least 2 characters for meaningful result).
 * @returns Dice coefficient (0–1).
 */
export function diceSimilarity(a: string, b: string): number {
  if (a.length < 2 || b.length < 2) {
    return a === b ? 1 : 0;
  }

  const bigramsA = bigrams(a);
  const bigramsB = bigrams(b);

  let intersection = 0;
  for (const bg of bigramsA) {
    if (bigramsB.has(bg)) intersection++;
  }

  return (2 * intersection) / (bigramsA.size + bigramsB.size);
}

/** A function that computes similarity between two strings, returning 0–1. */
export type FuzzyMatchFn = (a: string, b: string) => number;

/**
 * Returns the appropriate fuzzy matching function for the given algorithm.
 * @param algorithm - The algorithm to use.
 * @returns The similarity function.
 */
export function getFuzzyMatcher(algorithm: "levenshtein" | "dice"): FuzzyMatchFn {
  return algorithm === "levenshtein" ? levenshteinSimilarity : diceSimilarity;
}
