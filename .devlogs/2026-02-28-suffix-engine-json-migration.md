# Suffix Engine + JSON Dictionary Migration

**Tarih:** 2026-02-28
**Kapsam:** Faz 1 (JSON migration) + Faz 2 (suffix engine) + kritik bug fix
**Test:** 101 → 346 (+245 yeni test)

---

## Motivasyon

Türkçe yapışkan (agglutinative) bir dil. `sik` kökünden `siktir`, `sikerim`, `siktiler`, `sikimsonik` gibi onlarca form türüyor. Eski sistemde her formu elle varyant olarak ekliyorduk — skalable değildi. Ayrıca sözlük `.ts` dosyasındaydı, community katkısı için TypeScript bilgisi gerekiyordu.

---

## Faz 1: JSON Dictionary Migration (saf refactor)

### Değişiklikler
- `tsconfig.json` → `resolveJsonModule: true` eklendi
- `src/dictionary/tr.json` → Yeni. Tüm 25 entry + whitelist JSON formatında
- `src/dictionary/schema.ts` → Yeni. `validateDictionary()` runtime doğrulama
- `src/dictionary/index.ts` → JSON import, `getSuffixes()` metodu, constructor validation
- `src/dictionary/tr.ts` → Silindi
- `src/types.ts` → `WordEntry`'ye `category?: string`, `suffixable?: boolean` eklendi
- `tests/dictionary.test.ts` → Yeni. 21 schema doğrulama testi

### Yeni JSON formatı
```json
{
  "version": 1,
  "suffixes": ["tir", "dir", "ler", "lar", ...],
  "entries": [
    {
      "root": "sik",
      "variants": ["siktir", "sikerim", ...],
      "severity": "high",
      "category": "sexual",
      "suffixable": false
    }
  ],
  "whitelist": ["amsterdam", "sikke", ...]
}
```

### Doğrulama kuralları (`schema.ts`)
- Root boş olamaz, duplikat root yok
- Severity: `high | medium | low`
- Category: `sexual | insult | slur | general`
- Suffix: max 100 adet, 1-10 char, sadece `[a-z]`
- Hata mesajları açıklayıcı, hatalı entry'yi belirtir

### Sonuç
- Mevcut 101 test değişmeden geçti
- tsup build-time JSON inline eder — zero runtime I/O

---

## Faz 2: Suffix Engine

### Tasarım
73 Türkçe gramer eki tanımlandı (çatı, edilgen, zaman, kişi, hal, türetme vb.). Suffixable kökler için regex'in sağ word boundary'si suffix-aware yapıldı:

```
Eski:  (?<![\p{L}\p{N}])(?:root-patterns)(?![\p{L}\p{N}])
Yeni:  (?<![\p{L}\p{N}])(?:root-patterns)(?:SUFFIX_GROUP){0,2}(?![\p{L}\p{N}])
```

### Güvenlik önlemleri
- `MAX_PATTERN_LENGTH = 5000` — regex overflow engeller
- `MAX_SUFFIX_CHAIN = 2` — backtracking sınırlar
- Max 100 suffix, 1-10 char, `[a-z]` only — injection/corruption engeller
- `try-catch` regex compile — kötü pattern crash engellemez, suffix'siz fallback

### Suffixable kararları

