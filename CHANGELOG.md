# Changelog

All notable changes to terlik.js are documented here.

## v2.6.0 (2026-03-02) — TR + EN Dictionary Expansion & Benchmark Enrichment

**Massive TR dictionary expansion (39 → 147 entries), EN dictionary expansion (56 → 138 entries), and SPDG-driven benchmark enrichment (290 → 1280 samples).**

### Turkish Dictionary
- **Turkish dictionary overhaul** — 108 new entries across 8 categories: character insults (`alçak`, `terbiyesiz`, `küstah`), general insults (`budala`, `ahmak`, `embesil`), slang (`çomar`, `maganda`, `yobaz`), fraud/deception (`dolandırıcı`, `sahtekar`, `şarlatan`), threats (`geber`, `öldürücem`, `defol`), sexual (`kerhane`, `kaşar`, `sakso`), abbreviations (`sg`, `oç`, `sktrgt`), animal insults (`domuz`, `öküz`, `eşek`).
- **Existing entry enrichment** — New variants for `sik`, `amk`, `orospu`, `piç`, `yarrak`, `göt`, `taşak`, `ibne` entries.
- **Whitelist expansion** — 10 new FP protections: `domuzderisi`, `öküzgözü`, `maymuncuk`, `kaşarpeyniri` etc.
- **SPDG data cleanup** — Removed Grup D roots (words intentionally excluded from dictionary) from synthetic test data for realistic benchmarking.
- **TR SPDG detection rates** — easy 92%, medium 71%, hard 59%, FP 0.4%.

### English Dictionary
- **EN dictionary overhaul** — 82 new entries: racial/ethnic slurs (`beaner`, `dago`, `raghead`, `towelhead`), sexuality slurs (`homo`, `lesbo`, `poof`, `fudgepacker`), sexual terms (`butthole`, `gangbang`, `deepthroat`, `creampie`), insults (`cuck`, `thot`, `knob`, `pillock`), serious insults (`nonce`, `pedo`, `spastic`, `incel`), vulgar slang (`fap`, `jerkoff`, `circlejerk`).
- **Competitor mining** — Analyzed bad-words (447 words), allprofanity (252 words), obscenity (69 patterns). Added 27 genuinely missing roots (`bukkake`, `cunnilingus`, `shemale`, `jailbait`, `schmuck`, etc.).
- **Existing entry enrichment** — New variants: `shitpost`, `shitposting`, `camwhore`, `manwhore`, `camslut`, `nig`, `pornstar`, `cockring`, `titjob`, `cumslut`, `cumrag`, `bulldyke`.
- **Whitelist expansion** — 9 new FP protections: `homogeneous`, `homogenous`, `homophone`, `homonym`, `homologous`, `homosexual`, `shaggy`, `doorknob`, `spunky`.
- **EN root count** — 56 → 138 roots, ~200 → 342 variants, 97 → 105 whitelist entries.

### SPDG & Benchmark
- **EN SPDG data enrichment** — Comprehensive suffix list (9 → 90), leet map (9 → 16 mappings), templates (15 → 87 positive, 15 → 63 negative), contexts (15 → 40 each), emoji replacements (15 → 25).
- **Benchmark dataset enrichment** — Dynamic SPDG import in `dataset.ts`: curated 290 samples + SPDG-generated 990 samples = **1280 total samples** with category mapping.
- **1341 tests** passing, zero regression.

## v2.5.0 (2026-03-02) — Security Normalization + Per-Language Bundles

**Multi-pass security hardening, English detection overhaul, per-language tree-shakeable entry points.**

- **10-stage normalization pipeline** — Added NFKD decomposition (catches fullwidth evasion `ｆｕｃｋ`), combining mark stripping (diacritics evasion `s̈h̊ït`), and Cyrillic confusable mapping (`а`→`a`, `о`→`o`, `с`→`c`).
- **CamelCase decompounding** — 3rd detection pass splits `ShitLord`, `FuckYou` into components for matching.
- **Per-call strictness toggles** — `disableLeetDecode`, `disableCompound`, `minSeverity`, `excludeCategories` options at both constructor and per-call level.
- **English detection overhaul** — F1 92.7% → 100%. 20 new roots, 46 variants, 36 whitelist entries. Phonetic matching (`phuck`), extended leet (`8itch`, `ni66er`).
- **Per-language entry points** — `import { Terlik } from "terlik.js/tr"` for tree-shakeable single-language bundles (~10 KB gzip vs ~14 KB full).
- **`TerlikCore` class** — Low-level engine accepting `LanguageConfig` directly, exported from all entry points.
- **`createTerlik()` factory** — Convenience function per language entry.
- **Benchmark comparison** — Automated comparison vs bad-words, obscenity, allprofanity. terlik.js achieves 100% F1 on 290-sample English corpus.
- **1333 tests** passing.

## v2.4.1 (2026-03-01) — SEO & Documentation

