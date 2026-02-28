import http from "node:http";
import { Terlik, normalize, createNormalizer, getLanguageConfig, getSupportedLanguages } from "../src/index.js";
import type { MatchResult, Mode, MaskStyle } from "../src/types.js";

const PORT = 2026;

interface AnalyzeRequest {
  text: string;
  language: string;
  mode: Mode;
  maskStyle: MaskStyle;
  enableFuzzy: boolean;
  fuzzyThreshold: number;
  fuzzyAlgorithm: "levenshtein" | "dice";
  replaceMask: string;
  customWords?: string[];
  whitelist?: string[];
}

// Instance cache: lazily populated, keyed by options fingerprint.
// Detector-level static pattern cache (per-language) ensures regex objects
// are compiled only once and shared across all instances of the same language.
const terlikCache = new Map<string, Terlik>();

function buildCacheKey(language: string, mode: string, maskStyle: string, enableFuzzy: boolean, fuzzyThreshold: number, fuzzyAlgorithm: string, replaceMask: string, customWords?: string[], whitelist?: string[]): string {
  const cw = (customWords ?? []).sort().join(",");
  const wl = (whitelist ?? []).sort().join(",");
  return `${language}|${mode}|${maskStyle}|${enableFuzzy}|${fuzzyThreshold}|${fuzzyAlgorithm}|${replaceMask}|${cw}|${wl}`;
}

const SUPPORTED_LANGUAGES = getSupportedLanguages();
let warmupDuration = 0;
let warmupDone = false;

console.log("");
console.log("  terlik.js — Sunucu başlatılıyor...");
console.log("");
console.log(`  [1/3] Warmup: ${SUPPORTED_LANGUAGES.length} dil (arka planda)`);

// ────────────────────────────────────────────
// In-memory dictionary store for editor
// ────────────────────────────────────────────
interface DictEntry {
  root: string;
  variants: string[];
  severity: string;
  category: string;
  suffixable: boolean;
}

interface DictStore {
  version: number;
  suffixes: string[];
  entries: DictEntry[];
  whitelist: string[];
}

const dictionaryStore = new Map<string, DictStore>();
const originalDictionaries = new Map<string, DictStore>();
const changeCounters = new Map<string, number>();

console.log("");
console.log(`  [2/3] Dictionary store: ${SUPPORTED_LANGUAGES.length} dil klonlanıyor`);
const dictStoreStart = performance.now();
for (const lang of SUPPORTED_LANGUAGES) {
  const config = getLanguageConfig(lang);
  dictionaryStore.set(lang, structuredClone(config.dictionary) as DictStore);
  originalDictionaries.set(lang, structuredClone(config.dictionary) as DictStore);
  changeCounters.set(lang, 0);
  const dict = config.dictionary as DictStore;
  console.log(`         ${lang}: ${dict.entries.length} entry, ${dict.whitelist.length} whitelist, ${dict.suffixes.length} suffix`);
}
console.log(`         Toplam: ${(performance.now() - dictStoreStart).toFixed(0)}ms`);

function invalidateCacheForLang(lang: string): void {
  const keysToDelete: string[] = [];
  for (const key of terlikCache.keys()) {
    if (key.startsWith(lang + "|")) {
      keysToDelete.push(key);
    }
  }
  for (const key of keysToDelete) {
    terlikCache.delete(key);
  }
}

function incrementChanges(lang: string): void {
  changeCounters.set(lang, (changeCounters.get(lang) || 0) + 1);
}

function testWithEditedDictionary(text: string, lang: string) {
  const dict = dictionaryStore.get(lang);
  if (!dict) return { hasProfanity: false, matches: [] as Array<{word: string; root: string; severity: string; category: string}>, cleaned: text };

  const config = getLanguageConfig(lang);
  const normalizeFn = createNormalizer({
    locale: config.locale,
    charMap: config.charMap,
    leetMap: config.leetMap,
    numberExpansions: config.numberExpansions,
  });

  const normalized = normalizeFn(text);
  const whitelistSet = new Set(dict.whitelist.map((w: string) => normalizeFn(w)));
  const matches: Array<{word: string; root: string; severity: string; category: string}> = [];

  // Check each word in text against dictionary entries
  const tokens = normalized.split(/\s+/).filter(Boolean);
  for (const token of tokens) {
    if (whitelistSet.has(token)) continue;

    for (const entry of dict.entries) {
      const allForms = [entry.root, ...entry.variants].map((f: string) => normalizeFn(f));
      if (allForms.some((form: string) => token === form || token.includes(form))) {
        matches.push({ word: token, root: entry.root, severity: entry.severity, category: entry.category });
        break;
      }
    }
  }

  let cleaned = text;
  for (const m of matches) {
    const escaped = m.word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    cleaned = cleaned.replace(new RegExp(escaped, "gi"), "***");
  }

  return { hasProfanity: matches.length > 0, matches, cleaned };
}

function getCachedTerlik(req: AnalyzeRequest): Terlik {
  const lang = req.language || "tr";
  const key = buildCacheKey(lang, req.mode, req.maskStyle, req.enableFuzzy, req.fuzzyThreshold, req.fuzzyAlgorithm, req.replaceMask, req.customWords, req.whitelist);
  let instance = terlikCache.get(key);
  if (!instance) {
    instance = new Terlik({
      language: lang,
      mode: req.mode,
      maskStyle: req.maskStyle,
      enableFuzzy: req.enableFuzzy,
      fuzzyThreshold: req.fuzzyThreshold,
      fuzzyAlgorithm: req.fuzzyAlgorithm,
      replaceMask: req.replaceMask,
      customList: req.customWords,
      whitelist: req.whitelist,
    });
    terlikCache.set(key, instance);
  }
  return instance;
}

interface ProcessStep {
  step: string;
  label: string;
  detail: string;
  duration?: number;
  type: "info" | "transform" | "match" | "result" | "warning";
}

function analyze(req: AnalyzeRequest) {
  const steps: ProcessStep[] = [];
  const totalStart = performance.now();

  // Step 1: Input
  steps.push({
    step: "1",
    label: "Girdi",
    detail: req.text,
    type: "info",
  });

  // Step 2: Validation
  const t0 = performance.now();
  if (!req.text || req.text.trim().length === 0) {
    steps.push({
      step: "2",
      label: "Doğrulama",
      detail: "Boş girdi — işlem yapılmadı",
      duration: performance.now() - t0,
      type: "warning",
    });
    return {
      steps,
      cleaned: "",
      hasProfanity: false,
      matches: [],
      totalDuration: performance.now() - totalStart,
    };
  }
  steps.push({
    step: "2",
    label: "Doğrulama",
    detail: `${req.text.length} karakter, geçerli`,
    duration: performance.now() - t0,
    type: "info",
  });

  // Step 3: Normalization (language-aware)
  const lang = req.language || "tr";
  const langConfig = getLanguageConfig(lang);
  const normalizeFn = createNormalizer({
    locale: langConfig.locale,
    charMap: langConfig.charMap,
    leetMap: langConfig.leetMap,
    numberExpansions: langConfig.numberExpansions,
  });

  const t1 = performance.now();
  const normalized = normalizeFn(req.text);
  const normDuration = performance.now() - t1;
  steps.push({
    step: "3",
    label: "Normalizasyon",
    detail: `[${lang}] "${req.text}" → "${normalized}"`,
    duration: normDuration,
    type: "transform",
  });

  // Show normalization sub-steps
  const lower = req.text.toLocaleLowerCase(langConfig.locale);
  if (lower !== req.text) {
    steps.push({
      step: "3a",
      label: "  └ Küçük harf",
      detail: `"${req.text}" → "${lower}" (locale: ${langConfig.locale})`,
      type: "transform",
    });
  }

  if (normalized !== lower.replace(/\s+/g, " ").trim()) {
    steps.push({
      step: "3b",
      label: "  └ Karakter dönüşümü",
      detail: `charMap/leet/noktalama/tekrar → "${normalized}"`,
      type: "transform",
    });
  }

  // Step 4: Get/create Terlik instance (cached singleton)
  const t2 = performance.now();
  const terlik = getCachedTerlik(req);

  steps.push({
    step: "4",
    label: "Motor hazır",
    detail: `Dil: ${lang} | Mod: ${req.mode} | Maske: ${req.maskStyle}${req.maskStyle === "replace" ? ` ("${req.replaceMask}")` : ""} | Fuzzy: ${req.enableFuzzy ? `açık (${req.fuzzyAlgorithm}, eşik: ${req.fuzzyThreshold})` : "kapalı"}${(req.customWords?.length ?? 0) > 0 ? ` | +Kelime: ${req.customWords!.join(", ")}` : ""}${(req.whitelist?.length ?? 0) > 0 ? ` | Whitelist: ${req.whitelist!.join(", ")}` : ""}`,
    duration: performance.now() - t2,
    type: "info",
  });

  // Step 5: Detection
  const t3 = performance.now();
  const matches: MatchResult[] = terlik.getMatches(req.text);
  const detectDuration = performance.now() - t3;

  steps.push({
    step: "5",
    label: "Tespit",
    detail: matches.length > 0
      ? `${matches.length} eşleşme bulundu`
      : "Temiz — eşleşme yok",
    duration: detectDuration,
    type: matches.length > 0 ? "match" : "info",
  });

  // Step 5a: Match details
  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    steps.push({
      step: `5.${i + 1}`,
      label: `  └ Eşleşme #${i + 1}`,
      detail: `"${m.word}" → kök: "${m.root}" | pozisyon: ${m.index} | seviye: ${severityLabel(m.severity)} | yöntem: ${methodLabel(m.method)}`,
      type: "match",
    });
  }

  // Step 6: Cleaning
  const t4 = performance.now();
  const cleaned = terlik.clean(req.text);
  const cleanDuration = performance.now() - t4;

  if (matches.length > 0) {
    steps.push({
      step: "6",
      label: "Temizleme",
      detail: `"${req.text}" → "${cleaned}" (${req.maskStyle})`,
      duration: cleanDuration,
      type: "result",
    });
  } else {
    steps.push({
      step: "6",
      label: "Temizleme",
      detail: "Temizleme gerekmedi",
      duration: cleanDuration,
      type: "result",
    });
  }

  const totalDuration = performance.now() - totalStart;

  steps.push({
    step: "✓",
    label: "Tamamlandı",
    detail: `Toplam süre: ${totalDuration.toFixed(3)}ms`,
    duration: totalDuration,
    type: "info",
  });

  return {
    steps,
    cleaned,
    hasProfanity: matches.length > 0,
    matches,
    totalDuration,
  };
}

