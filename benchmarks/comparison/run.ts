import { writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createTerlikAdapter,
  createBadWordsAdapter,
  createObscenityAdapter,
  createAllProfanityAdapter,
  type LibraryAdapter,
} from "./adapters.js";
import { dataset, throughputCorpus } from "./dataset.js";
import { runAccuracy, type AccuracyResult } from "./accuracy.js";
import { runThroughput, type ThroughputResult } from "./throughput.js";
import { runMemory, type MemoryResult } from "./memory.js";
import { generateReport } from "./generate-report.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── Table helpers ───────────────────────────────────────────────────

function pad(s: string, len: number, align: "left" | "right" = "left"): string {
  return align === "right" ? s.padStart(len) : s.padEnd(len);
}

function pct(n: number): string {
  return (n * 100).toFixed(1) + "%";
}

function num(n: number): string {
  return n.toLocaleString("en-US");
}

function printTable(headers: string[], rows: string[][], colAlign?: ("left" | "right")[]): void {
  const widths = headers.map((h, i) =>
    Math.max(h.length, ...rows.map((r) => (r[i] ?? "").length)),
  );
  const align = colAlign ?? headers.map(() => "left");

  const sep = "+" + widths.map((w) => "-".repeat(w + 2)).join("+") + "+";
  const headerRow = "|" + headers.map((h, i) => " " + pad(h, widths[i], align[i]) + " ").join("|") + "|";

  console.log(sep);
  console.log(headerRow);
  console.log(sep);
  for (const row of rows) {
    const line = "|" + row.map((c, i) => " " + pad(c ?? "", widths[i], align[i]) + " ").join("|") + "|";
    console.log(line);
  }
  console.log(sep);
}

// ─── Adapter factories ──────────────────────────────────────────────

const factories: Array<{ name: string; create: () => LibraryAdapter }> = [
  { name: "terlik.js", create: createTerlikAdapter },
  { name: "bad-words", create: createBadWordsAdapter },
  { name: "obscenity", create: createObscenityAdapter },
  { name: "allprofanity", create: createAllProfanityAdapter },
];

