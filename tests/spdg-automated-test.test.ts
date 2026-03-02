import { describe, it, expect, beforeAll } from "vitest";
import { Terlik } from "../src/terlik.js";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

// ──────────────────────────────────────────────
// SPDG Automated Tests
// Synthetic Profanity Dataset Generator çıktılarını
// terlik.js detection motoruna karşı test eder.
// JSONL yoksa ilgili dil bloğu sessizce atlanır.
// ──────────────────────────────────────────────

interface SpdgEntry {
  text: string;
  label: number; // 1 = profanity, 0 = clean
  root: string;
  difficulty: string;
  transforms: string[];
  category: string;
}

const SPDG_OUTPUT_DIR = resolve(
  __dirname,
  "../tools/Synthetic-Profanity-Dataset-Generator/output",
);

const LANGUAGES = ["tr", "en", "es", "de"] as const;
type Lang = (typeof LANGUAGES)[number];

// Pozitif detection rate threshold'ları (difficulty bazında)
const POSITIVE_THRESHOLDS: Record<string, number | null> = {
  easy: 85,
  medium: 55,
  hard: 40,
  extreme: null, // sadece rapor, fail etmez
};

// Negatif false positive üst sınırı (%)
const FALSE_POSITIVE_LIMIT = 5;

function jsonlPath(lang: Lang): string {
  return resolve(SPDG_OUTPUT_DIR, `export-${lang}.jsonl`);
}

function parseJsonl(filePath: string): SpdgEntry[] {
  const raw = readFileSync(filePath, "utf-8");
  return raw
    .split("\n")
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as SpdgEntry);
}

// ──────────────────────────────────────────────
// Her dil için koşullu test bloğu
// ──────────────────────────────────────────────

describe("SPDG Automated Tests", () => {
  for (const lang of LANGUAGES) {
    const filePath = jsonlPath(lang);
    const exists = existsSync(filePath);

    describe.skipIf(!exists)(`${lang.toUpperCase()}`, () => {
      let entries: SpdgEntry[];
      let terlik: Terlik;
      let positives: SpdgEntry[];
      let negatives: SpdgEntry[];
      let byDifficulty: Map<string, SpdgEntry[]>;

      beforeAll(() => {
        entries = parseJsonl(filePath);
        terlik = new Terlik({ language: lang });
        positives = entries.filter((e) => e.label === 1);
        negatives = entries.filter((e) => e.label === 0);

        byDifficulty = new Map<string, SpdgEntry[]>();
        for (const entry of positives) {
          const diff = entry.difficulty;
          if (!byDifficulty.has(diff)) byDifficulty.set(diff, []);
          byDifficulty.get(diff)!.push(entry);
        }
      });

      it("pozitif örnekler profanity olarak algılanmalı (difficulty threshold)", () => {
        const report: string[] = [];

        for (const [difficulty, group] of byDifficulty) {
          let detected = 0;
          for (const entry of group) {
            if (terlik.containsProfanity(entry.text)) detected++;
          }
          const rate = (detected / group.length) * 100;
          const threshold = POSITIVE_THRESHOLDS[difficulty] ?? null;

          report.push(
            `  [${lang.toUpperCase()}] ${difficulty}: ${detected}/${group.length} (${rate.toFixed(1)}%)` +
              (threshold !== null ? ` — min ${threshold}%` : " — rapor only"),
          );

          if (threshold !== null) {
            expect(
              rate,
              `[${lang.toUpperCase()}] ${difficulty} detection rate ${rate.toFixed(1)}% < threshold ${threshold}%`,
            ).toBeGreaterThanOrEqual(threshold);
          }
        }

        console.log(`\n📊 SPDG Pozitif Detection [${lang.toUpperCase()}]:\n${report.join("\n")}`);
      });

      it(`negatif örnekler clean olarak algılanmalı (<${FALSE_POSITIVE_LIMIT}% false positive)`, () => {
        if (negatives.length === 0) return;

        let falsePositives = 0;
        const fpExamples: string[] = [];

        for (const entry of negatives) {
          if (terlik.containsProfanity(entry.text)) {
            falsePositives++;
            if (fpExamples.length < 10) {
              fpExamples.push(`"${entry.text}" (root: ${entry.root})`);
            }
          }
        }

        const fpRate = (falsePositives / negatives.length) * 100;

        console.log(
          `\n📊 SPDG Negatif FP [${lang.toUpperCase()}]: ${falsePositives}/${negatives.length} (${fpRate.toFixed(1)}%)`,
        );
        if (fpExamples.length > 0) {
          console.log(`   Örnek FP'ler: ${fpExamples.join(", ")}`);
        }

        expect(
          fpRate,
          `[${lang.toUpperCase()}] False positive rate ${fpRate.toFixed(1)}% >= ${FALSE_POSITIVE_LIMIT}%`,
        ).toBeLessThan(FALSE_POSITIVE_LIMIT);
      });
    });
  }
});
