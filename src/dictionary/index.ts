import type { WordEntry } from "../types.js";
import type { DictionaryData } from "./schema.js";

/**
 * Manages the profanity word list, whitelist, and suffixes for a language.
 */
export class Dictionary {
  private entries: Map<string, WordEntry> = new Map();
  private whitelist: Set<string>;
  private allWords: string[] = [];
  private suffixes: string[];

  /**
   * Creates a new Dictionary from validated dictionary data.
   * @param data - Validated dictionary data (entries, suffixes, whitelist).
   * @param customWords - Additional words to detect.
   * @param customWhitelist - Additional words to exclude.
   */
  constructor(data: DictionaryData, customWords?: string[], customWhitelist?: string[]) {
    this.whitelist = new Set(data.whitelist.map((w) => w.toLowerCase()));
    this.suffixes = data.suffixes;

    if (customWhitelist) {
      for (const w of customWhitelist) {
        this.whitelist.add(w.toLowerCase());
      }
    }

    for (const entry of data.entries) {
      this.addEntry({
        root: entry.root,
        variants: entry.variants,
        severity: entry.severity as WordEntry["severity"],
        category: entry.category,
        suffixable: entry.suffixable,
      });
    }

    if (customWords) {
      for (const word of customWords) {
        this.addEntry({
          root: word.toLowerCase(),
          variants: [],
          severity: "medium",
        });
      }
    }
  }

  private addEntry(entry: WordEntry): void {
    const normalizedRoot = entry.root.toLowerCase();
    this.entries.set(normalizedRoot, entry);
    this.allWords.push(normalizedRoot);
    for (const v of entry.variants) {
      this.allWords.push(v.toLowerCase());
    }
  }

  /** Returns all dictionary entries keyed by root word. */
  getEntries(): Map<string, WordEntry> {
    return this.entries;
  }

  /** Returns all words (roots + variants) as a flat array. */
  getAllWords(): string[] {
    return this.allWords;
  }

  /** Returns the whitelist as a Set of lowercase strings. */
  getWhitelist(): Set<string> {
    return this.whitelist;
  }

  /** Returns available grammatical suffixes for the language. */
  getSuffixes(): string[] {
    return this.suffixes;
  }

  /**
   * Adds words to the dictionary at runtime.
   * Empty strings and already-existing words are silently skipped.
   * @param words - Words to add.
   */
  addWords(words: string[]): void {
    for (const word of words) {
      const lower = word.toLowerCase().trim();
      if (lower.length === 0) continue;
      if (!this.entries.has(lower)) {
        this.addEntry({
          root: lower,
          variants: [],
          severity: "medium",
        });
      }
    }
  }

  /**
   * Removes words from the dictionary at runtime.
   * @param words - Words to remove.
   */
  removeWords(words: string[]): void {
    for (const word of words) {
      const key = word.toLowerCase();
      const entry = this.entries.get(key);
      if (entry) {
        this.entries.delete(key);
        this.allWords = this.allWords.filter(
          (w) => w !== key && !entry.variants.map((v) => v.toLowerCase()).includes(w),
        );
      }
    }
  }

  /**
   * Finds the dictionary entry for a given word (checks root and variants).
   * @param word - The word to look up.
   * @returns The matching WordEntry, or undefined if not found.
   */
  findRootForWord(word: string): WordEntry | undefined {
    const lower = word.toLowerCase();
    const direct = this.entries.get(lower);
    if (direct) return direct;

    for (const [, entry] of this.entries) {
      if (entry.variants.some((v) => v.toLowerCase() === lower)) {
        return entry;
      }
    }
    return undefined;
  }
}
