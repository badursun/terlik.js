import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

export interface Sample {
  text: string;
  profane: boolean;
  category: string;
}

// ─── SPDG import ───────────────────────────────────────────────────────
interface SPDGEntry {
  text: string;
  label: number;
  root: string;
  difficulty: string;
  transforms: string[];
  category: string;
}

function mapSPDGCategory(entry: SPDGEntry): string {
  if (entry.label === 0) return "spdg_clean";

  const t = entry.transforms;
  if (t.length === 0) return "spdg_plain";
  if (t.length === 1) {
    if (t[0] === "leet") return "spdg_leet";
    if (t[0] === "separator") return "spdg_separator";
    if (t[0] === "doubling" || t[0] === "charRepeat") return "spdg_repetition";
    if (t[0] === "case") return "spdg_plain"; // case-only is still plain-ish
    if (t[0] === "suffix") return "spdg_variant";
    if (t[0] === "reverse") return "spdg_evasion";
    if (t[0] === "unicode") return "spdg_unicode";
    if (t[0] === "zalgo") return "spdg_zalgo";
    if (t[0] === "zwc") return "spdg_zwc";
    if (t[0] === "split") return "spdg_split";
    if (t[0] === "emojiMix") return "spdg_emoji";
    if (t[0] === "vowelDrop") return "spdg_evasion";
    return "spdg_evasion";
  }
  // 2+ transforms → combined
  return "spdg_combined";
}

function loadSPDG(): Sample[] {
  const spdgPath = join(__dirname, "../../tools/Synthetic-Profanity-Dataset-Generator/output/export-en.jsonl");
  if (!existsSync(spdgPath)) return [];

  const lines = readFileSync(spdgPath, "utf8").trim().split("\n");
  const samples: Sample[] = [];
  const seen = new Set<string>();

  for (const line of lines) {
    const entry: SPDGEntry = JSON.parse(line);
    const key = entry.text.toLowerCase().trim();
    if (seen.has(key)) continue;
    seen.add(key);

    samples.push({
      text: entry.text,
      profane: entry.label === 1,
      category: mapSPDGCategory(entry),
    });
  }
  return samples;
}

// ─── Curated dataset (hand-crafted baseline) ────────────────────────────

