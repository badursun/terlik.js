import type { CompiledPattern, DetectOptions, MatchResult, Mode } from "./types.js";
import { Dictionary } from "./dictionary/index.js";
import { compilePatterns, REGEX_TIMEOUT_MS } from "./patterns.js";
import { getFuzzyMatcher } from "./fuzzy.js";

export class Detector {
  private dictionary: Dictionary;
  private _patterns: CompiledPattern[] | null = null;
  private normalizedWordSet: Set<string>;
  private normalizedWordToRoot: Map<string, string>;
  private normalizeFn: (text: string) => string;
  private locale: string;
  private charClasses: Record<string, string>;

  constructor(
    dictionary: Dictionary,
    normalizeFn: (text: string) => string,
    locale: string,
    charClasses: Record<string, string>,
  ) {
    this.dictionary = dictionary;
    this.normalizeFn = normalizeFn;
    this.locale = locale;
    this.charClasses = charClasses;
    this.normalizedWordSet = new Set<string>();
    this.normalizedWordToRoot = new Map<string, string>();
    this.buildNormalizedLookup();
  }

  private ensureCompiled(): CompiledPattern[] {
    if (this._patterns === null) {
      this._patterns = compilePatterns(
        this.dictionary.getEntries(),
        this.dictionary.getSuffixes(),
        this.charClasses,
        this.normalizeFn,
      );
    }
    return this._patterns;
  }

  compile(): void {
    this.ensureCompiled();
  }

  recompile(): void {
    this._patterns = compilePatterns(
      this.dictionary.getEntries(),
      this.dictionary.getSuffixes(),
      this.charClasses,
      this.normalizeFn,
    );
    this.buildNormalizedLookup();
  }

  private buildNormalizedLookup(): void {
    this.normalizedWordSet.clear();
    this.normalizedWordToRoot.clear();
    for (const word of this.dictionary.getAllWords()) {
      const n = this.normalizeFn(word);
      this.normalizedWordSet.add(n);
      this.normalizedWordToRoot.set(n, word);
    }
  }

  getPatterns(): Map<string, RegExp> {
    const map = new Map<string, RegExp>();
    for (const p of this.ensureCompiled()) {
      map.set(p.root, p.regex);
    }
    return map;
  }

  detect(text: string, options?: DetectOptions): MatchResult[] {
    const mode: Mode = options?.mode ?? "balanced";
    const results: MatchResult[] = [];
    const whitelist = this.dictionary.getWhitelist();

    if (mode === "strict") {
      this.detectStrict(text, whitelist, results);
    } else {
      this.detectPattern(text, whitelist, results);
    }

    if (mode === "loose" || options?.enableFuzzy) {
      const threshold = options?.fuzzyThreshold ?? 0.8;
      const algorithm = options?.fuzzyAlgorithm ?? "levenshtein";
      this.detectFuzzy(text, whitelist, results, threshold, algorithm);
    }

    return this.deduplicateResults(results);
  }

  private detectStrict(
    text: string,
    whitelist: Set<string>,
    results: MatchResult[],
  ): void {
    const normalized = this.normalizeFn(text);
    const words = normalized.split(/\s+/);
    const originalWords = text.split(/\s+/);

    let charIndex = 0;
    for (let wi = 0; wi < originalWords.length; wi++) {
      const origWord = originalWords[wi];
      const normWord = wi < words.length ? words[wi] : "";

      if (normWord.length === 0) {
        charIndex += origWord.length + 1;
        continue;
      }

      if (whitelist.has(normWord)) {
        charIndex += origWord.length + 1;
        continue;
      }

      if (this.normalizedWordSet.has(normWord)) {
        const dictWord = this.normalizedWordToRoot.get(normWord)!;
        const entry = this.dictionary.findRootForWord(dictWord);
        if (entry) {
          results.push({
            word: origWord,
            root: entry.root,
            index: charIndex,
            severity: entry.severity,
            method: "exact",
          });
        }
      }

      charIndex += origWord.length + 1;
    }
  }

  private detectPattern(
    text: string,
    whitelist: Set<string>,
    results: MatchResult[],
  ): void {
    // Run patterns on original text
    this.runPatterns(text, text, whitelist, results, false);

    // Second pass on normalized text only if normalization changed something
    // beyond simple lowercasing (leet, numExpand, punctuation removal, etc.)
    const normalizedText = this.normalizeFn(text);
    const lowerText = text.toLocaleLowerCase(this.locale);
    if (normalizedText !== lowerText && normalizedText.length > 0) {
      this.runPatterns(normalizedText, text, whitelist, results, true);
    }
  }

