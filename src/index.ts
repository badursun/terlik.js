export { Terlik } from "./terlik.js";
export { TerlikCore } from "./core.js";
export { normalize, createNormalizer } from "./normalizer.js";
export type { NormalizerConfig } from "./normalizer.js";
export { levenshteinDistance, levenshteinSimilarity, diceSimilarity } from "./fuzzy.js";
export { getLanguageConfig, getSupportedLanguages } from "./lang/index.js";
export type { LanguageConfig } from "./lang/types.js";
export type {
  TerlikOptions,
  DetectOptions,
  CleanOptions,
  MatchResult,
  WordEntry,
  Severity,
  Category,
  Mode,
  MaskStyle,
  FuzzyAlgorithm,
  MatchMethod,
} from "./types.js";
