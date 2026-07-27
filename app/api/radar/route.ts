import { createClient as createServerSupabase } from "@/lib/supabase/server";
import Anthropic from "@anthropic-ai/sdk";

// Weekly spending radar: compares last 7 days to the prior 4-week baseline,
// finds the biggest categories and merchant jumps, then asks Claude to
// summarize in 3-4 short sentences (Spanish, friendly, no jargon).
// If the AI is unavailable it returns a deterministic Spanish summary instead.
export const runtime = "nodejs";
export const maxDuration = 30;

const CAT_ES: Record<string, string> = {
  gas: "gasolina",
  food: "comida",
  tech: "tecnología",
  travel: "viajes",
  clothing: "ropa",
  software: "software / suscripciones",
  ads: "publicidad",
  office: "oficina",
  phone: "teléfono e internet",
  pro: "servicios profesionales",
  insurance: "seguros",
  rent: "renta",
  home: "hogar",
  education: "educación",
  personal: "personal / otros",
};

export async function POST() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  const today = new Date();
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const start = new Date(today); start.setDate(today.getDate() - 35);
  const { data: txns } = await supabase
    .from("txns")
    .select("kind,amount,cat,account,date_iso,note")
    .eq("user_id", user.id)
    .gte("date_iso", iso(start))
    .lte("date_iso", iso(today))
    .eq("kind", "expense");

  if (!txns || txns.length < 5) {
    return Response.json({ text: null, reason: "not_enough_data" });
  }

  const dayOf = (s: string) => Math.floor((today.getTime() - new Date(s + "T00:00:00").getTime()) / 864e5);
  const week: Record<string, { total: number; count: number }> = {};
  const baseline: Record<string, { total: number; count: number }> = {};
  const merchantWeek: Record<string, number> = {};
  const merchantBase: Record<string, number> = {};
  let weekTotal = 0;
  let baselineTotal = 0;

  for (const tx of txns) {
    const d = dayOf(tx.date_iso);
    const amt = Number(tx.amount) || 0;
    const cat = tx.cat || "personal";
    const merchant = (tx.note || "").trim().slice(0, 40) || "(sin nombre)";
    if (d < 7) {
      weekTotal += amt;
      (week[cat] = week[cat] || { total: 0, count: 0 }).total += amt;
      week[cat].count += 1;
      merchantWeek[merchant] = (merchantWeek[merchant] || 0) + amt;
    } else if (d < 35) {
      baselineTotal += amt;
      (baseline[cat] = baseline[cat] || { total: 0, count: 0 }).total += amt;
      baseline[cat].count += 1;
      merchantBase[merchant] = (merchantBase[merchant] || 0) + amt;
    }
  }

  const baseWeekly = baselineTotal / 4;
  const catRows = Object.keys(week)
    .map((c) => ({ cat: c, week: week[c].total, base: (baseline[c]?.total || 0) / 4 }))
    .sort((a, b) => b.week - a.week)
    .slice(0, 6);
  const merchantJumps = Object.entries(merchantWeek)
    .map(([m, w]) => ({ m, w, base: (merchantBase[m] || 0) / 4 }))
    .filter((r) => r.w >= 30 && r.w > r.base * 1.5)
    .sort((a, b) => b.w - a.w)
    .slice(0, 5);

  const summary = {
    semana_actual: `$${weekTotal.toFixed(0)}`,
    promedio_semanal_previo: `$${baseWeekly.toFixed(0)}`,
    diferencia: `$${(weekTotal - baseWeekly).toFixed(0)}`,
    por_categoria: catRows.map((r) => ({ categoria: CAT_ES[r.cat] || r.cat, esta_semana: `$${r.week.toFixed(0)}`, promedio_previo: `$${r.base.toFixed(0)}` })),
    picos: merchantJumps.map((r) => ({ comercio: r.m, esta_semana: `$${r.w.toFixed(0)}`, promedio_previo: `$${r.base.toFixed(0)}` })),
  };

  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      const msg = await client.messages.create({
        model: "claude-haiku-4-5",
        max_tokens: 400,
        system: "Eres onucore AI, asistente financiero personal. Escribe 3-4 frases CORTAS en español, en segunda persona (tú), sin jerga y sin signo — (guion largo). Concreto y útil. Empieza con lo más importante: ¿estás gastando más o menos que las semanas anteriores, y en qué? Si algo subió mucho, dilo con nombre y monto. Si nada relevante, di algo breve tipo 'semana tranquila'.",
        messages: [{ role: "user", content: JSON.stringify(summary) }],
      });
      const text = msg.content.filter((b) => b.type === "text").map((b) => (b as { text: string }).text).join("\n").trim();
      if (text) return Response.json({ text, summary });
    } catch { /* fall through to deterministic */ }
  }

  // Deterministic fallback (no IA): plain Spanish summary.
  const diff = weekTotal - baseWeekly;
  const parts: string[] = [];
  if (baseWeekly === 0) parts.push(`Esta semana gastaste $${weekTotal.toFixed(0)}.`);
  else if (Math.abs(diff) < 20) parts.push(`Semana tranquila. Gastaste $${weekTotal.toFixed(0)}, muy parecido al promedio ($${baseWeekly.toFixed(0)}).`);
  else if (diff > 0) parts.push(`Esta semana gastaste $${weekTotal.toFixed(0)}, $${diff.toFixed(0)} más que tu promedio ($${baseWeekly.toFixed(0)}).`);
  else parts.push(`Esta semana gastaste $${weekTotal.toFixed(0)}, $${(-diff).toFixed(0)} menos que tu promedio ($${baseWeekly.toFixed(0)}).`);
  const topJump = catRows.find((r) => r.week > r.base * 1.5 && r.week - r.base > 25);
  if (topJump) parts.push(`Lo que más subió: ${CAT_ES[topJump.cat] || topJump.cat} ($${topJump.week.toFixed(0)} vs $${topJump.base.toFixed(0)} usual).`);
  if (merchantJumps[0]) parts.push(`Pico en ${merchantJumps[0].m}: $${merchantJumps[0].w.toFixed(0)} esta semana.`);
  return Response.json({ text: parts.join(" "), summary });
}