const curatedDataset: Sample[] = [
  // ─── PLAIN PROFANITY (50) ───────────────────────────────────────────
  { text: "fuck you", profane: true, category: "plain" },
  { text: "shit happens", profane: true, category: "plain" },
  { text: "what the hell is this", profane: true, category: "plain" },
  { text: "damn it all", profane: true, category: "plain" },
  { text: "you are an asshole", profane: true, category: "plain" },
  { text: "go to hell", profane: true, category: "plain" },
  { text: "that is bullshit", profane: true, category: "plain" },
  { text: "what a bitch", profane: true, category: "plain" },
  { text: "stupid bastard", profane: true, category: "plain" },
  { text: "you prick", profane: true, category: "plain" },
  { text: "suck my dick", profane: true, category: "plain" },
  { text: "eat shit and die", profane: true, category: "plain" },
  { text: "this is crap", profane: true, category: "plain" },
  { text: "screw you", profane: true, category: "plain" },
  { text: "piss off", profane: true, category: "plain" },
  { text: "you whore", profane: true, category: "plain" },
  { text: "shut the fuck up", profane: true, category: "plain" },
  { text: "dumb ass", profane: true, category: "plain" },
  { text: "son of a bitch", profane: true, category: "plain" },
  { text: "holy shit dude", profane: true, category: "plain" },
  { text: "cock sucker", profane: true, category: "plain" },
  { text: "what the fuck", profane: true, category: "plain" },
  { text: "you piece of shit", profane: true, category: "plain" },
  { text: "go fuck yourself", profane: true, category: "plain" },
  { text: "that is so damn stupid", profane: true, category: "plain" },
  // new plain — new roots
  { text: "watching porn is bad", profane: true, category: "plain" },
  { text: "she gave a blowjob", profane: true, category: "plain" },
  { text: "jizz everywhere", profane: true, category: "plain" },
  { text: "he bought a dildo", profane: true, category: "plain" },
  { text: "she had an orgasm", profane: true, category: "plain" },
  { text: "they had an orgy", profane: true, category: "plain" },
  { text: "that hooker on the corner", profane: true, category: "plain" },
  { text: "dirty negro", profane: true, category: "plain" },
  { text: "he was caught masturbating", profane: true, category: "plain" },
  { text: "covered in semen", profane: true, category: "plain" },
  { text: "wet pussy", profane: true, category: "plain" },
  { text: "she wants cum", profane: true, category: "plain" },
  { text: "show me your penis", profane: true, category: "plain" },
  { text: "nice tits babe", profane: true, category: "plain" },
  { text: "lick my vagina", profane: true, category: "plain" },
  { text: "anal sex is common", profane: true, category: "plain" },
  { text: "he raped her", profane: true, category: "plain" },
  { text: "you stupid cunt", profane: true, category: "plain" },
  { text: "bloody wanker", profane: true, category: "plain" },
  { text: "what a twat", profane: true, category: "plain" },
  { text: "total bollocks", profane: true, category: "plain" },
  { text: "ugly slut", profane: true, category: "plain" },
  { text: "you retard", profane: true, category: "plain" },
  { text: "stupid faggot", profane: true, category: "plain" },
  { text: "dirty nigger", profane: true, category: "plain" },

  // ─── VARIANT FORMS (35) ────────────────────────────────────────────
  { text: "he is fucking annoying", profane: true, category: "variant" },
  { text: "motherfucker over there", profane: true, category: "variant" },
  { text: "she is a bitchy person", profane: true, category: "variant" },
  { text: "stop being an asshat", profane: true, category: "variant" },
  { text: "you dipshit", profane: true, category: "variant" },
  { text: "he got fucked up", profane: true, category: "variant" },
  { text: "shitty weather today", profane: true, category: "variant" },
  { text: "bullshitting everyone", profane: true, category: "variant" },
  { text: "these assholes are late", profane: true, category: "variant" },
  { text: "she is a dumbass", profane: true, category: "variant" },
  { text: "totally shitfaced last night", profane: true, category: "variant" },
  { text: "jackass move dude", profane: true, category: "variant" },
  { text: "you are a dickhead", profane: true, category: "variant" },
  { text: "that was a clusterfuck", profane: true, category: "variant" },
  { text: "such a shitshow", profane: true, category: "variant" },
  { text: "batshit crazy idea", profane: true, category: "variant" },
  { text: "unfucking believable", profane: true, category: "variant" },
  { text: "horseshit excuse", profane: true, category: "variant" },
  { text: "the fuckery never ends", profane: true, category: "variant" },
  { text: "douchebag alert", profane: true, category: "variant" },
  // new variants
  { text: "pornographic material found", profane: true, category: "variant" },
  { text: "he is a rapist", profane: true, category: "variant" },
  { text: "she was masturbating again", profane: true, category: "variant" },
  { text: "cumshot compilation", profane: true, category: "variant" },
  { text: "multiple orgasms reported", profane: true, category: "variant" },
  { text: "those pussies ran away", profane: true, category: "variant" },
  { text: "nice titties on display", profane: true, category: "variant" },
  { text: "vaginal examination required", profane: true, category: "variant" },
  { text: "screwed everything up", profane: true, category: "variant" },
  { text: "pricking his conscience", profane: true, category: "variant" },
  { text: "he is a cocksucking liar", profane: true, category: "variant" },
  { text: "total fuckwit behavior", profane: true, category: "variant" },
  { text: "whorish behavior on display", profane: true, category: "variant" },
  { text: "slutty outfit choice", profane: true, category: "variant" },
  { text: "complete mindfuck experience", profane: true, category: "variant" },

  // ─── LEET SPEAK (25) ───────────────────────────────────────────────
  { text: "f#ck you", profane: true, category: "leet" },
  { text: "sh1t happens", profane: true, category: "leet" },
  { text: "a$$hole right here", profane: true, category: "leet" },
  { text: "b1tch please", profane: true, category: "leet" },
  { text: "f@ck off", profane: true, category: "leet" },
  { text: "d1ck move bro", profane: true, category: "leet" },
  { text: "what a pr1ck", profane: true, category: "leet" },
  { text: "fuk this", profane: true, category: "leet" },
  { text: "phuck you", profane: true, category: "leet" },
  { text: "5hit quality", profane: true, category: "leet" },
  { text: "a55 clown", profane: true, category: "leet" },
  { text: "b!tch mode", profane: true, category: "leet" },
  { text: "p!ss off", profane: true, category: "leet" },
  { text: "fvck that", profane: true, category: "leet" },
  { text: "$hit posting", profane: true, category: "leet" },
  // new leet
  { text: "8itch slap", profane: true, category: "leet" },
  { text: "s#it stain", profane: true, category: "leet" },
  { text: "ni66er alert", profane: true, category: "leet" },
  { text: "phucking loser", profane: true, category: "leet" },
  { text: "c0ck blocker", profane: true, category: "leet" },
  { text: "4sshole move", profane: true, category: "leet" },
  { text: "d4mn right", profane: true, category: "leet" },
  { text: "r3tard alert", profane: true, category: "leet" },
  { text: "wh0re bag", profane: true, category: "leet" },
  { text: "tw4t face", profane: true, category: "leet" },

  // ─── SEPARATOR EVASION (15) ────────────────────────────────────────
  { text: "f.u.c.k you", profane: true, category: "separator" },
  { text: "s h i t man", profane: true, category: "separator" },
  { text: "a-s-s-h-o-l-e", profane: true, category: "separator" },
  { text: "b_i_t_c_h", profane: true, category: "separator" },
  { text: "f_u_c_k off", profane: true, category: "separator" },
  { text: "d.i.c.k head", profane: true, category: "separator" },
  { text: "w-h-o-r-e bag", profane: true, category: "separator" },
  { text: "c.o.c.k blocker", profane: true, category: "separator" },
  { text: "p.r.i.c.k move", profane: true, category: "separator" },
  { text: "c_r_a_p fest", profane: true, category: "separator" },
  // new separator
  { text: "n.i.g.g.e.r please", profane: true, category: "separator" },
  { text: "s-l-u-t shaming", profane: true, category: "separator" },
  { text: "c_u_n_t face", profane: true, category: "separator" },
  { text: "t.w.a.t move", profane: true, category: "separator" },
  { text: "h_e_l_l yeah", profane: true, category: "separator" },

  // ─── REPETITION EVASION (15) ───────────────────────────────────────
  { text: "fuuuuck this", profane: true, category: "repetition" },
  { text: "shiiiit dude", profane: true, category: "repetition" },
  { text: "what an assshole", profane: true, category: "repetition" },
  { text: "biiiitch please", profane: true, category: "repetition" },
  { text: "daaaamn son", profane: true, category: "repetition" },
  { text: "fffffuck off", profane: true, category: "repetition" },
  { text: "craaap quality", profane: true, category: "repetition" },
  { text: "helllll no", profane: true, category: "repetition" },
  { text: "dickkkk move", profane: true, category: "repetition" },
  { text: "pisssss off", profane: true, category: "repetition" },
  // new repetition
  { text: "cuuuunt face", profane: true, category: "repetition" },
  { text: "sluuuut shaming", profane: true, category: "repetition" },
  { text: "whoooore alert", profane: true, category: "repetition" },
  { text: "coooock blocker", profane: true, category: "repetition" },
  { text: "waaanker move", profane: true, category: "repetition" },

  // ─── COMBINED EVASION (15) ─────────────────────────────────────────
  { text: "F.U.C.K.I.N.G hell", profane: true, category: "combined" },
  { text: "$h!t posting", profane: true, category: "combined" },
  { text: "f#cking idiot", profane: true, category: "combined" },
  { text: "b.1.t.c.h mode", profane: true, category: "combined" },
  { text: "a$$h0le alert", profane: true, category: "combined" },
  { text: "phuck1ng loser", profane: true, category: "combined" },
  { text: "d!ck h3ad", profane: true, category: "combined" },
  { text: "5h1t stain", profane: true, category: "combined" },
  { text: "fuuuck1ng hell", profane: true, category: "combined" },
  { text: "b!tch a$$ move", profane: true, category: "combined" },
  // new combined
  { text: "phuck3d up badly", profane: true, category: "combined" },
  { text: "n!66er please", profane: true, category: "combined" },
  { text: "8.1.t.c.h mode", profane: true, category: "combined" },
  { text: "5h!tty weather", profane: true, category: "combined" },
  { text: "c0ck5ucker alert", profane: true, category: "combined" },

  // ─── CLEAN SENTENCES (50) ──────────────────────────────────────────
  { text: "hello world how are you today", profane: false, category: "clean" },
  { text: "the weather is beautiful this morning", profane: false, category: "clean" },
  { text: "i love programming in typescript", profane: false, category: "clean" },
  { text: "let us meet at the coffee shop", profane: false, category: "clean" },
  { text: "great job on the presentation", profane: false, category: "clean" },
  { text: "the movie was fantastic last night", profane: false, category: "clean" },
  { text: "can you help me with this problem", profane: false, category: "clean" },
  { text: "i am going to the grocery store", profane: false, category: "clean" },
  { text: "the concert was amazing", profane: false, category: "clean" },
  { text: "happy birthday to you", profane: false, category: "clean" },
  { text: "let me know if you need anything", profane: false, category: "clean" },
  { text: "the project deadline is friday", profane: false, category: "clean" },
  { text: "i just finished reading that book", profane: false, category: "clean" },
  { text: "what time is the meeting tomorrow", profane: false, category: "clean" },
  { text: "the garden looks wonderful", profane: false, category: "clean" },
  { text: "thanks for your help today", profane: false, category: "clean" },
  { text: "i enjoy hiking in the mountains", profane: false, category: "clean" },
  { text: "the food at that restaurant was great", profane: false, category: "clean" },
  { text: "we should plan a trip this summer", profane: false, category: "clean" },
  { text: "the sunset was breathtaking", profane: false, category: "clean" },
  { text: "i need to finish my homework", profane: false, category: "clean" },
  { text: "the traffic was light this morning", profane: false, category: "clean" },
  { text: "she plays the piano beautifully", profane: false, category: "clean" },
  { text: "we adopted a puppy last weekend", profane: false, category: "clean" },
  { text: "the team won the championship", profane: false, category: "clean" },
  { text: "i made pasta for dinner tonight", profane: false, category: "clean" },
  { text: "the library has a great selection", profane: false, category: "clean" },
  { text: "let us go for a walk in the park", profane: false, category: "clean" },
  { text: "the new phone model looks impressive", profane: false, category: "clean" },
  { text: "i am learning to play guitar", profane: false, category: "clean" },
  { text: "the architecture of this building is stunning", profane: false, category: "clean" },
  { text: "we had a productive meeting today", profane: false, category: "clean" },
  { text: "the kids are playing in the backyard", profane: false, category: "clean" },
  { text: "i appreciate your feedback on this", profane: false, category: "clean" },
  { text: "the documentary was very informative", profane: false, category: "clean" },
  { text: "spring is my favorite season", profane: false, category: "clean" },
  { text: "the coffee here is excellent", profane: false, category: "clean" },
  { text: "i need to schedule a dentist appointment", profane: false, category: "clean" },
  { text: "the workshop was really helpful", profane: false, category: "clean" },
  { text: "we are planning a surprise party", profane: false, category: "clean" },
  // new clean
  { text: "the museum exhibit was fascinating", profane: false, category: "clean" },
  { text: "our flight departs at seven in the morning", profane: false, category: "clean" },
  { text: "she received a scholarship for her studies", profane: false, category: "clean" },
  { text: "the recipe calls for fresh basil leaves", profane: false, category: "clean" },
  { text: "he completed the marathon in under four hours", profane: false, category: "clean" },
  { text: "the new software update fixed the bug", profane: false, category: "clean" },
  { text: "they celebrated their anniversary at the beach", profane: false, category: "clean" },
  { text: "the volunteer event was a huge success", profane: false, category: "clean" },
  { text: "she baked cookies for the neighbors", profane: false, category: "clean" },
  { text: "the hiking trail offers stunning views", profane: false, category: "clean" },

  // ─── WHITELIST / FALSE POSITIVE TRAPS (70) ─────────────────────────
  { text: "the assassin creed game is popular", profane: false, category: "whitelist" },
  { text: "she attended the class yesterday", profane: false, category: "whitelist" },
  { text: "the scunthorpe problem is well known", profane: false, category: "whitelist" },
  { text: "he passed the assessment test", profane: false, category: "whitelist" },
  { text: "the cocktail party was fun", profane: false, category: "whitelist" },
  { text: "we analyzed the data", profane: false, category: "whitelist" },
  { text: "the classic car show is this weekend", profane: false, category: "whitelist" },
  { text: "she is a bassist in the band", profane: false, category: "whitelist" },
  { text: "the grape harvest was excellent", profane: false, category: "whitelist" },
  { text: "he assembled the furniture", profane: false, category: "whitelist" },
  { text: "the therapist recommended exercise", profane: false, category: "whitelist" },
  { text: "she works in essex county", profane: false, category: "whitelist" },
  { text: "the document was classified", profane: false, category: "whitelist" },
  { text: "they spotted a cockatoo at the zoo", profane: false, category: "whitelist" },
  { text: "she is passionate about teaching", profane: false, category: "whitelist" },
  { text: "the mass exodus was unexpected", profane: false, category: "whitelist" },
  { text: "he had a mishap at work", profane: false, category: "whitelist" },
  { text: "the title was in block letters", profane: false, category: "whitelist" },
  { text: "she wore a cute camisole", profane: false, category: "whitelist" },
  { text: "the grass was freshly cut", profane: false, category: "whitelist" },
  { text: "he is a skilled craftsman", profane: false, category: "whitelist" },
  { text: "the butterfly fluttered past", profane: false, category: "whitelist" },
  { text: "she handled it diplomatically", profane: false, category: "whitelist" },
  { text: "the compass pointed north", profane: false, category: "whitelist" },
  { text: "he showed compassion for others", profane: false, category: "whitelist" },
  { text: "she analyzed the dataset thoroughly", profane: false, category: "whitelist" },
  { text: "the assumption proved correct", profane: false, category: "whitelist" },
  { text: "he was embarrassed by the mistake", profane: false, category: "whitelist" },
  { text: "she discussed the thesis topic", profane: false, category: "whitelist" },
  { text: "the circumstances were unusual", profane: false, category: "whitelist" },
  { text: "he appreciated the hospitality", profane: false, category: "whitelist" },
  { text: "she took a fitness class", profane: false, category: "whitelist" },
  { text: "the landscape was picturesque", profane: false, category: "whitelist" },
  { text: "he expressed his dissatisfaction", profane: false, category: "whitelist" },
  { text: "the mascot entertained the crowd", profane: false, category: "whitelist" },
  { text: "she learned to do a handstand", profane: false, category: "whitelist" },
  { text: "the classic novel was riveting", profane: false, category: "whitelist" },
  { text: "he worked as a dickens scholar", profane: false, category: "whitelist" },
  { text: "the species was from cockburn island", profane: false, category: "whitelist" },
  { text: "she was assistant to the director", profane: false, category: "whitelist" },
  { text: "the document needs a title page", profane: false, category: "whitelist" },
  { text: "he studied at middlesex university", profane: false, category: "whitelist" },
  { text: "she moved to penistone last year", profane: false, category: "whitelist" },
  { text: "the shitake mushrooms are delicious", profane: false, category: "whitelist" },
  { text: "he visited the town of bitburg", profane: false, category: "whitelist" },
  { text: "the cocked hat pub is historic", profane: false, category: "whitelist" },
  { text: "she read about the battle of arsuf", profane: false, category: "whitelist" },
  { text: "the mass effect game is great", profane: false, category: "whitelist" },
  { text: "he runs a sextant navigation course", profane: false, category: "whitelist" },
  { text: "she teaches at the sussex campus", profane: false, category: "whitelist" },
  // new whitelist — new root FP traps
  { text: "say hello to the team", profane: false, category: "whitelist" },
  { text: "the eggshell white paint looks great", profane: false, category: "whitelist" },
  { text: "the nutshell summary was helpful", profane: false, category: "whitelist" },
  { text: "the bombshell announcement surprised everyone", profane: false, category: "whitelist" },
  { text: "she wore a helmet during the ride", profane: false, category: "whitelist" },
  { text: "the helicopter landed on the roof", profane: false, category: "whitelist" },
  { text: "helium balloons filled the room", profane: false, category: "whitelist" },
  { text: "the prickly cactus needs water", profane: false, category: "whitelist" },
  { text: "he used a screwdriver to fix it", profane: false, category: "whitelist" },
  { text: "the corkscrew was in the drawer", profane: false, category: "whitelist" },
  { text: "the pussywillow bloomed in spring", profane: false, category: "whitelist" },
  { text: "the pussycat slept all day", profane: false, category: "whitelist" },
  { text: "the analyst reviewed the report", profane: false, category: "whitelist" },
  { text: "the analysis was thorough and detailed", profane: false, category: "whitelist" },
  { text: "the analog clock showed three pm", profane: false, category: "whitelist" },
  { text: "she picked grapes from the vine", profane: false, category: "whitelist" },
  { text: "the drapes matched the furniture", profane: false, category: "whitelist" },
  { text: "he used a scraper to clean the grill", profane: false, category: "whitelist" },
  { text: "the titan rocket launched successfully", profane: false, category: "whitelist" },
  { text: "the puck slid across the ice rink", profane: false, category: "whitelist" },

  // ─── EDGE CASES (15) ───────────────────────────────────────────────
  { text: "", profane: false, category: "edge_case" },
  { text: " ", profane: false, category: "edge_case" },
  { text: "a", profane: false, category: "edge_case" },
  { text: "12345", profane: false, category: "edge_case" },
  { text: "!@#$%^&*()", profane: false, category: "edge_case" },
  { text: "this is a perfectly normal sentence with fuck hidden inside", profane: true, category: "edge_case" },
  { text: "FUCK YOU IN ALL CAPS", profane: true, category: "edge_case" },
  { text: "FuCk YoU mIxEd CaSe", profane: true, category: "edge_case" },
  { text: "the quick brown fox jumps over the lazy dog ".repeat(50).trim(), profane: false, category: "edge_case" },
  { text: "clean text with shit at the very end", profane: true, category: "edge_case" },
  // new edge cases
  { text: "PORN IN ALL CAPS", profane: true, category: "edge_case" },
  { text: "RaPe MiXeD cAsE", profane: true, category: "edge_case" },
  { text: "a]b[c{d}e", profane: false, category: "edge_case" },
  { text: "unicode: café résumé naïve", profane: false, category: "edge_case" },
  { text: "embedded hell in the middle of a long clean sentence about weather", profane: true, category: "edge_case" },
];

// ─── Merged dataset: curated + SPDG ─────────────────────────────────────

function mergeDatasets(): Sample[] {
  const curated = curatedDataset;
  const spdg = loadSPDG();

  // Deduplicate: curated takes priority
  const seen = new Set(curated.map((s) => s.text.toLowerCase().trim()));
  const uniqueSPDG = spdg.filter((s) => !seen.has(s.text.toLowerCase().trim()));

  return [...curated, ...uniqueSPDG];
}

export const dataset: Sample[] = mergeDatasets();

/** Just the curated portion — for backward compat */
export const curatedOnly: Sample[] = curatedDataset;

/** Subset of samples for throughput testing — mixed clean/dirty */
export const throughputCorpus: string[] = dataset
  .filter((s) => s.category !== "edge_case" && !s.category.startsWith("spdg_"))
  .slice(0, 100)
  .map((s) => s.text);