- **SEO overhaul** — Updated package description, badges, npm topics, community files.
- **Social preview** — Added header image to README.

## v2.4.0 (2026-03-01) — extendDictionary + Detection Leak Fix

- **`extendDictionary` option** — Merge external dictionaries at construction time. Add custom roots, variants, suffixes, and whitelist entries without forking the package.
- **Variant-level suffix support** — Non-suffixable entries with ≥4 char variants now get optional suffix chains. Catches `sikişse`, `götvereni` and similar suffixed forms that previously leaked through detection.
- **Whitelist ı/i normalization fix** — Whitelist now checks un-normalized forms, correctly distinguishing `sıkıcı` (boring) from `sikici` (profane).
- **Turkish dictionary expansion** — 14 new roots, new variants, extended whitelist.
- **Community enhancements** — Expanded CONTRIBUTING.md, added PR template, Turkish positioned as flagship language.
- **Project reorganization** — Images → `assets/`, live test server → `tools/`, client-side test → `examples/`.
- **874 tests** passing.

## v2.3.0 (2026-02-28) — 40x Faster Cold Start: V8 JIT Regex Optimization

**Replaces `\p{L}`/`\p{N}` Unicode property escapes with explicit Latin ranges, eliminating V8 JIT bottleneck.**

- **40x faster cold start** — First `containsProfanity()` call: 16,494ms → 404ms.
- **356x faster multi-language warmup** — 4-language warmup: 19,234ms → 54ms.
- **13x less memory** — Heap usage: 492MB → 38MB.
- **Static pattern cache** — Same-language instances share compiled patterns via `Detector.patternCache`.
- **Background warmup** — Dev server starts instantly, warms up in background.

| Change | File |
|---|---|
| Replace `\p{L}\p{N}` with `[a-zA-Z0-9À-ɏ]` | `src/patterns.ts` |
| Static pattern cache + explicit range in getSurroundingWord | `src/detector.ts` |
| Explicit range in number expander + punctuation removal | `src/normalizer.ts` |
| Pass cacheKey to Detector | `src/terlik.ts` |
| Background warmup, lazy instance cache | `tools/server.ts` |
| NODE_OPTIONS heap safety net | `.github/workflows/ci.yml` |

## v2.2.1 (2026-02-28) — CI Fix: Timeout Race Condition + İ Platform Compatibility

**Fixes detection failures on slow runners and cross-platform İ (U+0130) handling.**

- **Timeout race condition fix** — `REGEX_TIMEOUT_MS` check moved from _before_ match processing to _after_. Previously, V8 JIT compilation on first `exec()` call could exceed 250ms, causing the timeout to discard a valid match before it was recorded.
- **İ (U+0130) cross-platform fix** — First regex pass now runs on `text.toLocaleLowerCase(locale)` instead of raw text, avoiding inconsistent V8/ICU case-folding behavior across platforms.

## v2.2 (2026-02-28) — Lazy Compilation + Linguistic Patch

**Zero-cost construction. Background warmup. Turkish agglutination hardening.**

- **Lazy compilation** — `new Terlik()` drops from ~225ms to **~1.5ms**. Patterns compiled on first `detect()` call.
- **`backgroundWarmup` option** — Schedules compilation + JIT warmup via `setTimeout(fn, 0)`.
- **Turkish suffix expansion** — 83 total suffixes including question particles and adverbial forms.
- **Deep agglutination variants** — `siktiğimin`, `sikermisiniz`, `sikermisin`, `siktirmişcesine`.
- **`MAX_PATTERN_LENGTH` 6000 → 10000**.
- **Test count** — 619 → 631.

## v2.1 (2026-02-28) — ReDoS Security Hardening

**Added Regex Denial-of-Service protection.**

- **Bounded separator** — `[^\p{L}\p{N}]*` → `{0,3}`. Reduces backtracking from O(n^2) to O(1).
- **Regex timeout safety net** — 250ms hard cap (`REGEX_TIMEOUT_MS`).
- **charClasses cleanup** — Removed separator-overlapping symbols from all language configs.
- **ReDoS test suite** — 71 tests covering adversarial timing and attack surface.
- **Test count** — 548 → 619.

## v2.0 (2026-02-28) — Multi-Language Support

- **Built-in languages** — Turkish (tr), English (en), Spanish (es), German (de). Extensible to any language.
- **Folder-based language packs** — One folder, two files, one import line.
- **`Terlik.warmup()`** — Multi-language JIT warmup for server deployments.
- **Language-agnostic engine** — Normalizer, compiler, detector, cleaner are fully parametric.
- **Test coverage** — 346 → 418 tests.

## v1.0 (2026-02-28) — Suffix Engine + JSON Dictionary Migration

- **JSON dictionary** — Community-friendly format with schema validation.
- **Suffix engine** — Turkish grammatical suffixes for automatic inflection matching.
- **Critical bug fix** — `\W` → `[^\p{L}\p{N}]` for Turkish character support.
- **Test coverage** — 101 → 346 tests.
