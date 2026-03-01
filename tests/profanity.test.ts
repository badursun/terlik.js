import { describe, it, expect } from "vitest";
import { Terlik } from "../src/terlik.js";

/**
 * Kapsamlı küfür algılama testleri — 25 kök kelimenin hepsi
 * Her kök için: düz metin, varyant, cümle içinde, büyük harf
 */

const terlik = new Terlik();

function detects(text: string, expectedRoot?: string): void {
  const matches = terlik.getMatches(text);
  expect(matches.length, `"${text}" should be detected`).toBeGreaterThan(0);
  if (expectedRoot) {
    expect(
      matches.some((m) => m.root === expectedRoot),
      `"${text}" should match root "${expectedRoot}", got: ${matches.map((m) => m.root).join(", ")}`,
    ).toBe(true);
  }
}

function clean(text: string): void {
  expect(terlik.containsProfanity(text), `"${text}" should be clean`).toBe(false);
}

// ──────────────────────────────────────────────
// 1. sik (sexual, high, suffixable)
// ──────────────────────────────────────────────
describe("root: sik", () => {
  it("plain root", () => detects("sik", "sik"));
  it("variant: siktir", () => detects("siktir git", "sik"));
  it("variant: sikerim", () => detects("sikerim seni", "sik"));
  it("variant: sikicem", () => detects("sikicem", "sik"));
  it("variant: siktim", () => detects("siktim", "sik"));
  it("variant: sikeyim", () => detects("sikeyim", "sik"));
  it("variant: sikis", () => detects("sikis", "sik"));
  it("variant: sikik", () => detects("sikik herif", "sik"));
  it("variant: sikim", () => detects("sikim", "sik"));
  it("Turkish İ", () => detects("SİKTİR", "sik"));
  it("leet: $1kt1r", () => detects("$1kt1r", "sik"));
  it("separator: s.i.k", () => detects("s.i.k", "sik"));
  it("repeat: siiiiiktir", () => detects("siiiiiktir", "sik"));
  it("in sentence", () => detects("hadi siktir git burdan", "sik"));
  it("suffix: siktiler", () => detects("siktiler", "sik"));
  it("suffix: siktirler", () => detects("siktirler", "sik"));
  it("whitelist: sikke", () => clean("sikke"));
  it("whitelist: siklet", () => clean("siklet"));
});

// ──────────────────────────────────────────────
// 2. amk (sexual, high, non-suffixable)
// ──────────────────────────────────────────────
describe("root: amk", () => {
  it("plain: amk", () => detects("amk", "amk"));
  it("variant: amina", () => detects("amina koyarim", "amk"));
  it("variant: aminakoyim", () => detects("aminakoyim", "amk"));
  it("variant: aminakoydugum", () => detects("aminakoydugum", "amk"));
  it("variant: amq", () => detects("amq", "amk"));
  it("in sentence", () => detects("bu ne amk", "amk"));
  it("uppercase", () => detects("AMK", "amk"));
});

// ──────────────────────────────────────────────
// 3. orospu (insult, high, suffixable)
// ──────────────────────────────────────────────
describe("root: orospu", () => {
  it("plain", () => detects("orospu", "orospu"));
  it("variant: orospucocugu", () => detects("orospucocugu", "orospu"));
  it("variant: orspu", () => detects("orspu", "orospu"));
  it("variant: oruspu", () => detects("oruspu", "orospu"));
  it("variant: orosbu", () => detects("orosbu", "orospu"));
  it("in sentence", () => detects("kes lan orospu cocugu", "orospu"));
  it("suffix: orospuluk", () => detects("orospuluk yapma", "orospu"));
  it("suffix: orospular", () => detects("orospular", "orospu"));
  it("separator: o.r.o.s.p.u", () => detects("o.r.o.s.p.u", "orospu"));
});

// ──────────────────────────────────────────────
// 4. piç (insult, high, suffixable)
// ──────────────────────────────────────────────
describe("root: piç", () => {
  it("plain: piç", () => detects("piç kurusu", "piç"));
  it("normalized: pic", () => detects("pic", "piç"));
  it("variant: piclik", () => detects("piclik yapma", "piç"));
  it("in sentence", () => detects("bu adam pic", "piç"));
  it("suffix: picler", () => detects("picler", "piç"));
  it("whitelist: piknik", () => clean("piknik"));
  it("whitelist: pikachu", () => clean("pikachu"));
});