// ─── Main ────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log("=".repeat(70));
  console.log("  PROFANITY LIBRARY COMPARISON BENCHMARK");
  console.log("  Dataset: " + dataset.length + " English samples");
  console.log("=".repeat(70));
  console.log();

  // Initialize all adapters
  const adapters: LibraryAdapter[] = [];
  for (const f of factories) {
    try {
      const adapter = f.create();
      await adapter.init();
      adapters.push(adapter);
      console.log(`  [OK] ${adapter.name} v${adapter.version}`);
    } catch (err: any) {
      console.log(`  [SKIP] ${f.name}: ${err.message}`);
    }
  }
  console.log();

  // ── 1. Accuracy ──────────────────────────────────────────────────
  console.log("─".repeat(70));
  console.log("  1. ACCURACY (Precision / Recall / F1 / FPR)");
  console.log("─".repeat(70));
  console.log();

  const accuracyResults: AccuracyResult[] = [];
  for (const adapter of adapters) {
    const result = runAccuracy(adapter, dataset);
    accuracyResults.push(result);
  }

  printTable(
    ["Library", "Precision", "Recall", "F1", "FPR", "Accuracy"],
    accuracyResults.map((r) => [
      r.library,
      pct(r.precision),
      pct(r.recall),
      pct(r.f1),
      pct(r.fpr),
      pct(r.accuracy),
    ]),
    ["left", "right", "right", "right", "right", "right"],
  );
  console.log();

  // Category breakdown
  const categories = [...new Set(dataset.map((s) => s.category))];
  console.log("  Category Breakdown (detection rate):");
  printTable(
    ["Category", ...adapters.map((a) => a.name)],
    categories.map((cat) => [
      cat,
      ...accuracyResults.map((r) => {
        const cb = r.categoryBreakdown[cat];
        return cb ? pct(cb.rate) : "N/A";
      }),
    ]),
    ["left", ...adapters.map(() => "right" as const)],
  );
  console.log();

  // Error summary
  for (const r of accuracyResults) {
    if (r.errors.length > 0) {
      const fpErrors = r.errors.filter((e) => e.got && !e.expected);
      const fnErrors = r.errors.filter((e) => !e.got && e.expected);
      console.log(`  ${r.library}: ${r.errors.length} errors (${fpErrors.length} FP, ${fnErrors.length} FN)`);
      if (fpErrors.length > 0) {
        console.log(`    False Positives:`);
        for (const e of fpErrors.slice(0, 5)) {
          console.log(`      - [${e.category}] "${e.text}"`);
        }
        if (fpErrors.length > 5) console.log(`      ... and ${fpErrors.length - 5} more`);
      }
      if (fnErrors.length > 0) {
        console.log(`    False Negatives:`);
        for (const e of fnErrors.slice(0, 5)) {
          console.log(`      - [${e.category}] "${e.text}"`);
        }
        if (fnErrors.length > 5) console.log(`      ... and ${fnErrors.length - 5} more`);
      }
      console.log();
    }
  }

  // ── 2. Throughput ────────────────────────────────────────────────
  console.log("─".repeat(70));
  console.log("  2. THROUGHPUT (ops/sec, latency in μs per batch)");
  console.log("─".repeat(70));
  console.log();

  const throughputResults: ThroughputResult[] = [];
  for (const adapter of adapters) {
    process.stdout.write(`  Measuring ${adapter.name}...`);
    const result = runThroughput(adapter, throughputCorpus);
    throughputResults.push(result);
    console.log(" done");
  }
  console.log();

  console.log("  check() performance:");
  printTable(
    ["Library", "ops/sec", "avg μs", "p50 μs", "p95 μs", "p99 μs"],
    throughputResults.map((r) => [
      r.library,
      num(r.check.opsPerSec),
      num(r.check.latency.avg),
      num(r.check.latency.p50),
      num(r.check.latency.p95),
      num(r.check.latency.p99),
    ]),
    ["left", "right", "right", "right", "right", "right"],
  );
  console.log();

  console.log("  clean() performance:");
  printTable(
    ["Library", "ops/sec", "avg μs", "p50 μs", "p95 μs", "p99 μs"],
    throughputResults.map((r) => [
      r.library,
      num(r.clean.opsPerSec),
      num(r.clean.latency.avg),
      num(r.clean.latency.p50),
      num(r.clean.latency.p95),
      num(r.clean.latency.p99),
    ]),
    ["left", "right", "right", "right", "right", "right"],
  );
  console.log();

  // ── 3. Memory ────────────────────────────────────────────────────
  console.log("─".repeat(70));
  console.log("  3. MEMORY USAGE (KB delta)");
  if (typeof global.gc !== "function") {
    console.log("  (Run with --expose-gc for accurate results)");
  }
  console.log("─".repeat(70));
  console.log();

  const memoryResults: MemoryResult[] = [];
  for (const f of factories) {
    try {
      process.stdout.write(`  Measuring ${f.name}...`);
      const result = await runMemory(f.create, throughputCorpus);
      memoryResults.push(result);
      console.log(" done");
    } catch (err: any) {
      console.log(` skipped (${err.message})`);
    }
  }
  console.log();

  printTable(
    ["Library", "Init Heap KB", "Init RSS KB", "Load Heap KB", "Load RSS KB"],
    memoryResults.map((r) => [
      r.library,
      num(r.init.heapKB),
      num(r.init.rssKB),
      num(r.load.heapKB),
      num(r.load.rssKB),
    ]),
    ["left", "right", "right", "right", "right"],
  );
  console.log();

  // ── Save JSON ────────────────────────────────────────────────────
  const resultsDir = join(__dirname, "results");
  mkdirSync(resultsDir, { recursive: true });

  const output = {
    timestamp: new Date().toISOString(),
    node: process.version,
    platform: process.platform,
    arch: process.arch,
    dataset: { total: dataset.length },
    accuracy: accuracyResults,
    throughput: throughputResults,
    memory: memoryResults,
  };

  const outPath = join(resultsDir, "comparison-results.json");
  writeFileSync(outPath, JSON.stringify(output, null, 2));
  console.log(`Results saved to ${outPath}`);
  console.log();

  // Generate markdown report
  generateReport(output);
  console.log();
  console.log("=".repeat(70));
  console.log("  BENCHMARK COMPLETE");
  console.log("=".repeat(70));
}

main().catch((err) => {
  console.error("Benchmark failed:", err);
  process.exit(1);
});
