# Contributing to terlik.js

Thanks for your interest in contributing! Whether you're adding a single word, reporting a false positive, or building a new language pack — every contribution helps.

## Quick Setup

```bash
git clone https://github.com/badursun/terlik.js.git
cd terlik.js
pnpm install
```

## Development Workflow

```bash
pnpm test             # run tests
pnpm test:watch       # run tests in watch mode
pnpm test:coverage    # run tests with coverage report
pnpm typecheck        # TypeScript type checking
pnpm build            # build ESM + CJS output
pnpm dev:live         # start interactive test server at http://localhost:2026
```

Pre-commit hooks run automatically via Husky to ensure code quality.

## How to Add a Word

The most common contribution. No TypeScript knowledge needed — just edit a JSON file.

### 1. Find the right dictionary

```
src/lang/tr/dictionary.json   ← Turkish
src/lang/en/dictionary.json   ← English
src/lang/es/dictionary.json   ← Spanish
src/lang/de/dictionary.json   ← German
```

### 2. Add your entry to the `entries` array

```json
{
  "root": "newword",
  "variants": ["n3ww0rd", "neww0rd"],
  "severity": "high",
  "category": "insult",
  "suffixable": true
}
```

**Fields:**
- `root` — The base form of the word (lowercase)
- `variants` — Alternative spellings the normalizer might not catch (leet speak, phonetic, etc.)
- `severity` — `"high"` (strongest), `"medium"` (moderate), `"low"` (mild)
- `category` — `"sexual"`, `"insult"`, `"slur"`, `"general"`
- `suffixable` — Set to `true` if the word takes grammatical suffixes (e.g., `newwordler`, `newwording`). Keep `false` for very short roots (3 chars) to avoid false positives — use explicit variants instead.

### 3. Add whitelist entries if needed

If your new root could cause false positives on legitimate words, add them to the `whitelist` array:

```json
"whitelist": ["existingword", "yournewsafeword"]
```

### 4. Add a test

Add a test in the language test file (e.g., `tests/profanity.test.ts` for Turkish, `tests/lang/en.test.ts` for English):

```ts
it("detects newword", () => {
  expect(terlik.containsProfanity("newword")).toBe(true);
});
```

### 5. Verify

```bash
pnpm test       # all tests pass
pnpm typecheck  # no type errors
pnpm build      # builds successfully
```

## How to Report False Positives / False Negatives

Open an issue with:

- **False positive** (safe word flagged): Include the word, the language, and why it's legitimate.
- **False negative** (profane word missed): Include the word (or a sanitized version), evasion technique used, and the language.

If you can, include a fix as a PR — it's the fastest path to resolution.

## How to Add a New Language

1. Create `src/lang/xx/` folder (where `xx` is the BCP-47 language code)

2. Add `dictionary.json`:
   ```json
   {
     "version": 1,
     "suffixes": ["ing", "ed", "s"],
     "entries": [
       {
         "root": "word",
         "variants": ["w0rd"],
         "severity": "high",
         "category": "general",
         "suffixable": true
       }
     ],
     "whitelist": ["safeword"]
   }
   ```

3. Add `config.ts`:
   ```ts
   import type { LanguageConfig } from "../types.js";
   import dictionary from "./dictionary.json";
   import { validateDictionary } from "../../dictionary/schema.js";

   const data = validateDictionary(dictionary);

   export const config: LanguageConfig = {
     locale: "xx",
     dictionary: data,
     charMap: {
       // language-specific character mappings (e.g., ñ → n, ß → ss)
     },
     leetMap: {
       "0": "o", "1": "i", "3": "e", "4": "a", "5": "s",
       "7": "t", "@": "a", "$": "s", "!": "i",
     },
     charClasses: {
       // character classes for regex pattern generation
     },
   };
   ```

4. Register in `src/lang/index.ts` — add one import and one registry line.

5. Add tests in `tests/lang/xx.test.ts`.

6. Verify:
   ```bash
   pnpm test && pnpm typecheck && pnpm build
   ```

## Commit Message Conventions

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(tr): add new root word "example"
fix(en): false positive on "grasshopper"
feat(lang): add Portuguese language pack
test: add edge case tests for suffix engine
docs: update README with new API example
perf: optimize pattern compilation
```

Common prefixes: `feat`, `fix`, `test`, `docs`, `perf`, `chore`, `refactor`.

Include the language scope when the change is language-specific (e.g., `feat(tr):`, `fix(en):`).

## Pull Request Process

1. Fork the repository and create a feature branch from `main`
2. Make your changes with tests
3. Ensure all checks pass:
   ```bash
   pnpm test       # all tests pass
   pnpm typecheck  # clean
   pnpm build      # ESM + CJS + DTS clean
   ```
4. Submit a PR with a clear description (the PR template will guide you)
5. Respond to review feedback

## Dictionary Guidelines

- **Severity levels**: `high` (strongest profanity), `medium` (moderate), `low` (mild)
- **Categories**: `sexual`, `insult`, `slur`, `general`
- **Suffixable**: Set to `true` for words that commonly take grammatical suffixes. Keep `false` for very short roots (3 chars) to avoid false positives — use explicit variants instead.
- **Whitelist**: Add legitimate words that might be false positives (e.g., "assassin" contains "ass")
- **Precision over recall**: When in doubt, leave it out. False positives are worse than false negatives in production chat systems.

## Code Style

- TypeScript strict mode is enforced
- Keep functions focused and small
- Add JSDoc to all public exports
- Write tests for new functionality
- No runtime dependencies
