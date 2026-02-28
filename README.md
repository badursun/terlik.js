# terlik.js

![terlik.js](git-header.png)

[![CI](https://github.com/badursun/terlik.js/actions/workflows/ci.yml/badge.svg)](https://github.com/badursun/terlik.js/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/terlik.js.svg)](https://www.npmjs.com/package/terlik.js)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Production-grade multi-language profanity detection and filtering. Not a naive blacklist — a multi-layered normalization and pattern engine that catches what simple string matching misses.

Built-in support for **Turkish**, **English**, **Spanish**, and **German**. Adding a new language is just a folder with two files.

Zero runtime dependencies. Full TypeScript. ESM + CJS. Works in Node.js, Bun, Deno, browsers, Cloudflare Workers, and Edge runtimes — no Node.js-specific APIs used.

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
| **Deep agglutination** | `siktiğimin`, `sikermisiniz`, `siktirmişcesine` | sik |
| **Zero-width chars** | `s\u200Bi\u200Bk\u200Bt\u200Bi\u200Br` (ZWSP/ZWNJ/ZWJ) | sik |

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

For suffixable roots, the engine appends an optional suffix group (up to 2 chained suffixes). Turkish has 83 suffixes (including question particles and adverbial forms), English has 8, Spanish has 13, German has 8.

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

## Dictionary Strategy

terlik.js ships with a **deliberately narrow dictionary** — the goal is to **minimize false positives** while catching real-world evasion patterns. The dictionary is not a massive word list; it's a curated set of roots + variants that the pattern engine expands through normalization, leet decoding, separator tolerance, and suffix chaining.

### Coverage

| Language | Roots | Explicit Variants | Suffixes | Whitelist | Effective Forms |
|---|---|---|---|---|---|
| Turkish | 25 | 88 | 83 | 52 | ~3,000+ |
| English | 23 | 106 | 8 | 42 | ~700+ |
| Spanish | 19 | 73 | 13 | 15 | ~500+ |
| German | 18 | 48 | 8 | 3 | ~300+ |

"Effective forms" = roots × normalization variants × suffix combinations × evasion patterns. A root like `sik` with 83 possible suffixes, leet decoding, separator tolerance, and repeat collapse produces thousands of detectable surface forms.

### What IS Covered

- **Core profanity roots** per language (high-severity sexual, insults, slurs)
- **Grammatical inflections** via suffix engine (Turkish agglutination, English -ing/-ed, etc.)
- **Evasion patterns**: leet speak, separators, repetition, mixed case, number words (TR)
- **Compound forms**: `orospucocugu`, `motherfucker`, `hijoputa`, `hurensohn`

### What is NOT Covered (by design)

- **Slang / regional variants** that change rapidly — better handled with `customList`
- **Context-dependent words** that are profane only in certain contexts
- **Phonetic substitutions** beyond leet (e.g., "phuck") — add via `customList`
- **New coinages** — use `addWords()` at runtime

### Why Narrow?

A large dictionary maximizes recall but tanks precision. In production chat systems, **false positives are worse than false negatives** — blocking "class" or "grass" because the dictionary is too broad erodes user trust. terlik.js defaults to high precision and lets you widen coverage per your needs:

```ts
// Add domain-specific words
terlik.addWords(["customSlang", "anotherWord"]);

// Or at construction time
const terlik = new Terlik({
  customList: ["customSlang", "anotherWord"],
  whitelist: ["legitimateWord"],
});

// Remove a built-in word if it causes false positives in your domain
terlik.removeWords(["damn"]);
```

## Performance

### Lazy Compilation

terlik.js uses **lazy compilation** — `new Terlik()` is near-instant (~1.5ms). Regex patterns are compiled on the first `detect()` call, not at construction time. This eliminates startup cost when creating multiple instances.

| Phase | Cost | When |
|---|---|---|
| `new Terlik()` | **~1.5ms** | Construction (lookup tables only) |
| First `detect()` | ~200-700ms | Lazy regex compilation + V8 JIT warmup |
| Subsequent calls | **<1ms** | Patterns cached, JIT optimized |

**Where do you want to pay the compilation cost?**

```ts
// Option A: Background warmup (recommended for servers)
// Construction is instant. Patterns compile in the next event loop tick.
// If a request arrives before warmup finishes, it compiles synchronously.
const terlik = new Terlik({ backgroundWarmup: true });

app.post("/chat", (req, res) => {
  const cleaned = terlik.clean(req.body.message); // <1ms (warmup already done)
});
```

```ts
// Option B: Explicit warmup at startup
const terlik = new Terlik();
terlik.containsProfanity("warmup"); // Forces compilation here

app.post("/chat", (req, res) => {
  const cleaned = terlik.clean(req.body.message); // <1ms
});
```

```ts
// Option C: Lazy (pay on first request)
const terlik = new Terlik(); // ~1.5ms

app.post("/chat", (req, res) => {
  const cleaned = terlik.clean(req.body.message); // First call: ~500ms, then <1ms
});
```

```ts
// Option D: Multi-language warmup
const cache = Terlik.warmup(["tr", "en", "es", "de"]);

app.post("/chat", (req, res) => {
  const lang = req.body.language;
  const cleaned = cache.get(lang)!.clean(req.body.message); // <1ms
});
```

> **Important:** Never create `new Terlik()` per request. A single cached instance handles requests in microseconds.

> **Serverless (Lambda, Vercel, Cloudflare Workers):** Do NOT use `backgroundWarmup`. The `setTimeout` callback may never fire because serverless runtimes freeze the process between invocations. Use explicit warmup instead: `const t = new Terlik(); t.containsProfanity("warmup");` at module scope.

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

### Accuracy

Measured on a labeled corpus of 388 samples across 4 languages (profane + clean + whitelist + edge cases):

| Language | Mode | Precision | Recall | F1 | FPR | FNR |
|---|---|---|---|---|---|---|
| TR | strict | 100.0% | 88.6% | 93.9% | 0.0% | 11.4% |
| TR | **balanced** | **100.0%** | **100.0%** | **100.0%** | **0.0%** | **0.0%** |
| TR | loose | 99.1% | 100.0% | 99.5% | 1.6% | 0.0% |
| EN | strict | 100.0% | 95.5% | 97.7% | 0.0% | 4.5% |
| EN | **balanced** | **100.0%** | **98.5%** | **99.2%** | **0.0%** | **1.5%** |
| EN | loose | 98.5% | 98.5% | 98.5% | 2.0% | 1.5% |
| ES | strict | 100.0% | 96.7% | 98.3% | 0.0% | 3.3% |
| ES | **balanced** | **100.0%** | **96.7%** | **98.3%** | **0.0%** | **3.3%** |
| ES | loose | 100.0% | 96.7% | 98.3% | 0.0% | 3.3% |
| DE | strict | 100.0% | 100.0% | 100.0% | 0.0% | 0.0% |
| DE | **balanced** | **100.0%** | **100.0%** | **100.0%** | **0.0%** | **0.0%** |
| DE | loose | 100.0% | 100.0% | 100.0% | 0.0% | 0.0% |

**Mode characteristics:**
- **Strict** — highest precision (0% FP), trades recall for safety. Misses some suffixed forms and evasion patterns.
- **Balanced** — best overall F1. Catches evasion patterns while keeping FPR near zero. **Recommended for production.**
- **Loose** — adds fuzzy matching. Slightly higher FPR due to similarity matches on borderline words.

Reproduce: `pnpm bench:accuracy` — outputs per-category breakdown, failure list, and JSON results.

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
  fuzzyThreshold: 0.8,           // similarity threshold (0-1). 0.8 ≈ 1 typo per 5 chars
  fuzzyAlgorithm: "levenshtein", // "levenshtein" | "dice"
  maxLength: 10000,              // truncate input beyond this
  backgroundWarmup: false,       // compile patterns in background via setTimeout
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

631 tests covering all 4 languages, 25 Turkish root words, suffix detection, lazy compilation, multi-language isolation, normalization, fuzzy matching, cleaning, integration, ReDoS hardening, attack surface coverage, and edge cases:

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

### 2026-02-28 (v2.2) — Lazy Compilation + Linguistic Patch

**Zero-cost construction. Background warmup. Turkish agglutination hardening.**

- **Lazy compilation** — Pattern compilation deferred from constructor to first `detect()` call. `new Terlik()` drops from ~225ms to **~1.5ms**. Strict-mode users never pay regex cost (hash lookup only).
- **`backgroundWarmup` option** — `new Terlik({ backgroundWarmup: true })` schedules compilation + JIT warmup via `setTimeout(fn, 0)`. Idempotent: if `detect()` is called before the timer fires, it compiles synchronously and the timer becomes a no-op.
- **`detector.compile()` public method** — Allows manual precompilation for advanced use cases.
- **Turkish suffix expansion** — Added question particles (`misin`, `misiniz`, `musun`, `musunuz`, `miyim`, `miyiz`) and adverbial forms (`cesine`, `casina`) to suffix engine (now 83 total). All suffixable entries (orospu, piç, yarrak, ibne, etc.) now catch question and adverbial inflections.
- **Deep agglutination variants** — Added explicit variants for `siktiğimin`, `sikermisiniz`, `sikermisin`, `siktirmişcesine`. These forms require 3+ suffix chains or non-standard morpheme boundaries (ğ→g bridge) that the suffix engine can't generalize without false positives.
- **`MAX_PATTERN_LENGTH` 6000 → 10000** — Accommodates the larger suffix group without fallback to non-suffix mode.
- **Test count** — 619 → 631. New `tests/lazy-compilation.test.ts` covers construction timing, transparent lazy compile, strict-mode optimization, backgroundWarmup with fake timers, and idempotent early-detect.

| Change | File |
|---|---|
| `backgroundWarmup` option | `src/types.ts` |
| Lazy `_patterns`, `ensureCompiled()`, `compile()` | `src/detector.ts` |
| backgroundWarmup setTimeout scheduling | `src/terlik.ts` |
| Suffix + variant expansion, MAX_PATTERN_LENGTH | `src/patterns.ts`, `src/lang/tr/dictionary.json` |
| Lazy compilation tests (new) | `tests/lazy-compilation.test.ts` |

### 2026-02-28 (v2.1) — ReDoS Security Hardening

**Added Regex Denial-of-Service protection.**

Identified vulnerability: overlap between `charClasses` and `separator` (`@`, `$`, `!`, `|`, `+`, `#`, `€`, `¢`, `©` could be matched by both char class and separator) enabled polynomial O(n^2) backtracking via adversarial input.

- **Bounded separator** — `[^\p{L}\p{N}]*` (unbounded) replaced with `[^\p{L}\p{N}]{0,3}` (max 3 chars). Real-world evasions (`s.i.k.t.i.r`, `s_i_k`) use 1 separator char. This reduces backtracking from O(n^2) to O(1) per boundary.
- **Regex timeout safety net** — Added 250ms timeout (`REGEX_TIMEOUT_MS`) to `runPatterns()` and `detectFuzzy()` loops. Never triggers on normal input (<1ms), but provides a hard cap on adversarial input.
- **charClasses cleanup** — Removed separator-overlapping symbols from all 4 language configs (TR, EN, ES, DE). These symbols are already defined in `leetMap` and converted during the normalizer pass — removing them from pattern matching causes no false negatives.
- **ReDoS test suite** — `tests/redos.test.ts`: 71 tests covering adversarial timing, attack surface (separator abuse, leet bypass, char repetition, Unicode tricks, whitelist integrity, boundary attacks, multi-match, input edge cases, suffix hardening).
- **MAX_PATTERN_LENGTH** — 5000 → 6000 (later raised to 10000 in v2.2). The `{0,3}` separator adds ~3 chars per boundary; raised the limit so large suffix patterns (e.g. `orospu`) don't fall back to non-suffix mode.
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
- **Suffix engine** — Defined Turkish grammatical suffixes (later expanded to 83 in v2.2). Suffixable roots (`orospu`, `salak`, `aptal`, `kahpe`, etc.) automatically catch inflected forms like `orospuluk`, `salaksin`, `aptallarin`, `kahpeler`. Short roots (3-char: `sik`, `bok`, `göt`, `döl`) use explicit variants instead to prevent false positives.
- **Critical bug fix: `\W` separator** — JavaScript's `\W` treats Turkish characters (`ı`, `ş`, `ğ`, `ö`, `ü`, `ç`) as non-word characters. The pattern engine separator `[\W_]*` was changed to `[^\p{L}\p{N}]*` (Unicode-aware). This fixed false positives on innocent words like `sıkma`, `sıkıntı`, `sıkıştı`.
- **Live test server warmup fix** — Fixed cache key mismatch and added JIT warmup. First request latency reduced from 3318ms to 37ms.
- **Test coverage** — 101 → 346 tests. All 25 root words are comprehensively tested.
- **Expanded whitelist** — Added `ama`, `ami`, `amen`, `amir`, `amil`, `dolmen`.

## License

MIT