  private runPatterns(
    searchText: string,
    originalText: string,
    whitelist: Set<string>,
    results: MatchResult[],
    isNormalized: boolean,
  ): void {
    const existingIndices = new Set(results.map((r) => r.index));
    const patterns = this.ensureCompiled();

    for (const pattern of patterns) {
      const patternStart = Date.now();
      pattern.regex.lastIndex = 0;
      let match: RegExpExecArray | null;

      while ((match = pattern.regex.exec(searchText)) !== null) {
        if (Date.now() - patternStart > REGEX_TIMEOUT_MS) break;

        const matchedText = match[0];
        const matchIndex = match.index;

        const normalizedMatch = this.normalizeFn(matchedText);
        if (whitelist.has(normalizedMatch)) continue;

        const surrounding = this.getSurroundingWord(searchText, matchIndex, matchedText.length);
        const normalizedSurrounding = this.normalizeFn(surrounding);
        if (whitelist.has(normalizedSurrounding)) continue;

        if (isNormalized) {
          // Map normalized match position back to original text word
          const mapped = this.mapNormalizedToOriginal(originalText, matchIndex, matchedText);
          if (mapped && !existingIndices.has(mapped.index)) {
            results.push({
              word: mapped.word,
              root: pattern.root,
              index: mapped.index,
              severity: pattern.severity,
              method: "pattern",
            });
            existingIndices.add(mapped.index);
          }
        } else {
          if (!existingIndices.has(matchIndex)) {
            results.push({
              word: matchedText,
              root: pattern.root,
              index: matchIndex,
              severity: pattern.severity,
              method: "pattern",
            });
            existingIndices.add(matchIndex);
          }
        }

        if (matchedText.length === 0) {
          pattern.regex.lastIndex++;
        }
      }
    }
  }

  private mapNormalizedToOriginal(
    originalText: string,
    normIndex: number,
    _normMatch: string,
  ): { word: string; index: number } | null {
    // Build a char-by-char mapping from normalized to original text
    // by normalizing word-by-word
    const origWords = originalText.split(/(\s+)/);
    let normOffset = 0;
    let origOffset = 0;

    for (const segment of origWords) {
      if (/^\s+$/.test(segment)) {
        normOffset += 1; // normalized collapses whitespace to single space
        origOffset += segment.length;
        continue;
      }

      const normWord = this.normalizeFn(segment);
      const normEnd = normOffset + normWord.length;

      // Check if the normalized match overlaps with this word's normalized range
      if (normIndex >= normOffset && normIndex < normEnd) {
        return { word: segment, index: origOffset };
      }

      normOffset = normEnd;
      origOffset += segment.length;
    }

    return null;
  }

  private detectFuzzy(
    text: string,
    whitelist: Set<string>,
    existingResults: MatchResult[],
    threshold: number,
    algorithm: "levenshtein" | "dice",
  ): void {
    const normalized = this.normalizeFn(text);
    const normWords = normalized.split(/\s+/);
    const origWords = text.split(/\s+/);
    const matcher = getFuzzyMatcher(algorithm);
    const existingIndices = new Set(existingResults.map((r) => r.index));
    const startTime = Date.now();

    let charIndex = 0;
    for (let wi = 0; wi < origWords.length; wi++) {
      if (Date.now() - startTime > REGEX_TIMEOUT_MS) break;

      const origWord = origWords[wi];
      const word = wi < normWords.length ? normWords[wi] : "";

      if (word.length < 3 || whitelist.has(word)) {
        charIndex += origWord.length + 1;
        continue;
      }

      for (const normDict of this.normalizedWordSet) {
        if (normDict.length < 3) continue;

        const similarity = matcher(word, normDict);
        if (similarity >= threshold) {
          if (!existingIndices.has(charIndex)) {
            const dictWord = this.normalizedWordToRoot.get(normDict)!;
            const entry = this.dictionary.findRootForWord(dictWord);
            if (entry) {
              existingResults.push({
                word: origWord,
                root: entry.root,
                index: charIndex,
                severity: entry.severity,
                method: "fuzzy",
              });
              existingIndices.add(charIndex);
            }
          }
          break;
        }
      }

      charIndex += origWord.length + 1;
    }
  }

  private getSurroundingWord(text: string, index: number, length: number): string {
    let start = index;
    let end = index + length;

    while (start > 0 && /\p{L}/u.test(text[start - 1])) start--;
    while (end < text.length && /\p{L}/u.test(text[end])) end++;

    return text.slice(start, end);
  }

  private deduplicateResults(results: MatchResult[]): MatchResult[] {
    const seen = new Map<number, MatchResult>();
    for (const result of results) {
      const existing = seen.get(result.index);
      if (!existing || result.word.length > existing.word.length) {
        seen.set(result.index, result);
      }
    }
    return [...seen.values()].sort((a, b) => a.index - b.index);
  }
}
