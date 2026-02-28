# Contributing to terlik.js

Thanks for your interest in contributing! Here's how to get started.

## Setup

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

## Adding a New Language

1. Create a folder: `src/lang/xx/` (where `xx` is the BCP-47 language code)
2. Add `dictionary.json` with entries, suffixes, and whitelist:
   ```json
   {
     "version": 1,
     "suffixes": ["ing", "ed"],
     "entries": [
       {
         "root": "word",
         "variants": ["variant1"],
         "severity": "high",
         "category": "general",
         "suffixable": true
       }
     ],
     "whitelist": ["safeword"]
   }
   ```
3. Add `config.ts` with locale, charMap, leetMap, and charClasses
4. Register in `src/lang/index.ts` (one import + one registry line)
5. Add tests in `tests/lang/xx.test.ts`
6. Run `pnpm test` and `pnpm build` to verify

## Pull Request Process

1. Fork the repository and create a feature branch
2. Make your changes with tests
3. Ensure `pnpm test`, `pnpm typecheck`, and `pnpm build` all pass
4. Submit a pull request with a clear description

## Dictionary Guidelines

- **Severity levels**: `high` (strongest profanity), `medium` (moderate), `low` (mild)
- **Categories**: `sexual`, `insult`, `slur`, `general`
- **Suffixable**: Set to `true` for words that commonly take grammatical suffixes. Keep `false` for very short roots (3 chars) to avoid false positives — use explicit variants instead.
- **Whitelist**: Add legitimate words that might be false positives (e.g. "assassin" contains "ass")

## Code Style

- TypeScript strict mode is enforced
- Keep functions focused and small
- Add JSDoc to all public exports
- Write tests for new functionality
