/**
 * Profiling script for terlik.js Turkish pattern compilation.
 *
 * Breaks down exactly where time is spent during Terlik instantiation:
 *   Phase 1 — getLanguageConfig() (JSON parse + schema validation)
 *   Phase 2 — createNormalizer() setup
 *   Phase 3 — Dictionary construction
 *   Phase 4 — buildSuffixGroup() (shared suffix regex fragment)
 *   Phase 5 — Per-entry pattern string generation + new RegExp() compilation
 *   Phase 6 — JIT warmup (containsProfanity on sample texts)
 *
 * Run:  npx tsx live_test_server/profile-compile.ts
 */

import { getLanguageConfig } from "../src/lang/index.js";
import { createNormalizer } from "../src/normalizer.js";
import { Dictionary } from "../src/dictionary/index.js";
import { Terlik } from "../src/index.js";

// ── Helpers ──────────────────────────────────────────────────────────

function hrMs(start: [number, number]): number {
  const [s, ns] = process.hrtime(start);
  return s * 1000 + ns / 1e6;
}

function pad(str: string, len: number): string {
  return str.length >= len ? str : str + " ".repeat(len - str.length);
}

function rpad(str: string, len: number): string {
  return str.length >= len ? str : " ".repeat(len - str.length) + str;
}

// ── Inline reimplementations of internal functions for profiling ─────
// (We cannot import buildSuffixGroup/wordToPattern since they are not exported,
//  so we replicate the logic here to measure it in isolation.)

const SEPARATOR = "[^\\p{L}\\p{N}]{0,3}";
const MAX_SUFFIX_CHAIN = 2;
const MAX_PATTERN_LENGTH = 6000;

function charToPattern(ch: string, charClasses: Record<string, string>): string {
  const cls = charClasses[ch.toLowerCase()];
  if (cls) return `${cls}+`;
  return ch.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "+";
}

function wordToPattern(
  word: string,
  charClasses: Record<string, string>,
  normalizeFn: (text: string) => string,
): string {
  const normalized = normalizeFn(word);
  const chars = [...normalized];
  const parts = chars.map((ch) => charToPattern(ch, charClasses));
  return parts.join(SEPARATOR);
}

function buildSuffixGroup(
  suffixes: string[],
  charClasses: Record<string, string>,
): string {
  if (suffixes.length === 0) return "";
  const suffixPatterns = suffixes.map((suffix) => {
    const chars = [...suffix];
    const parts = chars.map((ch) => charToPattern(ch, charClasses));
    return parts.join(SEPARATOR);
  });
  suffixPatterns.sort((a, b) => b.length - a.length);
  return `(?:${SEPARATOR}(?:${suffixPatterns.join("|")}))`;
}

// ── Main ─────────────────────────────────────────────────────────────

console.log("=".repeat(80));
console.log("  terlik.js — Turkish Pattern Compilation Profiler");
console.log("=".repeat(80));
console.log();

// ─── Phase 1: getLanguageConfig ──────────────────────────────────────
const t1 = process.hrtime();
const langConfig = getLanguageConfig("tr");
const phase1 = hrMs(t1);
console.log(`Phase 1  getLanguageConfig("tr")        : ${phase1.toFixed(2)} ms`);
console.log(`         entries: ${langConfig.dictionary.entries.length}, suffixes: ${langConfig.dictionary.suffixes.length}, whitelist: ${langConfig.dictionary.whitelist.length}`);
console.log();

// ─── Phase 2: createNormalizer ───────────────────────────────────────
const t2 = process.hrtime();
const normalizeFn = createNormalizer({
  locale: langConfig.locale,
  charMap: langConfig.charMap,
  leetMap: langConfig.leetMap,
  numberExpansions: langConfig.numberExpansions,
});
const phase2 = hrMs(t2);
console.log(`Phase 2  createNormalizer()              : ${phase2.toFixed(2)} ms`);
console.log();

// ─── Phase 3: Dictionary construction ────────────────────────────────
const t3 = process.hrtime();
const dictionary = new Dictionary(langConfig.dictionary);
const phase3 = hrMs(t3);
console.log(`Phase 3  Dictionary construction         : ${phase3.toFixed(2)} ms`);
console.log();