// ──────────────────────────────────────────────
// 5. yarrak (sexual, high, suffixable)
// ──────────────────────────────────────────────
describe("root: yarrak", () => {
  it("plain: yarrak", () => detects("yarrak", "yarrak"));
  it("variant: yarak", () => detects("yarak", "yarrak"));
  it("variant: yarakli", () => detects("yarakli", "yarrak"));
  it("variant: dalyarak", () => detects("dalyarak", "yarrak"));
  it("variant: dalyarrak", () => detects("dalyarrak", "yarrak"));
  it("in sentence", () => detects("bu ne yarrak gibi is", "yarrak"));
  it("suffix: yarraklar", () => detects("yarraklar", "yarrak"));
  it("whitelist: yarasa", () => clean("yarasa"));
});

// ──────────────────────────────────────────────
// 6. göt (sexual, high, suffixable)
// ──────────────────────────────────────────────
describe("root: göt", () => {
  it("plain: göt", () => detects("göt", "göt"));
  it("normalized: got", () => detects("got", "göt"));
  it("variant: gotunu", () => detects("gotunu", "göt"));
  it("variant: gotlek", () => detects("gotlek", "göt"));
  it("variant: gotveren", () => detects("gotveren", "göt"));
  it("variant: gotverenler", () => detects("gotverenler", "göt"));
  it("in sentence", () => detects("senin got", "göt"));
  it("leet: 6öt", () => detects("6öt", "göt"));
  it("suffix: gotune", () => detects("gotune", "göt"));
  it("suffix: gotler", () => detects("gotler", "göt"));
  it("whitelist: gotik", () => clean("gotik"));
  it("whitelist: gotham", () => clean("gotham"));
});

// ──────────────────────────────────────────────
// 7. am (sexual, high, non-suffixable)
// ──────────────────────────────────────────────
describe("root: am", () => {
  it("variant: amcik", () => detects("amcik", "am"));
  it("variant: amcuk", () => detects("amcuk", "am"));
  it("in sentence", () => detects("amcik herif", "am"));
  it("whitelist: ama", () => clean("ama"));
  it("whitelist: ami", () => clean("ami"));
  it("whitelist: amen", () => clean("amen"));
  it("whitelist: amir", () => clean("amir"));
  it("whitelist: ambalaj", () => clean("ambalaj"));
  it("whitelist: ambulans", () => clean("ambulans"));
  it("whitelist: ameliyat", () => clean("ameliyat"));
  it("whitelist: amerika", () => clean("amerika"));
  it("whitelist: amino", () => clean("amino"));
  it("whitelist: amonyak", () => clean("amonyak"));
  it("whitelist: ampul", () => clean("ampul"));
});

// ──────────────────────────────────────────────
// 8. taşak (sexual, medium, suffixable)
// ──────────────────────────────────────────────
describe("root: taşak", () => {
  it("plain: taşak", () => detects("taşak", "taşak"));
  it("normalized: tasak", () => detects("tasak", "taşak"));
  it("variant: tassak", () => detects("tassak", "taşak"));
  it("variant: tassakli", () => detects("tassakli", "taşak"));
  it("in sentence", () => detects("tasak gecme", "taşak"));
  it("suffix: tasaklar", () => detects("tasaklar", "taşak"));
});

// ──────────────────────────────────────────────
// 9. meme (sexual, medium, non-suffixable)
// ──────────────────────────────────────────────
describe("root: meme", () => {
  it("plain: meme", () => detects("meme", "meme"));
  it("in sentence", () => detects("meme gosterdi", "meme"));
  it("uppercase", () => detects("MEME", "meme"));
  it("whitelist: memento", () => clean("memento"));
  it("whitelist: memleket", () => clean("memleket"));
  it("whitelist: memur", () => clean("memur"));
  it("whitelist: memorial", () => clean("memorial"));
});

// ──────────────────────────────────────────────
// 10. ibne (slur, high, suffixable)
// ──────────────────────────────────────────────
describe("root: ibne", () => {
  it("plain: ibne", () => detects("ibne", "ibne"));
  it("variant: ibneler", () => detects("ibneler", "ibne"));
  it("in sentence", () => detects("lan ibne", "ibne"));
  it("leet: i8ne", () => detects("i8ne", "ibne"));
  it("suffix: ibnelik", () => detects("ibnelik", "ibne"));
  it("suffix: ibneler", () => detects("ibneler geldi", "ibne"));
});

