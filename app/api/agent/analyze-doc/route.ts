import { createClient as createServerSupabase } from "@/lib/supabase/server";
import Anthropic from "@anthropic-ai/sdk";

// El agente "ve" una foto de documento, lo clasifica y lo archiva solo en la
// Bóveda + la sección correcta (tax_form si es W-2/1099, gasto si es recibo,
// seguro/ID en Bóveda con la categoría correcta). Devuelve un resumen humano.
export const runtime = "nodejs";
export const maxDuration = 45;

const CAT_LIST = ["gas", "food", "tech", "travel", "clothing", "software", "ads", "office", "phone", "pro", "insurance", "rent", "home", "education", "personal"];

export async function POST(request: Request) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!process.env.ANTHROPIC_API_KEY) return Response.json({ error: "no_api_key" }, { status: 500 });

  let body: { dataUrl?: string; hint?: string; account?: string };
  try { body = await request.json(); } catch { return Response.json({ error: "invalid_json" }, { status: 400 }); }
  const dataUrl = body.dataUrl || "";
  const hint = (body.hint || "").trim();
  const account = body.account === "personal" ? "personal" : "business";
  const m = dataUrl.match(/^data:(image\/[a-z0-9.+-]+);base64,(.+)$/i);
  if (!m) return Response.json({ error: "invalid_image" }, { status: 400 });
  const mime = m[1].toLowerCase();
  const b64 = m[2];
  const bytes = Buffer.from(b64, "base64");
  if (bytes.byteLength > 8 * 1024 * 1024) return Response.json({ error: "image_too_big" }, { status: 400 });

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const year = new Date().getFullYear();
  const today = new Date().toISOString().slice(0, 10);

  const sys = `Eres onucore AI. El usuario te manda una FOTO de un documento y quieres archivarlo. Analiza la imagen y devuelve SOLO un JSON con esta estructura:

{
  "category": "tax" | "receipt" | "insurance" | "id" | "other",
  "title": "nombre corto y descriptivo del documento",
  "note": "una frase corta que resuma qué es (para que el usuario lo vea en la Bóveda)",
  "extracted": {
    // Si category=tax (W-2, 1099-*):
    "kind": "W-2" | "1099-NEC" | "1099-MISC" | "1099-K" | "Otra",
    "year": 2025,
    "payer": "nombre del empleador o pagador",
    "amount": 52000.00,
    "withheld": 6320.00,
    // Si category=receipt:
    "merchant": "comercio",
    "amount": 45.99,
    "date_iso": "YYYY-MM-DD",
    "fin_cat": una de [${CAT_LIST.join(",")}],
    // Si category=insurance:
    "kind_ins": "auto" | "salud" | "vida" | "otra",
    "insurer": "nombre de la aseguradora",
    "policy": "número de póliza",
    "expiry_iso": "YYYY-MM-DD"
  }
}

REGLAS:
- Si dudas del category, usa "other".
- Solo incluye campos de "extracted" que puedas leer con confianza. Nunca inventes.
- Si el usuario dio una pista, respétala.
- Hoy es ${today}. Año fiscal activo: ${year}.
- Devuelve ÚNICAMENTE el JSON, sin explicación adicional, sin markdown.`;

  const userContent: Anthropic.Messages.ContentBlockParam[] = [
    { type: "image", source: { type: "base64", media_type: mime as "image/jpeg" | "image/png" | "image/gif" | "image/webp", data: b64 } },
  ];
  if (hint) userContent.push({ type: "text", text: `Pista del usuario: "${hint}"` });

  let parsed: {
    category?: string;
    title?: string;
    note?: string;
    extracted?: Record<string, unknown>;
  } = {};
  try {
    const msg = await client.messages.create({
      model: "claude-haiku-4-5",
      max_tokens: 800,
      system: sys,
      messages: [{ role: "user", content: userContent }],
    });
    const raw = msg.content.filter((b) => b.type === "text").map((b) => (b as { text: string }).text).join("");
    const s = raw.indexOf("{");
    const e = raw.lastIndexOf("}");
    if (s < 0 || e <= s) throw new Error("no_json");
    parsed = JSON.parse(raw.slice(s, e + 1));
  } catch (err) {
    return Response.json({ error: "vision_failed", detail: (err as { message?: string })?.message || "" }, { status: 500 });
  }

  const category = ["tax", "receipt", "insurance", "id", "other"].includes(parsed.category || "") ? (parsed.category as string) : "other";
  const title = (parsed.title || "Documento").toString().slice(0, 120);
  const note = (parsed.note || "").toString().slice(0, 400);
  const ext = (parsed.extracted && typeof parsed.extracted === "object") ? parsed.extracted as Record<string, unknown> : {};

  // Upload to Supabase Storage (documents bucket, private).
  const extname = mime === "image/jpeg" ? "jpg" : mime === "image/png" ? "png" : mime === "image/webp" ? "webp" : "img";
  const safeTitle = title.replace(/[^\w.\-]+/g, "_").slice(0, 60) || "doc";
  const fileName = `${safeTitle}.${extname}`;
  const path = `${user.id}/${Date.now()}-${fileName}`;
  const uploadRes = await supabase.storage.from("documents").upload(path, bytes, { contentType: mime });
  if (uploadRes.error) return Response.json({ error: "upload_failed", detail: uploadRes.error.message }, { status: 500 });

  const { error: docErr } = await supabase.from("documents").insert({
    user_id: user.id,
    name: fileName,
    category,
    path,
    size: bytes.byteLength,
    mime,
    note,
  });
  if (docErr) return Response.json({ error: "doc_insert_failed", detail: docErr.message }, { status: 500 });

  const actions: string[] = [];

  // If it's a tax form, also create the entry in tax_forms.
  if (category === "tax" && ext.kind && ext.year) {
    const kind = String(ext.kind);
    const yr = Number(ext.year);
    const payer = String(ext.payer || "").slice(0, 120);
    const amount = Number(ext.amount) || 0;
    const withheld = Number(ext.withheld) || 0;
    if (yr && payer) {
      await supabase.from("tax_forms").insert({ user_id: user.id, kind, year: yr, payer, amount, withheld });
      actions.push(`Forma ${kind} ${yr} de ${payer} agregada (monto $${amount.toFixed(0)}${withheld ? `, retención $${withheld.toFixed(0)}` : ""}).`);
    }
  }

  // If it's a receipt, create an expense txn linked to this doc.
  if (category === "receipt" && ext.merchant && ext.amount) {
    const merchant = String(ext.merchant).slice(0, 120);
    const amount = Number(ext.amount) || 0;
    const dateISO = /^\d{4}-\d{2}-\d{2}$/.test(String(ext.date_iso || "")) ? String(ext.date_iso) : today;
    const finCat = CAT_LIST.includes(String(ext.fin_cat)) ? String(ext.fin_cat) : "office";
    const ded = account === "business";
    if (amount > 0) {
      await supabase.from("txns").insert({ user_id: user.id, kind: "expense", amount, cat: finCat, account, date_iso: dateISO, note: merchant, ded, source: "vision" });
      actions.push(`Gasto de $${amount.toFixed(2)} en ${merchant} agregado (cuenta ${account === "business" ? "Oprinte" : "Empleado"}, ${finCat}${ded ? ", deducible" : ""}).`);
    }
  }

  // If it's car insurance, update vehicle.insurance_expiry when present.
  if (category === "insurance" && String(ext.kind_ins || "").toLowerCase() === "auto" && ext.expiry_iso) {
    const expiry = /^\d{4}-\d{2}-\d{2}$/.test(String(ext.expiry_iso)) ? String(ext.expiry_iso) : null;
    if (expiry) {
      const { data: v } = await supabase.from("vehicles").select("id").eq("user_id", user.id).limit(1);
      if (v?.[0]) {
        await supabase.from("vehicles").update({ insurance_company: ext.insurer || null, insurance_policy: ext.policy || null, insurance_expiry: expiry }).eq("id", v[0].id);
        actions.push(`Seguro del carro actualizado (vence ${expiry}${ext.insurer ? ", " + ext.insurer : ""}).`);
      }
    }
  }

  const CAT_ES: Record<string, string> = { tax: "Impuestos", receipt: "Recibos", insurance: "Seguros", id: "IDs", other: "Otros" };
  const summary = [
    `📁 Guardado en la Bóveda → ${CAT_ES[category]}: "${title}".`,
    note ? `📝 ${note}` : "",
    ...actions,
  ].filter(Boolean).join("\n");

  return Response.json({ summary, category, title, note, extracted: ext, actions });
}
