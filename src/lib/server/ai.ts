import { eq } from "drizzle-orm";
import { db } from "@/db";
import { appSettings } from "@/db/schema";

/* ====================================================================== *
 *  Lecture robuste des secrets (Gemini / Hugging Face) — serveur uniquement.
 * ====================================================================== */

function clean(raw: string | undefined) {
  if (!raw) return "";
  return String(raw).trim().replace(/^["']|["']$/g, "").trim();
}

export function readSecret(names: string[]) {
  for (const name of names) {
    const value = clean(process.env[name]);
    if (value) return value;
  }
  return "";
}

export function geminiKey() {
  return readSecret(["GEMINI_API_KEY", "Gemini_API_Key", "GOOGLE_API_KEY", "GOOGLE_GENAI_API_KEY", "API_KEY"]);
}

export const isGeminiKey = (key: string) => key.startsWith("AIza") || key.length > 30;

export function hfToken() {
  return readSecret(["HF_TOKEN", "HUGGING_FACE_HUB_TOKEN", "HUGGINGFACE_API_KEY", "HUGGINGFACE_TOKEN", "HF_API_KEY"]);
}

export const isHfToken = (token: string) =>
  token.startsWith("hf_") || (token.length > 20 && !token.startsWith("sk-or") && !token.startsWith("AIza"));

export function detectAiProvider(): "gemini" | "huggingface" | "local" {
  if (isGeminiKey(geminiKey())) return "gemini";
  if (isHfToken(hfToken())) return "huggingface";
  return "local";
}

export function aiProviderLabel() {
  const p = detectAiProvider();
  if (p === "gemini") return "Google Gemini";
  if (p === "huggingface") return "Hugging Face";
  return "Moteur local";
}

/* ====================================================================== *
 *  Google Gemini — endpoint OpenAI-compatible + API native (audio/vision).
 * ====================================================================== */

const GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
const GEMINI_NATIVE_URL = "https://generativelanguage.googleapis.com/v1beta/models";

function readEnv(name: string, fallback: string) {
  const raw = process.env[name];
  return raw ? String(raw).trim().replace(/^["']|["']$/g, "").trim() || fallback : fallback;
}

export const GEMINI_TEXT_MODEL = readEnv("GEMINI_TEXT_MODEL", "gemini-2.5-flash-lite");
export const GEMINI_VISION_MODEL = readEnv("GEMINI_VISION_MODEL", "gemini-2.5-flash-lite");
const MODEL_FALLBACKS = ["gemini-2.5-flash-lite", "gemini-2.5-flash", "gemini-2.0-flash", "gemini-flash-lite-latest"];

type ChatMessage = { role: string; content: unknown };

export async function geminiChat(messages: ChatMessage[], options: Record<string, unknown> = {}) {
  const key = geminiKey();
  if (!key) throw new Error("Clé Gemini introuvable dans l'environnement.");
  const wanted = (options.model as string) ?? GEMINI_TEXT_MODEL;
  const candidates = [wanted, ...MODEL_FALLBACKS.filter((m) => m !== wanted)];
  let lastError: Error | null = null;
  for (const model of candidates) {
    try {
      return await callGemini(key, model, messages, options);
    } catch (err) {
      lastError = err as Error;
      const msg = String((err as Error).message ?? "");
      if (!/404|not found|not exist|NOT_FOUND/i.test(msg)) throw err;
    }
  }
  throw lastError ?? new Error("Échec Gemini.");
}

async function callGemini(key: string, model: string, messages: ChatMessage[], options: Record<string, unknown>) {
  const body: Record<string, unknown> = {
    model,
    messages,
    temperature: options.temperature ?? 0.7,
    max_tokens: options.maxTokens ?? 4000,
  };
  if (options.jsonMode) body.response_format = { type: "json_object" };
  const res = await fetch(GEMINI_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (res.status === 429) throw new Error("Limite de requêtes Gemini atteinte — réessayez dans quelques instants.");
  if (res.status === 401 || res.status === 403) throw new Error("Clé Gemini invalide.");
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Erreur Gemini (${res.status}) : ${detail.slice(0, 200)}`);
  }
  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("Réponse Gemini vide.");
  return String(content).trim();
}

export async function geminiTranscribe(buffer: Buffer, mimeType: string) {
  const key = geminiKey();
  if (!key) throw new Error("Clé Gemini introuvable.");
  const base64 = buffer.toString("base64");
  const model = readEnv("GEMINI_AUDIO_MODEL", GEMINI_TEXT_MODEL);
  const body = {
    contents: [
      {
        parts: [
          { text: "Transcris fidèlement cet audio en français. Réponds uniquement avec le texte transcrit, sans commentaire." },
          { inline_data: { mime_type: mimeType || "audio/webm", data: base64 } },
        ],
      },
    ],
    generationConfig: { temperature: 0.1, maxOutputTokens: 2048 },
  };
  const res = await fetch(`${GEMINI_NATIVE_URL}/${model}:generateContent?key=${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (res.status === 429) throw new Error("Limite de requêtes Gemini atteinte — réessayez.");
  if (res.status === 401 || res.status === 403) throw new Error("Clé Gemini invalide.");
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Erreur transcription Gemini (${res.status}) : ${detail.slice(0, 200)}`);
  }
  const data = (await res.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
  return String(data.candidates?.[0]?.content?.parts?.[0]?.text ?? "").trim();
}

/* ------------------------- OCR (vision) commun ------------------------- */

type StudentRef = { id: string; name: string };

export function parseOcrResult(raw: string, students: StudentRef[]) {
  const match = String(raw).match(/\{[\s\S]*\}/);
  if (!match) return [];
  let parsed: { grades?: Array<{ student_id?: string; value?: number; name?: string }> };
  try {
    parsed = JSON.parse(match[0]);
  } catch {
    return [];
  }
  const grades = parsed.grades ?? [];
  const validIds = new Set(students.map((s) => s.id));
  const result: Array<{ studentId: string; value: number }> = [];
  for (const g of grades) {
    const value = Number(g.value);
    if (Number.isNaN(value)) continue;
    const clamped = Math.max(0, Math.min(20, value));
    if (g.student_id && validIds.has(g.student_id)) {
      result.push({ studentId: g.student_id, value: clamped });
    } else if (g.name) {
      const found = fuzzyMatch(g.name, students);
      if (found) result.push({ studentId: found, value: clamped });
    }
  }
  return result;
}

function normalize(s: string) {
  return String(s)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, "")
    .trim();
}

function fuzzyMatch(name: string, students: StudentRef[]) {
  const target = normalize(name);
  let best: { id: string; score: number } | null = null;
  for (const s of students) {
    const candidate = normalize(s.name);
    if (candidate.includes(target) || target.includes(candidate)) return s.id;
    const score = jaccard(target, candidate);
    if (!best || score > best.score) best = { id: s.id, score };
  }
  return best && best.score > 0.5 ? best.id : null;
}

function jaccard(a: string, b: string) {
  const sa = new Set(a.split(" "));
  const sb = new Set(b.split(" "));
  const inter = [...sa].filter((x) => sb.has(x)).length;
  const union = new Set([...sa, ...sb]).size || 1;
  return inter / union;
}

export async function geminiOcrGrades({ imageDataUrl, students }: { imageDataUrl: string; students: StudentRef[] }) {
  const roster = students.map((s, i) => `${i + 1}. ${s.name}`).join("\n");
  const system = [
    "Tu es un assistant OCR spécialisé dans la lecture de relevés de notes scolaires.",
    "Tu reçois la photo d'une feuille de notes (sur 20).",
    "Pour chaque élève reconnu, extrais sa note et associe-la à l'élève de la liste fournie",
    "en utilisant la correspondance de nom la plus proche (tolérant aux coquilles).",
    "Réponds UNIQUEMENT avec un objet JSON valide, sans texte autour.",
  ].join(" ");
  const user = {
    role: "user",
    content: [
      {
        type: "text",
        text: `Liste des élèves de la classe :\n${roster}\n\nExtrais les notes de l'image. Réponds en JSON strict :\n{"grades":[{"student_id":"<id>","value":<nombre sur 20>}]}\nSi une note est illisible, ignore cet élève.`,
      },
      { type: "image_url", image_url: { url: imageDataUrl } },
    ],
  };
  const raw = await geminiChat([{ role: "system", content: system }, user], {
    model: GEMINI_VISION_MODEL,
    temperature: 0.1,
    maxTokens: 1600,
    jsonMode: true,
  });
  return parseOcrResult(raw, students);
}

/* ====================================================================== *
 *  Hugging Face Router — API compatible OpenAI (repli optionnel).
 * ====================================================================== */

const HF_ROUTER_URL = "https://router.huggingface.co/v1/chat/completions";
const HF_AUDIO_URL = "https://router.huggingface.co/v1/audio/transcriptions";
export const HF_TEXT_MODEL = readEnv("HF_TEXT_MODEL", "meta-llama/Llama-3.1-8B-Instruct:novita");
export const HF_VISION_MODEL = readEnv("HF_VISION_MODEL", "moonshotai/Kimi-K3:together");
export const HF_AUDIO_MODEL = readEnv("HF_AUDIO_MODEL", "openai/whisper-large-v3");

export async function hfChat(messages: ChatMessage[], options: Record<string, unknown> = {}) {
  const token = hfToken();
  if (!token) throw new Error("Jeton Hugging Face introuvable dans l'environnement.");
  const body: Record<string, unknown> = {
    model: options.model ?? HF_TEXT_MODEL,
    messages,
    temperature: options.temperature ?? 0.7,
    max_tokens: options.maxTokens ?? 4000,
  };
  if (options.jsonMode) body.response_format = { type: "json_object" };
  const res = await fetch(HF_ROUTER_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (res.status === 429) throw new Error("Limite de requêtes Hugging Face atteinte — réessayez.");
  if (res.status === 401) throw new Error("Jeton HF_TOKEN invalide.");
  if (res.status === 402) throw new Error("Crédits Hugging Face insuffisants.");
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Erreur HF Router (${res.status}) : ${detail.slice(0, 200)}`);
  }
  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("Réponse HF Router vide.");
  return String(content).trim();
}

export function cleanAiOutput(raw: string) {
  let text = String(raw).trim();
  text = text.replace(/<think>[\s\S]*?<\/think>/gi, "");
  text = text.replace(/<reasoning>[\s\S]*?<\/reasoning>/gi, "");
  const syn = text.indexOf("## ");
  if (syn > 0 && text.slice(0, syn).length < 400) text = text.slice(syn);
  return text.trim();
}

export async function hfOcrGrades({ imageDataUrl, students }: { imageDataUrl: string; students: StudentRef[] }) {
  const roster = students.map((s, i) => `${i + 1}. ${s.name}`).join("\n");
  const system = [
    "Tu es un assistant OCR spécialisé dans la lecture de relevés de notes scolaires.",
    "Tu reçois la photo d'une feuille de notes (sur 20).",
    "Pour chaque élève reconnu, extrais sa note et associe-la à l'élève de la liste fournie.",
    "Réponds UNIQUEMENT avec un objet JSON valide.",
  ].join(" ");
  const user = {
    role: "user",
    content: [
      { type: "text", text: `Liste des élèves :\n${roster}\n\nExtrais les notes. JSON strict : {"grades":[{"student_id":"<id>","value":<nombre>}]}` },
      { type: "image_url", image_url: { url: imageDataUrl } },
    ],
  };
  const raw = await hfChat([{ role: "system", content: system }, user], {
    model: HF_VISION_MODEL,
    temperature: 0.1,
    maxTokens: 1200,
    jsonMode: true,
  });
  return parseOcrResult(raw, students);
}

export async function hfTranscribe(buffer: Buffer, mimeType: string) {
  const token = hfToken();
  if (!token) throw new Error("Jeton Hugging Face introuvable.");
  const ext = mimeType.includes("webm") ? "webm" : mimeType.includes("ogg") ? "ogg" : "m4a";
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(buffer)], { type: mimeType }), `audio.${ext}`);
  form.append("model", HF_AUDIO_MODEL);
  form.append("language", "fr");
  const res = await fetch(HF_AUDIO_URL, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: form });
  if (res.status === 429) throw new Error("Limite de requêtes Hugging Face atteinte — réessayez.");
  if (res.status === 401) throw new Error("Jeton HF_TOKEN invalide.");
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Erreur transcription HF (${res.status}) : ${detail.slice(0, 200)}`);
  }
  const data = (await res.json()) as { text?: string };
  return String(data.text ?? "").trim();
}

/* ====================================================================== *
 *  Analyse pédagogique IA (Gemini → Hugging Face → moteur local).
 * ====================================================================== */

export const LENGTH_TOKENS: Record<string, number> = { standard: 4000, detaille: 8000, exhaustif: 16000 };

async function readSetting(key: string) {
  const rows = await db.select().from(appSettings).where(eq(appSettings.key, key)).limit(1);
  return rows[0]?.value ?? null;
}

async function writeSetting(key: string, value: string) {
  const now = new Date().toISOString();
  await db
    .insert(appSettings)
    .values({ key, value, updated_at: now })
    .onConflictDoUpdate({ target: appSettings.key, set: { value, updated_at: now } });
}

export async function getAiSettings() {
  const [providerRaw, modelRaw, lengthRaw] = await Promise.all([
    readSetting("ai_provider"),
    readSetting("ai_model"),
    readSetting("ai_length"),
  ]);
  const length = lengthRaw || "exhaustif";
  return {
    provider: providerRaw || "auto",
    model: modelRaw ?? "",
    length,
    maxTokens: LENGTH_TOKENS[length] ?? LENGTH_TOKENS.exhaustif,
  };
}

export async function setAiSettings(values: { provider?: string; model?: string; length?: string }) {
  if (values.provider !== undefined) await writeSetting("ai_provider", values.provider);
  if (values.model !== undefined) await writeSetting("ai_model", values.model);
  if (values.length !== undefined) await writeSetting("ai_length", values.length);
}

export function resolveProvider(choice: string) {
  if (choice === "auto") return detectAiProvider();
  return choice;
}

/* ------------------------ Statistiques utilitaires --------------------- */

type GradeRow = { value: number; max_value: number; term: string; subject_id: string; student_id: string };

function average(grades: GradeRow[]) {
  if (!grades.length) return 0;
  return grades.reduce((sum, g) => sum + (Number(g.value) / (Number(g.max_value) || 20)) * 20, 0) / grades.length;
}

function fullName(p: { last_name?: string; first_name?: string }) {
  return `${String(p.last_name ?? "").toUpperCase()} ${p.first_name ?? ""}`.trim();
}

function mention(avg: number) {
  if (avg >= 16) return "Excellent";
  if (avg >= 14) return "Très bien";
  if (avg >= 12) return "Bien";
  if (avg >= 10) return "Assez bien";
  if (avg >= 8) return "Insuffisant";
  return "Faible";
}

type AnalysisParams = {
  term: string;
  termLabel: string;
  students: Array<Record<string, unknown>>;
  subjects: Array<Record<string, unknown>>;
  grades: GradeRow[];
  attendance: Array<{ status: string }>;
  payments: Array<{ amount: number; status: string }>;
  focus?: string;
};

function buildDataContext(params: AnalysisParams) {
  const { termLabel, students, subjects, grades, attendance, payments } = params;
  const termGrades = params.term === "all" ? grades : grades.filter((g) => g.term === params.term);
  const general = average(termGrades);

  const perSubject = subjects
    .map((s) => {
      const own = termGrades.filter((g) => g.subject_id === s.id);
      const values = own.map((g) => (Number(g.value) / (Number(g.max_value) || 20)) * 20);
      const max = values.length ? Math.max(...values) : 0;
      const min = values.length ? Math.min(...values) : 0;
      const above10 = values.filter((v) => v >= 10).length;
      return {
        name: s.name,
        avg: average(own),
        count: own.length,
        coef: Number(s.coefficient) || 1,
        max,
        min,
        successRate: values.length ? (above10 / values.length) * 100 : 0,
      };
    })
    .sort((a, b) => a.avg - b.avg);

  const perStudent = students
    .map((s) => ({
      name: fullName(s),
      avg: average(termGrades.filter((g) => g.student_id === s.id)),
      count: termGrades.filter((g) => g.student_id === s.id).length,
    }))
    .filter((s) => s.count > 0)
    .sort((a, b) => b.avg - a.avg);

  const top5 = perStudent.slice(0, 5);
  const atRisk = perStudent.filter((s) => s.avg < 10);
  const middle = perStudent.filter((s) => s.avg >= 10 && s.avg < 12);

  const dist = {
    excellent: perStudent.filter((s) => s.avg >= 16).length,
    tresBien: perStudent.filter((s) => s.avg >= 14 && s.avg < 16).length,
    bien: perStudent.filter((s) => s.avg >= 12 && s.avg < 14).length,
    assezBien: perStudent.filter((s) => s.avg >= 10 && s.avg < 12).length,
    faible: perStudent.filter((s) => s.avg < 10).length,
  };

  const classIds = new Set(students.map((s) => s.class_id).filter(Boolean));
  const perClass = [...classIds].map((cid) => {
    const classStudents = students.filter((s) => s.class_id === cid);
    const ids = new Set(classStudents.map((s) => s.id));
    const classGrades = termGrades.filter((g) => ids.has(g.student_id));
    return { name: `Classe ${cid}`, effectif: classStudents.length, avg: average(classGrades) };
  });

  const presenceRate = attendance.length
    ? (attendance.filter((a) => a.status === "present").length / attendance.length) * 100
    : 100;
  const absentCount = attendance.filter((a) => a.status === "absent").length;
  const lateCount = attendance.filter((a) => a.status === "retard").length;

  const revenue = payments.reduce((s, p) => s + Number(p.amount || 0), 0);
  const paidCount = payments.filter((p) => p.status === "paye").length;
  const pendingRevenue = payments.filter((p) => p.status !== "paye").reduce((s, p) => s + Number(p.amount || 0), 0);

  return [
    `DONNÉES COMPLÈTES DE L'ÉTABLISSEMENT — Période : ${termLabel}`,
    `Effectif : ${students.length} élèves | ${subjects.length} matières | ${classIds.size} classes | ${termGrades.length} notes saisies`,
    `Moyenne générale : ${general.toFixed(2)}/20`,
    `Taux de présence : ${presenceRate.toFixed(1)}% | Absences : ${absentCount} | Retards : ${lateCount} (sur ${attendance.length} pointages)`,
    `Recettes encaissées : ${Math.round(revenue).toLocaleString("fr-FR")} FCFA | En attente : ${Math.round(pendingRevenue).toLocaleString("fr-FR")} FCFA (${paidCount}/${payments.length} paiements réglés)`,
    ``,
    `MOYENNES PAR MATIÈRE (triées croissant) — moyenne / min / max / taux de réussite (≥10) :`,
    ...perSubject
      .filter((s) => s.count > 0)
      .map((s) => `  - ${s.name} : ${s.avg.toFixed(2)}/20 | min ${s.min.toFixed(1)} max ${s.max.toFixed(1)} | réussite ${s.successRate.toFixed(0)}% | ${s.count} notes, coef ${s.coef}`),
    ``,
    `DISTRIBUTION DES MOYENNES ÉLÈVES :`,
    `  Excellent (≥16) : ${dist.excellent} | Très bien (14-16) : ${dist.tresBien} | Bien (12-14) : ${dist.bien} | Assez bien (10-12) : ${dist.assezBien} | Faible (<10) : ${dist.faible}`,
    ``,
    `RÉPARTITION PAR CLASSE :`,
    ...perClass.map((c) => `  - ${c.name} : ${c.avg.toFixed(2)}/20 (${c.effectif} élèves)`),
    ``,
    `TOP 5 ÉLÈVES :`,
    ...top5.map((s, i) => `  ${i + 1}. ${s.name} — ${s.avg.toFixed(2)}/20 (${s.count} notes)`),
    ``,
    `ÉLÈVES EN DIFFICULTÉ (< 10/20) — ${atRisk.length} élève(s) :`,
    ...(atRisk.length ? atRisk.map((s) => `  - ${s.name} — ${s.avg.toFixed(2)}/20 (${s.count} notes)`) : ["  Aucun"]),
    ``,
    `ÉLÈVES FRAGILES (10-12/20) — ${middle.length} élève(s) :`,
    ...(middle.length ? middle.slice(0, 8).map((s) => `  - ${s.name} — ${s.avg.toFixed(2)}/20`) : ["  Aucun"]),
  ].join("\n");
}

function buildSystemPrompt() {
  return [
    `Tu es un conseiller pédagogique expert et un chef d'établissement expérimenté, travaillant pour EduSync Pro, une plateforme de gestion scolaire au Gabon (système éducatif francophone, notes sur 20).`,
    `Analyse en PROFONDEUR les données fournies et rédige un RAPPORT COMPLET, DÉTAILLÉ et SUBSTANTIEL en Markdown français.`,
    ``,
    `IMPORTANT : Réponds directement avec le rapport final. Ne montre AUCUN raisonnement interne.`,
    `Commence immédiatement par "## Synthèse".`,
    `Le rapport doit être TRÈS LONG, EXHAUSTIF et RICHE (14 sections développées, plusieurs paragraphes denses par section, au moins 2000 mots).`,
    `Chaque analyse doit être approfondie, argumentée, nuancée, et appuyée sur les chiffres réels fournis.`,
    `N'économise pas sur les détails : plus c'est complet, mieux c'est.`,
    ``,
    `STRUCTURE OBLIGATOIRE (développe chaque section sur plusieurs paragraphes) :`,
    `1. ## Synthèse — [période] (bilan exécutif : moyenne, effectif, présence, finances, enjeux)`,
    `2. ### Analyse des performances par matière`,
    `3. ### Analyse comparative entre classes`,
    `4. ### Distribution et niveaux des élèves`,
    `5. ### Points forts de la période`,
    `6. ### Axes d'amélioration prioritaires`,
    `7. ### Élèves à valoriser`,
    `8. ### Élèves en difficulté — plan d'action individualisé`,
    `9. ### Élèves fragiles à surveiller`,
    `10. ### Analyse de l'assiduité`,
    `11. ### Analyse financière`,
    `12. ### Plan d'action global et priorisé`,
    `13. ### Recommandations pédagogiques par matière`,
    `14. ### Synthèse et perspectives`,
    ``,
    `RÈGLES : sois concret, nuancé, actionnable. Utilise les chiffres et noms fournis.`,
    `Format Markdown : titres ##/###, listes -, **gras** pour les chiffres clés.`,
  ].join("\n");
}

/* ----------------------- Analyse locale (fallback) --------------------- */

function localSchoolAnalysis(params: AnalysisParams & { attendanceRate?: number; totalRevenue?: number }) {
  const { termLabel, students, subjects, focus } = params;
  const grades = params.grades;
  const termGrades = params.term === "all" ? grades : grades.filter((g) => g.term === params.term);
  const general = average(termGrades);
  const lines: string[] = [];

  const perSubject = subjects
    .map((s) => {
      const own = termGrades.filter((g) => g.subject_id === s.id);
      const values = own.map((g) => (Number(g.value) / (Number(g.max_value) || 20)) * 20);
      return {
        name: s.name,
        avg: average(own),
        count: own.length,
        coef: Number(s.coefficient) || 1,
        min: values.length ? Math.min(...values) : 0,
        max: values.length ? Math.max(...values) : 0,
        successRate: values.length ? (values.filter((v) => v >= 10).length / values.length) * 100 : 0,
      };
    })
    .sort((a, b) => a.avg - b.avg);

  const notedSubjects = perSubject.filter((s) => s.count > 0);
  const weakestSubject = notedSubjects[0];
  const bestSubject = notedSubjects[notedSubjects.length - 1];

  const perStudent = students
    .map((s) => ({
      name: fullName(s),
      avg: average(termGrades.filter((g) => g.student_id === s.id)),
      count: termGrades.filter((g) => g.student_id === s.id).length,
    }))
    .filter((s) => s.count > 0)
    .sort((a, b) => b.avg - a.avg);

  const top = perStudent.slice(0, 3);
  const atRisk = perStudent.filter((s) => s.avg < 10);
  const fragile = perStudent.filter((s) => s.avg >= 10 && s.avg < 12);

  const dist = {
    excellent: perStudent.filter((s) => s.avg >= 16).length,
    tresBien: perStudent.filter((s) => s.avg >= 14 && s.avg < 16).length,
    bien: perStudent.filter((s) => s.avg >= 12 && s.avg < 14).length,
    assezBien: perStudent.filter((s) => s.avg >= 10 && s.avg < 12).length,
    faible: perStudent.filter((s) => s.avg < 10).length,
  };

  lines.push(`## Synthèse — ${termLabel}`);
  lines.push("");
  lines.push(`**Moyenne générale :** **${general.toFixed(2)}/20** sur **${termGrades.length} notes** saisies · **Effectif :** **${students.length}** élèves · **${subjects.length} matières** notées sur la période.`);
  if (params.attendanceRate != null) lines.push(`**Taux de présence :** **${params.attendanceRate.toFixed(1)}%**.`);
  if (params.totalRevenue != null) lines.push(`**Recettes encaissées :** **${Math.round(params.totalRevenue).toLocaleString("fr-FR")} FCFA**.`);
  lines.push(`Le niveau global de l'établissement est **${mention(general).toLowerCase()}** (${general.toFixed(2)}/20). ${general >= 12 ? "Les résultats sont globalement satisfaisants, mais des écarts significatifs subsistent entre matières et entre élèves." : "Une attention particulière doit être portée au niveau moyen, qui reste en deçà du seuil de réussite attendu."}`);
  if (focus) { lines.push(""); lines.push(`> **Axe demandé :** ${focus} — voir la section dédiée ci-dessous.`); }
  lines.push("");

  if (notedSubjects.length) {
    lines.push("### Analyse des performances par matière");
    lines.push("");
    notedSubjects.forEach((s) => {
      lines.push(`**${s.name}** — moyenne **${s.avg.toFixed(2)}/20** (coef ${s.coef}) · notes de ${s.min.toFixed(1)} à ${s.max.toFixed(1)} · taux de réussite **${s.successRate.toFixed(0)}%** (${s.count} évaluations).`);
    });
    lines.push("");
    if (weakestSubject) lines.push(`La matière la plus fragile est **${weakestSubject.name}** (${weakestSubject.avg.toFixed(2)}/20, réussite ${weakestSubject.successRate.toFixed(0)}%). ${weakestSubject.coef >= 3 ? `Son coefficient élevé (${weakestSubject.coef}) pèse lourdement sur les moyennes générales.` : "Son coefficient modéré limite son impact mais reste à surveiller."}`);
    lines.push("");
  }

  lines.push("### Distribution et niveaux des élèves");
  lines.push("");
  lines.push(`Répartition des moyennes : **Excellent (≥16) :** ${dist.excellent} · **Très bien (14–16) :** ${dist.tresBien} · **Bien (12–14) :** ${dist.bien} · **Assez bien (10–12) :** ${dist.assezBien} · **Faible (<10) :** ${dist.faible}.`);
  const share = perStudent.length ? ((dist.excellent + dist.tresBien + dist.bien) / perStudent.length) * 100 : 0;
  lines.push(`**${share.toFixed(0)}%** des élèves évalués atteignent au moins la mention « Bien ». ${dist.faible > perStudent.length / 4 ? "La proportion d'élèves en difficulté est préoccupante et justifie un plan de remédiation." : "Le nombre d'élèves en difficulté reste contenu."}`);
  lines.push("");

  if (bestSubject) { lines.push("### Points forts de la période"); lines.push(""); lines.push(`La matière la plus réussie est **${bestSubject.name}** (**${bestSubject.avg.toFixed(2)}/20**, réussite ${bestSubject.successRate.toFixed(0)}%). Cette dynamique positive doit être valorisée et servie d'exemple pour les autres disciplines.`); lines.push(""); }
  if (weakestSubject) { lines.push("### Axes d'amélioration prioritaires"); lines.push(""); lines.push(`**${weakestSubject.name}** (${weakestSubject.avg.toFixed(2)}/20) requiert une action immédiate. Causes probables : progression trop rapide, évaluations mal calibrées (écart mini-maxi de ${(weakestSubject.max - weakestSubject.min).toFixed(1)} points), ou difficultés conceptuelles des élèves.`); lines.push(""); }
  if (top.length) { lines.push("### Élèves à valoriser"); lines.push(""); top.forEach((s, i) => lines.push(`${i + 1}. **${s.name}** — **${s.avg.toFixed(2)}/20** (${mention(s.avg)}). Excellence à entretenir et à récompenser.`)); lines.push(""); }
  if (atRisk.length) { lines.push("### Élèves en difficulté — plan d'action individualisé"); lines.push(""); atRisk.forEach((s) => lines.push(`- **${s.name}** — **${s.avg.toFixed(2)}/20** : mise en place d'un soutien ciblé, entretien individualisé et contact avec la famille. Suivi hebdomadaire recommandé.`)); lines.push(""); }
  if (fragile.length) { lines.push("### Élèves fragiles à surveiller (10–12/20)"); lines.push(""); fragile.slice(0, 8).forEach((s) => lines.push(`- **${s.name}** — ${s.avg.toFixed(2)}/20 : marge de progression étroite, accompagnement préventif conseillé.`)); lines.push(""); }
  if (params.attendanceRate != null) { lines.push("### Analyse de l'assiduité"); lines.push(""); lines.push(`Le taux de présence est de **${params.attendanceRate.toFixed(1)}%**. ${params.attendanceRate >= 90 ? "L'assiduité est satisfaisante." : "L'absentéisme affecte potentiellement les résultats — un suivi renforcé des présences est recommandé."}`); lines.push(""); }
  if (params.totalRevenue != null) { lines.push("### Analyse financière"); lines.push(""); lines.push(`Les recettes encaissées s'élèvent à **${Math.round(params.totalRevenue).toLocaleString("fr-FR")} FCFA**. Un suivi rigoureux des paiements en attente garantit la trésorerie de l'établissement.`); lines.push(""); }

  lines.push("### Plan d'action global et priorisé");
  lines.push("");
  lines.push("**Immédiat :**");
  lines.push(`- Lancer un plan de soutien en ${weakestSubject?.name ?? "—"}.`);
  lines.push(`- Convoquer les ${atRisk.length} élève(s) sous la moyenne pour un entretien.`);
  lines.push("**Court terme :**");
  lines.push("- Recalibrer les évaluations des matières à forte dispersion.");
  lines.push("- Contacter les familles des élèves fragiles (10–12/20).");
  lines.push("**Moyen terme :**");
  lines.push("- Valoriser publiquement les élèves méritants (mentions, affichage).");
  lines.push("- Renforcer le suivi de l'assiduité et du recouvrement financier.");
  if (focus) { lines.push(""); lines.push("### Réponse à l'axe demandé"); lines.push(""); lines.push(`Concernant « ${focus} » : ${weakestSubject ? `concentrez les efforts sur ${weakestSubject.name}` : "adaptez la stratégie pédagogique"}, avec un pilotage par le coefficient et le taux de réussite observés.`); }

  return lines.join("\n");
}

/* ------------------------- Orchestrateur principal -------------------- */

export async function generateAnalysis(params: AnalysisParams) {
  const settings = await getAiSettings();
  const provider = resolveProvider(settings.provider);
  const maxTokens = settings.maxTokens;

  const dataContext = buildDataContext(params);
  const userPrompt = [dataContext, "", params.focus ? `AXE D'ANALYSE DEMANDÉ : ${params.focus}` : "Analyse globale de la période.", "", "Rédige le rapport maintenant."].join("\n");
  const systemPrompt = buildSystemPrompt();

  if (provider === "gemini") {
    try {
      const model = settings.model || GEMINI_TEXT_MODEL;
      const raw = await geminiChat(
        [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
        { model, temperature: 0.7, maxTokens },
      );
      return { report: cleanAiOutput(raw), source: "gemini" as const, model };
    } catch (error) {
      console.error("[gemini] échec analyse :", (error as Error).message);
    }
  }

  if (provider === "huggingface" || provider === "gemini") {
    try {
      const model = settings.model || HF_TEXT_MODEL;
      const raw = await hfChat(
        [{ role: "system", content: systemPrompt }, { role: "user", content: userPrompt }],
        { model, temperature: 0.7, maxTokens },
      );
      return { report: cleanAiOutput(raw), source: "huggingface" as const, model };
    } catch (error) {
      console.error("[hf-router] échec analyse :", (error as Error).message);
    }
  }

  const att = params.attendance.length
    ? (params.attendance.filter((a) => a.status === "present").length / params.attendance.length) * 100
    : 100;
  const revenue = params.payments.reduce((s, p) => s + Number(p.amount || 0), 0);
  const report = localSchoolAnalysis({
    ...params,
    attendanceRate: att,
    totalRevenue: revenue,
  });
  return { report, source: "local" as const, model: "local" };
}
