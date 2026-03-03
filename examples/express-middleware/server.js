const express = require("express");
const { Terlik } = require("terlik.js");

const app = express();
app.use(express.json());

// Pre-warm all supported languages at startup
const instances = Terlik.warmup(["tr", "en", "es", "de"]);

/**
 * Pick Terlik instance from ?lang= query param.
 * Defaults to Turkish ("tr") if not specified or unsupported.
 */
function getInstance(req) {
  const lang = req.query.lang || "tr";
  return instances.get(lang) || instances.get("tr");
}

// ── POST /api/check ─────────────────────────────────────────────
// Returns whether the message contains profanity.
app.post("/api/check", (req, res) => {
  const { message } = req.body;
  if (typeof message !== "string") {
    return res.status(400).json({ error: "\"message\" field is required (string)" });
  }

  const terlik = getInstance(req);
  const hasProfanity = terlik.containsProfanity(message);

  res.json({ message, hasProfanity });
});

// ── POST /api/clean ─────────────────────────────────────────────
// Returns the message with profanity masked.
app.post("/api/clean", (req, res) => {
  const { message } = req.body;
  if (typeof message !== "string") {
    return res.status(400).json({ error: "\"message\" field is required (string)" });
  }

  const terlik = getInstance(req);
  const cleaned = terlik.clean(message);

  res.json({ original: message, cleaned });
});

// ── POST /api/moderate ──────────────────────────────────────────
// Returns detailed match info (root word, severity, category).
app.post("/api/moderate", (req, res) => {
  const { message } = req.body;
  if (typeof message !== "string") {
    return res.status(400).json({ error: "\"message\" field is required (string)" });
  }

  const terlik = getInstance(req);
  const matches = terlik.getMatches(message);

  res.json({
    message,
    hasProfanity: matches.length > 0,
    matchCount: matches.length,
    matches: matches.map((m) => ({
      word: m.word,
      root: m.root,
      index: m.index,
      severity: m.severity,
      category: m.category,
      method: m.method,
    })),
  });
});

// ── Error handler ───────────────────────────────────────────────
app.use((err, _req, res, _next) => {
  console.error(err.stack);
  res.status(500).json({ error: "Internal server error" });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`terlik.js express example running on http://localhost:${PORT}`);
  console.log("Endpoints:");
  console.log("  POST /api/check    — detect profanity");
  console.log("  POST /api/clean    — mask profanity");
  console.log("  POST /api/moderate — detailed match info");
  console.log("Use ?lang=en|es|de to switch language (default: tr)");
});
