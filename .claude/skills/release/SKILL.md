---
name: release
description: "Version bump, changelog, git commit/push, npm publish. Use: /release patch | /release minor | /release major | /release 2.3.0"
argument-hint: "[major|minor|patch|X.Y.Z]"
disable-model-invocation: true
allowed-tools:
  - Bash
  - Read
  - Edit
  - Grep
  - Glob
---

# Release Automation — terlik.js

`$ARGUMENTS` ile versiyon tipi veya explicit versiyon belirt.

## 1. Pre-flight Checks

Sirasiyla calistir, herhangi biri basarisiz olursa DURDUR ve kullaniciya bildir:

```bash
# Branch kontrolu
git branch --show-current  # main olmali

# Clean working directory
git status --porcelain     # bos olmali (untracked haric)

# Typecheck
pnpm typecheck

# Full test suite
pnpm test
```

Eger testler veya typecheck basarisiz olursa, sebebini kullaniciya acikla ve DURMA — fix edilmeden release yapilmaz.

## 2. Version Calculation

`package.json` dosyasindan mevcut versiyonu oku.

`$ARGUMENTS` degerine gore yeni versiyonu hesapla:
- `patch` → X.Y.Z+1 (bug fix)
- `minor` → X.Y+1.0 (yeni ozellik)
- `major` → X+1.0.0 (breaking change)
- `X.Y.Z` → verilen versiyon direkt kullan (mevcut versiyondan buyuk olmali)

Eger `$ARGUMENTS` bos veya gecersizse, kullaniciya sor.

## 3. Git Log Analysis

Son release'den bu yana yapilan commit'leri analiz et:

```bash
git log --oneline HEAD...$(git describe --tags --abbrev=0 2>/dev/null || echo HEAD~20)
```

Her commit'i kategorize et:
- `fix:` → Bug Fixes
- `feat:` → Features
- `security:` → Security
- `docs:` → Documentation (changelog'da gosterme)
- `chore:` → Internal (changelog'da gosterme)
- Diger → Changes

## 4. Update package.json

`package.json` icindeki `"version"` degerini yeni versiyonla degistir.

## 5. Update README Changelog

`README.md` icindeki `## Changelog` bolumunun hemen altina yeni entry ekle. Format:

```markdown
### YYYY-MM-DD (vX.Y.Z) — Kisa Baslik

**Bir satirlik ozet.**

- **Degisiklik 1** — Aciklama.
- **Degisiklik 2** — Aciklama.

| Change | File |
|---|---|
| Degisiklik adi | `dosya/yolu.ts` |
```

Commit log analizinden gelen bilgileri kullan. docs/chore commit'lerini dahil etme.

## 6. Build

```bash
pnpm build
```

Build basarisiz olursa DURDUR.

## 7. Git Commit & Push

```bash
git add package.json README.md
git commit -m "chore: release v{NEW_VERSION}

{commit ozeti}

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"

git push origin main
```

Push basarisiz olursa kullaniciya bildir (force push YAPMA).

## 8. npm Publish

```bash
npm publish --access public
```

Basarisiz olursa (401/403):
- `npm whoami` ile login durumunu kontrol et
- Kullaniciya token/login sorununu bildir
- Commit zaten push edildi, sadece publish tekrarlanmali

## 9. Post-release Summary

Tablo formatinda ozet goster:

| Item | Value |
|---|---|
| Version | X.Y.Z → A.B.C |
| Package | `npm i terlik.js@A.B.C` |
| Size | tarball boyutu |
| Commit | hash |
| npm | https://www.npmjs.com/package/terlik.js |
| GitHub | https://github.com/badursun/terlik.js |

## Onemli Kurallar

- Hicbir adimi atlama, sirayla yap
- Test veya typecheck basarisizsa release YAPMA
- `--force`, `--no-verify` KULLANMA
- Eger bir adim basarisiz olursa, o ana kadar yapilanlari ve kalan adimlari kullaniciya bildir
- npm publish token sorunu olursa, kullanicidan yeni token iste
- Her zaman Turkce iletisim kur
