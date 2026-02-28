# terlik.js

![terlik.js](git-header.png)

[![CI](https://github.com/badursun/terlik.js/actions/workflows/ci.yml/badge.svg)](https://github.com/badursun/terlik.js/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/terlik.js.svg)](https://www.npmjs.com/package/terlik.js)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Production-grade multi-language profanity detection and filtering. Not a naive blacklist — a multi-layered normalization and pattern engine that catches what simple string matching misses.

Built-in support for **Turkish**, **English**, **Spanish**, and **German**. Adding a new language is just a folder with two files.

Zero runtime dependencies. Full TypeScript. ESM + CJS.

## Why terlik.js?

Turkish profanity evasion is creative. Users write `s2k`, `$1kt1r`, `s.i.k.t.i.r`, `SİKTİR`, `siiiiiktir`, `i8ne`, `or*spu`, `pu$ttt`, `6öt` — and expect to get away with it. Turkish is agglutinative — a single root like `sik` spawns dozens of forms: `siktiler`, `sikerim`, `siktirler`, `sikimsonik`. Manually listing every variant doesn't scale.

terlik.js catches all of these with a **suffix engine** that automatically recognizes Turkish grammatical suffixes on profane roots. Here's what a single call handles:

```ts
import { Terlik } from "terlik.js";
const terlik = new Terlik();

terlik.clean("s2mle yüzle$ g0t_v3r3n o r o s p u pezev3nk i8ne pu$ttt or*spu");
// "***** yüzle$ ********* *********** ******** **** ****** ******"
// 7 matches, 0 false positives, <2ms
```

## Install

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

// Turkish (default)
const tr = new Terlik();
tr.containsProfanity("siktir git");  // true
tr.clean("siktir git burdan");       // "****** git burdan"

// English
const en = new Terlik({ language: "en" });
en.containsProfanity("what the fuck"); // true
en.containsProfanity("siktir git");    // false (Turkish not loaded)

// Spanish & German
const es = new Terlik({ language: "es" });
const de = new Terlik({ language: "de" });
es.containsProfanity("hijo de puta");  // true
de.containsProfanity("scheiße");       // true
```

## What It Catches

| Evasion technique | Example | Detected as |
|---|---|---|
| Plain text | `siktir` | sik |
| Turkish İ/I | `SİKTİR` | sik |
| Leet speak | `$1kt1r`, `@pt@l` | sik, aptal |
| Visual leet (TR) | `8ok`, `6öt`, `i8ne`, `s2k` | bok, göt, ibne, sik |
| Turkish number words | `s2mle` (s+iki+mle) | sik (sikimle) |
| Separators | `s.i.k.t.i.r`, `s_i_k` | sik |
| Spaces | `o r o s p u` | orospu |
| Char repetition | `siiiiiktir`, `pu$ttt` | sik, puşt |
| Mixed punctuation | `or*spu`, `g0t_v3r3n` | orospu, göt |
| Combined | `$1kt1r g0t_v3r3n` | both caught |
| **Suffix forms** | `siktiler`, `orospuluk`, `gotune` | sik, orospu, göt |
| **Suffix + evasion** | `s.i.k.t.i.r.l.e.r`, `$1kt1rler` | sik |
| **Suffix chaining** | `siktirler` (sik+tir+ler) | sik |

### What It Doesn't Catch (on purpose)

Whitelist prevents false positives on legitimate words:

```ts
terlik.containsProfanity("Amsterdam");    // false
terlik.containsProfanity("sikke");        // false (Ottoman coin)
terlik.containsProfanity("ambulans");     // false
terlik.containsProfanity("siklet");       // false (boxing weight class)
terlik.containsProfanity("memur");        // false
terlik.containsProfanity("malzeme");      // false
terlik.containsProfanity("ama");          // false (conjunction)
terlik.containsProfanity("amir");         // false
terlik.containsProfanity("dolmen");       // false
```

## How It Works

Six-stage normalization pipeline (language-aware), then pattern matching:

```
input
  → lowercase (locale-aware: "tr", "en", "es", "de")
  → char folding (language-specific: İ→i, ñ→n, ß→ss, ä→a, ...)
  → number expansion (optional, e.g. Turkish: s2k → sikik)
  → leet speak decode (0→o, 1→i, @→a, $→s, ...)
  → punctuation removal (between letters: s.i.k → sik)
  → repeat collapse (siiiiik → sik)
  → pattern matching (dynamic regex with language-specific char classes)
  → whitelist filtering
  → result
```

Each language has its own char map, leet map, char classes, and optional number expansions. The engine is language-agnostic — only the data is language-specific.

For suffixable roots, the engine appends an optional suffix group (up to 2 chained suffixes). Turkish has 73 suffixes, English has 6, Spanish has 9, German has 5.

### Language Packs

Each language lives in its own folder under `src/lang/`:

```
src/lang/
  tr/
    config.ts           ← charMap, leetMap, charClasses, locale
    dictionary.json     ← entries, suffixes, whitelist
  en/
    config.ts
    dictionary.json
  ...
```

Dictionary format (community-friendly JSON, no TypeScript needed):

```json
{
  "version": 1,
  "suffixes": ["ing", "ed", "er", "s"],
  "entries": [
    { "root": "fuck", "variants": ["fucking", "fucker"], "severity": "high", "category": "sexual", "suffixable": true }
  ],
  "whitelist": ["assassin", "class", "grass"]
}
```

Categories: `sexual`, `insult`, `slur`, `general`. Severity: `high`, `medium`, `low`.

### Adding a New Language

1. Create `src/lang/xx/` folder
2. Add `dictionary.json` (entries, suffixes, whitelist)
3. Add `config.ts` (locale, charMap, leetMap, charClasses)
4. Register in `src/lang/index.ts` (one import line)
5. Write tests, build, done

## Performance

### Startup Cost & First Request Latency

terlik.js uses 25+ compiled regex patterns. There are two one-time costs:

1. **`new Terlik()`** — Compiles patterns and builds lookup tables (~10-50ms)
2. **First detection call** — JavaScript engine JIT-compiles the regex patterns on first execution. This can add **1-3 seconds** to the first call.

These costs are paid only once. After that, every call runs in **<1ms**.

**The key question:** Where do you want to pay the JIT cost?

```ts
// Option A: Pay at startup (recommended for servers)
// App startup takes longer, but no user ever waits.
const terlik = new Terlik();
terlik.containsProfanity("warmup"); // Forces JIT compilation here (~1-3s)

app.post("/chat", (req, res) => {
  const cleaned = terlik.clean(req.body.message); // <1ms from the very first request
});
```

```ts
// Option B: Pay on first request
// App starts faster, but the first user request will be slow (~1-3s).
const terlik = new Terlik();

app.post("/chat", (req, res) => {
  const cleaned = terlik.clean(req.body.message); // First call: ~1-3s, then <1ms
});
```

```ts
// Option C: Multi-language warmup
// Creates and JIT-warms all languages at once.
const cache = Terlik.warmup(["tr", "en", "es", "de"]);

app.post("/chat", (req, res) => {
  const lang = req.body.language; // "tr", "en", etc.
  const cleaned = cache.get(lang)!.clean(req.body.message); // <1ms
});
```

> **Important:** Never create `new Terlik()` per request. Each constructor call recompiles all patterns. A single cached instance handles requests in microseconds.

### Throughput

Benchmark results (Apple Silicon, single core, msgs/sec):

| Scenario | msgs/sec |
|---|---|
| Clean messages (no matches) | ~193,000 |
| Mixed messages (balanced mode) | ~151,000 |
| Suffixed dirty messages | ~142,000 |
| Strict mode | ~390,000 |
| Loose mode (with fuzzy) | ~8,400 |

> **Note:** Loose/fuzzy mode is ~18x slower than balanced mode due to O(n*m) similarity computation. Use it only when typo tolerance is critical, not as a default.

## Options

```ts
const terlik = new Terlik({
  language: "tr",                // "tr" | "en" | "es" | "de" (default: "tr")
  mode: "balanced",              // "strict" | "balanced" | "loose"
  maskStyle: "stars",            // "stars" | "partial" | "replace"
  replaceMask: "[***]",          // mask text for "replace" style
  customList: ["customword"],    // additional words to detect
  whitelist: ["safeword"],       // additional words to whitelist
  enableFuzzy: false,            // enable fuzzy matching
  fuzzyThreshold: 0.8,           // similarity threshold (0-1)
  fuzzyAlgorithm: "levenshtein", // "levenshtein" | "dice"
  maxLength: 10000,              // truncate input beyond this
});
```

## Detection Modes

| Mode | What it does | Best for |
|---|---|---|
| `strict` | Normalize + exact match only | Minimum false positives |
| `balanced` | Normalize + pattern matching with separator/leet tolerance | **General use (default)** |
| `loose` | Pattern + fuzzy matching (Levenshtein or Dice) | Maximum coverage, typo tolerance |

## API

### `terlik.containsProfanity(text, options?): boolean`

Quick boolean check. Runs full detection internally and returns `true` if any match exists.

### `terlik.getMatches(text, options?): MatchResult[]`

Returns all matches with details:

```ts
interface MatchResult {
  word: string;       // matched text from original input
  root: string;       // dictionary root word
  index: number;      // position in original text
  severity: "high" | "medium" | "low";
  method: "exact" | "pattern" | "fuzzy";
}
```

### `terlik.clean(text, options?): string`

Returns text with profanity masked. Three styles:

```ts
terlik.clean("siktir git");                                    // "****** git"
terlik.clean("siktir git", { maskStyle: "partial" });          // "s****r git"
terlik.clean("siktir git", { maskStyle: "replace" });          // "[***] git"
```

### `terlik.addWords(words) / removeWords(words)`

Runtime dictionary modification. Recompiles patterns automatically.

```ts
terlik.addWords(["customword"]);
terlik.containsProfanity("customword"); // true

terlik.removeWords(["salak"]);
terlik.containsProfanity("salak"); // false
```

### `Terlik.warmup(languages, options?): Map<string, Terlik>`

Static method. Creates and JIT-warms instances for multiple languages at once.

```ts
const cache = Terlik.warmup(["tr", "en", "es", "de"]);
cache.get("en")!.containsProfanity("fuck"); // true — no cold start
```

### `terlik.language: string`

Read-only property. Returns the language code of the instance.

### `getSupportedLanguages(): string[]`

Returns all available language codes.

```ts
import { getSupportedLanguages } from "terlik.js";
getSupportedLanguages(); // ["tr", "en", "es", "de"]
```

### `normalize(text): string`

Standalone export. Uses Turkish locale by default.

```ts
import { normalize, createNormalizer } from "terlik.js";

normalize("S.İ.K.T.İ.R"); // "siktir" (Turkish default)

// Custom normalizer for any language
const deNormalize = createNormalizer({
  locale: "de",
  charMap: { ä: "a", ö: "o", ü: "u", ß: "ss" },
  leetMap: { "0": "o", "3": "e" },
});
deNormalize("Scheiße"); // "scheisse"
```

## Testing

619 tests covering all 4 languages, 25 Turkish root words, suffix detection, multi-language isolation, normalization, fuzzy matching, cleaning, integration, ReDoS hardening, attack surface coverage, and edge cases:

```bash
pnpm test          # run once
pnpm test:watch    # watch mode
```

### Live Test Server

An interactive browser-based test environment is included. Chat interface on the left, real-time process log on the right — see exactly what terlik.js does at each step (normalization, pattern matching, match details, timing).

```bash
pnpm dev:live      # http://localhost:2026
```

See [`live_test_server/README.md`](./live_test_server/README.md) for details.

### Integration Guide

See [**Integration Guide**](./docs/integration-guide.md) for Express, Fastify, Next.js, Nuxt, Socket.io, and multi-language server examples.

## Development

```bash
pnpm install          # install dependencies
pnpm test             # run tests
pnpm test:coverage    # run tests with coverage report
pnpm typecheck        # TypeScript type checking
pnpm build            # build ESM + CJS output
pnpm bench            # run performance benchmarks
pnpm dev:live         # start interactive test server
```

Pre-commit hooks (via Husky) automatically run type checking on staged `.ts` files.

See [CONTRIBUTING.md](./CONTRIBUTING.md) for contribution guidelines.

## Changelog

### 2026-02-28 (v2.1) — ReDoS Security Hardening

**Added Regex Denial-of-Service protection.**

Identified vulnerability: overlap between `charClasses` and `separator` (`@`, `$`, `!`, `|`, `+`, `#`, `€`, `¢`, `©` could be matched by both char class and separator) enabled polynomial O(n^2) backtracking via adversarial input.

- **Bounded separator** — `[^\p{L}\p{N}]*` (unbounded) replaced with `[^\p{L}\p{N}]{0,3}` (max 3 chars). Real-world evasions (`s.i.k.t.i.r`, `s_i_k`) use 1 separator char. This reduces backtracking from O(n^2) to O(1) per boundary.
- **Regex timeout safety net** — Added 250ms timeout (`REGEX_TIMEOUT_MS`) to `runPatterns()` and `detectFuzzy()` loops. Never triggers on normal input (<1ms), but provides a hard cap on adversarial input.
- **charClasses cleanup** — Removed separator-overlapping symbols from all 4 language configs (TR, EN, ES, DE). These symbols are already defined in `leetMap` and converted during the normalizer pass — removing them from pattern matching causes no false negatives.
- **ReDoS test suite** — `tests/redos.test.ts`: 71 tests covering adversarial timing, attack surface (separator abuse, leet bypass, char repetition, Unicode tricks, whitelist integrity, boundary attacks, multi-match, input edge cases, suffix hardening).
- **MAX_PATTERN_LENGTH** — 5000 → 6000. The `{0,3}` separator adds ~3 chars per boundary; raised the limit so large suffix patterns (e.g. `orospu`) don't fall back to non-suffix mode.
- **Test count** — 548 → 619.

| Change | File |
|---|---|
| Separator `*` → `{0,3}`, timeout constant | `src/patterns.ts` |
| Timeout loop guard | `src/detector.ts` |
| charClasses cleanup | `src/lang/{tr,en,es,de}/config.ts` |
| ReDoS + attack surface test suite (new) | `tests/redos.test.ts` |

### 2026-02-28 (v2)

**Multi-Language Support**

- **4 built-in languages** — Turkish (tr), English (en), Spanish (es), German (de). Each language is a self-contained folder (`src/lang/xx/`) with `config.ts` and `dictionary.json`.
- **Folder-based language packs** — Adding a new language requires creating one folder with two files and one import line in the registry.
- **`Terlik.warmup()`** — Static method to create and JIT-warm multiple language instances at once for server deployments.
- **`language` option** — `new Terlik({ language: "en" })`. Default remains `"tr"` (backward compatible).
- **Language-agnostic engine** — Normalizer, pattern compiler, detector, and cleaner are now fully parametric. Language-specific data (charMap, leetMap, charClasses, numberExpansions) comes from config files.
- **New exports** — `createNormalizer`, `getLanguageConfig`, `getSupportedLanguages`, `LanguageConfig` type.
- **Test coverage** — 346 → 418 tests. Added language-specific tests, cross-language isolation tests, and registry tests.

### 2026-02-28

**Suffix Engine + JSON Dictionary Migration**

- **JSON dictionary** — Migrated dictionary from `tr.ts` to community-friendly `tr.json` format. Added runtime schema validation (`validateDictionary`). Each entry now includes `category` and `suffixable` fields.
- **Suffix engine** — Defined 73 Turkish grammatical suffixes. Suffixable roots (`orospu`, `salak`, `aptal`, `kahpe`, etc.) automatically catch inflected forms like `orospuluk`, `salaksin`, `aptallarin`, `kahpeler`. Short roots (3-char: `sik`, `bok`, `göt`, `döl`) use explicit variants instead to prevent false positives.
- **Critical bug fix: `\W` separator** — JavaScript's `\W` treats Turkish characters (`ı`, `ş`, `ğ`, `ö`, `ü`, `ç`) as non-word characters. The pattern engine separator `[\W_]*` was changed to `[^\p{L}\p{N}]*` (Unicode-aware). This fixed false positives on innocent words like `sıkma`, `sıkıntı`, `sıkıştı`.
- **Live test server warmup fix** — Fixed cache key mismatch and added JIT warmup. First request latency reduced from 3318ms to 37ms.
- **Test coverage** — 101 → 346 tests. All 25 root words are comprehensively tested.
- **Expanded whitelist** — Added `ama`, `ami`, `amen`, `amir`, `amil`, `dolmen`.

## License

MIT
