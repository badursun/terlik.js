// Runs terlik.js off the main thread so the first (lazy) regex compilation
// never freezes the page animations.
import { Terlik, createNormalizer, getLanguageConfig } from "./terlik.min.mjs";

const instances = new Map();
const normalizers = new Map();

function get(lang) {
  if (!instances.has(lang)) {
    instances.set(lang, new Terlik({ language: lang }));
    normalizers.set(lang, createNormalizer(getLanguageConfig(lang)));
  }
  return instances.get(lang);
}

self.onmessage = ({ data }) => {
  const { id, type, text = "", lang = "tr", mode = "balanced", maskStyle = "stars" } = data;
  try {
    if (type === "warmup") {
      const t0 = performance.now();
      const t = get(lang);
      // exercise every path the page uses so the first real call is already JIT-hot
      const sample = "w4rmup s.a.m.p.l.e teeeext $0me th1ng";
      for (const mode of ["balanced", "strict", "loose"]) {
        t.getMatches(sample, { mode });
        t.clean(sample, { mode });
      }
      self.postMessage({ id, type, lang, ms: performance.now() - t0 });
      return;
    }
    const cold = !instances.has(lang);
    const t = get(lang);
    const t0 = performance.now();
    const matches = t.getMatches(text, { mode });
    const cleaned = t.clean(text, { mode, maskStyle });
    const ms = performance.now() - t0;
    const normalized = normalizers.get(lang)(text);
    self.postMessage({ id, type, lang, cleaned, matches, normalized, ms, cold });
  } catch (err) {
    self.postMessage({ id, type, error: String(err && err.message || err) });
  }
};
