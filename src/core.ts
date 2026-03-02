declare function setTimeout(callback: () => void, ms: number): unknown;

import type {
  Category,
  CleanOptions,
  DetectOptions,
  MatchResult,
  MaskStyle,
  Mode,
  Severity,
  TerlikOptions,
} from "./types.js";
import type { LanguageConfig } from "./lang/types.js";
import { Dictionary } from "./dictionary/index.js";
import { Detector } from "./detector.js";
import { cleanText } from "./cleaner.js";
import { validateInput, MAX_INPUT_LENGTH } from "./utils.js";
import { createNormalizer } from "./normalizer.js";
import { validateDictionary, mergeDictionaries } from "./dictionary/schema.js";

/**
 * Core profanity detection and filtering engine.
 * Requires a pre-resolved LanguageConfig — no registry dependency.
 *
 * For convenience with automatic language resolution, use `Terlik` from the main entry point.
 * For minimal bundle size with a single language, use per-language entries (e.g. `terlik.js/tr`).
 */
export class TerlikCore {
  private dictionary: Dictionary;
  private detector: Detector;
  private mode: Mode;
  private maskStyle: MaskStyle;
  private enableFuzzy: boolean;
  private fuzzyThreshold: number;
  private fuzzyAlgorithm: "levenshtein" | "dice";
  private maxLength: number;
  private replaceMask: string;
  private disableLeetDecode: boolean;
  private disableCompound: boolean;
  private minSeverity: Severity | undefined;
  private excludeCategories: Category[] | undefined;
  /** The language code this instance was created with. */
  readonly language: string;

  /**
   * Creates a new TerlikCore instance with a pre-resolved language config.
   * @param langConfig - The language configuration (dictionary, charMap, leetMap, etc.).
   * @param options - Configuration options.
   */
  constructor(langConfig: LanguageConfig, options?: TerlikOptions) {
    this.language = langConfig.locale;
    this.mode = options?.mode ?? "balanced";
    this.maskStyle = options?.maskStyle ?? "stars";
    this.enableFuzzy = options?.enableFuzzy ?? false;
    this.fuzzyAlgorithm = options?.fuzzyAlgorithm ?? "levenshtein";
    this.replaceMask = options?.replaceMask ?? "[***]";
    this.disableLeetDecode = options?.disableLeetDecode ?? false;
    this.disableCompound = options?.disableCompound ?? false;
    this.minSeverity = options?.minSeverity;
    this.excludeCategories = options?.excludeCategories;

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

    const normalizeFn = createNormalizer({
      locale: langConfig.locale,
      charMap: langConfig.charMap,
      leetMap: langConfig.leetMap,
      numberExpansions: langConfig.numberExpansions,
    });
    const safeNormalizeFn = createNormalizer({
      locale: langConfig.locale,
      charMap: langConfig.charMap,
      leetMap: {},
      numberExpansions: [],
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
      safeNormalizeFn,
      langConfig.locale,
      langConfig.charClasses,
      hasCustomDict ? null : langConfig.locale,
    );

    if (options?.backgroundWarmup) {
      setTimeout(() => {
        this.detector.compile();
        this.containsProfanity("warmup");
      }, 0);
    }
  }

  containsProfanity(text: string, options?: DetectOptions): boolean {
    const input = validateInput(text, this.maxLength);
    if (input.length === 0) return false;
    const matches = this.detector.detect(input, this.mergeDetectOptions(options));
    return matches.length > 0;
  }

  getMatches(text: string, options?: DetectOptions): MatchResult[] {
    const input = validateInput(text, this.maxLength);
    if (input.length === 0) return [];
    return this.detector.detect(input, this.mergeDetectOptions(options));
  }

  clean(text: string, options?: CleanOptions): string {
    const input = validateInput(text, this.maxLength);
    if (input.length === 0) return input;
    const matches = this.detector.detect(input, this.mergeDetectOptions(options));
    const style = options?.maskStyle ?? this.maskStyle;
    const replaceMask = options?.replaceMask ?? this.replaceMask;
    return cleanText(input, matches, style, replaceMask);
  }

  addWords(words: string[]): void {
    this.dictionary.addWords(words);
    this.detector.recompile();
  }

  removeWords(words: string[]): void {
    this.dictionary.removeWords(words);
    this.detector.recompile();
  }

  getPatterns(): Map<string, RegExp> {
    return this.detector.getPatterns();
  }

  private mergeDetectOptions(options?: DetectOptions): DetectOptions {
    return {
      mode: options?.mode ?? this.mode,
      enableFuzzy: options?.enableFuzzy ?? this.enableFuzzy,
      fuzzyThreshold: options?.fuzzyThreshold ?? this.fuzzyThreshold,
      fuzzyAlgorithm: options?.fuzzyAlgorithm ?? this.fuzzyAlgorithm,
      disableLeetDecode: options?.disableLeetDecode ?? this.disableLeetDecode,
      disableCompound: options?.disableCompound ?? this.disableCompound,
      minSeverity: options?.minSeverity ?? this.minSeverity,
      excludeCategories: options?.excludeCategories ?? this.excludeCategories,
    };
  }
}
