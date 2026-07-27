import type { SupabaseClient } from "@supabase/supabase-js";
import Anthropic from "@anthropic-ai/sdk";

// Proactive AI: scans the user's recent data and drops small "Did you mean X?"
// prompts into `ai_nudges`. Each nudge is idempotent (dedupe_key) and carries
// an `action` payload that the accept endpoint can apply mechanically.

// Two heuristics run first, then Claude fills gaps for real judgment calls.
//   H1 — expense on the PERSONAL account with a merchant that looks like work
//        (Uber, Lyft, gas, coffee) → "¿fue de negocio?"
//   H2 — event that just passed and has no follow-up task → "¿te agendo follow-up?"
//   H3 — Claude reviews the last 14 days of business-account expenses that
//        stayed in the 'personal' category and suggests a Schedule C category
//        (deductions the user is leaving on the table).

/* eslint-disable @typescript-eslint/no-explicit-any */
type DB = SupabaseClient<any, any, any>;

type Nudge = {
  user_id: string;
  kind: string;
  text: string;
  action: any;
  dedupe_key: string;
};

const WORK_HINTS = /\b(uber|lyft|chevron|shell|76 |mobil|arco|starbucks|peet|philz|wework|regus|office|amazon|adobe|figma|notion|zoom|slack|apple\.com\/bill|google \*)/i;

const CATS = [
  "gas", "food", "tech", "travel", "software", "ads", "office", "phone", "pro", "insurance", "rent", "home", "education",
] as const;

export async function generateNudges(admin: DB, userId: string): Promise<number> {
  const today = new Date();
  const isoAgo = (days: number) => { const d = new Date(today); d.setDate(today.getDate() - days); return d.toISOString().slice(0, 10); };
  const isoAheadNeg = (days: number) => { const d = new Date(today); d.setDate(today.getDate() - days); return d.toISOString().slice(0, 10); };

  const pending: Nudge[] = [];

  // H1 — personal-account expenses that could be business
  const { data: personalMaybeBiz } = await admin
    .from("txns")
    .select("id,amount,note,cat,account,date_iso,source")
    .eq("user_id", userId)
    .eq("kind", "expense")
    .eq("account", "personal")
    .gte("date_iso", isoAgo(14))
    .limit(200);
  for (const t of personalMaybeBiz || []) {
    if (!WORK_HINTS.test(t.note || "")) continue;
    if (Number(t.amount) < 10) continue;
    const key = `h1:${t.id}`;
    pending.push({
      user_id: userId,
      kind: "categorize_txn",
      text: `¿Este gasto fue de negocio? ${t.note || "(sin nombre)"} · $${Number(t.amount).toFixed(0)} · ${t.date_iso}`,
      action: { type: "categorize_txn", txn_id: t.id, account: "business", cat: guessCatFromNote(t.note || ""), ded: true },
      dedupe_key: key,
    });
  }

  // H2 — past events without a follow-up task
  const { data: pastEvents } = await admin
    .from("items")
    .select("id,title,date_iso,person,type")
    .eq("user_id", userId)
    .eq("type", "event")
    .gte("date_iso", isoAgo(3))
    .lt("date_iso", today.toISOString().slice(0, 10))
    .limit(20);
  const { data: existingTasks } = await admin
    .from("items")
    .select("id,title")
    .eq("user_id", userId)
    .eq("type", "task");
  const taskTitles = new Set((existingTasks || []).map((t: { title: string }) => (t.title || "").toLowerCase()));
  for (const e of pastEvents || []) {
    const followTitle = `Seguimiento: ${e.title}`;
    if (taskTitles.has(followTitle.toLowerCase())) continue;
    const key = `h2:${e.id}`;
    const due = new Date(today); due.setDate(today.getDate() + 3);
    pending.push({
      user_id: userId,
      kind: "followup",
      text: `¿Te recuerdo hacer follow-up de "${e.title}"${e.person ? ` con ${e.person}` : ""} en 3 días?`,
      action: { type: "create_task", title: followTitle, date_iso: due.toISOString().slice(0, 10), person: e.person || "" },
      dedupe_key: key,
    });
  }

  // H3 — Claude reviews business expenses miscategorized as "personal"
  if (process.env.ANTHROPIC_API_KEY) {
    const { data: bizPersonal } = await admin
      .from("txns")
      .select("id,amount,note,date_iso")
      .eq("user_id", userId)
      .eq("kind", "expense")
      .eq("account", "business")
      .eq("cat", "personal")
      .eq("ded", false)
      .gte("date_iso", isoAgo(21))
      .order("amount", { ascending: false })
      .limit(20);
    const sample = (bizPersonal || []).filter((x: { note: string }) => (x.note || "").trim().length > 0).slice(0, 12);
    if (sample.length > 0) {
      try {
        const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
        const msg = await client.messages.create({
          model: "claude-haiku-4-5",
          max_tokens: 600,
          system: `Eres onucore AI. Recibes gastos de la CUENTA DE NEGOCIO (Oprinte) que quedaron sin categorizar como 'personal' y no deducibles. Para cada uno, decide si probablemente ES deducible como gasto de negocio, y si lo es, asigna UNA categoría de esta lista: ${CATS.join(", ")}. Devuelve SOLO un JSON con la forma: {"picks":[{"id":<id>,"cat":"<cat>","reason":"<max 8 palabras>"}]}. Si no estás seguro para uno, no lo incluyas.`,
          messages: [{ role: "user", content: JSON.stringify(sample) }],
        });
        const raw = msg.content.filter((b) => b.type === "text").map((b) => (b as { text: string }).text).join("");
        const jsonStart = raw.indexOf("{");
        const jsonEnd = raw.lastIndexOf("}");
        if (jsonStart >= 0 && jsonEnd > jsonStart) {
          const parsed = JSON.parse(raw.slice(jsonStart, jsonEnd + 1));
          for (const p of parsed.picks || []) {
            if (!p.id || !CATS.includes(p.cat)) continue;
            const src = sample.find((x: { id: number }) => x.id === p.id);
            if (!src) continue;
            pending.push({
              user_id: userId,
              kind: "categorize_txn",
              text: `¿Este gasto es "${p.cat}"? ${src.note} · $${Number(src.amount).toFixed(0)}${p.reason ? ` (${p.reason})` : ""}`,
              action: { type: "categorize_txn", txn_id: src.id, account: "business", cat: p.cat, ded: true },
              dedupe_key: `h3:${src.id}`,
            });
          }
        }
      } catch {
        /* skip AI-based suggestions on error */
      }
    }
  }

  if (!pending.length) return 0;
  // Upsert with dedupe_key so re-runs never duplicate.
  const { error } = await admin
    .from("ai_nudges")
    .upsert(pending, { onConflict: "user_id,dedupe_key", ignoreDuplicates: true });
  if (error) return 0;
  return pending.length;
}

function guessCatFromNote(note: string): string {
  const n = note.toLowerCase();
  if (/uber|lyft|taxi/.test(n)) return "gas";
  if (/chevron|shell|76|mobil|arco|gas /.test(n)) return "gas";
  if (/starbucks|peet|philz|coffee|cafe|deli|lunch/.test(n)) return "food";
  if (/adobe|figma|notion|zoom|slack|google|apple\.com/.test(n)) return "software";
  if (/amazon|office|staples/.test(n)) return "office";
  return "office";
}
