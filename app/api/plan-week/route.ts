import { createClient as createServerSupabase } from "@/lib/supabase/server";
import Anthropic from "@anthropic-ai/sdk";

// "Prepárame para la semana": collects everything coming up in the next 7 days
// (events, bills, birthdays, car services, quarterly taxes) and asks Claude to
// turn it into a friendly day-by-day plan in Spanish.
export const runtime = "nodejs";
export const maxDuration = 30;

const LA_TZ = "America/Los_Angeles";
const laToday = () => new Date().toLocaleDateString("en-CA", { timeZone: LA_TZ });
const daysFrom = (base: string, iso: string) =>
  Math.round((new Date(iso + "T00:00:00").getTime() - new Date(base + "T00:00:00").getTime()) / 864e5);

export async function POST() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  const today = laToday();
  const end = new Date(today); end.setDate(end.getDate() + 7);
  const endISO = end.toISOString().slice(0, 10);

  const [{ data: items }, { data: cars }] = await Promise.all([
    supabase.from("items").select("type,title,amount,date_iso,person,repeat,area,done").eq("user_id", user.id),
    supabase.from("car_records").select("kind,title,due_iso").eq("user_id", user.id),
  ]);
  const its = items || [];

  const bag: { day: string; kind: string; text: string }[] = [];
  const push = (iso: string, kind: string, text: string) => {
    const du = daysFrom(today, iso);
    if (du < 0 || du > 7) return;
    bag.push({ day: iso, kind, text });
  };

  its.forEach((i) => {
    if (i.type === "event" && i.date_iso) push(i.date_iso, "cita", `${i.title}`);
    if (i.type === "task" && !i.done && i.date_iso) push(i.date_iso, "pendiente", i.title);
    if (i.type === "obligation" && !i.done && i.date_iso) push(i.date_iso, "bil", `${i.title}${i.amount ? " $" + Number(i.amount).toFixed(0) : ""}`);
    if (i.type === "birthday" && i.date_iso) push(i.date_iso, "cumple", `${i.title}${i.person ? " (" + i.person + ")" : ""}`);
  });
  (cars || []).forEach((r) => { if (r.due_iso) push(r.due_iso, "carro", r.title || r.kind); });

  // Quarterly estimated-tax deadlines
  const yq = Number(today.slice(0, 4));
  [`${yq}-04-15`, `${yq}-06-15`, `${yq}-09-15`, `${yq + 1}-01-15`].forEach((d) => push(d, "impuestos", "Pago trimestral estimado"));

  bag.sort((a, b) => a.day.localeCompare(b.day));

  if (bag.length === 0) {
    return Response.json({ text: "Semana ligera. No hay citas, biles ni pendientes en los próximos 7 días. Buen momento para adelantar algo tuyo.", items: [] });
  }

  const week = new Date(today + "T00:00:00");
  const days = Array.from({ length: 8 }, (_, i) => {
    const d = new Date(week); d.setDate(d.getDate() + i);
    const iso = d.toISOString().slice(0, 10);
    return { iso, name: d.toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "short", timeZone: LA_TZ }), items: bag.filter((b) => b.day === iso) };
  }).filter((d) => d.items.length);

  if (process.env.ANTHROPIC_API_KEY) {
    try {
      const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
      const msg = await client.messages.create({
        model: "claude-haiku-4-5",
        max_tokens: 500,
        system: "Eres onucore AI, asistente personal. Escribe en español, segunda persona (tú), tono cálido y directo, SIN el signo — (guion largo). Formato: una frase de apertura (¿qué tan cargada viene la semana?) y luego un plan DÍA POR DÍA en líneas cortas empezando con el nombre del día. Sé útil, no repitas obvieces. Máximo ~150 palabras. No inventes citas que no están en los datos.",
        messages: [{ role: "user", content: `Hoy es ${today} (LA). Esto viene los próximos 7 días:\n${JSON.stringify(days, null, 2)}\n\nArma el plan de la semana para el usuario.` }],
      });
      const text = msg.content.filter((b) => b.type === "text").map((b) => (b as { text: string }).text).join("\n").trim();
      if (text) return Response.json({ text, items: bag });
    } catch { /* fall through */ }
  }

  // Fallback: plain grouping
  const lines = days.map((d) => `${d.name}: ${d.items.map((i) => i.text).join(", ")}`).join("\n");
  return Response.json({ text: `Esta semana:\n${lines}`, items: bag });
}
