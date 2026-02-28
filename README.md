# terlik.js

![terlik.js](git-header.png)

Production-grade Turkish profanity detection and filtering. Not a naive blacklist — a multi-layered normalization and pattern engine that catches what simple string matching misses.

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

const terlik = new Terlik();

// Detect
terlik.containsProfanity("siktir git");  // true
terlik.containsProfanity("merhaba");     // false

// Clean
terlik.clean("siktir git burdan");
// "****** git burdan"

// Inspect matches
terlik.getMatches("aptal orospu cocugu");
// [
//   { word: "aptal", root: "aptal", severity: "low", method: "pattern", index: 0 },
//   { word: "orospu cocugu", root: "orospu", severity: "high", method: "pattern", index: 6 }
// ]
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

Six-stage normalization pipeline, then pattern matching:

```
input
  → lowercase (Turkish locale-aware)
  → Turkish char folding (İ→i, ç→c, ğ→g, ö→o, ş→s, ü→u)
  → Turkish number expansion (s2k → sikik, only between letters)
  → Leet speak decode (0→o, 1→i, 2→i, 8→b, 6→g, $→s, @→a, ...)
  → Punctuation removal (between letters: s.i.k → sik)
  → Repeat collapse (siiiiik → sik)
  → Pattern matching (dynamic regex with char class substitutions)
  → Whitelist filtering
  → Result
```

Pattern engine generates regex per root word with full substitution maps. For example, `sik` becomes a pattern that matches `s`, `$`, `5` for the first char, allows separators between chars, and so on.

For suffixable roots, the engine appends an optional suffix group (up to 2 chained suffixes from 73 Turkish grammatical suffixes). This means `sik` automatically catches `siktiler`, `sikerim`, `siktirler` without manually listing each variant.

### Dictionary Format

The dictionary is a community-friendly JSON file (`src/dictionary/tr.json`) with runtime validation. No TypeScript knowledge needed to contribute:

```json
{
  "root": "sik",
  "variants": ["siktir", "sikerim", ...],
  "severity": "high",
  "category": "sexual",
  "suffixable": true
}
```

Categories: `sexual`, `insult`, `slur`, `general`. Severity: `high`, `medium`, `low`.

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

## Options

```ts
const terlik = new Terlik({
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

### `normalize(text): string`

Standalone export. Useful if you need the normalization pipeline without detection.

```ts
import { normalize } from "terlik.js";

normalize("S.İ.K.T.İ.R"); // "siktir"
normalize("$1k7!r");       // "siktir"
normalize("s2mle");         // "sikimle"
```

## Testing

346 tests covering all 25 root words, suffix detection, normalization, fuzzy matching, cleaning, integration, and edge cases:

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

## Changelog

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