// ──────────────────────────────────────────────
// 11. gavat (insult, high, suffixable)
// ──────────────────────────────────────────────
describe("root: gavat", () => {
  it("plain: gavat", () => detects("gavat", "gavat"));
  it("variant: gavatlik", () => detects("gavatlik", "gavat"));
  it("in sentence", () => detects("bu adam gavat", "gavat"));
  it("suffix: gavatlar", () => detects("gavatlar", "gavat"));
  it("uppercase", () => detects("GAVAT", "gavat"));
});

// ──────────────────────────────────────────────
// 12. pezevenk (insult, high, suffixable)
// ──────────────────────────────────────────────
describe("root: pezevenk", () => {
  it("plain: pezevenk", () => detects("pezevenk", "pezevenk"));
  it("variant: pezo", () => detects("pezo herif", "pezevenk"));
  it("in sentence", () => detects("bu pezevenk kim", "pezevenk"));
  it("suffix: pezevenkler", () => detects("pezevenkler", "pezevenk"));
  it("suffix: pezevenklik", () => detects("pezevenklik", "pezevenk"));
});

// ──────────────────────────────────────────────
// 13. bok (general, medium, suffixable)
// ──────────────────────────────────────────────
describe("root: bok", () => {
  it("plain: bok", () => detects("bok", "bok"));
  it("variant: boktan", () => detects("boktan", "bok"));
  it("in sentence", () => detects("ne boktan bir gun", "bok"));
  it("leet: 8ok", () => detects("8ok", "bok"));
  it("suffix: boklar", () => detects("boklar", "bok"));
  it("suffix: boklu", () => detects("boklu", "bok"));
  it("whitelist: bokser", () => clean("bokser"));
  it("whitelist: boksör", () => clean("boksör"));
});

// ──────────────────────────────────────────────
// 14. haysiyetsiz (insult, medium, non-suffixable)
// ──────────────────────────────────────────────
describe("root: haysiyetsiz", () => {
  it("plain: haysiyetsiz", () => detects("haysiyetsiz", "haysiyetsiz"));
  it("in sentence", () => detects("bu adam haysiyetsiz", "haysiyetsiz"));
  it("uppercase", () => detects("HAYSIYETSIZ", "haysiyetsiz"));
});

// ──────────────────────────────────────────────
// 15. salak (insult, low, suffixable)
// ──────────────────────────────────────────────
describe("root: salak", () => {
  it("plain: salak", () => detects("salak", "salak"));
  it("variant: salaklik", () => detects("salaklik", "salak"));
  it("in sentence", () => detects("salak misin sen", "salak"));
  it("uppercase", () => detects("SALAK", "salak"));
  it("suffix: salaksin", () => detects("salaksin", "salak"));
  it("suffix: salaklar", () => detects("salaklar", "salak"));
});

// ──────────────────────────────────────────────
// 16. aptal (insult, low, suffixable)
// ──────────────────────────────────────────────
describe("root: aptal", () => {
  it("plain: aptal", () => detects("aptal", "aptal"));
  it("variant: aptallik", () => detects("aptallik", "aptal"));
  it("variant: aptalca", () => detects("aptalca", "aptal"));
  it("in sentence", () => detects("bu adam aptal herif", "aptal"));
  it("leet: @pt@l", () => detects("@pt@l", "aptal"));
  it("suffix: aptallar", () => detects("aptallar", "aptal"));
  it("suffix: aptallarin", () => detects("aptallarin isi", "aptal"));
});

// ──────────────────────────────────────────────
// 17. gerizekalı (insult, low, suffixable)
// ──────────────────────────────────────────────
describe("root: gerizekalı", () => {
  it("plain: gerizekalı", () => detects("gerizekalı", "gerizekalı"));
  it("normalized: gerizekali", () => detects("gerizekali", "gerizekalı"));
  it("in sentence", () => detects("bu gerizekali kim", "gerizekalı"));
  it("suffix: gerizekaliler", () => detects("gerizekaliler", "gerizekalı"));
});