// ─── Phase 4: buildSuffixGroup ───────────────────────────────────────
const suffixes = dictionary.getSuffixes();
const t4 = process.hrtime();
const suffixGroup = buildSuffixGroup(suffixes, langConfig.charClasses);
const phase4 = hrMs(t4);
console.log(`Phase 4  buildSuffixGroup()              : ${phase4.toFixed(2)} ms`);
console.log(`         suffix count  : ${suffixes.length}`);
console.log(`         pattern length: ${suffixGroup.length} chars`);
console.log();

// ─── Phase 5: Per-entry pattern compilation ──────────────────────────
console.log(`Phase 5  Per-entry pattern compilation`);
console.log("-".repeat(80));

interface EntryProfile {
  root: string;
  variants: number;
  suffixable: boolean;
  patternLen: number;
  stringBuildMs: number;
  regexCompileMs: number;
  totalMs: number;
}

const entries = dictionary.getEntries();
const profiles: EntryProfile[] = [];
let totalStringBuild = 0;
let totalRegexCompile = 0;

for (const [, entry] of entries) {
  // --- String building phase ---
  const tStr = process.hrtime();

  const allForms = [entry.root, ...entry.variants];
  const sortedForms = allForms
    .map((w) => normalizeFn(w))
    .filter((w) => w.length > 0)
    .filter((w, i, arr) => arr.indexOf(w) === i)
    .sort((a, b) => b.length - a.length);

  const formPatterns = sortedForms.map((w) =>
    wordToPattern(w, langConfig.charClasses, normalizeFn),
  );
  const combined = formPatterns.join("|");

  const useSuffix = entry.suffixable && suffixGroup.length > 0;
  let pattern: string;
  if (useSuffix) {
    pattern = `(?<![\\p{L}\\p{N}])(?:${combined})${suffixGroup}{0,${MAX_SUFFIX_CHAIN}}(?![\\p{L}\\p{N}])`;
  } else {
    pattern = `(?<![\\p{L}\\p{N}])(?:${combined})(?![\\p{L}\\p{N}])`;
  }
  if (pattern.length > MAX_PATTERN_LENGTH && useSuffix) {
    pattern = `(?<![\\p{L}\\p{N}])(?:${combined})(?![\\p{L}\\p{N}])`;
  }

  const stringBuildMs = hrMs(tStr);

  // --- RegExp compilation phase ---
  const tReg = process.hrtime();
  try {
    new RegExp(pattern, "giu");
  } catch {
    // fallback pattern
    const fallback = `(?<![\\p{L}\\p{N}])(?:${combined})(?![\\p{L}\\p{N}])`;
    new RegExp(fallback, "giu");
  }
  const regexCompileMs = hrMs(tReg);

  totalStringBuild += stringBuildMs;
  totalRegexCompile += regexCompileMs;

  profiles.push({
    root: entry.root,
    variants: entry.variants.length,
    suffixable: !!entry.suffixable,
    patternLen: pattern.length,
    stringBuildMs,
    regexCompileMs,
    totalMs: stringBuildMs + regexCompileMs,
  });
}

// Sort by total time descending
profiles.sort((a, b) => b.totalMs - a.totalMs);

// Print table header
console.log(
  `${pad("Root", 20)} ${rpad("Vars", 5)} ${rpad("Sfx?", 5)} ${rpad("PatLen", 8)} ${rpad("StrBuild", 10)} ${rpad("RegExp", 10)} ${rpad("Total", 10)}`,
);
console.log("-".repeat(80));

for (const p of profiles) {
  console.log(
    `${pad(p.root, 20)} ${rpad(String(p.variants), 5)} ${rpad(p.suffixable ? "Y" : "N", 5)} ${rpad(String(p.patternLen), 8)} ${rpad(p.stringBuildMs.toFixed(2), 10)} ${rpad(p.regexCompileMs.toFixed(2), 10)} ${rpad(p.totalMs.toFixed(2), 10)}`,
  );
}

const totalPhase5 = totalStringBuild + totalRegexCompile;
console.log("-".repeat(80));
console.log(
  `${pad("TOTAL (" + profiles.length + " entries)", 20)} ${rpad("", 5)} ${rpad("", 5)} ${rpad("", 8)} ${rpad(totalStringBuild.toFixed(2), 10)} ${rpad(totalRegexCompile.toFixed(2), 10)} ${rpad(totalPhase5.toFixed(2), 10)}`,
);
console.log();

