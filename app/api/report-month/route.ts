import { createClient as createServerSupabase } from "@/lib/supabase/server";
import Anthropic from "@anthropic-ai/sdk";

// Automatic month recap: on the first days of a new month, summarizes last
// month's income, spending, top categories, and how it compares to the prior
// month. Short, actionable, Spanish.
export const runtime = "nodejs";
export const maxDuration = 30;

const CAT_ES: Record<string, string> = {
  gas: "gasolina", food: "comida", tech: "tecnología", travel: "viajes",
  clothing: "ropa", software: "software", ads: "publicidad", office: "oficina",
  phone: "teléfono e internet", pro: "servicios profesionales", insurance: "seguros",
  rent: "renta", home: "hogar", education: "educación", personal: "personal / otros",
};

function monthRange(year: number, month0: number) {
  const start = `${year}-${String(month0 + 1).padStart(2, "0")}-01`;
  const endD = new Date(year, month0 + 1, 0);
  const end = `${year}-${String(month0 + 1).padStart(2, "0")}-${String(endD.getDate()).padStart(2, "0")}`;
  return { start, end };
}

export async function POST(request: Request) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  const now = new Date();
  // Default: last completed month.
  let year = now.getFullYear();
  let month0 = now.getMonth() - 1;
  if (month0 < 0) { month0 = 11; year -= 1; }
  try {
    const url = new URL(request.url);
    const y = Number(url.searchParams.get("year"));
    const m = Number(url.searchParams.get("month"));
    if (y && m >= 1 && m <= 12) { year = y; month0 = m - 1; }
  } catch { /* noop */ }

  const cur = monthRange(year, month0);
  const prev = monthRange(month0 === 0 ? year - 1 : year, month0 === 0 ? 11 : month0 - 1);

  const [{ data: curTx }, { data: prevTx }] = await Promise.all([
    supabase.from("txns").select("kind,amount,cat,account,date_iso,note").eq("user_id", user.id).gte("date_iso", cur.start).lte("date_iso", cur.end),
    supabase.from("txns").select("kind,amount").eq("user_id", user.id).gte("date_iso", prev.start).lte("date_iso", prev.end),
  ]);

  const sum = (arr: { kind: string; amount: number }[] | null, k: string) => (arr || []).filter((x) => x.kind === k).reduce((s, x) => s + Number(x.amount || 0), 0);
  const curInc = sum(curTx, "income");
  const curExp = sum(curTx, "expense");
  const prevInc = sum(prevTx, "income");
  const prevExp = sum(prevTx, "expense");

  const byCat: Record<string, number> = {};
  (curTx || []).filter((x) => x.kind === "expense").forEach((x) => {
    const c = x.cat || "personal";
    byCat[c] = (byCat[c] || 0) + Number(x.amount || 0);
  });
  const top3 = Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([c, v]) => ({ cat: CAT_ES[c] || c, monto: `$${v.toFixed(0)}` }));

  if (curInc === 0 && curExp === 0) return Response.json({ text: null, reason: "no_data" });

  const monthName = new Date(year, month0, 1).toLocaleDateString("es-MX", { month: "long", year: "numeric" });
  const summary = {
    mes: monthName,
    ingresos: `$${curInc.toFixed(0)}`,
    gastos: `$${curExp.toFixed(0)}`,
    neto: `$${(curInc - curExp).toFixed(0)}`,
    ingresos_mes_previo: `$${prevInc.toFixed(0)}`,
    gastos_mes_previo: `$${prevExp.toFixed(0)}`,
    top_3_gastos: top3,
  };

  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      const msg = await client.messages.create({
        model: "claude-haiku-4-5",
        max_tokens: 220,
        system: "Eres onucore AI. Español, segunda persona (tú), MUY corto: 2-3 frases. Sin markdown, sin el signo — (guion largo). Empieza con el mes y el neto. Luego menciona la comparación vs el mes previo (subiste/bajaste) y las 1-2 categorías top de gasto con monto.",
        messages: [{ role: "user", content: JSON.stringify(summary) }],
      });
      const text = msg.content.filter((b) => b.type === "text").map((b) => (b as { text: string }).text).join("\n").trim();
      if (text) return Response.json({ text, summary });
    } catch { /* fall through */ }
  }

  const diffInc = curInc - prevInc;
  const diffExp = curExp - prevExp;
  const dir = (n: number) => n > 0 ? "subieron" : n < 0 ? "bajaron" : "quedaron igual";
  const parts = [
    `En ${monthName} el neto fue $${(curInc - curExp).toFixed(0)} (ingresos $${curInc.toFixed(0)}, gastos $${curExp.toFixed(0)}).`,
    `Vs mes previo, ingresos ${dir(diffInc)} $${Math.abs(diffInc).toFixed(0)} y gastos ${dir(diffExp)} $${Math.abs(diffExp).toFixed(0)}.`,
  ];
  if (top3.length) parts.push(`Top gasto: ${top3.map((t) => `${t.cat} ${t.monto}`).join(", ")}.`);
  return Response.json({ text: parts.join(" "), summary });
}