// ──────────────────────────────────────────────
// 18. mal (insult, low, non-suffixable)
// ──────────────────────────────────────────────
describe("root: mal", () => {
  it("plain: mal", () => detects("mal herif", "mal"));
  it("in sentence", () => detects("bu adam mal", "mal"));
  it("uppercase", () => detects("MAL", "mal"));
  it("whitelist: malzeme", () => clean("malzeme"));
  it("whitelist: maliyet", () => clean("maliyet"));
  it("whitelist: malik", () => clean("malik"));
  it("whitelist: malikane", () => clean("malikane"));
  it("whitelist: maliye", () => clean("maliye"));
  it("whitelist: malta", () => clean("malta"));
  it("whitelist: malt", () => clean("malt"));
  it("whitelist: mallorca", () => clean("mallorca"));
});

// ──────────────────────────────────────────────
// 19. dangalak (insult, low, suffixable)
// ──────────────────────────────────────────────
describe("root: dangalak", () => {
  it("plain: dangalak", () => detects("dangalak", "dangalak"));
  it("in sentence", () => detects("bu dangalak ne yapiyor", "dangalak"));
  it("suffix: dangalaklar", () => detects("dangalaklar", "dangalak"));
  it("uppercase", () => detects("DANGALAK", "dangalak"));
});

// ──────────────────────────────────────────────
// 20. ezik (insult, low, suffixable)
// ──────────────────────────────────────────────
describe("root: ezik", () => {
  it("plain: ezik", () => detects("ezik", "ezik"));
  it("in sentence", () => detects("ezik herif", "ezik"));
  it("suffix: ezikler", () => detects("ezikler", "ezik"));
  it("suffix: eziklik", () => detects("eziklik", "ezik"));
  it("uppercase", () => detects("EZIK", "ezik"));
});

// ──────────────────────────────────────────────
// 21. puşt (slur, high, suffixable)
// ──────────────────────────────────────────────
describe("root: puşt", () => {
  it("plain: puşt", () => detects("puşt", "puşt"));
  it("normalized: pust", () => detects("pust", "puşt"));
  it("variant: pustt", () => detects("pustt", "puşt"));
  it("in sentence", () => detects("lan pust", "puşt"));
  it("leet: pu$t", () => detects("pu$t", "puşt"));
  it("suffix: pustlar", () => detects("pustlar", "puşt"));
  it("suffix: pustluk", () => detects("pustluk", "puşt"));
});

// ──────────────────────────────────────────────
// 22. şerefsiz (insult, medium, suffixable)
// ──────────────────────────────────────────────
describe("root: şerefsiz", () => {
  it("plain: şerefsiz", () => detects("şerefsiz", "şerefsiz"));
  it("normalized: serefsiz", () => detects("serefsiz", "şerefsiz"));
  it("variant: serefsizler", () => detects("serefsizler", "şerefsiz"));
  it("in sentence", () => detects("bu serefsiz adam", "şerefsiz"));
  it("suffix: serefsizlik", () => detects("serefsizlik", "şerefsiz"));
  it("uppercase", () => detects("SEREFSIZ", "şerefsiz"));
});

// ──────────────────────────────────────────────
// 23. yavşak (insult, medium, suffixable)
// ──────────────────────────────────────────────
describe("root: yavşak", () => {
  it("plain: yavşak", () => detects("yavşak", "yavşak"));
  it("normalized: yavsak", () => detects("yavsak", "yavşak"));
  it("in sentence", () => detects("bu yavsak kim", "yavşak"));
  it("suffix: yavsaklik", () => detects("yavsaklik", "yavşak"));
  it("suffix: yavsaklar", () => detects("yavsaklar", "yavşak"));
  it("uppercase", () => detects("YAVSAK", "yavşak"));
});

// ──────────────────────────────────────────────
// 24. döl (sexual, high, suffixable)
// ──────────────────────────────────────────────
describe("root: döl", () => {
  it("plain: döl", () => detects("döl", "döl"));
  it("normalized: dol", () => detects("dol", "döl"));
  it("variant: dolunu", () => detects("dolunu", "döl"));
  it("in sentence", () => detects("dol israfı", "döl"));
  it("variant: dolcu", () => detects("dolcu", "döl"));
  it("whitelist: dolunay", () => clean("dolunay"));
  it("whitelist: dolum", () => clean("dolum"));
  it("whitelist: doluluk", () => clean("doluluk"));
  it("whitelist: dolmen", () => clean("dolmen"));
});