function severityLabel(s: string): string {
  switch (s) {
    case "high": return "🔴 ağır";
    case "medium": return "🟡 orta";
    case "low": return "🟢 hafif";
    default: return s;
  }
}

function methodLabel(m: string): string {
  switch (m) {
    case "exact": return "tam eşleşme";
    case "pattern": return "pattern";
    case "fuzzy": return "bulanık";
    default: return m;
  }
}

// --- HTML ---

const HTML = /* html */ `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>terlik.js — Canlı Test</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }

  :root {
    --bg: #0f1117;
    --surface: #1a1d27;
    --surface2: #232734;
    --border: #2e3345;
    --text: #e4e6f0;
    --text2: #8b8fa3;
    --accent: #6c5ce7;
    --accent2: #a29bfe;
    --red: #ff6b6b;
    --orange: #ffa726;
    --green: #66bb6a;
    --yellow: #fdd835;
    --blue: #42a5f5;
    --cyan: #26c6da;
    --font: 'SF Mono', 'Fira Code', 'JetBrains Mono', Consolas, monospace;
    --font-ui: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
  }

  body {
    background: var(--bg);
    color: var(--text);
    font-family: var(--font-ui);
    height: 100vh;
    overflow: hidden;
  }

  .layout {
    display: grid;
    grid-template-columns: 1fr 1fr;
    grid-template-rows: auto auto 1fr;
    height: 100vh;
    gap: 0;
  }

  /* Header */
  .header {
    grid-column: 1 / -1;
    background: var(--surface);
    border-bottom: 1px solid var(--border);
    padding: 12px 24px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .header h1 {
    font-size: 18px;
    font-weight: 700;
    font-family: var(--font);
  }

  .header h1 span { color: var(--accent2); }

  .header-right {
    display: flex;
    align-items: center;
    gap: 16px;
    font-size: 13px;
  }

  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--green);
    display: inline-block;
    animation: pulse 2s infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.4; }
  }

  /* Chat Panel */
  .chat-panel {
    display: flex;
    flex-direction: column;
    border-right: 1px solid var(--border);
    overflow: hidden;
  }

  .panel-title {
    padding: 12px 20px;
    font-size: 12px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 1.5px;
    color: var(--text2);
    border-bottom: 1px solid var(--border);
    background: var(--surface);
  }

  .chat-messages {
    flex: 1;
    overflow-y: auto;
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .msg {
    max-width: 85%;
    animation: msgIn 0.3s ease-out;
  }

  @keyframes msgIn {
    from { opacity: 0; transform: translateY(10px); }
    to { opacity: 1; transform: translateY(0); }
  }

  .msg-user { align-self: flex-end; }
  .msg-system { align-self: flex-start; }

  .msg-bubble {
    padding: 10px 16px;
    border-radius: 14px;
    font-size: 14px;
    line-height: 1.5;
    word-break: break-word;
  }

  .msg-user .msg-bubble {
    background: var(--accent);
    color: #fff;
    border-bottom-right-radius: 4px;
  }

  .msg-system .msg-bubble {
    background: var(--surface2);
    border-bottom-left-radius: 4px;
  }

  .msg-system .msg-bubble.has-profanity {
    border-left: 3px solid var(--red);
  }

  .msg-system .msg-bubble.clean {
    border-left: 3px solid var(--green);
  }

  .msg-meta {
    font-size: 11px;
    color: var(--text2);
    margin-top: 4px;
    padding: 0 4px;
  }

  .msg-user .msg-meta { text-align: right; }

  /* Legacy settings-bar (unused, kept for compat) */

  /* Input area */
  .chat-input-area {
    padding: 16px 20px;
    background: var(--surface);
    border-top: 1px solid var(--border);
  }

  .chat-input-row {
    display: flex;
    gap: 10px;
  }

  #chatInput {
    flex: 1;
    background: var(--surface2);
    color: var(--text);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 10px 16px;
    font-size: 14px;
    font-family: var(--font-ui);
    outline: none;
    transition: border-color 0.2s;
  }

  #chatInput:focus { border-color: var(--accent); }

  #chatInput::placeholder { color: var(--text2); }

  #sendBtn {
    background: var(--accent);
    color: #fff;
    border: none;
    border-radius: 10px;
    padding: 10px 20px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.2s;
    white-space: nowrap;
  }

  #sendBtn:hover { background: var(--accent2); }

  /* Process Panel */
  .process-panel {
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .process-log {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .log-group {
    margin-bottom: 12px;
    animation: msgIn 0.3s ease-out;
  }

  .log-group-header {
    font-size: 11px;
    color: var(--text2);
    margin-bottom: 8px;
    padding-bottom: 4px;
    border-bottom: 1px solid var(--border);
    display: flex;
    justify-content: space-between;
  }

  .log-entry {
    display: grid;
    grid-template-columns: 40px 1fr auto;
    gap: 8px;
    padding: 5px 8px;
    border-radius: 6px;
    font-size: 12px;
    font-family: var(--font);
    line-height: 1.5;
    animation: stepIn 0.15s ease-out;
    animation-fill-mode: both;
  }

  @keyframes stepIn {
    from { opacity: 0; transform: translateX(-8px); }
    to { opacity: 1; transform: translateX(0); }
  }

  .log-entry:hover { background: var(--surface2); }

  .log-step {
    color: var(--text2);
    font-weight: 600;
    text-align: right;
  }

  .log-content { color: var(--text); }
  .log-label { color: var(--cyan); font-weight: 600; }
  .log-detail { color: var(--text2); margin-left: 4px; }
  .log-duration {
    color: var(--text2);
    font-size: 11px;
    text-align: right;
    white-space: nowrap;
  }

  .log-entry.type-match { background: rgba(255,107,107,0.08); }
  .log-entry.type-match .log-label { color: var(--red); }

  .log-entry.type-transform .log-label { color: var(--orange); }
  .log-entry.type-result .log-label { color: var(--green); }
  .log-entry.type-warning .log-label { color: var(--yellow); }
  .log-entry.type-info .log-label { color: var(--blue); }

  /* Quick test buttons */
  .quick-tests {
    padding: 8px 20px 4px;
    display: flex;
    gap: 6px;
    flex-wrap: wrap;
  }

  .quick-btn {
    background: var(--surface2);
    color: var(--text2);
    border: 1px solid var(--border);
    border-radius: 16px;
    padding: 4px 12px;
    font-size: 11px;
    cursor: pointer;
    transition: all 0.2s;
    font-family: var(--font);
  }

  .quick-btn:hover {
    background: var(--accent);
    color: #fff;
    border-color: var(--accent);
  }

  /* Scrollbar */
  ::-webkit-scrollbar { width: 6px; }
  ::-webkit-scrollbar-track { background: transparent; }
  ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
  ::-webkit-scrollbar-thumb:hover { background: var(--text2); }

  .empty-state {
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: var(--text2);
    font-size: 13px;
    text-align: center;
    line-height: 2;
  }

  /* Settings sections */
  .settings-section {
    padding: 10px 20px;
    background: var(--surface);
    border-top: 1px solid var(--border);
  }

  .settings-section-title {
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: var(--text2);
    margin-bottom: 8px;
    cursor: pointer;
    display: flex;
    align-items: center;
    gap: 6px;
    user-select: none;
  }

  .settings-section-title:hover { color: var(--text); }
  .settings-section-title .arrow { transition: transform 0.2s; font-size: 8px; }
  .settings-section-title .arrow.collapsed { transform: rotate(-90deg); }

  .settings-row {
    display: flex;
    gap: 12px;
    flex-wrap: wrap;
    align-items: flex-start;
  }

  .settings-row.collapsed { display: none; }

  .field {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .field label {
    font-size: 10px;
    color: var(--text2);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .field .helper {
    font-size: 10px;
    color: var(--text2);
    opacity: 0.7;
    font-style: italic;
  }

  .field select, .field input[type="number"], .field input[type="text"] {
    background: var(--surface2);
    color: var(--text);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 5px 8px;
    font-size: 12px;
    font-family: var(--font);
    outline: none;
  }

  .field select:focus, .field input:focus { border-color: var(--accent); }
  .field input[type="checkbox"] { accent-color: var(--accent); }

  .field-wide { flex: 1; min-width: 140px; }
  .field-wide input[type="text"] { width: 100%; }

  .field.hidden { display: none; }

  .toolbar-btn {
    background: var(--surface2);
    color: var(--cyan);
    border: 1px solid var(--border);
    border-radius: 8px;
    padding: 6px 14px;
    font-size: 12px;
    cursor: pointer;
    font-family: var(--font);
    white-space: nowrap;
    transition: all 0.2s;
    align-self: flex-end;
  }

  .toolbar-btn:hover { background: var(--accent); color: #fff; border-color: var(--accent); }

  @media (max-width: 768px) {
    .layout {
      grid-template-columns: 1fr;
      grid-template-rows: auto auto 1fr 1fr;
    }
    .chat-panel { border-right: none; border-bottom: 1px solid var(--border); }
  }

  /* ── Tab System ── */
  .tab-bar {
    grid-column: 1 / -1;
    background: var(--surface);
    border-bottom: 1px solid var(--border);
    padding: 0 24px;
    display: flex;
    gap: 0;
  }

  .tab-btn {
    background: none;
    border: none;
    color: var(--text2);
    padding: 10px 20px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    border-bottom: 2px solid transparent;
    transition: all 0.2s;
    font-family: var(--font-ui);
  }

  .tab-btn:hover { color: var(--text); }
  .tab-btn.active { color: var(--accent2); border-bottom-color: var(--accent); }

  .tab-content {
    display: none;
    grid-column: 1 / -1;
    grid-template-columns: 1fr 1fr;
    height: 100%;
    overflow: hidden;
  }

  .tab-content.active { display: grid; }

  /* ── Editor Layout ── */
  .editor-left {
    display: flex;
    flex-direction: column;
    border-right: 1px solid var(--border);
    overflow: hidden;
  }

  .editor-right {
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }

  .editor-toolbar {
    padding: 12px 20px;
    background: var(--surface);
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }

  .editor-toolbar select, .editor-toolbar input {
    background: var(--surface2);
    color: var(--text);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 6px 10px;
    font-size: 12px;
    font-family: var(--font);
    outline: none;
  }

  .editor-toolbar select:focus, .editor-toolbar input:focus {
    border-color: var(--accent);
  }

  .editor-sections {
    flex: 1;
    overflow-y: auto;
    padding: 16px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .editor-section {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
  }

  .editor-section-header {
    padding: 10px 16px;
    background: var(--surface2);
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: center;
    justify-content: space-between;
    cursor: pointer;
    user-select: none;
  }

  .editor-section-header:hover { background: var(--border); }

  .editor-section-title {
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: var(--text2);
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .editor-section-title .arrow {
    font-size: 10px;
    transition: transform 0.2s;
  }

  .editor-section-title .arrow.collapsed { transform: rotate(-90deg); }

  .editor-section-body { padding: 12px; }
  .editor-section-body.collapsed { display: none; }

  .editor-section-count {
    font-size: 11px;
    color: var(--text2);
    background: var(--surface);
    padding: 2px 8px;
    border-radius: 10px;
  }

  /* ── Dictionary Table ── */
  .dict-table {
    width: 100%;
    font-size: 12px;
    font-family: var(--font);
    border-collapse: collapse;
    table-layout: fixed;
  }

  .dict-table th {
    text-align: left;
    padding: 6px 8px;
    color: var(--text2);
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    border-bottom: 1px solid var(--border);
    position: sticky;
    top: 0;
    background: var(--surface);
  }

  /* Column widths */
  .dict-table th:nth-child(1),
  .dict-table td:nth-child(1) { width: 14%; } /* Root */
  .dict-table th:nth-child(2),
  .dict-table td:nth-child(2) { width: 36%; } /* Variants */
  .dict-table th:nth-child(3),
  .dict-table td:nth-child(3) { width: 10%; } /* Severity */
  .dict-table th:nth-child(4),
  .dict-table td:nth-child(4) { width: 12%; } /* Category */
  .dict-table th:nth-child(5),
  .dict-table td:nth-child(5) { width: 6%; }  /* Sfx */
  .dict-table th:nth-child(6),
  .dict-table td:nth-child(6) { width: 22%; } /* Actions */

  .dict-table td {
    padding: 6px 8px;
    border-bottom: 1px solid var(--border);
    vertical-align: top;
    word-break: break-word;
  }

  .dict-table tr:hover td { background: var(--surface2); }

  .dict-table .variants-cell {
    font-size: 11px;
    color: var(--text2);
    line-height: 1.6;
  }

  .severity-high { color: var(--red); }
  .severity-medium { color: var(--orange); }
  .severity-low { color: var(--green); }

  .dict-actions {
    display: flex;
    gap: 4px;
    white-space: nowrap;
  }

  .dict-actions button {
    background: none;
    border: 1px solid var(--border);
    color: var(--text2);
    border-radius: 4px;
    padding: 2px 6px;
    cursor: pointer;
    font-size: 11px;
    transition: all 0.15s;
  }

  .dict-actions button:hover { background: var(--surface2); color: var(--text); }
  .dict-actions button.btn-delete:hover { background: rgba(255,107,107,0.15); color: var(--red); border-color: var(--red); }

  /* ── Inline Form ── */
  .inline-form {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    padding: 12px;
    background: var(--surface2);
    border-radius: 8px;
    margin-bottom: 10px;
    align-items: flex-end;
  }

  .inline-form .form-field {
    display: flex;
    flex-direction: column;
    gap: 3px;
  }

  .inline-form .form-field label {
    font-size: 10px;
    color: var(--text2);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .inline-form .form-field.field-grow { flex: 1; min-width: 120px; }

  .inline-form input, .inline-form select {
    background: var(--bg);
    color: var(--text);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 6px 8px;
    font-size: 12px;
    font-family: var(--font);
    outline: none;
    width: 100%;
  }

  .inline-form input:focus, .inline-form select:focus { border-color: var(--accent); }

  .inline-form .form-actions {
    display: flex;
    gap: 6px;
    align-items: flex-end;
    padding-bottom: 1px;
  }

  .inline-form .form-btn {
    background: var(--accent);
    color: #fff;
    border: none;
    border-radius: 6px;
    padding: 6px 14px;
    font-size: 12px;
    cursor: pointer;
    font-weight: 600;
    white-space: nowrap;
  }

  .inline-form .form-btn:hover { background: var(--accent2); }

  .inline-form .form-btn-cancel {
    background: var(--surface);
    color: var(--text2);
    border: 1px solid var(--border);
  }

  .inline-form .form-btn-cancel:hover { background: var(--border); color: var(--text); }

  /* ── Tag / Chip List ── */
  .tag-list {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 8px;
  }

  .tag {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background: var(--surface2);
    border: 1px solid var(--border);
    border-radius: 14px;
    padding: 3px 10px;
    font-size: 11px;
    font-family: var(--font);
    color: var(--text);
  }

  .tag .tag-remove {
    background: none;
    border: none;
    color: var(--text2);
    cursor: pointer;
    font-size: 13px;
    line-height: 1;
    padding: 0 0 0 2px;
    transition: color 0.15s;
  }

  .tag .tag-remove:hover { color: var(--red); }

  .tag-add-row {
    display: flex;
    gap: 6px;
    align-items: center;
  }

  .tag-add-row input {
    background: var(--bg);
    color: var(--text);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 5px 10px;
    font-size: 12px;
    font-family: var(--font);
    outline: none;
    flex: 1;
    max-width: 200px;
  }

  .tag-add-row input:focus { border-color: var(--accent); }

  .tag-add-row button {
    background: var(--accent);
    color: #fff;
    border: none;
    border-radius: 6px;
    padding: 5px 12px;
    font-size: 12px;
    cursor: pointer;
    font-weight: 600;
  }

  .tag-add-row button:hover { background: var(--accent2); }

  /* ── Bottom Toolbar ── */
  .editor-bottom-toolbar {
    padding: 12px 16px;
    background: var(--surface);
    border-top: 1px solid var(--border);
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }

  .editor-bottom-toolbar .toolbar-btn { font-size: 12px; }

  .badge {
    background: var(--accent);
    color: #fff;
    border-radius: 10px;
    padding: 2px 10px;
    font-size: 11px;
    font-weight: 700;
    margin-left: auto;
  }

  .badge.zero { background: var(--border); color: var(--text2); }

  /* ── Preview Panel ── */
  .preview-area {
    flex: 1;
    overflow-y: auto;
    padding: 20px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }

  .preview-input-row {
    display: flex;
    gap: 10px;
  }

  .preview-input-row input {
    flex: 1;
    background: var(--surface2);
    color: var(--text);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 10px 16px;
    font-size: 14px;
    font-family: var(--font-ui);
    outline: none;
  }

  .preview-input-row input:focus { border-color: var(--accent); }

  .preview-input-row button {
    background: var(--accent);
    color: #fff;
    border: none;
    border-radius: 10px;
    padding: 10px 20px;
    font-size: 14px;
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
  }

  .preview-input-row button:hover { background: var(--accent2); }

  .preview-result {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 16px;
  }

  .preview-badge {
    display: inline-block;
    padding: 4px 14px;
    border-radius: 14px;
    font-size: 13px;
    font-weight: 700;
    margin-bottom: 12px;
  }

  .preview-clean {
    background: rgba(102,187,106,0.15);
    color: var(--green);
    border: 1px solid rgba(102,187,106,0.3);
  }

  .preview-dirty {
    background: rgba(255,107,107,0.15);
    color: var(--red);
    border: 1px solid rgba(255,107,107,0.3);
  }

  .preview-matches {
    margin-top: 10px;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .preview-match-item {
    background: var(--surface2);
    border-radius: 6px;
    padding: 8px 12px;
    font-size: 12px;
    font-family: var(--font);
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 4px 12px;
  }

  .preview-match-item .pm-label { color: var(--text2); }
  .preview-match-item .pm-value { color: var(--text); }

  .preview-cleaned {
    margin-top: 10px;
    padding: 10px;
    background: var(--surface2);
    border-radius: 6px;
    font-family: var(--font);
    font-size: 13px;
    color: var(--orange);
  }

  .preview-empty {
    color: var(--text2);
    font-size: 13px;
    text-align: center;
    padding: 40px 20px;
    line-height: 2;
  }

  .editor-search-row {
    display: flex;
    gap: 8px;
    margin-bottom: 10px;
  }

  .editor-search-row input {
    flex: 1;
    background: var(--bg);
    color: var(--text);
    border: 1px solid var(--border);
    border-radius: 6px;
    padding: 6px 10px;
    font-size: 12px;
    font-family: var(--font);
    outline: none;
  }

  .editor-search-row input:focus { border-color: var(--accent); }
</style>
</head>
<body>
<div class="layout">
  <div class="header">
    <h1><span>terlik.js</span> — Canlı Test</h1>
    <div class="header-right">
      <span class="status-dot"></span>
      <span style="color:var(--text2);font-size:12px">localhost:${PORT} | dev modu</span>
    </div>
  </div>

  <div class="tab-bar">
    <button class="tab-btn active" data-tab="chat">Chat</button>
    <button class="tab-btn" data-tab="editor">Sözlük Editörü</button>
  </div>

  <div class="tab-content active" id="tabChat">
  <div class="chat-panel">
    <div class="panel-title">Chat</div>
    <div class="chat-messages" id="chatMessages">
      <div class="empty-state">
        Aşağıya bir mesaj yaz ve Gönder'e bas.<br>
        Küfür varsa maskelenir, sağ panelde adım adım süreci görürsün.<br>
        <span style="color:var(--accent2)">↓ Hazır örnekleri tek tıkla dene</span>
      </div>
    </div>
    <div class="quick-tests" id="quickTests"></div>

    <!-- Tespit Ayarları -->
    <div class="settings-section">
      <div class="settings-section-title" data-toggle="settingsCore">
        <span class="arrow">▼</span> Tespit Ayarları
      </div>
      <div class="settings-row" id="settingsCore">
        <div class="field">
          <label>Dil</label>
          <select id="optLanguage">
            <option value="tr" selected>Türkçe (tr)</option>
            <option value="en">English (en)</option>
            <option value="es">Español (es)</option>
            <option value="de">Deutsch (de)</option>
          </select>
          <span class="helper">Hangi dilde küfür tespiti yapılsın?</span>
        </div>
        <div class="field">
          <label>Mod</label>
          <select id="optMode">
            <option value="strict">strict</option>
            <option value="balanced" selected>balanced</option>
            <option value="loose">loose</option>
          </select>
          <span class="helper">strict: sadece tam eşleşme, balanced: pattern, loose: fuzzy dahil</span>
        </div>
        <div class="field">
          <label>Maskeleme</label>
          <select id="optMask">
            <option value="stars" selected>stars (******)</option>
            <option value="partial">partial (s****r)</option>
            <option value="replace">replace (özel metin)</option>
          </select>
        </div>
        <div class="field hidden" id="replaceMaskField">
          <label>Maske metni</label>
          <input type="text" id="optReplaceMask" value="[***]" style="width:80px">
          <span class="helper">replace seçiliyken kullanılır</span>
        </div>
      </div>
    </div>

    <!-- Fuzzy Ayarları -->
    <div class="settings-section" style="border-top:none;padding-top:0">
      <div class="settings-section-title" data-toggle="settingsFuzzy">
        <span class="arrow">▼</span> Fuzzy Eşleştirme
      </div>
      <div class="settings-row" id="settingsFuzzy">
        <div class="field">
          <label>Aktif</label>
          <div style="padding:4px 0"><input type="checkbox" id="optFuzzy"></div>
          <span class="helper">Yazım hatalarını yakalamak için aç</span>
        </div>
        <div class="field">
          <label>Eşik (0-1)</label>
          <input type="number" id="optThreshold" value="0.8" min="0" max="1" step="0.05" style="width:65px">
          <span class="helper">Düşük = daha toleranslı</span>
        </div>
        <div class="field">
          <label>Algoritma</label>
          <select id="optAlgorithm">
            <option value="levenshtein">levenshtein</option>
            <option value="dice">dice</option>
          </select>
        </div>
      </div>
    </div>

    <!-- Sözlük Ayarları -->
    <div class="settings-section" style="border-top:none;padding-top:0">
      <div class="settings-section-title" data-toggle="settingsDict">
        <span class="arrow">▼</span> Sözlük Yönetimi
      </div>
      <div class="settings-row" id="settingsDict">
        <div class="field field-wide">
          <label>Ekstra yakalanacak kelimeler</label>
          <input type="text" id="optCustomWords" placeholder="hiyar, kodumun, zıbıdı">
          <span class="helper">Varsayılan sözlüğe ek kelimeler. Virgül ile ayır.</span>
        </div>
        <div class="field field-wide">
          <label>Yakalanmasın (whitelist)</label>
          <input type="text" id="optWhitelist" placeholder="örnekkelime, testsözcük">
          <span class="helper">Bu kelimeleri küfür olarak işaretleme. Virgül ile ayır.</span>
        </div>
      </div>
    </div>

    <div class="chat-input-area">
      <div class="chat-input-row">
        <input type="text" id="chatInput" placeholder="Bir mesaj yaz ve Enter'a bas..." autocomplete="off">
        <button id="normalizeBtn" class="toolbar-btn" title="Mesaj kutusundaki metni sadece normalize et, tespit yapma">normalize()</button>
        <button id="sendBtn">Gönder</button>
      </div>
    </div>
  </div>

  <div class="process-panel">
    <div class="panel-title">İşlem Süreci (Process Log)</div>
    <div class="process-log" id="processLog">
      <div class="empty-state">
        <div>
          Soldan bir mesaj gönder, burada<br>terlik.js'in adım adım ne yaptığını gör:<br><br>
          <span style="color:var(--orange)">1.</span> Normalizasyon (harf dönüşümleri)<br>
          <span style="color:var(--red)">2.</span> Tespit (pattern eşleşmeler)<br>
          <span style="color:var(--green)">3.</span> Temizleme (maskeleme)<br>
          <span style="color:var(--blue)">4.</span> Süre ölçümü (ms)
        </div>
      </div>
    </div>
  </div>
  </div>

  <div class="tab-content" id="tabEditor">
    <div class="editor-left">
      <div class="editor-toolbar">
        <div class="field">
          <label style="font-size:10px;color:var(--text2);text-transform:uppercase;letter-spacing:0.5px">Dil</label>
          <select id="editorLang">
            <option value="tr" selected>Türkçe (tr)</option>
            <option value="en">English (en)</option>
            <option value="es">Español (es)</option>
            <option value="de">Deutsch (de)</option>
          </select>
        </div>
      </div>

      <div class="editor-sections">
        <!-- Entries Section -->
        <div class="editor-section">
          <div class="editor-section-header" data-editor-toggle="entriesBody">
            <span class="editor-section-title"><span class="arrow">▼</span> Kökler (Entries)</span>
            <span class="editor-section-count" id="entriesCount">0</span>
          </div>
          <div class="editor-section-body" id="entriesBody">
            <div class="editor-search-row">
              <input type="text" id="entriesSearch" placeholder="Ara (kök veya variant)...">
            </div>
            <div id="addEntryFormArea"></div>
            <button class="toolbar-btn" id="addEntryBtn" style="margin-bottom:10px">+ Yeni Kök Ekle</button>
            <div id="entriesTableWrap">
              <table class="dict-table">
                <thead><tr><th>Root</th><th>Variants</th><th>Severity</th><th>Category</th><th>Sfx</th><th>İşlem</th></tr></thead>
                <tbody id="entriesTableBody"></tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- Whitelist Section -->
        <div class="editor-section">
          <div class="editor-section-header" data-editor-toggle="whitelistBody">
            <span class="editor-section-title"><span class="arrow">▼</span> Whitelist</span>
            <span class="editor-section-count" id="whitelistCount">0</span>
          </div>
          <div class="editor-section-body" id="whitelistBody">
            <div class="tag-list" id="whitelistTags"></div>
            <div class="tag-add-row">
              <input type="text" id="whitelistInput" placeholder="Kelime ekle...">
              <button id="whitelistAddBtn">Ekle</button>
            </div>
          </div>
        </div>

        <!-- Suffixes Section -->
        <div class="editor-section">
          <div class="editor-section-header" data-editor-toggle="suffixesBody">
            <span class="editor-section-title"><span class="arrow">▼</span> Suffixes (Ekler)</span>
            <span class="editor-section-count" id="suffixesCount">0</span>
          </div>
          <div class="editor-section-body" id="suffixesBody">
            <div class="tag-list" id="suffixesTags"></div>
            <div class="tag-add-row">
              <input type="text" id="suffixInput" placeholder="Ek ekle...">
              <button id="suffixAddBtn">Ekle</button>
            </div>
          </div>
        </div>
      </div>

      <div class="editor-bottom-toolbar">
        <button class="toolbar-btn" id="exportBtn">JSON İndir</button>
        <button class="toolbar-btn" id="resetBtn">Sıfırla</button>
        <span class="badge zero" id="changeBadge">0 değişiklik</span>
      </div>
    </div>

    <div class="editor-right">
      <div class="panel-title">Live Preview</div>
      <div class="preview-area">
        <div class="preview-input-row">
          <input type="text" id="previewInput" placeholder="Test metni yaz..." autocomplete="off">
          <button id="previewBtn">Test Et</button>
        </div>
        <div id="previewResult">
          <div class="preview-empty">
            Soldaki sözlüğü düzenle, burada test et.<br>
            Test, düzenlenmiş in-memory sözlük üzerinden çalışır.
          </div>
        </div>
      </div>
    </div>
  </div>
</div>

<script>
const chatMessages = document.getElementById('chatMessages');
const processLog = document.getElementById('processLog');
const chatInput = document.getElementById('chatInput');
const sendBtn = document.getElementById('sendBtn');
let msgCount = 0;

// Section toggle (collapse/expand)
document.querySelectorAll('.settings-section-title').forEach(title => {
  title.addEventListener('click', () => {
    const targetId = title.getAttribute('data-toggle');
    const target = document.getElementById(targetId);
    const arrow = title.querySelector('.arrow');
    if (target) {
      target.classList.toggle('collapsed');
      arrow.classList.toggle('collapsed');
    }
  });
});

// Show/hide replace mask field based on mask style selection
const optMask = document.getElementById('optMask');
const replaceMaskField = document.getElementById('replaceMaskField');
optMask.addEventListener('change', () => {
  replaceMaskField.classList.toggle('hidden', optMask.value !== 'replace');
});


const QUICK_TESTS = {
  tr: [
    { text: 'merhaba dünya nasılsın', label: 'temiz mesaj' },
    { text: 'siktir git burdan', label: 'düz küfür' },
    { text: 's.i.k.t.i.r git', label: 'ayraçlı' },
    { text: '$1kt1r lan', label: 'leet speak' },
    { text: 'siiiiiktir', label: 'tekrar karakter' },
    { text: 'SİKTİR GİT', label: 'büyük harf' },
    { text: 'sikke koleksiyonu', label: 'whitelist' },
    { text: 'aptal orospu cocugu', label: 'çoklu eşleşme' },
    { text: 'amsterdam güzel şehir', label: 'false positive' },
    { text: 'sıkıntı var', label: 'FP: sıkıntı' },
  ],
  en: [
    { text: 'hello world', label: 'clean' },
    { text: 'what the fuck', label: 'plain' },
    { text: 'stop fucking around', label: 'variant' },
    { text: 'f.u.c.k this', label: 'separator' },
    { text: 'fck off', label: 'leet' },
    { text: 'fuuuck', label: 'repeat' },
    { text: '$h1t', label: 'leet shit' },
    { text: 'son of a bitch', label: 'bitch' },
    { text: 'the assassin escaped', label: 'whitelist' },
    { text: 'first class ticket', label: 'FP: class' },
  ],
  es: [
    { text: 'hola mundo', label: 'limpio' },
    { text: 'hijo de puta', label: 'puta' },
    { text: 'eso es una mierda', label: 'mierda' },
    { text: 'eres un cabron', label: 'cabron' },
    { text: 'joder tio', label: 'joder' },
    { text: 'm.i.e.r.d.a', label: 'separador' },
    { text: 'mi computadora', label: 'whitelist' },
  ],
  de: [
    { text: 'hallo welt', label: 'sauber' },
    { text: 'das ist scheiße', label: 'scheiße' },
    { text: 'fick dich', label: 'fick' },
    { text: 'du arschloch', label: 'arschloch' },
    { text: 'scheisse', label: 'ohne ß' },
    { text: 'f.i.c.k', label: 'separator' },
    { text: 'du idiot', label: 'idiot' },
  ],
};

function renderQuickTests(lang) {
  const container = document.getElementById('quickTests');
  container.innerHTML = '';
  const tests = QUICK_TESTS[lang] || QUICK_TESTS['tr'];
  for (const t of tests) {
    const btn = document.createElement('button');
    btn.className = 'quick-btn';
    btn.setAttribute('data-text', t.text);
    btn.textContent = t.label;
    btn.addEventListener('click', () => {
      chatInput.value = t.text;
      send(t.text);
    });
    container.appendChild(btn);
  }
}

// Language change → update quick tests
document.getElementById('optLanguage').addEventListener('change', (e) => {
  renderQuickTests(e.target.value);
});

// Initial render
renderQuickTests('tr');

function getOptions() {
  const cwRaw = document.getElementById('optCustomWords').value.trim();
  const wlRaw = document.getElementById('optWhitelist').value.trim();
  return {
    language: document.getElementById('optLanguage').value,
    mode: document.getElementById('optMode').value,
    maskStyle: document.getElementById('optMask').value,
    enableFuzzy: document.getElementById('optFuzzy').checked,
    fuzzyThreshold: parseFloat(document.getElementById('optThreshold').value),
    fuzzyAlgorithm: document.getElementById('optAlgorithm').value,
    replaceMask: document.getElementById('optReplaceMask').value || '[***]',
    customWords: cwRaw ? cwRaw.split(',').map(s => s.trim()).filter(Boolean) : [],
    whitelist: wlRaw ? wlRaw.split(',').map(s => s.trim()).filter(Boolean) : [],
  };
}

function addChatMessage(text, type, meta) {
  // Clear empty state
  const empty = chatMessages.querySelector('.empty-state');
  if (empty) empty.remove();

  const msg = document.createElement('div');
  msg.className = 'msg msg-' + type;
  msg.innerHTML =
    '<div class="msg-bubble ' + (meta || '') + '">' + escapeHtml(text) + '</div>' +
    '<div class="msg-meta">' + new Date().toLocaleTimeString('tr-TR') + '</div>';
  chatMessages.appendChild(msg);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function addProcessGroup(data) {
  // Clear empty state
  const empty = processLog.querySelector('.empty-state');
  if (empty) empty.remove();

  const group = document.createElement('div');
  group.className = 'log-group';

  const header = document.createElement('div');
  header.className = 'log-group-header';
  header.innerHTML =
    '<span>#' + (++msgCount) + ' — ' + new Date().toLocaleTimeString('tr-TR') + '</span>' +
    '<span>' + data.totalDuration.toFixed(3) + 'ms</span>';
  group.appendChild(header);

  data.steps.forEach((step, i) => {
    const entry = document.createElement('div');
    entry.className = 'log-entry type-' + step.type;
    entry.style.animationDelay = (i * 50) + 'ms';
    entry.innerHTML =
      '<div class="log-step">' + step.step + '</div>' +
      '<div class="log-content"><span class="log-label">' + escapeHtml(step.label) + '</span>' +
      '<span class="log-detail">' + escapeHtml(step.detail) + '</span></div>' +
      '<div class="log-duration">' + (step.duration != null ? step.duration.toFixed(3) + 'ms' : '') + '</div>';
    group.appendChild(entry);
  });

  processLog.appendChild(group);
  processLog.scrollTop = processLog.scrollHeight;
}

function escapeHtml(s) {
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

async function send(text) {
  if (!text.trim()) return;
  addChatMessage(text, 'user');
  chatInput.value = '';

  const opts = getOptions();
  try {
    const res = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, ...opts }),
    });
    const data = await res.json();

    const displayText = data.hasProfanity ? data.cleaned : text;
    const bubbleClass = data.hasProfanity ? 'has-profanity' : 'clean';
    addChatMessage(displayText, 'system', bubbleClass);
    addProcessGroup(data);
  } catch (err) {
    addChatMessage('Hata: ' + err.message, 'system', 'has-profanity');
  }
}

sendBtn.addEventListener('click', () => send(chatInput.value));
chatInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') send(chatInput.value);
});

// Quick test buttons are rendered dynamically by renderQuickTests()

// ─── Tab System ─────────────────────────────
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
    btn.classList.add('active');
    const tabId = btn.getAttribute('data-tab');
    document.getElementById('tab' + tabId.charAt(0).toUpperCase() + tabId.slice(1)).classList.add('active');
  });
});

// ─── Editor Section Toggle ──────────────────
document.querySelectorAll('[data-editor-toggle]').forEach(header => {
  header.addEventListener('click', () => {
    const bodyId = header.getAttribute('data-editor-toggle');
    const body = document.getElementById(bodyId);
    const arrow = header.querySelector('.arrow');
    if (body) { body.classList.toggle('collapsed'); }
    if (arrow) { arrow.classList.toggle('collapsed'); }
  });
});

// ─── Dictionary Editor ──────────────────────
const editorState = {
  lang: 'tr',
  data: null,
  changes: 0,
  lastTestInput: '',
  editingRoot: null,
};

const editorLang = document.getElementById('editorLang');
const entriesTableBody = document.getElementById('entriesTableBody');
const entriesCount = document.getElementById('entriesCount');
const whitelistTags = document.getElementById('whitelistTags');
const whitelistCount = document.getElementById('whitelistCount');
const suffixesTags = document.getElementById('suffixesTags');
const suffixesCount = document.getElementById('suffixesCount');
const changeBadge = document.getElementById('changeBadge');
const previewResult = document.getElementById('previewResult');
const previewInput = document.getElementById('previewInput');

async function loadDictionary(lang) {
  try {
    const res = await fetch('/api/dictionary/' + lang);
    const data = await res.json();
    editorState.data = data.dictionary;
    editorState.changes = data.changes;
    editorState.lang = lang;
    renderEditor();
  } catch (err) {
    console.error('Dictionary load error:', err);
  }
}

function renderEditor() {
  renderEntries();
  renderWhitelist();
  renderSuffixes();
  updateChangeBadge();
}

function updateChangeBadge() {
  const c = editorState.changes;
  changeBadge.textContent = c + ' değişiklik';
  changeBadge.className = 'badge' + (c === 0 ? ' zero' : '');
}

// ─── Entries Rendering ──────────────────────
function renderEntries(filter) {
  if (!editorState.data) return;
  const entries = editorState.data.entries;
  const search = (filter || document.getElementById('entriesSearch').value || '').toLowerCase();
  entriesCount.textContent = entries.length;
  entriesTableBody.innerHTML = '';

  const filtered = search
    ? entries.filter(e => e.root.toLowerCase().includes(search) || e.variants.some(v => v.toLowerCase().includes(search)))
    : entries;

  for (const entry of filtered) {
    const tr = document.createElement('tr');
    tr.innerHTML =
      '<td>' + escapeHtml(entry.root) + '</td>' +
      '<td class="variants-cell">' + escapeHtml(entry.variants.join(', ')) + '</td>' +
      '<td><span class="severity-' + entry.severity + '">' + entry.severity + '</span></td>' +
      '<td>' + escapeHtml(entry.category || '') + '</td>' +
      '<td>' + (entry.suffixable ? 'Evet' : '-') + '</td>' +
      '<td class="dict-actions">' +
        '<button class="btn-edit" data-root="' + escapeHtml(entry.root) + '">Düzenle</button>' +
        '<button class="btn-delete" data-root="' + escapeHtml(entry.root) + '">Sil</button>' +
      '</td>';
    entriesTableBody.appendChild(tr);
  }

  // Attach event listeners
  entriesTableBody.querySelectorAll('.btn-edit').forEach(btn => {
    btn.addEventListener('click', () => showEditForm(btn.getAttribute('data-root')));
  });
  entriesTableBody.querySelectorAll('.btn-delete').forEach(btn => {
    btn.addEventListener('click', () => deleteEntry(btn.getAttribute('data-root')));
  });
}

document.getElementById('entriesSearch').addEventListener('input', (e) => {
  renderEntries(e.target.value);
});

// ─── Add Entry Form ─────────────────────────
const addEntryBtn = document.getElementById('addEntryBtn');
const addEntryFormArea = document.getElementById('addEntryFormArea');

addEntryBtn.addEventListener('click', () => {
  editorState.editingRoot = null;
  showEntryForm(null);
});

function showEntryForm(entry) {
  addEntryFormArea.innerHTML =
    '<div class="inline-form">' +
      '<div class="form-field" style="min-width:100px">' +
        '<label>Kök</label>' +
        '<input type="text" id="formRoot" placeholder="sik, amk..." value="' + (entry ? escapeHtml(entry.root) : '') + '"' + (entry ? ' readonly style="opacity:0.6"' : '') + '>' +
      '</div>' +
      '<div class="form-field field-grow">' +
        '<label>Varyantlar (virgülle)</label>' +
        '<input type="text" id="formVariants" placeholder="siktir, sikerim, sikiyor..." value="' + (entry ? escapeHtml(entry.variants.join(', ')) : '') + '">' +
      '</div>' +
      '<div class="form-field">' +
        '<label>Seviye</label>' +
        '<select id="formSeverity">' +
          '<option value="high"' + (entry && entry.severity === 'high' ? ' selected' : '') + '>high</option>' +
          '<option value="medium"' + ((!entry) || (entry && entry.severity === 'medium') ? ' selected' : '') + '>medium</option>' +
          '<option value="low"' + (entry && entry.severity === 'low' ? ' selected' : '') + '>low</option>' +
        '</select>' +
      '</div>' +
      '<div class="form-field">' +
        '<label>Kategori</label>' +
        '<select id="formCategory">' +
          '<option value="sexual"' + (entry && entry.category === 'sexual' ? ' selected' : '') + '>sexual</option>' +
          '<option value="insult"' + ((!entry) || (entry && entry.category === 'insult') ? ' selected' : '') + '>insult</option>' +
          '<option value="slur"' + (entry && entry.category === 'slur' ? ' selected' : '') + '>slur</option>' +
          '<option value="general"' + (entry && entry.category === 'general' ? ' selected' : '') + '>general</option>' +
        '</select>' +
      '</div>' +
      '<div class="form-field">' +
        '<label>Suffix</label>' +
        '<label style="display:flex;align-items:center;gap:4px;font-size:12px;color:var(--text);padding:6px 0"><input type="checkbox" id="formSuffixable"' + (entry && entry.suffixable ? ' checked' : '') + '> Evet</label>' +
      '</div>' +
      '<div class="form-actions">' +
        '<button class="form-btn" id="formSave">' + (entry ? 'Güncelle' : 'Ekle') + '</button>' +
        '<button class="form-btn form-btn-cancel" id="formCancel">İptal</button>' +
      '</div>' +
    '</div>';

  document.getElementById('formCancel').addEventListener('click', () => { addEntryFormArea.innerHTML = ''; });
  document.getElementById('formSave').addEventListener('click', () => saveEntry(!!entry));
}

function showEditForm(root) {
  const entry = editorState.data.entries.find(e => e.root === root);
  if (entry) {
    editorState.editingRoot = root;
    showEntryForm(entry);
  }
}

async function saveEntry(isUpdate) {
  const root = document.getElementById('formRoot').value.trim();
  const variantsRaw = document.getElementById('formVariants').value.trim();
  const severity = document.getElementById('formSeverity').value;
  const category = document.getElementById('formCategory').value;
  const suffixable = document.getElementById('formSuffixable').checked;

  if (!root) return;
  const variants = variantsRaw ? variantsRaw.split(',').map(s => s.trim()).filter(Boolean) : [];

  const payload = { root, variants, severity, category, suffixable };
  const method = isUpdate ? 'PUT' : 'POST';

  try {
    const res = await fetch('/api/dictionary/' + editorState.lang + '/entry', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const data = await res.json();
    if (data.ok) {
      editorState.data = data.dictionary;
      editorState.changes = data.changes;
      addEntryFormArea.innerHTML = '';
      renderEditor();
      autoRetest();
    }
  } catch (err) {
    console.error('Save entry error:', err);
  }
}

async function deleteEntry(root) {
  try {
    const res = await fetch('/api/dictionary/' + editorState.lang + '/entry', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ root }),
    });
    const data = await res.json();
    if (data.ok) {
      editorState.data = data.dictionary;
      editorState.changes = data.changes;
      renderEditor();
      autoRetest();
    }
  } catch (err) {
    console.error('Delete entry error:', err);
  }
}

// ─── Whitelist Rendering ────────────────────
function renderWhitelist() {
  if (!editorState.data) return;
  const list = editorState.data.whitelist;
  whitelistCount.textContent = list.length;
  whitelistTags.innerHTML = '';
  for (const word of list) {
    const tag = document.createElement('span');
    tag.className = 'tag';
    tag.innerHTML = escapeHtml(word) + '<button class="tag-remove" data-word="' + escapeHtml(word) + '">×</button>';
    whitelistTags.appendChild(tag);
  }
  whitelistTags.querySelectorAll('.tag-remove').forEach(btn => {
    btn.addEventListener('click', () => removeWhitelist(btn.getAttribute('data-word')));
  });
}

document.getElementById('whitelistAddBtn').addEventListener('click', addWhitelist);
document.getElementById('whitelistInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') addWhitelist(); });

async function addWhitelist() {
  const input = document.getElementById('whitelistInput');
  const word = input.value.trim();
  if (!word) return;
  try {
    const res = await fetch('/api/dictionary/' + editorState.lang + '/whitelist', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ word }),
    });
    const data = await res.json();
    if (data.ok) {
      input.value = '';
      editorState.data = data.dictionary;
      editorState.changes = data.changes;
      renderEditor();
      autoRetest();
    }
  } catch (err) {
    console.error('Add whitelist error:', err);
  }
}

async function removeWhitelist(word) {
  try {
    const res = await fetch('/api/dictionary/' + editorState.lang + '/whitelist', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ word }),
    });
    const data = await res.json();
    if (data.ok) {
      editorState.data = data.dictionary;
      editorState.changes = data.changes;
      renderEditor();
      autoRetest();
    }
  } catch (err) {
    console.error('Remove whitelist error:', err);
  }
}

// ─── Suffixes Rendering ─────────────────────
function renderSuffixes() {
  if (!editorState.data) return;
  const list = editorState.data.suffixes;
  suffixesCount.textContent = list.length;
  suffixesTags.innerHTML = '';
  for (const sfx of list) {
    const tag = document.createElement('span');
    tag.className = 'tag';
    tag.innerHTML = escapeHtml(sfx) + '<button class="tag-remove" data-suffix="' + escapeHtml(sfx) + '">×</button>';
    suffixesTags.appendChild(tag);
  }
  suffixesTags.querySelectorAll('.tag-remove').forEach(btn => {
    btn.addEventListener('click', () => removeSuffix(btn.getAttribute('data-suffix')));
  });
}

document.getElementById('suffixAddBtn').addEventListener('click', addSuffix);
document.getElementById('suffixInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') addSuffix(); });

async function addSuffix() {
  const input = document.getElementById('suffixInput');
  const suffix = input.value.trim();
  if (!suffix) return;
  try {
    const res = await fetch('/api/dictionary/' + editorState.lang + '/suffix', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ suffix }),
    });
    const data = await res.json();
    if (data.ok) {
      input.value = '';
      editorState.data = data.dictionary;
      editorState.changes = data.changes;
      renderEditor();
    }
  } catch (err) {
    console.error('Add suffix error:', err);
  }
}

async function removeSuffix(suffix) {
  try {
    const res = await fetch('/api/dictionary/' + editorState.lang + '/suffix', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ suffix }),
    });
    const data = await res.json();
    if (data.ok) {
      editorState.data = data.dictionary;
      editorState.changes = data.changes;
      renderEditor();
    }
  } catch (err) {
    console.error('Remove suffix error:', err);
  }
}

// ─── Live Preview ───────────────────────────
document.getElementById('previewBtn').addEventListener('click', runPreview);
previewInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') runPreview(); });

async function runPreview() {
  const text = previewInput.value.trim();
  if (!text) return;
  editorState.lastTestInput = text;

  try {
    const res = await fetch('/api/dictionary/' + editorState.lang + '/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    const data = await res.json();
    renderPreviewResult(data);
  } catch (err) {
    previewResult.innerHTML = '<div class="preview-empty">Hata: ' + escapeHtml(err.message) + '</div>';
  }
}

function autoRetest() {
  if (editorState.lastTestInput) {
    runPreview();
  }
}

function renderPreviewResult(data) {
  let html = '<div class="preview-result">';

  if (data.hasProfanity) {
    html += '<div class="preview-badge preview-dirty">Küfür tespit edildi</div>';
  } else {
    html += '<div class="preview-badge preview-clean">Temiz</div>';
  }

  if (data.matches && data.matches.length > 0) {
    html += '<div class="preview-matches">';
    for (const m of data.matches) {
      html += '<div class="preview-match-item">' +
        '<span class="pm-label">Kelime:</span><span class="pm-value">' + escapeHtml(m.word) + '</span>' +
        '<span class="pm-label">Kök:</span><span class="pm-value">' + escapeHtml(m.root) + '</span>' +
        '<span class="pm-label">Seviye:</span><span class="pm-value severity-' + m.severity + '">' + m.severity + '</span>' +
        '<span class="pm-label">Kategori:</span><span class="pm-value">' + escapeHtml(m.category || '-') + '</span>' +
      '</div>';
    }
    html += '</div>';
  }

  if (data.cleaned && data.cleaned !== previewInput.value) {
    html += '<div class="preview-cleaned">Temizlenmiş: ' + escapeHtml(data.cleaned) + '</div>';
  }

  html += '</div>';
  previewResult.innerHTML = html;
}

// ─── Export & Reset ─────────────────────────
document.getElementById('exportBtn').addEventListener('click', () => {
  window.open('/api/dictionary/' + editorState.lang + '/export', '_blank');
});

document.getElementById('resetBtn').addEventListener('click', async () => {
  try {
    const res = await fetch('/api/dictionary/' + editorState.lang + '/reset', {
      method: 'POST',
    });
    const data = await res.json();
    if (data.ok) {
      editorState.data = data.dictionary;
      editorState.changes = data.changes;
      renderEditor();
      autoRetest();
    }
  } catch (err) {
    console.error('Reset error:', err);
  }
});

// ─── Language Switch ────────────────────────
editorLang.addEventListener('change', (e) => {
  loadDictionary(e.target.value);
});

// Initial load when switching to editor tab
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    if (btn.getAttribute('data-tab') === 'editor' && !editorState.data) {
      loadDictionary(editorState.lang);
    }
  });
});

// Normalize standalone test
document.getElementById('normalizeBtn').addEventListener('click', async () => {
  const text = chatInput.value.trim();
  if (!text) return;
  try {
    const res = await fetch('/api/normalize', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    const data = await res.json();

    // Show in process log
    const empty = processLog.querySelector('.empty-state');
    if (empty) empty.remove();

    const group = document.createElement('div');
    group.className = 'log-group';

    const header = document.createElement('div');
    header.className = 'log-group-header';
    header.innerHTML =
      '<span>normalize() — ' + new Date().toLocaleTimeString('tr-TR') + '</span>' +
      '<span>' + data.duration.toFixed(3) + 'ms</span>';
    group.appendChild(header);

    const entry = document.createElement('div');
    entry.className = 'log-entry type-transform';
    entry.innerHTML =
      '<div class="log-step">→</div>' +
      '<div class="log-content"><span class="log-label">normalize</span>' +
      '<span class="log-detail">"' + escapeHtml(data.input) + '" → "' + escapeHtml(data.normalized) + '"</span></div>' +
      '<div class="log-duration">' + data.duration.toFixed(3) + 'ms</div>';
    group.appendChild(entry);

    processLog.appendChild(group);
    processLog.scrollTop = processLog.scrollHeight;
  } catch (err) {
    addChatMessage('Hata: ' + err.message, 'system', 'has-profanity');
  }
});
</script>
</body>
</html>`;

