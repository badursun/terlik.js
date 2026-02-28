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

// Warmup: Sunucu ayağa kalkarken tüm yaygın konfigürasyonları önceden oluştur
const terlikCache = new Map<string, Terlik>();

const WARMUP_CONFIGS: Array<{ mode: Mode; maskStyle: MaskStyle; enableFuzzy: boolean }> = [
  { mode: "strict", maskStyle: "stars", enableFuzzy: false },
  { mode: "balanced", maskStyle: "stars", enableFuzzy: false },
  { mode: "balanced", maskStyle: "partial", enableFuzzy: false },
  { mode: "balanced", maskStyle: "replace", enableFuzzy: false },
  { mode: "loose", maskStyle: "stars", enableFuzzy: true },
];

function buildCacheKey(language: string, mode: string, maskStyle: string, enableFuzzy: boolean, fuzzyThreshold: number, fuzzyAlgorithm: string, replaceMask: string, customWords?: string[], whitelist?: string[]): string {
  const cw = (customWords ?? []).sort().join(",");
  const wl = (whitelist ?? []).sort().join(",");
  return `${language}|${mode}|${maskStyle}|${enableFuzzy}|${fuzzyThreshold}|${fuzzyAlgorithm}|${replaceMask}|${cw}|${wl}`;
}

// Warmup sample texts to trigger V8 JIT compilation on regex patterns
const WARMUP_TEXTS = [
  "merhaba dünya nasılsın",
  "siktir git burdan",
  "s.i.k.t.i.r lan",
  "$1kt1r",
  "amsterdam sikke bokser malzeme",
];

const SUPPORTED_LANGUAGES = getSupportedLanguages();

const warmupStart = performance.now();
for (const lang of SUPPORTED_LANGUAGES) {
  for (const cfg of WARMUP_CONFIGS) {
    const key = buildCacheKey(lang, cfg.mode, cfg.maskStyle, cfg.enableFuzzy, 0.8, "levenshtein", "[***]");
    const instance = new Terlik({
      language: lang,
      mode: cfg.mode,
      maskStyle: cfg.maskStyle,
      enableFuzzy: cfg.enableFuzzy,
      fuzzyThreshold: 0.8,
      fuzzyAlgorithm: "levenshtein",
      replaceMask: "[***]",
    });
    terlikCache.set(key, instance);

    // JIT warmup: run actual detection so V8 compiles the regex patterns
    for (const text of WARMUP_TEXTS) {
      instance.containsProfanity(text);
    }
  }
}
const warmupDuration = performance.now() - warmupStart;

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
    grid-template-rows: auto 1fr;
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
      grid-template-rows: auto 1fr 1fr;
    }
    .chat-panel { border-right: none; border-bottom: 1px solid var(--border); }
  }
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

  // CORS preflight
  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    res.end();
    return;
  }

  res.writeHead(404);
  res.end("Not found");
});

server.listen(PORT, () => {
  console.log("");
  console.log("  ┌──────────────────────────────────────────────┐");
  console.log("  │                                              │");
  console.log("  │   terlik.js — Canlı Test Sunucusu            │");
  console.log("  │                                              │");
  console.log(`  │   http://localhost:${PORT}                      │`);
  console.log("  │                                              │");
  console.log("  │   Kaynak: src/ (build gereksiz)              │");
  console.log(`  │   Warmup: ${warmupDuration.toFixed(1)}ms (${SUPPORTED_LANGUAGES.length} lang × ${WARMUP_CONFIGS.length} cfg) │`);
  console.log("  │   Çıkmak için: Ctrl+C                       │");
  console.log("  │                                              │");
  console.log("  └──────────────────────────────────────────────┘");
  console.log("");
});
