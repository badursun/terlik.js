import { TerlikCore } from "../../core.js";
import { config } from "./config.js";
import type { TerlikOptions } from "../../types.js";

/**
 * Turkish-only Terlik instance. Only the TR dictionary is bundled.
 *
 * @example
 * ```ts
 * import { Terlik } from "terlik.js/tr";
 * const t = new Terlik();
 * t.containsProfanity("siktir"); // true
 * ```
 */
export class Terlik extends TerlikCore {
  constructor(options?: Omit<TerlikOptions, "language">) {
    super(config, options);
  }
}

/** Pre-resolved Turkish language config for advanced usage with TerlikCore. */
export { config as languageConfig };

/** Convenience factory — returns a pre-configured Turkish Terlik instance. */
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
