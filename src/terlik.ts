import { TerlikCore } from "./core.js";
import { getLanguageConfig, getSupportedLanguages } from "./lang/index.js";
import type { TerlikOptions } from "./types.js";

/**
 * Multi-language profanity detection and filtering engine.
 *
 * Resolves language config from the built-in registry.
 * All four languages (TR, EN, ES, DE) are included in the bundle.
 *
 * For minimal bundle size with a single language, use per-language entries:
 * ```ts
 * import { Terlik } from "terlik.js/tr";
 * ```
 *
 * @example
 * ```ts
 * const terlik = new Terlik();
 * terlik.containsProfanity("siktir"); // true
 * terlik.clean("siktir git");         // "****** git"
 * ```
 */
export class Terlik extends TerlikCore {
  constructor(options?: TerlikOptions) {
    const lang = options?.language ?? "tr";
    const langConfig = getLanguageConfig(lang);
    super(langConfig, options);
  }

  /**
   * Creates and JIT-warms instances for multiple languages at once.
   * Useful for server deployments to eliminate cold-start latency.
   *
   * @param languages - Language codes to warm up (e.g. `["tr", "en"]`).
   *                    Defaults to all supported languages.
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
    languages?: string[],
    baseOptions?: Omit<TerlikOptions, "language">,
  ): Map<string, Terlik> {
    const langs = languages ?? getSupportedLanguages();
    const map = new Map<string, Terlik>();
    for (const lang of langs) {
      const instance = new Terlik({ ...baseOptions, language: lang });
      instance.containsProfanity("warmup");
      map.set(lang, instance);
    }
    return map;
  }
}
