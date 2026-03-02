import { TerlikCore } from "../../core.js";
import { config } from "./config.js";
import type { TerlikOptions } from "../../types.js";

/**
 * Spanish-only Terlik instance. Only the ES dictionary is bundled.
 *
 * @example
 * ```ts
 * import { Terlik } from "terlik.js/es";
 * const t = new Terlik();
 * t.containsProfanity("mierda"); // true
 * ```
 */
export class Terlik extends TerlikCore {
  constructor(options?: Omit<TerlikOptions, "language">) {
    super(config, options);
  }
}

/** Pre-resolved Spanish language config for advanced usage with TerlikCore. */
export { config as languageConfig };

/** Convenience factory — returns a pre-configured Spanish Terlik instance. */
export function createTerlik(options?: Omit<TerlikOptions, "language">): Terlik {
  return new Terlik(options);
}

export { TerlikCore } from "../../core.js";
export type {
  TerlikOptions,
  DetectOptions,
  CleanOptions,
  MatchResult,
  Category,
  Severity,
  Mode,
  MaskStyle,
  FuzzyAlgorithm,
  MatchMethod,
} from "../../types.js";
export type { LanguageConfig } from "../types.js";
