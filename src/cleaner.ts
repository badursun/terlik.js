import type { MaskStyle, MatchResult } from "./types.js";

function maskStars(word: string): string {
  return "*".repeat(word.length);
}

function maskPartial(word: string): string {
  if (word.length <= 2) return "*".repeat(word.length);
  return word[0] + "*".repeat(word.length - 2) + word[word.length - 1];
}

function maskReplace(replaceMask: string): string {
  return replaceMask;
}

/**
 * Applies a mask to a single word using the specified style.
 * @param word - The word to mask.
 * @param style - The masking style.
 * @param replaceMask - The replacement text (used only with "replace" style).
 * @returns The masked string.
 */
export function applyMask(word: string, style: MaskStyle, replaceMask: string): string {
  switch (style) {
    case "stars":
      return maskStars(word);
    case "partial":
      return maskPartial(word);
    case "replace":
      return maskReplace(replaceMask);
  }
}

/**
 * Replaces all matched profanity in the text with masked versions.
 * Processes matches from end to start to preserve character indices.
 *
 * @param text - The original text.
 * @param matches - The detected matches to mask.
 * @param style - The masking style.
 * @param replaceMask - The replacement text (used only with "replace" style).
 * @returns The cleaned text.
 */
export function cleanText(
  text: string,
  matches: MatchResult[],
  style: MaskStyle,
  replaceMask: string,
): string {
  if (matches.length === 0) return text;

  // Sort by index descending so we can replace from end to start
  // without invalidating earlier indices
  const sorted = [...matches].sort((a, b) => b.index - a.index);

  let result = text;
  for (const match of sorted) {
    const masked = applyMask(match.word, style, replaceMask);
    result = result.slice(0, match.index) + masked + result.slice(match.index + match.word.length);
  }

  return result;
}