// --- Server ---

const server = http.createServer((req, res) => {
  if (req.method === "GET" && (req.url === "/" || req.url === "/index.html")) {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(HTML);
    return;
  }

  if (req.method === "POST" && req.url === "/api/analyze") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      try {
        const payload: AnalyzeRequest = JSON.parse(body);
        const result = analyze(payload);
        res.writeHead(200, {
          "Content-Type": "application/json; charset=utf-8",
          "Access-Control-Allow-Origin": "*",
        });
        res.end(JSON.stringify(result));
      } catch (err) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: String(err) }));
      }
    });
    return;
  }

  if (req.method === "POST" && req.url === "/api/normalize") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      try {
        const { text } = JSON.parse(body);
        const start = performance.now();
        const result = normalize(text ?? "");
        const duration = performance.now() - start;
        res.writeHead(200, {
          "Content-Type": "application/json; charset=utf-8",
          "Access-Control-Allow-Origin": "*",
        });
        res.end(JSON.stringify({ input: text, normalized: result, duration }));
      } catch (err) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: String(err) }));
      }
    });
    return;
  }

  // ────────────────────────────────────────────
  // Dictionary Editor API
  // ────────────────────────────────────────────
  const dictMatch = (req.url || "").match(/^\/api\/dictionary\/([a-z]{2})(?:\/(.+))?$/);
  if (dictMatch) {
    const lang = dictMatch[1];
    const action = dictMatch[2]; // entry, whitelist, suffix, export, test, reset or undefined

    if (!SUPPORTED_LANGUAGES.includes(lang)) {
      res.writeHead(400, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ error: "Unsupported language: " + lang }));
      return;
    }

    const jsonHeaders = {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": "*",
    };

    // GET /api/dictionary/:lang — return full dictionary data
    if (req.method === "GET" && !action) {
      const dict = dictionaryStore.get(lang)!;
      res.writeHead(200, jsonHeaders);
      res.end(JSON.stringify({ dictionary: dict, changes: changeCounters.get(lang) || 0 }));
      return;
    }

    // GET /api/dictionary/:lang/export — download as JSON file
    if (req.method === "GET" && action === "export") {
      const dict = dictionaryStore.get(lang)!;
      res.writeHead(200, {
        "Content-Type": "application/json; charset=utf-8",
        "Content-Disposition": `attachment; filename="dictionary-${lang}.json"`,
        "Access-Control-Allow-Origin": "*",
      });
      res.end(JSON.stringify(dict, null, 2));
      return;
    }

    // All remaining routes need body parsing
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      try {
        const payload = body ? JSON.parse(body) : {};
        const dict = dictionaryStore.get(lang)!;

        // POST /api/dictionary/:lang/entry — add new entry
        if (req.method === "POST" && action === "entry") {
          const { root, variants, severity, category, suffixable } = payload;
          if (!root) {
            res.writeHead(400, jsonHeaders);
            res.end(JSON.stringify({ error: "root is required" }));
            return;
          }
          const existing = dict.entries.findIndex((e: DictEntry) => e.root === root);
          if (existing !== -1) {
            res.writeHead(409, jsonHeaders);
            res.end(JSON.stringify({ error: "Entry already exists: " + root }));
            return;
          }
          dict.entries.push({
            root,
            variants: variants || [],
            severity: severity || "medium",
            category: category || "general",
            suffixable: !!suffixable,
          });
          incrementChanges(lang);
          invalidateCacheForLang(lang);
          res.writeHead(200, jsonHeaders);
          res.end(JSON.stringify({ ok: true, dictionary: dict, changes: changeCounters.get(lang) }));
          return;
        }

        // PUT /api/dictionary/:lang/entry — update existing entry
        if (req.method === "PUT" && action === "entry") {
          const { root, variants, severity, category, suffixable } = payload;
          if (!root) {
            res.writeHead(400, jsonHeaders);
            res.end(JSON.stringify({ error: "root is required" }));
            return;
          }
          const idx = dict.entries.findIndex((e: DictEntry) => e.root === root);
          if (idx === -1) {
            res.writeHead(404, jsonHeaders);
            res.end(JSON.stringify({ error: "Entry not found: " + root }));
            return;
          }
          if (variants !== undefined) dict.entries[idx].variants = variants;
          if (severity !== undefined) dict.entries[idx].severity = severity;
          if (category !== undefined) dict.entries[idx].category = category;
          if (suffixable !== undefined) dict.entries[idx].suffixable = !!suffixable;
          incrementChanges(lang);
          invalidateCacheForLang(lang);
          res.writeHead(200, jsonHeaders);
          res.end(JSON.stringify({ ok: true, dictionary: dict, changes: changeCounters.get(lang) }));
          return;
        }

        // DELETE /api/dictionary/:lang/entry — delete entry
        if (req.method === "DELETE" && action === "entry") {
          const { root } = payload;
          if (!root) {
            res.writeHead(400, jsonHeaders);
            res.end(JSON.stringify({ error: "root is required" }));
            return;
          }
          const idx = dict.entries.findIndex((e: DictEntry) => e.root === root);
          if (idx === -1) {
            res.writeHead(404, jsonHeaders);
            res.end(JSON.stringify({ error: "Entry not found: " + root }));
            return;
          }
          dict.entries.splice(idx, 1);
          incrementChanges(lang);
          invalidateCacheForLang(lang);
          res.writeHead(200, jsonHeaders);
          res.end(JSON.stringify({ ok: true, dictionary: dict, changes: changeCounters.get(lang) }));
          return;
        }

        // POST /api/dictionary/:lang/whitelist — add to whitelist
        if (req.method === "POST" && action === "whitelist") {
          const { word } = payload;
          if (!word) {
            res.writeHead(400, jsonHeaders);
            res.end(JSON.stringify({ error: "word is required" }));
            return;
          }
          if (!dict.whitelist.includes(word)) {
            dict.whitelist.push(word);
            dict.whitelist.sort();
            incrementChanges(lang);
            invalidateCacheForLang(lang);
          }
          res.writeHead(200, jsonHeaders);
          res.end(JSON.stringify({ ok: true, dictionary: dict, changes: changeCounters.get(lang) }));
          return;
        }

        // DELETE /api/dictionary/:lang/whitelist — remove from whitelist
        if (req.method === "DELETE" && action === "whitelist") {
          const { word } = payload;
          if (!word) {
            res.writeHead(400, jsonHeaders);
            res.end(JSON.stringify({ error: "word is required" }));
            return;
          }
          const idx = dict.whitelist.indexOf(word);
          if (idx !== -1) {
            dict.whitelist.splice(idx, 1);
            incrementChanges(lang);
            invalidateCacheForLang(lang);
          }
          res.writeHead(200, jsonHeaders);
          res.end(JSON.stringify({ ok: true, dictionary: dict, changes: changeCounters.get(lang) }));
          return;
        }

        // POST /api/dictionary/:lang/suffix — add suffix
        if (req.method === "POST" && action === "suffix") {
          const { suffix } = payload;
          if (!suffix) {
            res.writeHead(400, jsonHeaders);
            res.end(JSON.stringify({ error: "suffix is required" }));
            return;
          }
          if (!dict.suffixes.includes(suffix)) {
            dict.suffixes.push(suffix);
            dict.suffixes.sort();
            incrementChanges(lang);
            invalidateCacheForLang(lang);
          }
          res.writeHead(200, jsonHeaders);
          res.end(JSON.stringify({ ok: true, dictionary: dict, changes: changeCounters.get(lang) }));
          return;
        }

        // DELETE /api/dictionary/:lang/suffix — remove suffix
        if (req.method === "DELETE" && action === "suffix") {
          const { suffix } = payload;
          if (!suffix) {
            res.writeHead(400, jsonHeaders);
            res.end(JSON.stringify({ error: "suffix is required" }));
            return;
          }
          const idx = dict.suffixes.indexOf(suffix);
          if (idx !== -1) {
            dict.suffixes.splice(idx, 1);
            incrementChanges(lang);
            invalidateCacheForLang(lang);
          }
          res.writeHead(200, jsonHeaders);
          res.end(JSON.stringify({ ok: true, dictionary: dict, changes: changeCounters.get(lang) }));
          return;
        }

        // POST /api/dictionary/:lang/test — test text with edited dictionary
        if (req.method === "POST" && action === "test") {
          const { text } = payload;
          if (!text) {
            res.writeHead(400, jsonHeaders);
            res.end(JSON.stringify({ error: "text is required" }));
            return;
          }
          const result = testWithEditedDictionary(text, lang);
          res.writeHead(200, jsonHeaders);
          res.end(JSON.stringify(result));
          return;
        }

        // POST /api/dictionary/:lang/reset — reset to original
        if (req.method === "POST" && action === "reset") {
          const original = originalDictionaries.get(lang)!;
          dictionaryStore.set(lang, structuredClone(original));
          changeCounters.set(lang, 0);
          invalidateCacheForLang(lang);
          res.writeHead(200, jsonHeaders);
          res.end(JSON.stringify({ ok: true, dictionary: dictionaryStore.get(lang), changes: 0 }));
          return;
        }

        res.writeHead(404, jsonHeaders);
        res.end(JSON.stringify({ error: "Unknown action: " + action }));
      } catch (err) {
        res.writeHead(400, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ error: String(err) }));
      }
    });
    return;
  }

  // CORS preflight
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, GET, PUT, DELETE, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    res.end();
    return;
  }

  res.writeHead(404);
  res.end("Not found");
});