| Kök | Suffixable | Neden |
|-----|-----------|-------|
| orospu, piç, yarrak, taşak, ibne, gavat, pezevenk, salak, aptal, gerizekalı, dangalak, ezik, puşt, şerefsiz, yavşak, kahpe | `true` | 4+ karakter, FP riski düşük |
| sik, bok, göt, döl | `false` | 3 karakter, FP riski yüksek (aşağıdaki bug'lara bak) |
| amk, am, mal, meme, haysiyetsiz | `false` | Kısaltma / kısa kök / masum kelime riski |

---

## Bulunan Bug #1: `\W` Separator Türkçe Harfleri Yutuyor

### Sorun
Pattern engine'deki karakter arası separator `[\W_]*` olarak tanımlıydı. JavaScript'te `\w` sadece ASCII `[a-zA-Z0-9_]` tanır. Türkçe karakterler (`ı`, `ş`, `ğ`, `ö`, `ü`, `ç`) `\W` (non-word) olarak sınıflanıyor.

### Etki
Separator, Türkçe harfleri "ayırıcı karakter" olarak yutuyordu:

```
"sıkıştı" → pattern engine'de:
  s(s-class) + ı(SEPARATOR!) + k(k-class) + ış(SEPARATOR!) + t(t-class) + ı(i-class)
  = "sikti" varyantı ile eşleşme → FALSE POSITIVE
```

Bu sadece suffix engine'de değil, **tüm pattern matching'de** vardı. Suffix engine çalışması sırasında `sıkıştı`, `sıkma`, `sıkı`, `sıkıntı` gibi masum kelimelerin FP olarak yakalandığı görüldü.

### Kanıt
```js
/\W/u.test("ı") // true — ı non-word olarak görülüyor!
/\W/u.test("ş") // true — ş de!
```

### Çözüm
```ts
// ESKİ (HATALI):
const SEPARATOR = "[\\W_]*";

// YENİ (DOĞRU):
const SEPARATOR = "[^\\p{L}\\p{N}]*";
```

`\p{L}` (Unicode Letter) ve `\p{N}` (Unicode Number) kullanarak tüm dillerin harflerini koruyor. Sadece harf/rakam OLMAYAN karakterler (noktalama, boşluk, sembol) separator olarak kabul ediliyor.

### Not
Bu bug muhtemelen projenin başından beri vardı ama fark edilmiyordu çünkü:
1. Testlerde `sıkma`, `sıkıntı` gibi kelimeler yoktu
2. Çoğu test normalize edilmiş (ASCII) metinlerle çalışıyordu
3. Original text pass'te Türkçe karakterli kelimeler az test edilmişti

---

## Bulunan Bug #2: 3 Harfli Kökler + Suffix = FP Patlaması

### Sorun
Suffix engine etkinken, 3 harfli kökler (`sik`, `bok`, `göt`, `döl`) + tek harfli suffix'ler (`e`, `a`, `i`) çok fazla false positive üretiyordu:

```
"dole bakmak" → döl + e (suffix) → FP!
"boke artık"  → bok + e (suffix) → FP!
"sıkma limon" → sik + ma (suffix) → FP!  (separator bug ile birleşince)
```

### Çözüm
3 harfli kökler `suffixable: false` yapıldı. Yaygın çekim formları açık varyant olarak eklendi:

- **sik**: +18 varyant (sike, siken, siker, sikti, siktiler, sikmek, sikiyor, sikimsonik vb.)
- **göt**: +6 varyant (gote, gotu, gotler, gotlu, gotunden, gotune)
- **bok**: +5 varyant (boka, boku, boklu, boklar, boklari)
- **döl**: +1 varyant (dolcu)

4+ karakter kökler (`orospu`, `salak`, `aptal` vb.) hala `suffixable: true` — FP riski düşük.

---

## Test Kapsamı

### Önceki: 101 test
### Sonraki: 346 test (+245)

| Dosya | Test | İçerik |
|-------|------|--------|
| `profanity.test.ts` | 186 | **Yeni** — 25 kökün tamamı: düz metin, varyant, cümle içi, büyük harf, leet, suffix, whitelist |
| `edge-cases.test.ts` | 36 | FP koruması (+5 yeni: ama, ami, amen, amir, dolmen), emoji, uzun input, evasion |
| `suffix.test.ts` | 33 | **Yeni** — Suffix algılama, chaining, evasion+suffix, non-suffixable reject, sıkma/sıkıntı/sıkıştı FP testleri |
| `dictionary.test.ts` | 21 | **Yeni** — JSON schema doğrulama, duplikat root, severity/category |
| `terlik.test.ts` | 19 | Entegrasyon |
| `normalizer.test.ts` | 17 | Normalizasyon pipeline |
| `fuzzy.test.ts` | 14 | Levenshtein & Dice |
| `detector.test.ts` | 11 | Pattern/strict/loose mod |
| `cleaner.test.ts` | 9 | Maskeleme stilleri |

---

## Performans

| Senaryo | Önce | Sonra | Değişim |
|---------|------|-------|---------|
| Clean messages | ~250k msg/s | ~193k msg/s | -23% |
| Mixed (balanced) | ~188k msg/s | ~151k msg/s | -20% |
| Suffixed dirty | — | ~142k msg/s | yeni |
| Strict mode | ~384k msg/s | ~390k msg/s | +2% |

Performans düşüşü ağırlıklı olarak daha büyük regex pattern'lerinden kaynaklanıyor (daha fazla varyant). Production kullanımı için hala yeterli (150k+ msg/s).

---

## Değişen Dosyalar

| Dosya | Değişiklik |
|-------|-----------|
| `tsconfig.json` | `resolveJsonModule: true` |
| `src/dictionary/tr.json` | Yeni — tüm sözlük verisi, 73 suffix, 25 entry |
| `src/dictionary/schema.ts` | Yeni — runtime doğrulama |
| `src/dictionary/index.ts` | JSON import, `getSuffixes()`, validation |
| `src/dictionary/tr.ts` | Silindi |
| `src/types.ts` | `category?`, `suffixable?` eklendi |
| `src/patterns.ts` | **Separator fix**, `buildSuffixGroup`, suffix-aware compile, safety guards |
| `src/detector.ts` | `getSuffixes()` parametresi (2 satır) |
| `tests/dictionary.test.ts` | Yeni — 21 test |
| `tests/suffix.test.ts` | Yeni — 33 test |
| `tests/profanity.test.ts` | Yeni — 186 test |
| `tests/edge-cases.test.ts` | +5 test |
| `tests/terlik.test.ts` | 1 test güncellendi |
| `benchmarks/bench.ts` | Suffixed dirty messages eklendi |
| `README.md` | Suffix engine doku, benchmark, test sayısı güncellendi |

---

## Bulunan Bug #3: Live Test Server Warmup Cache Miss

### Sorun
Sunucu başlarken 5 konfigürasyon için Terlik instance'ları oluşturuyor ve cache'e koyuyordu (`warmup: 184.9ms`). Ancak ilk gerçek kullanıcı isteği **~3318ms** sürüyordu, ikinci istek ise **~31ms**.

İki ayrı neden:

**1. Cache key uyumsuzluğu:**
```ts
// Warmup key formatı:
"balanced|stars|false|0.8|levenshtein|[***]"

// Lookup key formatı (getCachedTerlik):
"balanced|stars|false|0.8|levenshtein|[***]||"
//                                         ^^ boş customWords ve whitelist
```
UI'dan gelen request `customWords: []` ve `whitelist: []` içeriyordu. `getCachedTerlik` bunları key'e ekliyordu ama warmup eklemiyordu → her ilk request cache miss → yeni Terlik instance oluşturma.

**2. JIT compilation eksikliği:**
Warmup sadece Terlik instance oluşturuyordu ama regex'leri hiç çalıştırmıyordu. V8'in JIT compiler'ı regex pattern'lerini ilk gerçek `exec()` çağrısında derliyor — bu da ilk request'te ~3 saniyelik gecikme yaratıyordu.

### Çözüm
```ts
// 1. Ortak key builder fonksiyonu
function buildCacheKey(...) { ... }
// Warmup ve lookup aynı fonksiyonu kullanıyor

// 2. JIT warmup — gerçek mesajlarla çalıştır
const WARMUP_TEXTS = [
  "merhaba dünya nasılsın",
  "siktir git burdan",
  "s.i.k.t.i.r lan",
  "$1kt1r",
  "amsterdam sikke bokser malzeme",
];
for (const text of WARMUP_TEXTS) {
  instance.containsProfanity(text);
}
```

### Sonuç
| Metrik | Önce | Sonra |
|--------|------|-------|
| Warmup süresi | 185ms | ~6300ms |
| İlk request | **3318ms** | **37ms** |
| Sonraki requestler | ~31ms | ~3-5ms |

Warmup süresi arttı (one-time startup maliyeti) ama ilk request **~90x hızlandı**.

### Değişen dosya
`live_test_server/server.ts` — `buildCacheKey()` fonksiyonu, JIT warmup texts

---

---

## Multi-Language Support (aynı gün, ikinci güncelleme)

### Motivasyon
Sözlük JSON formatına geçtikten sonra, engine'in %80+'ı zaten dil-bağımsızdı. Hardcoded Türkçe veriyi (charMap, leetMap, charClasses, numberExpansions) parametrik hale getirerek çoklu dil desteği eklendi.

### Mimari Değişiklik
**Klasör bazlı dil paketleri:**
```
src/lang/
  types.ts           ← LanguageConfig interface
  index.ts           ← Build-time registry (statik import)
  tr/config.ts + dictionary.json
  en/config.ts + dictionary.json
  es/config.ts + dictionary.json
  de/config.ts + dictionary.json
```

### Refactor Edilen Dosyalar

| Dosya | Değişiklik |
|-------|-----------|
| `src/normalizer.ts` | `createNormalizer(config)` factory eklendi. Türkçe inline constants korundu (backward compat) |
| `src/patterns.ts` | `CHAR_CLASSES` hardcoded → parametre. `compilePatterns(entries, suffixes, charClasses, normalizeFn)` |
| `src/dictionary/index.ts` | `Dictionary(data: DictionaryData, ...)` — statik tr.json import kaldırıldı |
| `src/detector.ts` | Constructor: `(dictionary, normalizeFn, locale, charClasses)`. Tüm `normalize()` → `this.normalizeFn()` |
| `src/terlik.ts` | `language` option, `getLanguageConfig()` wiring, `static warmup()`, `readonly language` prop |
| `src/types.ts` | `TerlikOptions.language?: string` eklendi |
| `src/index.ts` | Yeni export'lar: `createNormalizer`, `getLanguageConfig`, `getSupportedLanguages`, `LanguageConfig` |

### Yeni Dil Paketleri
- **English (en):** 8 entry (fuck, shit, asshole, bitch, bastard, dick, crap, damn), 6 suffix, 19 whitelist
- **Spanish (es):** 6 entry (mierda, puta, cabron, joder, idiota, culo), 9 suffix, 7 whitelist
- **German (de):** 6 entry (scheiße, fick, arsch, hurensohn, idiot, dumm), 5 suffix, 2 whitelist

### Test Sonuçları
- **346 → 418 test** (+72 yeni)
- 5 yeni test dosyası: `en.test.ts`, `es.test.ts`, `de.test.ts`, `multi-lang.test.ts`, `registry.test.ts`
- Cross-language isolation: Her dil instance'ı sadece kendi dilini algılar
- `Terlik.warmup()` testleri: multi-language warmup, baseOptions, unsupported lang throw

### API

```ts
// Default Türkçe (geriye uyumlu)
const terlik = new Terlik();

// Dil seçimi
const en = new Terlik({ language: "en" });

// Multi-language warmup
const cache = Terlik.warmup(["tr", "en", "es", "de"]);

// Bilgi
terlik.language;            // "tr"
getSupportedLanguages();    // ["tr", "en", "es", "de"]
```

### Yeni Dil Ekleme
1. `src/lang/xx/` klasörü oluştur
2. `dictionary.json` yaz (version, entries, suffixes, whitelist)
3. `config.ts` yaz (locale, charMap, leetMap, charClasses + dictionary import)
4. `src/lang/index.ts`'e 1 satır import ekle
5. Test yaz, build, bitti

---

## Geriye Uyumluluk
- `new Terlik()` hala Türkçe, `language` default `"tr"`
- `normalize()` export hala Türkçe default
- `WordEntry`'ye eklenen alanlar opsiyonel
- Suffix engine sadece match ekler, mevcut match'leri kaldırmaz
- Separator fix FP'leri azaltır — breaking change değil, davranış iyileştirmesi
- 346 mevcut test aynen geçer