// ──────────────────────────────────────────────
// 25. kahpe (insult, high, suffixable)
// ──────────────────────────────────────────────
describe("root: kahpe", () => {
  it("plain: kahpe", () => detects("kahpe", "kahpe"));
  it("variant: kahpelik", () => detects("kahpelik", "kahpe"));
  it("in sentence", () => detects("kahpe kari", "kahpe"));
  it("suffix: kahpeler", () => detects("kahpeler", "kahpe"));
  it("suffix: kahpelikler", () => detects("kahpelikler", "kahpe"));
  it("uppercase", () => detects("KAHPE", "kahpe"));
});

// ──────────────────────────────────────────────
// 26. sürtük (insult, high, suffixable)
// ──────────────────────────────────────────────
describe("root: sürtük", () => {
  it("plain: sürtük", () => detects("sürtük", "sürtük"));
  it("normalized: surtuk", () => detects("surtuk", "sürtük"));
  it("in sentence", () => detects("bu kadin surtuk", "sürtük"));
  it("suffix: surtukler", () => detects("surtukler", "sürtük"));
  it("suffix: surtukluk", () => detects("surtukluk", "sürtük"));
  it("uppercase", () => detects("SÜRTÜK", "sürtük"));
});

// ──────────────────────────────────────────────
// 27. kaltak (insult, high, suffixable)
// ──────────────────────────────────────────────
describe("root: kaltak", () => {
  it("plain: kaltak", () => detects("kaltak", "kaltak"));
  it("in sentence", () => detects("bu kaltak kim", "kaltak"));
  it("suffix: kaltaklar", () => detects("kaltaklar", "kaltak"));
  it("suffix: kaltaklik", () => detects("kaltaklik", "kaltak"));
  it("uppercase", () => detects("KALTAK", "kaltak"));
});

// ──────────────────────────────────────────────
// 28. fahişe (insult, high, suffixable)
// ──────────────────────────────────────────────
describe("root: fahişe", () => {
  it("plain: fahişe", () => detects("fahişe", "fahişe"));
  it("normalized: fahise", () => detects("fahise", "fahişe"));
  it("in sentence", () => detects("bu fahise kadin", "fahişe"));
  it("suffix: fahiseler", () => detects("fahiseler", "fahişe"));
  it("suffix: fahiselik", () => detects("fahiselik", "fahişe"));
  it("uppercase", () => detects("FAHISE", "fahişe"));
});

// ──────────────────────────────────────────────
// 29. kevaşe (insult, medium, suffixable)
// ──────────────────────────────────────────────
describe("root: kevaşe", () => {
  it("plain: kevaşe", () => detects("kevaşe", "kevaşe"));
  it("normalized: kevase", () => detects("kevase", "kevaşe"));
  it("in sentence", () => detects("bu kevase kim", "kevaşe"));
  it("suffix: kevaseler", () => detects("kevaseler", "kevaşe"));
  it("uppercase", () => detects("KEVASE", "kevaşe"));
});

// ──────────────────────────────────────────────
// 30. oğlancı (slur, high, suffixable)
// ──────────────────────────────────────────────
describe("root: oğlancı", () => {
  it("plain: oğlancı", () => detects("oğlancı", "oğlancı"));
  it("normalized: oglanci", () => detects("oglanci", "oğlancı"));
  it("in sentence", () => detects("bu adam oglanci", "oğlancı"));
  it("suffix: oglancilar", () => detects("oglancilar", "oğlancı"));
  it("suffix: oglancilik", () => detects("oglancilik", "oğlancı"));
  it("uppercase", () => detects("OGLANCI", "oğlancı"));
});

// ──────────────────────────────────────────────
// 31. dingil (insult, low, suffixable)
// ──────────────────────────────────────────────
describe("root: dingil", () => {
  it("plain: dingil", () => detects("dingil", "dingil"));
  it("in sentence", () => detects("bu dingil ne yapiyor", "dingil"));
  it("suffix: dingiller", () => detects("dingiller", "dingil"));
  it("suffix: dingillik", () => detects("dingillik", "dingil"));
  it("uppercase", () => detects("DINGIL", "dingil"));
});

// ──────────────────────────────────────────────
// 32. avanak (insult, low, suffixable)
// ──────────────────────────────────────────────
describe("root: avanak", () => {
  it("plain: avanak", () => detects("avanak", "avanak"));
  it("in sentence", () => detects("bu avanak herif", "avanak"));
  it("suffix: avanaklar", () => detects("avanaklar", "avanak"));
  it("suffix: avanaklik", () => detects("avanaklik", "avanak"));
  it("uppercase", () => detects("AVANAK", "avanak"));
});

