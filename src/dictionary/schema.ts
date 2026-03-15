const VALID_SEVERITIES = ["high", "medium", "low"];
const VALID_CATEGORIES = ["sexual", "insult", "slur", "general"];
const MAX_SUFFIXES = 150;
const SUFFIX_PATTERN = /^[\p{Ll}]{1,10}$/u;

/** Raw dictionary data structure as loaded from JSON. */
export interface DictionaryData {
  version: number;
  suffixes: string[];
  entries: Array<{
    root: string;
    variants: string[];
    severity: string;
    category: string;
    suffixable: boolean;
  }>;
  whitelist: string[];
}

/**
 * Validates raw dictionary data against the expected schema.
 * Checks version, suffix format, entry fields, and whitelist integrity.
 *
 * @param data - The raw data to validate (typically parsed from JSON).
 * @returns The validated dictionary data.
 * @throws {Error} If validation fails with a descriptive message.
 */
export function validateDictionary(data: unknown): DictionaryData {
  if (data == null || typeof data !== "object") {
    throw new Error("Dictionary data must be a non-null object");
  }

  const d = data as Record<string, unknown>;

  if (typeof d.version !== "number" || d.version < 1) {
    throw new Error("Dictionary version must be a positive number");
  }

  // Validate suffixes
  if (!Array.isArray(d.suffixes)) {
    throw new Error("Dictionary suffixes must be an array");
  }

  if (d.suffixes.length > MAX_SUFFIXES) {
    throw new Error(`Dictionary suffixes exceed maximum of ${MAX_SUFFIXES}`);
  }

  for (const suffix of d.suffixes) {
    if (typeof suffix !== "string" || !SUFFIX_PATTERN.test(suffix)) {
      throw new Error(
        `Invalid suffix "${suffix}": must be 1-10 lowercase Unicode letters`,
      );
    }
  }

  // Validate entries
  if (!Array.isArray(d.entries)) {
    throw new Error("Dictionary entries must be an array");
  }

  const seenRoots = new Set<string>();

  for (let i = 0; i < d.entries.length; i++) {
    const entry = d.entries[i] as Record<string, unknown>;
    const label = `entries[${i}]`;

    if (entry == null || typeof entry !== "object") {
      throw new Error(`${label}: must be an object`);
    }

    if (typeof entry.root !== "string" || entry.root.length === 0) {
      throw new Error(`${label}: root must be a non-empty string`);
    }

    const rootLower = (entry.root as string).toLowerCase();
    if (seenRoots.has(rootLower)) {
      throw new Error(`${label}: duplicate root "${entry.root}"`);
    }
    seenRoots.add(rootLower);

    if (!Array.isArray(entry.variants)) {
      throw new Error(`${label} (root="${entry.root}"): variants must be an array`);
    }

    if (typeof entry.severity !== "string" || !VALID_SEVERITIES.includes(entry.severity)) {
      throw new Error(
        `${label} (root="${entry.root}"): severity must be one of ${VALID_SEVERITIES.join(", ")}`,
      );
    }

    if (typeof entry.category !== "string" || !VALID_CATEGORIES.includes(entry.category)) {
      throw new Error(
        `${label} (root="${entry.root}"): category must be one of ${VALID_CATEGORIES.join(", ")}`,
      );
    }

    if (typeof entry.suffixable !== "boolean") {
      throw new Error(`${label} (root="${entry.root}"): suffixable must be a boolean`);
    }
  }

  // Validate whitelist
  if (!Array.isArray(d.whitelist)) {
    throw new Error("Dictionary whitelist must be an array");
  }

  const seenWhitelist = new Set<string>();
  for (let i = 0; i < d.whitelist.length; i++) {
    if (typeof d.whitelist[i] !== "string") {
      throw new Error(`whitelist[${i}]: must be a string`);
    }
    if ((d.whitelist[i] as string).length === 0) {
      throw new Error(`whitelist[${i}]: must not be empty`);
    }
    const wlLower = (d.whitelist[i] as string).toLowerCase();
    if (seenWhitelist.has(wlLower)) {
      throw new Error(`whitelist[${i}]: duplicate entry "${d.whitelist[i]}"`);
    }
    seenWhitelist.add(wlLower);
  }

  return data as DictionaryData;
}

/**
 * Merges an extension dictionary into a base dictionary.
 * Duplicate roots (by lowercase comparison) in the extension are skipped.
 * Suffixes and whitelist entries are unioned via Set.
 *
 * @param base - The base (built-in) dictionary data.
 * @param ext - The extension dictionary data to merge in.
 * @returns A new merged DictionaryData object.
 */
export function mergeDictionaries(base: DictionaryData, ext: DictionaryData): DictionaryData {
  const existingRoots = new Set(base.entries.map((e) => e.root.toLowerCase()));

  const mergedEntries = [...base.entries];
  for (const entry of ext.entries) {
    if (!existingRoots.has(entry.root.toLowerCase())) {
      mergedEntries.push(entry);
      existingRoots.add(entry.root.toLowerCase());
    }
  }

  const mergedSuffixes = [...new Set([...base.suffixes, ...ext.suffixes])];
  const mergedWhitelist = [...new Set([...base.whitelist, ...ext.whitelist])];

  return {
    version: base.version,
    suffixes: mergedSuffixes,
    entries: mergedEntries,
    whitelist: mergedWhitelist,
  };
}