// ─── Phase 6: Full Terlik construction (end-to-end) ──────────────────
// NOTE: This runs AFTER Phase 5, so V8 has already JIT-optimized the regex
// engine from the individual compilations above. The "real" cold-start cost
// is better reflected by Phase 5 totals or by running this script fresh.
console.log(`Phase 6  Full Terlik constructor (end-to-end comparison)`);
console.log("-".repeat(80));

const tFull = process.hrtime();
const terlik = new Terlik({ language: "tr" });
const fullConstructMs = hrMs(tFull);
console.log(`         new Terlik({ language: "tr" })  : ${fullConstructMs.toFixed(2)} ms`);
console.log(`         (NOTE: V8 already warmed from Phase 5 — this is NOT cold-start)`);
console.log();

// ─── Phase 7: JIT warmup ─────────────────────────────────────────────
console.log(`Phase 7  JIT warmup — containsProfanity() calls`);
console.log("-".repeat(80));

const warmupTexts = [
  "bu bir test cumlesidir",
  "siktir git buradan",
  "guzel bir gun",
  "a.m.i.n.a koyayim",
  "s1kt1r lan",
  "normal bir cumle, hicbir sey yok",
  "o.r" + ".o" + ".s" + ".p" + ".u cocugu",
  "merhaba dunya nasilsin bugun cok guzel hava var disari cikalim mi",
  "p1c kurusu seni, defol git",
  "bu bir test daha, temiz cumle",
];

const jitTimes: { text: string; ms: number; result: boolean }[] = [];
for (const text of warmupTexts) {
  const tJit = process.hrtime();
  const result = terlik.containsProfanity(text);
  const ms = hrMs(tJit);
  jitTimes.push({ text, ms, result });
}

for (const j of jitTimes) {
  const truncated = j.text.length > 50 ? j.text.slice(0, 50) + "..." : j.text;
  console.log(
    `  ${rpad(j.ms.toFixed(3), 10)} ms  ${j.result ? "HIT " : "MISS"}  "${truncated}"`,
  );
}

const totalJit = jitTimes.reduce((sum, j) => sum + j.ms, 0);
console.log(`         Total JIT warmup: ${totalJit.toFixed(2)} ms`);
console.log();

// ─── Summary ─────────────────────────────────────────────────────────
console.log("=".repeat(80));
console.log("  SUMMARY");
console.log("=".repeat(80));
console.log();
console.log(`  Phase 1  getLanguageConfig      : ${rpad(phase1.toFixed(2), 10)} ms`);
console.log(`  Phase 2  createNormalizer        : ${rpad(phase2.toFixed(2), 10)} ms`);
console.log(`  Phase 3  Dictionary ctor         : ${rpad(phase3.toFixed(2), 10)} ms`);
console.log(`  Phase 4  buildSuffixGroup        : ${rpad(phase4.toFixed(2), 10)} ms`);
console.log(`  Phase 5  Pattern compilation     : ${rpad(totalPhase5.toFixed(2), 10)} ms`);
console.log(`           - string building       : ${rpad(totalStringBuild.toFixed(2), 10)} ms`);
console.log(`           - new RegExp()          : ${rpad(totalRegexCompile.toFixed(2), 10)} ms`);
console.log(`  Phase 6  Full constructor (e2e)  : ${rpad(fullConstructMs.toFixed(2), 10)} ms`);
console.log(`  Phase 7  JIT warmup (10 calls)   : ${rpad(totalJit.toFixed(2), 10)} ms`);
console.log();

const decomposedTotal = phase1 + phase2 + phase3 + phase4 + totalPhase5;
console.log(`  Decomposed total (Phases 1-5)    : ${rpad(decomposedTotal.toFixed(2), 10)} ms`);
console.log(`  Actual constructor (Phase 6)     : ${rpad(fullConstructMs.toFixed(2), 10)} ms`);
console.log(`  Overhead / diff                  : ${rpad((fullConstructMs - decomposedTotal).toFixed(2), 10)} ms`);
console.log();

// Top 5 slowest entries
console.log("  Top 5 slowest entries:");
for (let i = 0; i < Math.min(5, profiles.length); i++) {
  const p = profiles[i];
  console.log(
    `    ${i + 1}. ${pad(p.root, 18)} ${rpad(p.totalMs.toFixed(2), 8)} ms  (pattern: ${p.patternLen} chars, ${p.variants} variants, suffix: ${p.suffixable ? "yes" : "no"})`,
  );
}
console.log();
console.log("=".repeat(80));