// ──────────────────────────────────────────────
// 33. manyak (insult, low, suffixable)
// ──────────────────────────────────────────────
describe("root: manyak", () => {
  it("plain: manyak", () => detects("manyak", "manyak"));
  it("in sentence", () => detects("bu adam manyak", "manyak"));
  it("suffix: manyaklar", () => detects("manyaklar", "manyak"));
  it("suffix: manyaklik", () => detects("manyaklik", "manyak"));
  it("uppercase", () => detects("MANYAK", "manyak"));
});

// ──────────────────────────────────────────────
// 34. hödük (insult, low, suffixable)
// ──────────────────────────────────────────────
describe("root: hödük", () => {
  it("plain: hödük", () => detects("hödük", "hödük"));
  it("normalized: hoduk", () => detects("hoduk", "hödük"));
  it("in sentence", () => detects("bu hoduk herif", "hödük"));
  it("suffix: hodukler", () => detects("hodukler", "hödük"));
  it("suffix: hodukluk", () => detects("hodukluk", "hödük"));
  it("uppercase", () => detects("HODUK", "hödük"));
});

// ──────────────────────────────────────────────
// 35. kepaze (insult, medium, suffixable)
// ──────────────────────────────────────────────
describe("root: kepaze", () => {
  it("plain: kepaze", () => detects("kepaze", "kepaze"));
  it("in sentence", () => detects("bu adam kepaze", "kepaze"));
  it("suffix: kepazeler", () => detects("kepazeler", "kepaze"));
  it("suffix: kepazelik", () => detects("kepazelik", "kepaze"));
  it("uppercase", () => detects("KEPAZE", "kepaze"));
});

// ──────────────────────────────────────────────
// 36. rezil (insult, medium, suffixable)
// ──────────────────────────────────────────────
describe("root: rezil", () => {
  it("plain: rezil", () => detects("rezil", "rezil"));
  it("in sentence", () => detects("rezil oldu", "rezil"));
  it("suffix: reziller", () => detects("reziller", "rezil"));
  it("suffix: rezillik", () => detects("rezillik", "rezil"));
  it("uppercase", () => detects("REZIL", "rezil"));
});

// ──────────────────────────────────────────────
// 37. kalleş (insult, medium, suffixable)
// ──────────────────────────────────────────────
describe("root: kalleş", () => {
  it("plain: kalleş", () => detects("kalleş", "kalleş"));
  it("normalized: kalles", () => detects("kalles", "kalleş"));
  it("in sentence", () => detects("bu kalles herif", "kalleş"));
  it("suffix: kallesler", () => detects("kallesler", "kalleş"));
  it("suffix: kalleslik", () => detects("kalleslik", "kalleş"));
  it("uppercase", () => detects("KALLES", "kalleş"));
});

// ──────────────────────────────────────────────
// 38. namussuz (insult, medium, suffixable)
// ──────────────────────────────────────────────
describe("root: namussuz", () => {
  it("plain: namussuz", () => detects("namussuz", "namussuz"));
  it("in sentence", () => detects("bu namussuz adam", "namussuz"));
  it("suffix: namussuzlar", () => detects("namussuzlar", "namussuz"));
  it("suffix: namussuzluk", () => detects("namussuzluk", "namussuz"));
  it("uppercase", () => detects("NAMUSSUZ", "namussuz"));
  it("whitelist: namus", () => clean("namus"));
  it("whitelist: namuslu", () => clean("namuslu"));
});

// ──────────────────────────────────────────────
// 39. ahlaksız (insult, medium, suffixable)
// ──────────────────────────────────────────────
describe("root: ahlaksız", () => {
  it("plain: ahlaksız", () => detects("ahlaksız", "ahlaksız"));
  it("normalized: ahlaksiz", () => detects("ahlaksiz", "ahlaksız"));
  it("in sentence", () => detects("bu ahlaksiz adam", "ahlaksız"));
  it("suffix: ahlaksizlar", () => detects("ahlaksizlar", "ahlaksız"));
  it("suffix: ahlaksizlik", () => detects("ahlaksizlik", "ahlaksız"));
  it("uppercase", () => detects("AHLAKSIZ", "ahlaksız"));
  it("whitelist: ahlak", () => clean("ahlak"));
  it("whitelist: ahlaki", () => clean("ahlaki"));
});
