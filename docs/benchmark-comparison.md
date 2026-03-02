# Benchmark Comparison: terlik.js vs Alternatives

Automated, reproducible comparison of terlik.js against popular profanity detection libraries on an **English-only** corpus. We use English because it's the only language all four libraries support — terlik.js's Turkish, Spanish, and German capabilities are tested separately in the main test suite.

> **Transparency note:** This benchmark is maintained by the terlik.js team. The dataset, adapters, and measurement code are all open source — anyone can inspect, modify, and re-run them. We encourage you to verify these results on your own hardware. See [Run It Yourself](#run-it-yourself) below.

---

## TL;DR — The Scorecard

| Metric | terlik.js | obscenity | bad-words | allprofanity |
|---|:---:|:---:|:---:|:---:|
| **Overall F1** | **100.0%** | 81.7% | 66.1% | 59.7% |
| **False Positives** | **0** | 3 | 0 | 0 |
| **False Negatives** | **0** | 48 | 82 | 93 |
| **Total Errors** | **0 / 290** | 51 / 290 | 82 / 290 | 93 / 290 |
| **Detection Speed** | **81K ops/sec** | 67K ops/sec | 2.8K ops/sec | 44K ops/sec |
| **Cleaning Speed** | **81K ops/sec** | 47K ops/sec | 564 ops/sec | 44K ops/sec |
| **Init Memory** | 220 KB | 167 KB | 205 KB | 1,317 KB |
| **Bundle (gzip)** | ~14 KB | ~8 KB | ~3 KB | ~15 KB |
| **Languages** | 4 (TR, EN, ES, DE) | 1 (EN) | 1 (EN) | 9 |
| **Zero Dependencies** | Yes | Yes | No | No |

> **What does this mean?** terlik.js detects every profane message without a single mistake, runs faster than all alternatives, and does it with zero dependencies across 4 languages.

---

## Libraries Tested

| Library | Version | How it works | Languages |
|---|---|---|---|
| [terlik.js](https://www.npmjs.com/package/terlik.js) | local | Multi-layer normalization + regex pattern engine + suffix system | TR, EN, ES, DE |
| [bad-words](https://www.npmjs.com/package/bad-words) | 3.0.4 | Static word list with simple regex splitting | EN |
| [obscenity](https://www.npmjs.com/package/obscenity) | 0.4.6 | RegExp transformer pipeline with character substitutions | EN |
| [allprofanity](https://www.npmjs.com/package/allprofanity) | 2.2.1 | Aho-Corasick automaton + Bloom filter | 9 languages (no Turkish) |

**What's the difference?**
- **bad-words** checks if a word appears in a static list. Simple but brittle — "f.u.c.k" or "phuck" bypasses it.
- **obscenity** applies character transformations before matching. Better at leet speak, but can't handle separators.
- **allprofanity** uses Aho-Corasick (a fast multi-pattern search algorithm). Fast init, but limited evasion handling.
- **terlik.js** normalizes text through 6 stages (lowercase → char folding → leet decode → separator removal → repeat collapse → pattern match), then matches against regex patterns built from the dictionary. This catches evasion techniques the others miss.

---

## Dataset

290 labeled English samples across 9 categories. Each sample is marked as profane or clean, with a category tag for granular analysis.

| Category | Samples | Profane? | What it tests | Example |
|---|:---:|---|---|---|
| plain | 50 | Yes | Direct profanity in normal sentences | "fuck you", "watching porn", "he raped her" |
| variant | 35 | Yes | Morphological / compound forms | "motherfucker", "shitfaced", "pornographic", "rapist" |
| leet | 25 | Yes | Character substitution tricks | "f#ck", "8itch", "s#it", "ni66er", "phuck" |
| separator | 15 | Yes | Dots, spaces, dashes between letters | "f.u.c.k", "s h i t", "n.i.g.g.e.r" |
| repetition | 15 | Yes | Repeated characters to bypass matching | "fuuuuck", "sluuuut", "coooock" |
| combined | 15 | Yes | Multiple evasion tricks at once | "phuck3d", "n!66er", "5h!tty" |
| clean | 50 | No | Normal sentences (should not be flagged) | "the weather is beautiful", "happy birthday" |
| whitelist | 70 | No | Words containing profanity substrings | "assassin", "analysis", "grape", "therapist", "pussywillow" |
| edge_case | 15 | Mixed | Boundary conditions | Empty strings, ALL CAPS, unicode, very long text |
| | **290** | | | |

> **Why these categories?** Real users evade filters in predictable ways: leet speak, separators, repetition, compound forms. A library that only catches plain text profanity is trivial to bypass. This dataset tests the full evasion spectrum.

The dataset is in [`benchmarks/comparison/dataset.ts`](../benchmarks/comparison/dataset.ts). PRs welcome.

---

## Results

Measured on macOS, Node.js v24.4.0. Absolute numbers vary by hardware — relative ranking is what matters.

### 1. Overall Accuracy

> "How many mistakes does each library make?"

| Library | Precision | Recall | F1 | FPR | Accuracy | Total Errors |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| **terlik.js** | **100.0%** | **100.0%** | **100.0%** | **0.0%** | **100.0%** | **0** |
| obscenity | 97.4% | 70.4% | 81.7% | 2.3% | 82.4% | 51 |
| bad-words | 100.0% | 49.4% | 66.1% | 0.0% | 71.7% | 82 |
| allprofanity | 100.0% | 42.6% | 59.7% | 0.0% | 67.9% | 93 |

**What do these metrics mean?**

| Metric | Plain English | Why it matters |
|---|---|---|
| **Precision** | "When it flags something, is it actually profane?" | Low precision = innocent messages get blocked. Users get frustrated. |
| **Recall** | "Does it catch all the profanity?" | Low recall = profanity slips through. The filter feels useless. |
| **F1** | Combined score (harmonic mean of Precision & Recall) | Single number to compare overall quality. 100% = perfect. |
| **FPR** | "How often does it wrongly flag clean text?" | Even 1% FPR means 1 in 100 clean messages gets blocked. |

**The bottom line:** terlik.js catches everything (100% recall) without any false alarms (100% precision). The next best library (obscenity) misses 30% of profanity and wrongly flags 2.3% of clean text.

---

### 2. Category Breakdown — Where Each Library Succeeds and Fails

> "What types of profanity does each library catch?"

| Category | terlik.js | bad-words | obscenity | allprofanity | What it means |
|---|:---:|:---:|:---:|:---:|---|
| **plain** | **50/50** | 43/50 | 42/50 | 37/50 | Basic profanity like "fuck you" |
| **variant** | **35/35** | 13/35 | 26/35 | 6/35 | Compound forms like "shitfaced" |
| **leet** | **25/25** | 13/25 | 20/25 | 14/25 | Character tricks like "8itch" |
| **separator** | **15/15** | 1/15 | 0/15 | 0/15 | Spaced out like "f.u.c.k" |
| **repetition** | **15/15** | 0/15 | 10/15 | 0/15 | Stretched like "fuuuuck" |
| **combined** | **15/15** | 4/15 | 10/15 | 6/15 | Multiple tricks at once |
| **clean** | **50/50** | 50/50 | 50/50 | 50/50 | Normal text (should pass) |
| **whitelist** | **70/70** | 70/70 | 67/70 | 70/70 | Tricky words (should pass) |
| **edge_case** | **15/15** | 14/15 | 14/15 | 14/15 | Boundary conditions |

The same data as percentages:

| Category | terlik.js | bad-words | obscenity | allprofanity |
|---|:---:|:---:|:---:|:---:|
| plain | **100%** | 86% | 84% | 74% |
| variant | **100%** | 37% | 74% | 17% |
| leet | **100%** | 52% | 80% | 56% |
| separator | **100%** | 7% | 0% | 0% |
| repetition | **100%** | 0% | 67% | 0% |
| combined | **100%** | 27% | 67% | 40% |
| clean | 100% | 100% | 100% | 100% |
| whitelist | **100%** | 100% | 96% | 100% |
| edge_case | **100%** | 93% | 93% | 93% |

---

### 3. Evasion Detection Deep Dive

> "Users actively try to bypass profanity filters. Which library survives?"

This is where the gap becomes dramatic. Evasion techniques are how real users bypass filters in chat, comments, and forums.

| Evasion technique | Example | terlik.js | bad-words | obscenity | allprofanity |
|---|---|:---:|:---:|:---:|:---:|
| Separator dots | `f.u.c.k` | Caught | Missed | Missed | Missed |
| Separator spaces | `s h i t` | Caught | Missed | Missed | Missed |
| Separator dashes | `a-s-s-h-o-l-e` | Caught | Missed | Missed | Missed |
| Separator underscores | `c_u_n_t` | Caught | Missed | Missed | Missed |
| Char repetition | `fuuuuck` | Caught | Missed | Caught | Missed |
| Char repetition | `sluuuut` | Caught | Missed | Caught | Missed |
| Leet: numbers | `sh1t`, `b1tch` | Caught | Caught | Caught | Caught |
| Leet: symbols | `$hit`, `a$$hole` | Caught | Caught | Caught | Caught |
| Leet: 8→b | `8itch` | Caught | Missed | Missed | Missed |
| Leet: 6→g | `ni66er` | Caught | Missed | Missed | Missed |
| Leet: #→h | `s#it` | Caught | Missed | Missed | Missed |
| Phonetic: ph→f | `phuck` | Caught | Missed | Missed | Missed |
| Combined | `phuck3d` | Caught | Missed | Missed | Missed |
| Combined | `n!66er` | Caught | Missed | Missed | Missed |
| Combined | `5h!tty` | Caught | Missed | Caught | Missed |

**Summary: evasion detection rate**

| | terlik.js | bad-words | obscenity | allprofanity |
|---|:---:|:---:|:---:|:---:|
| **Evasion samples caught** | **70/70** | 18/70 | 40/70 | 20/70 |
| **Evasion detection rate** | **100%** | 26% | 57% | 29% |

> **What does this mean?** If a user types "phuck you" or "f.u.c.k off", only terlik.js will catch it. The other libraries miss 43-74% of evasion attempts.

---

### 4. False Positive Analysis

> "Does it incorrectly block innocent words?"

A filter that blocks "analysis" because it contains "anal", or "grape" because it contains "rape", is worse than no filter at all — it erodes user trust.

| Library | False Positives | Wrongly blocked words |
|---|:---:|---|
| **terlik.js** | **0** | None |
| bad-words | 0 | None |
| allprofanity | 0 | None |
| obscenity | 3 | "penistone" (a real English town), "pussywillow" (a plant), "pussycat" (a cat) |

**How does terlik.js avoid false positives with 56 roots?** A 96-entry whitelist explicitly protects words like:

| Tricky word | Contains | Why it's safe |
|---|---|---|
| analysis | anal | Academic term |
| therapist | rape | Medical profession |
| grape | rape | Fruit |
| hello | hell | Common greeting |
| title | tit | Document element |
| pussywillow | pussy | Plant species |
| screwdriver | screw | Tool |
| cocktail | cock | Beverage |
| penistone | penis | English town name |
| assassin | ass | Historical term |
| cucumber | cum | Vegetable |

All 70 whitelist trap sentences in the dataset pass correctly.

---

### 5. Error Breakdown by Library

> "What exactly does each library get wrong?"

#### terlik.js — 0 errors

Perfect score. Zero false positives, zero false negatives.

#### bad-words — 82 errors (0 FP, 82 FN)

| Error type | Count | Examples of missed profanity |
|---|:---:|---|
| Missed plain profanity | 7 | "that is bullshit", "they had an orgy", "dirty negro" |
| Missed variant forms | 22 | "shitfaced", "pornographic", "unfucking", "rapist", "cumshot" |
| Missed leet speak | 12 | "8itch", "s#it", "ni66er", "phuck", "c0ck" |
| Missed separators | 14 | All separator samples except 1 |
| Missed repetition | 15 | All repetition samples |
| Missed combined | 11 | Most combined evasion samples |
| Missed edge cases | 1 | Mixed case edge case |

> bad-words uses a simple word list. It can't handle any form of evasion — not leet speak, not separators, not repetition. Over half of all profane messages slip through.

#### obscenity — 51 errors (3 FP, 48 FN)

| Error type | Count | Examples |
|---|:---:|---|
| **False positives** | **3** | "penistone", "pussywillow", "pussycat" |
| Missed plain profanity | 8 | "what the hell", "damn it", "screw you", "this is crap" |
| Missed variant forms | 9 | "unfucking", "fuckery", "screwed", "hookers" |
| Missed leet speak | 5 | "8itch", "s#it", "ni66er", "phuck" |
| Missed separators | 15 | All separator samples (0% detection) |
| Missed repetition | 5 | Some repetition samples |
| Missed combined | 5 | Some combined evasion samples |
| Missed edge cases | 1 | Mixed case edge case |

> obscenity is the strongest competitor. It handles some leet speak and repetition via transformer pipeline, but has no separator detection at all and generates false positives due to lack of whitelist.

#### allprofanity — 93 errors (0 FP, 93 FN)

| Error type | Count | Examples |
|---|:---:|---|
| Missed plain profanity | 13 | "what the hell", "you prick", "screw you", "dirty negro" |
| Missed variant forms | 29 | Almost all variant forms (only 17% caught) |
| Missed leet speak | 11 | "8itch", "s#it", "ni66er", "phuck", many others |
| Missed separators | 15 | All separator samples (0% detection) |
| Missed repetition | 15 | All repetition samples (0% detection) |
| Missed combined | 9 | Most combined evasion samples |
| Missed edge cases | 1 | Mixed case edge case |

> allprofanity's Aho-Corasick engine is fast but rigid. It matches exact strings from its word list and can't handle any morphological or evasion variation.

---

### 6. Throughput

> "How fast can each library process messages?"

Measured in operations per second (higher = better). Each operation processes a batch of 100 messages.

**Detection speed (check/containsProfanity):**

| Library | ops/sec | avg latency | p50 | p95 | p99 | vs terlik.js |
|---|---:|---:|---:|---:|---:|---|
| **terlik.js** | **81,212** | 1,230 μs | 1,197 μs | 1,524 μs | 1,798 μs | — |
| obscenity | 67,471 | 1,482 μs | 1,497 μs | 1,641 μs | 1,752 μs | 1.2x slower |
| allprofanity | 43,765 | 2,285 μs | 2,309 μs | 2,560 μs | 2,770 μs | 1.9x slower |
| bad-words | 2,855 | 35,030 μs | 35,564 μs | 38,381 μs | 40,226 μs | 28x slower |

**Cleaning speed (clean/censor):**

| Library | ops/sec | avg latency | p50 | p95 | p99 | vs terlik.js |
|---|---:|---:|---:|---:|---:|---|
| **terlik.js** | **81,214** | 1,231 μs | 1,199 μs | 1,533 μs | 1,646 μs | — |
| obscenity | 47,390 | 2,110 μs | 2,143 μs | 2,326 μs | 2,425 μs | 1.7x slower |
| allprofanity | 43,885 | 2,279 μs | 2,317 μs | 2,496 μs | 2,594 μs | 1.9x slower |
| bad-words | 564 | 177,394 μs | 182,347 μs | 188,173 μs | 191,156 μs | 144x slower |

> **What do these numbers mean in practice?** At 81K ops/sec, terlik.js can check ~81,000 messages per second on a single core. For a chat app with 1,000 concurrent users sending 1 message/second, that's 81x headroom. bad-words would need 28 cores for the same load.

**p95/p99 explained:** p95 = 95% of batches complete within this time. p99 = 99%. Low p99 means consistent performance without random spikes.

---

### 7. Memory Usage

> "How much RAM does each library consume?"

Heap and RSS delta measured in KB:

| Library | Init Heap | Init RSS | After 2K msgs Heap | After 2K msgs RSS | Notes |
|---|---:|---:|---:|---:|---|
| terlik.js | +220 KB | +48 KB | -4,023 KB | +2,936 KB | GC reclaims memory efficiently |
| obscenity | +167 KB | +16 KB | +651 KB | +32 KB | Lightweight, stable |
| bad-words | +205 KB | +36 KB | +9,519 KB | +60 KB | Heap grows with usage |
| allprofanity | +1,317 KB | +244 KB | -4,944 KB | -21,772 KB | Large init (loads 2 dictionaries) |

**What does this mean?**
- **Init Heap:** Memory used just to load the library. All are lightweight (~170-220 KB) except allprofanity (1.3 MB, loads English + Hindi dictionaries by default).
- **After processing:** terlik.js and allprofanity show negative heap deltas — V8's garbage collector reclaims memory after JIT optimization. bad-words accumulates ~9.5 MB after processing 2,000 messages.
- Run with `node --expose-gc` for precise measurements.

---

### 8. Bundle Size

> "How much does this add to my application?"

| Library | Raw size | Gzipped | Dependencies |
|---|---:|---:|---|
| terlik.js | ~64 KB | **~14 KB** | 0 |
| obscenity | ~45 KB | ~8 KB | 0 |
| bad-words | ~15 KB | ~3 KB | 1 (badwords-list) |
| allprofanity | ~80 KB | ~15 KB | 2 |

**Dictionary expansion impact (v2.4.1 → current):**

| | Before | After | Delta |
|---|---:|---:|---:|
| English roots | 36 | 56 | +20 |
| Explicit variants | 139 | 185 | +46 |
| Whitelist entries | 60 | 96 | +36 |
| Suffix rules | 8 | 9 | +1 |
| ESM raw | ~57 KB | ~64 KB | +7 KB |
| ESM gzip | ~12 KB | ~14 KB | **+2 KB** |

> The entire English detection overhaul (20 new roots, 46 variants, 36 whitelist entries) added only **+2 KB gzipped**. Dictionary entries share common substrings and compress extremely well.

---

### 9. The Trade-off Map

> "Every library makes trade-offs. Here's where each one sits."

| | High Precision | High Recall | Fast | Small | Evasion-proof |
|---|:---:|:---:|:---:|:---:|:---:|
| **terlik.js** | Yes | Yes | Yes | Yes | Yes |
| obscenity | Mostly | No | Yes | Yes | Partially |
| bad-words | Yes | No | No | Yes | No |
| allprofanity | Yes | No | Mostly | Mostly | No |

**In plain English:**
- **terlik.js** — No compromises. Perfect detection, fastest speed, zero dependencies. The only library that handles all evasion types.
- **obscenity** — Good precision, decent leet handling, but can't handle separators and has no whitelist (causes false positives). Closest competitor.
- **bad-words** — Zero false positives, but misses over half of all profanity. Any determined user will bypass it.
- **allprofanity** — Similar to bad-words but with more language support. Weak evasion handling. Fast init but large memory footprint.

---

## How terlik.js Achieves This

The detection pipeline explains why terlik.js catches what others miss:

```
Input: "phuck y0u m0th3rfuck3r"
  │
  ├─ 1. Lowercase         → "phuck y0u m0th3rfuck3r"
  ├─ 2. Char folding      → "phuck y0u m0th3rfuck3r"
  ├─ 3. Leet decode       → "phuck you motherfucker"
  ├─ 4. Separator removal → (no separators to remove)
  ├─ 5. Repeat collapse   → (no repeats to collapse)
  ├─ 6. Pattern matching  → charClasses: f=[fph], so "ph" → matches "f" pattern
  │                          "phuck" matches /[fph][uv][c][k]/ → ✅ fuck
  │                          "motherfucker" → ✅ direct variant match
  ├─ 7. Whitelist check   → neither word is whitelisted
  └─ Result: 2 matches found
```

Other libraries fail at different stages:
- **bad-words** has no leet decode, no separator removal, no pattern matching
- **obscenity** has leet decode + some patterns, but no separator removal and no phonetic matching (ph→f)
- **allprofanity** has basic matching but no normalization pipeline

---

## Transparency: Where terlik.js Can Still Improve

100% on 290 samples doesn't mean perfection in the wild. Known limitations:

| Limitation | Example | Status |
|---|---|---|
| Context-dependent words | "hell yeah" is flagged (but user may consider it mild) | By design — severity: "low" |
| 3-letter root FP risk | "cum" in "cucumber" | Protected by whitelist, but new compounds may appear |
| Rapidly evolving slang | New coinages not in dictionary | Use `addWords()` or `customList` at runtime |
| Non-Latin scripts | Cyrillic "а" substituted for Latin "a" | Not yet handled |
| Dataset size | 290 samples is comprehensive but not exhaustive | Continuously expanding |

We document every limitation and encourage the community to report edge cases.

---

## Methodology

| Parameter | Value |
|---|---|
| Warmup iterations | 100 (V8 JIT compilation) |
| Measurement iterations | 1,000 |
| Batch size | 100 messages per iteration |
| Latency metric | Per-batch microsecond timing |
| Percentiles | p50, p95, p99 |
| Memory measurement | `process.memoryUsage()` delta |
| Isolation | Each library in independent adapter |
| Fairness | Same corpus, same machine, same process |

### Adapter Pattern

Each library is wrapped in a `LibraryAdapter` interface with `init()`, `check()`, and `clean()` methods:

| Library | check() API | clean() API |
|---|---|---|
| terlik.js | `containsProfanity()` | `clean()` |
| bad-words | `isProfane()` / `clean() !== text` | `clean()` |
| obscenity | `matcher.hasMatch()` | `censor.applyTo()` |
| allprofanity | `check()` | `clean()` |

Adapters: [`benchmarks/comparison/adapters.ts`](../benchmarks/comparison/adapters.ts)

### Limitations of This Benchmark

| Limitation | Impact |
|---|---|
| **English only** | Doesn't test TR/ES/DE — only the common denominator |
| **290 samples** | Comprehensive but not exhaustive. Real-world text is more varied |
| **Self-reported** | Maintained by terlik.js team. We aim for fairness but acknowledge potential bias |
| **Single machine** | Absolute ops/sec numbers depend on hardware. Relative ranking matters more |
| **Default configs** | All libraries tested with default settings. Custom tuning may improve results |
| **bad-words v3** | Tested v3.0.4 (latest on npm). A v4 may exist but npm resolves to v3 |

---

## Run It Yourself

**Prerequisites:** Node.js >= 18, pnpm

```bash
# From the repository root:
pnpm build                  # Build terlik.js first
pnpm bench:compare          # Install deps + run benchmark

# Or manually:
cd benchmarks/comparison
pnpm install
npx tsx run.ts              # Standard run
node --expose-gc --import tsx/esm run.ts   # With accurate memory
```

**Output:**
1. Formatted tables to the console
2. JSON results to `benchmarks/comparison/results/comparison-results.json`

### Modifying the Benchmark

| Task | How |
|---|---|
| Add test cases | Edit `dataset.ts` — add `{ text, profane, category }` |
| Add a library | Create adapter in `adapters.ts`, add factory to `run.ts` |
| Change iterations | Edit `WARMUP_ITERATIONS` / `MEASURE_ITERATIONS` in `throughput.ts` |

---

## Raw Data

Full JSON output with per-sample error lists: [`benchmarks/comparison/results/comparison-results.json`](../benchmarks/comparison/results/comparison-results.json)

## Contributing

Found an issue with the methodology? Think the dataset is unfair? **Please open an issue or PR.** We want this comparison to be as fair and transparent as possible.
