declare function setTimeout(callback: () => void, ms: number): unknown;

import type {
  CleanOptions,
  DetectOptions,
  MatchResult,
  MaskStyle,
  Mode,
  TerlikOptions,
} from "./types.js";
import { Dictionary } from "./dictionary/index.js";
import { Detector } from "./detector.js";
import { cleanText } from "./cleaner.js";
import { validateInput, MAX_INPUT_LENGTH } from "./utils.js";
import { getLanguageConfig } from "./lang/index.js";
import { createNormalizer } from "./normalizer.js";
import { validateDictionary, mergeDictionaries } from "./dictionary/schema.js";

/**
 * Multi-language profanity detection and filtering engine.
 *
 * @example
 * ```ts
 * const terlik = new Terlik();
 * terlik.containsProfanity("siktir"); // true
 * terlik.clean("siktir git");         // "****** git"
 * ```
 */
export class Terlik {
  private dictionary: Dictionary;
  private detector: Detector;
  private mode: Mode;
  private maskStyle: MaskStyle;
  private enableFuzzy: boolean;
  private fuzzyThreshold: number;
  private fuzzyAlgorithm: "levenshtein" | "dice";
  private maxLength: number;
  private replaceMask: string;
  /** The language code this instance was created with. */
  readonly language: string;

  /**
   * Creates a new Terlik instance.
   * @param options - Configuration options.
   * @throws {Error} If the specified language is not supported.
   */
  constructor(options?: TerlikOptions) {
    this.language = options?.language ?? "tr";
    this.mode = options?.mode ?? "balanced";
    this.maskStyle = options?.maskStyle ?? "stars";
    this.enableFuzzy = options?.enableFuzzy ?? false;
    this.fuzzyAlgorithm = options?.fuzzyAlgorithm ?? "levenshtein";
    this.replaceMask = options?.replaceMask ?? "[***]";

    const threshold = options?.fuzzyThreshold ?? 0.8;
    if (threshold < 0 || threshold > 1) {
      throw new Error(`fuzzyThreshold must be between 0 and 1, got ${threshold}`);
    }
    this.fuzzyThreshold = threshold;

    const maxLen = options?.maxLength ?? MAX_INPUT_LENGTH;
    if (maxLen < 1) {
      throw new Error(`maxLength must be at least 1, got ${maxLen}`);
    }
    this.maxLength = maxLen;

    const langConfig = getLanguageConfig(this.language);
    const normalizeFn = createNormalizer({
      locale: langConfig.locale,
      charMap: langConfig.charMap,
      leetMap: langConfig.leetMap,
      numberExpansions: langConfig.numberExpansions,
    });

    let dictData = langConfig.dictionary;
    if (options?.extendDictionary) {
      validateDictionary(options.extendDictionary);
      dictData = mergeDictionaries(dictData, options.extendDictionary);
    }

    this.dictionary = new Dictionary(
      dictData,
      options?.customList,
      options?.whitelist,
    );
    const hasCustomDict = !!(options?.customList?.length || options?.whitelist?.length || options?.extendDictionary);
    this.detector = new Detector(
      this.dictionary,
      normalizeFn,
      langConfig.locale,
      langConfig.charClasses,
      hasCustomDict ? null : this.language,
    );

    if (options?.backgroundWarmup) {
      setTimeout(() => {
        this.detector.compile();
        this.containsProfanity("warmup");
      }, 0);
    }
  }

  /**
   * Creates and JIT-warms instances for multiple languages at once.
   * Useful for server deployments to eliminate cold-start latency.
   *
   * @param languages - Language codes to warm up (e.g. `["tr", "en"]`).
   * @param baseOptions - Shared options applied to all instances.
   * @returns A map of language code to warmed-up Terlik instance.
   *
   * @example
   * ```ts
   * const cache = Terlik.warmup(["tr", "en", "es"]);
   * cache.get("en")!.containsProfanity("fuck"); // true, no cold start
   * ```
   */
  static warmup(
    languages: string[],
    baseOptions?: Omit<TerlikOptions, "language">,
  ): Map<string, Terlik> {
    const map = new Map<string, Terlik>();
    for (const lang of languages) {
      const instance = new Terlik({ ...baseOptions, language: lang });
      // JIT warmup: run detection to trigger regex compilation
      instance.containsProfanity("warmup");
      map.set(lang, instance);
    }
    return map;
  }

  /**
   * Checks whether the text contains profanity.
   * @param text - The text to check.
   * @param options - Per-call detection options (overrides instance defaults).
   * @returns `true` if profanity is detected, `false` otherwise.
   */
  containsProfanity(text: string, options?: DetectOptions): boolean {
    const input = validateInput(text, this.maxLength);
    if (input.length === 0) return false;
    const matches = this.detector.detect(input, this.mergeDetectOptions(options));
    return matches.length > 0;
  }

  /**
   * Returns all profanity matches with details (word, root, index, severity, method).
   * @param text - The text to analyze.
   * @param options - Per-call detection options (overrides instance defaults).
   * @returns Array of match results, sorted by index.
   */
  getMatches(text: string, options?: DetectOptions): MatchResult[] {
    const input = validateInput(text, this.maxLength);
    if (input.length === 0) return [];
    return this.detector.detect(input, this.mergeDetectOptions(options));
  }

  /**
   * Returns the text with detected profanity masked.
   * @param text - The text to clean.
   * @param options - Per-call clean options (overrides instance defaults).
   * @returns The cleaned text with profanity replaced by mask characters.
   */
  clean(text: string, options?: CleanOptions): string {
    const input = validateInput(text, this.maxLength);
    if (input.length === 0) return input;
    const matches = this.detector.detect(input, this.mergeDetectOptions(options));
    const style = options?.maskStyle ?? this.maskStyle;
    const replaceMask = options?.replaceMask ?? this.replaceMask;
    return cleanText(input, matches, style, replaceMask);
  }

  /**
   * Adds custom words to the detection dictionary at runtime.
   * Triggers pattern recompilation.
   * @param words - Words to add.
   */
  addWords(words: string[]): void {
    this.dictionary.addWords(words);
    this.detector.recompile();
  }

  /**
   * Removes words from the detection dictionary at runtime.
   * Triggers pattern recompilation.
   * @param words - Words to remove.
   */
  removeWords(words: string[]): void {
    this.dictionary.removeWords(words);
    this.detector.recompile();
  }

  /**
   * Returns the compiled regex patterns keyed by root word.
   * Useful for debugging or advanced usage.
   * @returns Map of root word to compiled RegExp.
   */
  getPatterns(): Map<string, RegExp> {
    return this.detector.getPatterns();
  }

  private mergeDetectOptions(options?: DetectOptions): DetectOptions {
    return {
      mode: options?.mode ?? this.mode,
      enableFuzzy: options?.enableFuzzy ?? this.enableFuzzy,
      fuzzyThreshold: options?.fuzzyThreshold ?? this.fuzzyThreshold,
      fuzzyAlgorithm: options?.fuzzyAlgorithm ?? this.fuzzyAlgorithm,
    };
  }
}