console.log("");
console.log(`  [3/3] HTTP sunucusu başlatılıyor (port ${PORT})...`);

server.listen(PORT, () => {
  console.log("");
  console.log("  ┌──────────────────────────────────────────────┐");
  console.log("  │                                              │");
  console.log("  │   terlik.js — Canlı Test Sunucusu            │");
  console.log("  │                                              │");
  console.log(`  │   http://localhost:${PORT}                      │`);
  console.log("  │                                              │");
  console.log("  │   Kaynak: src/ (build gereksiz)              │");
  console.log("  │   Warmup: arka planda (ilk istekte hazır)    │");
  console.log("  │   Çıkmak için: Ctrl+C                       │");
  console.log("  │                                              │");
  console.log("  └──────────────────────────────────────────────┘");
  console.log("");

  // Background warmup: compile patterns + JIT warm for each language.
  // Server is already accepting requests — first request to an un-warmed
  // language will trigger synchronous compilation (~15s for first language).
  const warmupStart = performance.now();
  let warmedCount = 0;
  const warmupNext = () => {
    if (warmedCount >= SUPPORTED_LANGUAGES.length) {
      warmupDuration = performance.now() - warmupStart;
      warmupDone = true;
      console.log(`  ✔ Warmup tamamlandı: ${SUPPORTED_LANGUAGES.length} dil, ${warmupDuration.toFixed(0)}ms`);
      return;
    }
    const lang = SUPPORTED_LANGUAGES[warmedCount];
    const langStart = performance.now();
    const instance = new Terlik({ language: lang });
    // Trigger pattern compilation + V8 JIT
    instance.containsProfanity("warmup");
    instance.containsProfanity("s.i.k.t.i.r");
    instance.containsProfanity("$1kt1r amsterdam sikke");
    const key = buildCacheKey(lang, "balanced", "stars", false, 0.8, "levenshtein", "[***]");
    terlikCache.set(key, instance);
    console.log(`    warmup ${lang}: ${(performance.now() - langStart).toFixed(0)}ms`);
    warmedCount++;
    // Yield to event loop between languages so requests aren't blocked
    setTimeout(warmupNext, 0);
  };
  setTimeout(warmupNext, 0);
});
