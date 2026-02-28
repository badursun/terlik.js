/** Profanity severity level. */
export type Severity = "high" | "medium" | "low";

/** Detection mode controlling the balance between precision and recall. */
export type Mode = "strict" | "balanced" | "loose";

/** Masking style used when cleaning text. */
export type MaskStyle = "stars" | "partial" | "replace";

/** Fuzzy matching algorithm. */
export type FuzzyAlgorithm = "levenshtein" | "dice";

/** How a match was detected. */
export type MatchMethod = "exact" | "pattern" | "fuzzy";

/** A single entry in the profanity dictionary. */
export interface WordEntry {
  /** The canonical root form of the word. */
  root: string;
  /** Alternative spellings or forms of the root. */
  variants: string[];
  /** Severity level of the word. */
  severity: Severity;
  /** Content category (e.g. "sexual", "insult", "slur", "general"). */
  category?: string;
  /** Whether the suffix engine should match grammatical suffixes on this root. */
  suffixable?: boolean;
}

/** Configuration options for creating a Terlik instance. */
export interface TerlikOptions {
  /** Language code (default: `"tr"`). */
  language?: string;
  /** Detection mode (default: `"balanced"`). */
  mode?: Mode;
  /** Masking style (default: `"stars"`). */
  maskStyle?: MaskStyle;
  /** Additional words to detect. */
  customList?: string[];
  /** Additional words to exclude from detection. */
  whitelist?: string[];
  /** Enable fuzzy matching (default: `false`). */
  enableFuzzy?: boolean;
  /** Fuzzy similarity threshold between 0 and 1 (default: `0.8`). */
  fuzzyThreshold?: number;
  /** Fuzzy matching algorithm (default: `"levenshtein"`). */
  fuzzyAlgorithm?: FuzzyAlgorithm;
  /** Maximum input length before truncation (default: `10000`). */
  maxLength?: number;
  /** Custom mask text for "replace" mask style (default: `"[***]"`). */
  replaceMask?: string;
}

/** Per-call detection options that override instance defaults. */
export interface DetectOptions {
  mode?: Mode;
  enableFuzzy?: boolean;
  fuzzyThreshold?: number;
  fuzzyAlgorithm?: FuzzyAlgorithm;
}

/** Per-call clean options that override instance defaults. */
export interface CleanOptions extends DetectOptions {
  maskStyle?: MaskStyle;
  replaceMask?: string;
}

/** A single profanity match found in the input text. */
export interface MatchResult {
  /** The matched text from the original input. */
  word: string;
  /** The dictionary root word. */
  root: string;
  /** Character index in the original input. */
  index: number;
  /** Severity of the matched word. */
  severity: Severity;
  /** How the match was detected. */
  method: MatchMethod;
}

/** A compiled regex pattern for a dictionary entry. */
export interface CompiledPattern {
  root: string;
  severity: Severity;
  regex: RegExp;
  variants: string[];
}
