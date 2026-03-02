# API Reference

Full API reference for [terlik.js](https://github.com/badursun/terlik.js). For a quick overview, see the [README](../README.md).

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Constructor & Options](#constructor--options)
- [Per-Language Imports](#per-language-imports)
- [Detection Methods](#detection-methods)
- [Runtime Dictionary Management](#runtime-dictionary-management)
- [Static Methods](#static-methods)
- [Detection Modes](#detection-modes)
- [Per-Call Options](#per-call-options)
- [Normalizer (Standalone)](#normalizer-standalone)
- [Advanced: TerlikCore](#advanced-terlikcore)
- [Exported Types](#exported-types)
- [Performance Notes](#performance-notes)

---

## Installation

```bash
npm install terlik.js
# or
pnpm add terlik.js
# or
yarn add terlik.js
```

## Quick Start

```ts
import { Terlik } from "terlik.js";

const terlik = new Terlik();
terlik.containsProfanity("siktir git");  // true
terlik.clean("siktir git burdan");       // "****** git burdan"
terlik.getMatches("siktir git");         // [{ word: "siktir", root: "sik", ... }]
```

---

## Constructor & Options

```ts
import { Terlik } from "terlik.js";

const terlik = new Terlik(options?: TerlikOptions);
```

### `TerlikOptions`

| Option | Type | Default | Description |
|---|---|---|---|
| `language` | `string` | `"tr"` | Language code. Built-in: `"tr"`, `"en"`, `"es"`, `"de"`. |
| `mode` | `Mode` | `"balanced"` | Detection mode: `"strict"`, `"balanced"`, or `"loose"`. |
| `maskStyle` | `MaskStyle` | `"stars"` | Masking style for `clean()`: `"stars"`, `"partial"`, or `"replace"`. |
| `replaceMask` | `string` | `"[***]"` | Replacement text when `maskStyle` is `"replace"`. |
| `customList` | `string[]` | `undefined` | Additional words to detect (added as high-severity exact entries). |
| `whitelist` | `string[]` | `undefined` | Additional words to exclude from detection. |
| `enableFuzzy` | `boolean` | `false` | Enable fuzzy matching (Levenshtein or Dice similarity). |
| `fuzzyThreshold` | `number` | `0.8` | Similarity threshold for fuzzy matching (0–1). `0.8` ≈ 1 typo per 5 chars. |
| `fuzzyAlgorithm` | `FuzzyAlgorithm` | `"levenshtein"` | `"levenshtein"` or `"dice"`. |
| `maxLength` | `number` | `10000` | Truncate input beyond this length. Must be ≥ 1. |
| `backgroundWarmup` | `boolean` | `false` | Compile patterns in background via `setTimeout`. **Do not use in serverless.** |
| `extendDictionary` | `DictionaryData` | `undefined` | External dictionary to merge with the built-in one. See [Runtime Dictionary Management](#runtime-dictionary-management). |
| `disableLeetDecode` | `boolean` | `false` | Disable leet-speak decoding and number expansion. Safety layers (NFKD, diacritics, Cyrillic) remain active. |
| `disableCompound` | `boolean` | `false` | Disable CamelCase decompounding (3rd detection pass). Explicit compound variants in the dictionary are unaffected. |
| `minSeverity` | `Severity` | `undefined` | Minimum severity threshold. Matches below this level are excluded. |
| `excludeCategories` | `Category[]` | `undefined` | Categories to exclude from results. |

---

## Per-Language Imports

If you only need one language, use sub-path imports to reduce bundle size:

```ts
import { Terlik } from "terlik.js/tr";  // Turkish only (~10 KB gzip)
import { Terlik } from "terlik.js/en";  // English only (~10 KB gzip)
import { Terlik } from "terlik.js/es";  // Spanish only (~9 KB gzip)
import { Terlik } from "terlik.js/de";  // German only (~9 KB gzip)
```

### Bundle Size Comparison

| Import | Gzip size | Includes |
|---|---|---|
| `terlik.js` | ~14 KB | All 4 languages (TR, EN, ES, DE) |
| `terlik.js/tr` | ~10 KB | Turkish only |
| `terlik.js/en` | ~10 KB | English only |
| `terlik.js/es` | ~9 KB | Spanish only |
| `terlik.js/de` | ~9 KB | German only |

### Sub-Path Exports

Each per-language entry point (`terlik.js/tr`, `/en`, `/es`, `/de`) exports:

| Export | Description |
|---|---|
| `Terlik` | Pre-configured class for that language. No `language` option needed. |
| `createTerlik(options?)` | Factory function returning a `Terlik` instance. |
| `languageConfig` | Pre-resolved `LanguageConfig` object for advanced use with `TerlikCore`. |
| `TerlikCore` | Low-level engine class. See [Advanced: TerlikCore](#advanced-terlikcore). |
| All types | `TerlikOptions`, `DetectOptions`, `CleanOptions`, `MatchResult`, etc. |

### Usage

```ts
// Basic — just like the main entry, but single-language
import { Terlik } from "terlik.js/tr";
const t = new Terlik();
t.containsProfanity("siktir"); // true

// Factory
import { createTerlik } from "terlik.js/en";
const en = createTerlik({ mode: "strict" });
en.containsProfanity("fuck"); // true

// Advanced — use languageConfig with TerlikCore
import { TerlikCore, languageConfig } from "terlik.js/tr";
const custom = new TerlikCore(languageConfig, { mode: "loose", enableFuzzy: true });
```

### Per-Language `Terlik` Constructor

The per-language `Terlik` class omits the `language` option since the language is fixed:

```ts
// Per-language: language is fixed, cannot be overridden
import { Terlik } from "terlik.js/tr";
const t = new Terlik({ mode: "strict" }); // OK
// const t = new Terlik({ language: "en" }); // TypeScript error
```

---

## Detection Methods

### `containsProfanity(text, options?): boolean`

Returns `true` if the text contains any profanity match.

**Parameters:**

| Param | Type | Description |
|---|---|---|
| `text` | `string` | Input text to check. |
| `options` | `DetectOptions` | Optional per-call overrides. See [Per-Call Options](#per-call-options). |

**Returns:** `boolean`

```ts
terlik.containsProfanity("siktir git");     // true
terlik.containsProfanity("merhaba dünya");  // false

// With per-call options
terlik.containsProfanity("damn it", { minSeverity: "high" }); // false (damn is medium)
```

### `getMatches(text, options?): MatchResult[]`

Returns all profanity matches with full details.

**Parameters:**

| Param | Type | Description |
|---|---|---|
| `text` | `string` | Input text to check. |
| `options` | `DetectOptions` | Optional per-call overrides. |

**Returns:** `MatchResult[]`

```ts
const matches = terlik.getMatches("siktir git orospucocugu");
// [
//   { word: "siktir", root: "sik", index: 0, severity: "high", category: "sexual", method: "pattern" },
//   { word: "orospucocugu", root: "orospu", index: 11, severity: "high", category: "insult", method: "pattern" }
// ]
```

#### `MatchResult` Interface

```ts
interface MatchResult {
  /** The matched text from the original input. */
  word: string;
  /** The dictionary root word. */
  root: string;
  /** Character index in the original input. */
  index: number;
  /** Severity of the matched word. */
  severity: "high" | "medium" | "low";
  /** Content category (undefined for custom words added via customList/addWords). */
  category?: "sexual" | "insult" | "slur" | "general";
  /** How the match was detected. */
  method: "exact" | "pattern" | "fuzzy";
}
```

### `clean(text, options?): string`

Returns the input text with profanity masked.

**Parameters:**

| Param | Type | Description |
|---|---|---|
| `text` | `string` | Input text to clean. |
| `options` | `CleanOptions` | Optional per-call overrides (includes mask options). |

**Returns:** `string`

#### Mask Styles

```ts
// "stars" (default) — full word replaced with asterisks
terlik.clean("siktir git");
// "****** git"

// "partial" — first and last characters preserved
terlik.clean("siktir git", { maskStyle: "partial" });
// "s****r git"

// "replace" — replaced with fixed text
terlik.clean("siktir git", { maskStyle: "replace" });
// "[***] git"

// Custom replacement text
terlik.clean("siktir git", { maskStyle: "replace", replaceMask: "🤬" });
// "🤬 git"
```

### `language: string` (read-only)

Returns the language code of the instance.

```ts
const t = new Terlik({ language: "en" });
t.language; // "en"
```

---

## Runtime Dictionary Management

### `addWords(words: string[]): void`

Add custom words to the detection list at runtime. Patterns are recompiled automatically.

```ts
terlik.addWords(["customSlang", "anotherWord"]);
terlik.containsProfanity("customSlang"); // true
```

### `removeWords(words: string[]): void`

Remove words from the detection list. Removes both built-in and custom entries by root. Patterns are recompiled automatically.

```ts
terlik.removeWords(["damn"]);
terlik.containsProfanity("damn"); // false
```

### `extendDictionary` Option

Merge an external dictionary with the built-in one at construction time. Useful for teams managing custom word lists:

```ts
const terlik = new Terlik({
  extendDictionary: {
    version: 1,
    suffixes: ["ci", "cu"],
    entries: [
      {
        root: "customword",
        variants: ["cust0mword"],
        severity: "high",
        category: "general",
        suffixable: true,
      },
    ],
    whitelist: ["safeterm"],
  },
});

terlik.containsProfanity("customword");   // true
terlik.containsProfanity("customwordci"); // true (suffix match)
terlik.containsProfanity("safeterm");     // false (whitelisted)
terlik.containsProfanity("siktir");       // true (built-in still works)
```

**Merge behavior:**
- Duplicate roots are skipped (built-in takes precedence).
- Suffixes are merged (union of both lists).
- Whitelist entries are merged.
- Pattern cache is disabled for extended instances.

---

## Static Methods

### `Terlik.warmup(languages?, options?): Map<string, Terlik>`

Creates and JIT-warms instances for multiple languages at once. Useful for server deployments to eliminate cold-start latency.

**Parameters:**

| Param | Type | Default | Description |
|---|---|---|---|
| `languages` | `string[]` | All supported | Language codes to warm up. |
| `options` | `Omit<TerlikOptions, "language">` | `undefined` | Shared options applied to all instances. |

**Returns:** `Map<string, Terlik>`

```ts
// Warm up all languages
const cache = Terlik.warmup();

// Warm up specific languages
const cache = Terlik.warmup(["tr", "en"]);

// With shared options
const cache = Terlik.warmup(["tr", "en"], { mode: "strict" });

// Usage in server
app.post("/chat", (req, res) => {
  const lang = req.body.language;
  const cleaned = cache.get(lang)!.clean(req.body.message); // <1ms
});
```

> **Note:** Only available from the main `terlik.js` entry point. Per-language entries do not export `warmup`.

### `getSupportedLanguages(): string[]`

Returns all available built-in language codes.

```ts
import { getSupportedLanguages } from "terlik.js";
getSupportedLanguages(); // ["tr", "en", "es", "de"]
```

---

## Detection Modes

| Mode | Behavior | Best for |
|---|---|---|
| `strict` | Normalize + exact match only. Highest precision, lowest recall. | Minimum false positives. |
| `balanced` | Normalize + pattern matching with separator/leet tolerance. Best F1 overall. | **General use (default).** |
| `loose` | Pattern + fuzzy matching (Levenshtein or Dice). Highest recall, slightly higher FPR. | Maximum coverage, typo tolerance. |

### Detailed Comparison

**Strict mode:**
- Only matches after normalization (char folding, leet decode, separator removal, repeat collapse).
- No fuzzy matching. No char-class pattern expansion.
- Best when you have controlled input and want zero false positives.

**Balanced mode** (recommended):
- Full normalization pipeline + regex patterns with char-class expansion.
- Catches leet speak, separators, char repetition, CamelCase compounds.
- Near-zero FPR with high recall. Best for production chat systems.

**Loose mode:**
- Everything in balanced + fuzzy matching.
- Catches typos and creative misspellings within the similarity threshold.
- ~18x slower than balanced due to O(n*m) similarity computation.
- Use only when typo tolerance is critical.

```ts
// Override mode per call
terlik.containsProfanity("text", { mode: "strict" });
terlik.clean("text", { mode: "loose", enableFuzzy: true, fuzzyThreshold: 0.75 });
```

---

## Per-Call Options

Both `containsProfanity` and `getMatches` accept `DetectOptions`. The `clean` method accepts `CleanOptions` which extends `DetectOptions` with mask options.

### `DetectOptions`

| Option | Type | Default | Description |
|---|---|---|---|
| `mode` | `Mode` | Instance default | Override detection mode for this call. |
| `enableFuzzy` | `boolean` | Instance default | Enable/disable fuzzy matching. |
| `fuzzyThreshold` | `number` | Instance default | Similarity threshold (0–1). |
| `fuzzyAlgorithm` | `FuzzyAlgorithm` | Instance default | `"levenshtein"` or `"dice"`. |
| `disableLeetDecode` | `boolean` | Instance default | Skip leet-speak decoding and number expansion. Safety layers remain active. |
| `disableCompound` | `boolean` | Instance default | Skip CamelCase decompounding pass. |
| `minSeverity` | `Severity` | Instance default | Exclude matches below this severity. |
| `excludeCategories` | `Category[]` | Instance default | Exclude matches in these categories. |

### `CleanOptions`

Extends `DetectOptions` with:

| Option | Type | Default | Description |
|---|---|---|---|
| `maskStyle` | `MaskStyle` | Instance default | `"stars"`, `"partial"`, or `"replace"`. |
| `replaceMask` | `string` | Instance default | Replacement text for `"replace"` style. |

### Examples

```ts
// Only detect high-severity words
terlik.getMatches("text", { minSeverity: "high" });

// Exclude slurs category
terlik.getMatches("text", { excludeCategories: ["slur"] });

// Disable leet decode for controlled input (e.g. validated usernames)
terlik.containsProfanity("user123", { disableLeetDecode: true });

// Clean with different mask per call
terlik.clean("text", { maskStyle: "partial" });
terlik.clean("text", { maskStyle: "replace", replaceMask: "[CENSORED]" });
```

---

## Normalizer (Standalone)

The normalization pipeline is available as a standalone export for use outside of profanity detection.

### `normalize(text): string`

Normalizes text using the default **Turkish** locale pipeline.

```ts
import { normalize } from "terlik.js";

normalize("S.İ.K.T.İ.R");  // "siktir"
normalize("$1kt1r");        // "siktir"
normalize("Scheiße");        // "scheisse"
```

### `createNormalizer(config): (text: string) => string`

Creates a language-specific normalizer function. The returned function applies a 10-stage pipeline:

1. Strip invisible chars (ZWSP, ZWNJ, soft hyphen, etc.)
2. NFKD decompose (fullwidth to ASCII, precomposed to base + combining)
3. Strip combining marks (removes accents/diacritics)
4. Locale-aware lowercase
5. Cyrillic confusable to Latin
6. Language-specific char folding
7. Number expansion (if configured)
8. Leet decode
9. Punctuation removal (between letters)
10. Repeat collapse + whitespace trim

```ts
import { createNormalizer } from "terlik.js";

const deNormalize = createNormalizer({
  locale: "de",
  charMap: { ä: "a", ö: "o", ü: "u", ß: "ss" },
  leetMap: { "0": "o", "3": "e" },
});

deNormalize("Scheiße");  // "scheisse"
deNormalize("fück");     // "fuck"
deNormalize("ｆｕｃｋ");   // "fuck" (fullwidth chars)
```

#### `NormalizerConfig`

```ts
interface NormalizerConfig {
  locale: string;
  charMap: Record<string, string>;
  leetMap: Record<string, string>;
  numberExpansions?: [string, string][];
}
```

---

## Advanced: TerlikCore

`TerlikCore` is the low-level engine class that powers all `Terlik` instances. It accepts a pre-resolved `LanguageConfig` object instead of a language string, bypassing the language registry entirely.

### When to Use

- **Custom language configs**: Build your own `LanguageConfig` for a language not yet supported.
- **Advanced tree-shaking**: Per-language entry points use `TerlikCore` internally. Using it directly gives you full control.
- **Runtime language loading**: Load language configs dynamically (e.g., from a database or API).

### Usage

```ts
import { TerlikCore } from "terlik.js";
import type { LanguageConfig } from "terlik.js";

// Build a custom language config
const myLangConfig: LanguageConfig = {
  locale: "fr",
  charMap: { é: "e", è: "e", ê: "e", ë: "e", ç: "c" },
  leetMap: { "0": "o", "1": "i", "3": "e", "@": "a", "$": "s" },
  charClasses: {
    a: "[a4@àáâãäå]",
    e: "[e3èéêë]",
    // ...
  },
  dictionary: {
    version: 1,
    suffixes: [],
    entries: [
      { root: "merde", variants: [], severity: "high", category: "general", suffixable: false },
    ],
    whitelist: [],
  },
};

const fr = new TerlikCore(myLangConfig, { mode: "balanced" });
fr.containsProfanity("merde"); // true
```

### Using with Per-Language Config

Each per-language entry exports its `languageConfig`:

```ts
import { TerlikCore, languageConfig } from "terlik.js/tr";

// Use the Turkish config with custom options
const custom = new TerlikCore(languageConfig, {
  mode: "loose",
  enableFuzzy: true,
  fuzzyThreshold: 0.75,
});
```

### Constructor

```ts
new TerlikCore(langConfig: LanguageConfig, options?: TerlikOptions)
```

`TerlikCore` has the same instance API as `Terlik` (`containsProfanity`, `getMatches`, `clean`, `addWords`, `removeWords`, `getPatterns`, `language`), but does **not** have the static `warmup` method.

### `getPatterns(): Map<string, RegExp>`

Returns the compiled regex patterns (root → regex). Useful for debugging or custom matching logic.

```ts
const patterns = terlik.getPatterns();
for (const [root, regex] of patterns) {
  console.log(`${root}: ${regex.source}`);
}
```

---

## Exported Types

All types below are exported from the main entry (`terlik.js`). Per-language entries (`terlik.js/tr`, etc.) export all types **except** `WordEntry` and `NormalizerConfig` — use the main entry if you need those.

### Core Types

```ts
type Severity = "high" | "medium" | "low";
type Category = "sexual" | "insult" | "slur" | "general";
type Mode = "strict" | "balanced" | "loose";
type MaskStyle = "stars" | "partial" | "replace";
type FuzzyAlgorithm = "levenshtein" | "dice";
type MatchMethod = "exact" | "pattern" | "fuzzy";
```

### Interfaces

```ts
interface TerlikOptions {
  language?: string;
  mode?: Mode;
  maskStyle?: MaskStyle;
  replaceMask?: string;
  customList?: string[];
  whitelist?: string[];
  enableFuzzy?: boolean;
  fuzzyThreshold?: number;
  fuzzyAlgorithm?: FuzzyAlgorithm;
  maxLength?: number;
  backgroundWarmup?: boolean;
  extendDictionary?: DictionaryData;
  disableLeetDecode?: boolean;
  disableCompound?: boolean;
  minSeverity?: Severity;
  excludeCategories?: Category[];
}

interface DetectOptions {
  mode?: Mode;
  enableFuzzy?: boolean;
  fuzzyThreshold?: number;
  fuzzyAlgorithm?: FuzzyAlgorithm;
  disableLeetDecode?: boolean;
  disableCompound?: boolean;
  minSeverity?: Severity;
  excludeCategories?: Category[];
}

interface CleanOptions extends DetectOptions {
  maskStyle?: MaskStyle;
  replaceMask?: string;
}

interface MatchResult {
  word: string;
  root: string;
  index: number;
  severity: Severity;
  category?: Category;
  method: MatchMethod;
}

interface WordEntry {
  root: string;
  variants: string[];
  severity: Severity;
  category?: string;
  suffixable?: boolean;
}

interface LanguageConfig {
  locale: string;
  charMap: Record<string, string>;
  leetMap: Record<string, string>;
  charClasses: Record<string, string>;
  numberExpansions?: [string, string][];
  dictionary: DictionaryData;
}

// Used by extendDictionary option and LanguageConfig.dictionary.
// Not exported from the public API — use this shape inline.
interface DictionaryData {
  version: number;           // must be 1
  suffixes: string[];        // e.g. ["ing", "ed", "er", "s"]
  entries: Array<{
    root: string;            // canonical root form
    variants: string[];      // alternative spellings
    severity: string;        // "high" | "medium" | "low"
    category: string;        // "sexual" | "insult" | "slur" | "general"
    suffixable: boolean;     // whether suffix engine applies
  }>;
  whitelist: string[];       // words to exclude from detection
}

interface NormalizerConfig {
  locale: string;
  charMap: Record<string, string>;
  leetMap: Record<string, string>;
  numberExpansions?: [string, string][];
}
```

---

## Performance Notes

### Lazy Compilation

`new Terlik()` is near-instant (~1.5ms). Regex patterns compile on the first detection call, not at construction.

| Phase | Cost | When |
|---|---|---|
| `new Terlik()` | ~1.5ms | Construction (lookup tables only) |
| First `detect()` | ~200-700ms | Lazy regex compilation + V8 JIT warmup |
| Subsequent calls | <1ms | Patterns cached, JIT optimized |

### Warmup Strategies

| Strategy | When | Example |
|---|---|---|
| `backgroundWarmup: true` | Long-running servers (Express, Fastify) | `new Terlik({ backgroundWarmup: true })` |
| Explicit warmup | Serverless (Lambda, Vercel, Workers) | `const t = new Terlik(); t.containsProfanity("warmup");` |
| `Terlik.warmup()` | Multi-language servers | `Terlik.warmup(["tr", "en"])` |
| Lazy (default) | Scripts, CLIs, low-traffic | `new Terlik()` |

> **Serverless warning:** Do NOT use `backgroundWarmup` in serverless runtimes. The `setTimeout` callback may never fire because the process freezes between invocations.

### Per-Language Bundle Sizes

Using per-language imports eliminates unused language dictionaries from your bundle:

| Import | Raw | Gzip |
|---|---|---|
| `terlik.js` (all languages) | ~67 KB | ~14 KB |
| `terlik.js/tr` | ~42 KB | ~10 KB |
| `terlik.js/en` | ~43 KB | ~10 KB |
| `terlik.js/es` | ~38 KB | ~9 KB |
| `terlik.js/de` | ~37 KB | ~9 KB |

The core engine (~32 KB raw) is shared across all entry points via code splitting. The difference comes from dictionary size per language.
