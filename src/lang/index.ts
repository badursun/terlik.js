import type { LanguageConfig } from "./types.js";
import { config as trConfig } from "./tr/config.js";
import { config as enConfig } from "./en/config.js";
import { config as esConfig } from "./es/config.js";
import { config as deConfig } from "./de/config.js";

const CORE_DICT_VERSION = 1;

const REGISTRY: Record<string, LanguageConfig> = {
  tr: trConfig,
  en: enConfig,
  es: esConfig,
  de: deConfig,
};

/**
 * Retrieves the configuration for a supported language.
 *
 * @param lang - Language code (e.g. "tr", "en", "es", "de").
 * @returns The language configuration including dictionary, charMap, and leetMap.
 * @throws {Error} If the language is not supported or the dictionary version is too old.
 */
export function getLanguageConfig(lang: string): LanguageConfig {
  const config = REGISTRY[lang];
  if (!config) {
    const available = getSupportedLanguages().join(", ");
    throw new Error(
      `Unsupported language: "${lang}". Available languages: ${available}`,
    );
  }
  if (config.dictionary.version < CORE_DICT_VERSION) {
    throw new Error(
      `Dictionary version ${config.dictionary.version} for language "${lang}" is below minimum required version ${CORE_DICT_VERSION}. Please update the language pack.`,
    );
  }
  return config;
}

/**
 * Returns all available language codes.
 * @returns Array of supported language codes (e.g. `["tr", "en", "es", "de"]`).
 */
export function getSupportedLanguages(): string[] {
  return Object.keys(REGISTRY);
}

export { trConfig, enConfig, esConfig, deConfig };
