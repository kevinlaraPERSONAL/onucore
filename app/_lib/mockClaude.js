// mockClaude.js — LOCAL simulation of ATLAS's AI for the prototype preview.
// It intercepts fetch() to api.anthropic.com and returns responses with the
// SAME shape as the real API, so the prototype feels alive WITHOUT a Claude key
// or a server. None of this is real AI — in production these calls go server-side
// (see CLAUDE.md). This file lives only in _preview/ and never touches the source.

const pad = (n) => String(n).padStart(2, "0");
const todayISO = () => new Date().toISOString().slice(0, 10);
const addDaysISO = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
const fmtMoney = (n) => new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(n || 0);
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

const MONTHS = {
  enero: 0, ene: 0, january: 0, jan: 0, febrero: 1, feb: 1, february: 1,
  marzo: 2, mar: 2, march: 2, abril: 3, abr: 3, april: 3, apr: 3,
  mayo: 4, may: 4, junio: 5, jun: 5, june: 5, julio: 6, jul: 6, july: 6,
  agosto: 7, ago: 7, august: 7, aug: 7, septiembre: 8, sep: 8, sept: 8, september: 8,
  octubre: 9, oct: 9, october: 9, noviembre: 10, nov: 10, november: 10,
  diciembre: 11, dic: 11, december: 11, dec: 11,
};

function isSpanish(s) {
  return /[áéíóúñ¿¡]|cu[aá]nto|gast|ingres|cu[aá]l|c[oó]mo|qu[eé]\b|tengo|debo|pagar|reuni|recu[eé]rda|comida|gasolina|renta|cobr|cita/i.test(s || "");
}
function detectLang(sys) {
  if (/español/i.test(sys)) return "es";
  if (/EN English|english/i.test(sys)) return "en";
  if (/português/i.test(sys)) return "pt";
  if (/français/i.test(sys)) return "fr";
  return "es";
}

// ---------- extraction helpers ----------
function extractAmount(text) {
  let m = text.match(/\$\s*([0-9][0-9.,]*)/);
  if (!m) m = text.match(/\b([0-9][0-9.,]*)\s*(?:d[oó]lares|dollars|usd|bucks)\b/i);
  if (!m) m = text.match(/\b([0-9][0-9.,]{1,})\b/); // fallback: any multi-digit number
  if (!m) return null;
  const n = parseFloat(m[1].replace(/,/g, ""));
  return isNaN(n) ? null : n;
}
function monthDayISO(mi, day) {
  const now = new Date();
  let y = now.getFullYear();
  const t0 = new Date(); t0.setHours(0, 0, 0, 0);
  if (new Date(y, mi, day) < t0) y++;
  return `${y}-${pad(mi + 1)}-${pad(day)}`;
}
function extractDate(text) {
  const t = text.toLowerCase();
  if (/pasado\s+mañana|day after tomorrow/.test(t)) return addDaysISO(2);
  if (/\bmañana\b|\bmanana\b|\btomorrow\b/.test(t)) return addDaysISO(1);
  if (/\bhoy\b|\btoday\b|\btonight\b|esta noche/.test(t)) return todayISO();
  let m = t.match(/(\d{1,2})\s*(?:de\s+)?([a-záéíóú]+)/);
  if (m && MONTHS[m[2]] != null) return monthDayISO(MONTHS[m[2]], +m[1]);
  m = t.match(/([a-záéíóú]+)\.?\s+(\d{1,2})\b/);
  if (m && MONTHS[m[1]] != null) return monthDayISO(MONTHS[m[1]], +m[2]);
  return null;
}
function extractTime(text) {
  let m = text.match(/(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?)/i);
  if (m) { const h = +m[1]; const mi = m[2] ? +m[2] : 0; const ap = /p/i.test(m[3]) ? "PM" : "AM"; return `${h}:${pad(mi)} ${ap}`; }
  m = text.match(/a\s+las\s+(\d{1,2})(?::(\d{2}))?/i);
  if (m) { let h = +m[1]; const mi = m[2] ? +m[2] : 0; const ap = h >= 12 || h < 8 ? "PM" : "AM"; const hh = h > 12 ? h - 12 : h; return `${hh}:${pad(mi)} ${ap}`; }
  return "";
}
function extractPerson(text) {
  const m = text.match(/\b(?:con|with)\s+([A-ZÁÉÍÓÚÑ][\wáéíóúñ]+(?:\s+[A-ZÁÉÍÓÚÑ][\wáéíóúñ.]*)?)/);
  return m ? m[1].trim() : "";
}
const CATKEYS = [
  ["gas", /gasolina|combustible|\bgas\b|\bfuel\b|shell|chevron|pemex|\bbp\b/i],
  ["food", /comida|almuerzo|cena|desayuno|lunch|dinner|breakfast|restaurant|caf[eé]|coffee|starbucks|taco|pizza|com[ií]/i],
  ["tech", /laptop|macbook|computer|computadora|iphone|ipad|monitor|teclado|equipo|c[aá]mara|disco|ssd/i],
  ["travel", /vuelo|flight|hotel|airbnb|uber|lyft|taxi|viaje|avi[oó]n|hospedaje/i],
  ["software", /adobe|software|suscripci[oó]n|subscription|figma|notion|saas|licencia|dominio|hosting/i],
  ["ads", /publicidad|\bads\b|facebook ads|google ads|marketing|campa[ñn]a/i],
  ["office", /oficina|office|supplies|suministros|costco|depot|papel|impresora|tinta|escritorio/i],
  ["phone", /tel[eé]fono|internet|celular|\bcell\b|\bplan\b|at&t|verizon|t-mobile|telcel/i],
  ["pro", /contador|abogado|lawyer|accountant|bookkeeper|consultor|asesor|notario/i],
  ["insurance", /seguro|insurance|p[oó]liza/i],
  ["rent", /renta|\brent\b|coworking|wework|alquiler|lease/i],
  ["education", /curso|course|training|capacitaci[oó]n|libro|\bbook\b|udemy|educaci[oó]n/i],
  ["clothing", /\bropa\b|clothing|jacket|chamarra|zapatos|camisa|traje/i],
];
function guessCat(text) { for (const [k, re] of CATKEYS) if (re.test(text)) return k; return "personal"; }
function guessAccount(text) {
  if (/visa/i.test(text)) return "visa";
  if (/amex|american express/i.test(text)) return "amex";
  if (/paypal/i.test(text)) return "paypal";
  if (/efectivo|\bcash\b/i.test(text)) return "cash";
  if (/transfer|transferencia|banco|\bbank\b|cheque|checking|d[eé]bito|debit/i.test(text)) return "bank";
  return "";
}
function guessIncomeCat(text) {
  if (/venta|vend[ií]|sold|\bsale\b|producto/i.test(text)) return "sales";
  if (/cliente|client|proyecto|factura|retainer|honorario/i.test(text)) return "client";
  return "client";
}
const titleCase = (s) => { s = (s || "").trim().replace(/\s+/g, " "); return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; };
function labelFor(iso, es) {
  if (!iso) return "";
  if (iso === todayISO()) return es ? "Hoy" : "Today";
  if (iso === addDaysISO(1)) return es ? "Mañana" : "Tomorrow";
  return new Date(iso + "T00:00:00").toLocaleDateString(es ? "es-MX" : "en-US", { day: "numeric", month: "short" });
}

// ---------- the classifier (text -> items, model-shaped) ----------
function classify(text) {
  const t = text.toLowerCase();
  const es = isSpanish(text);
  const amount = extractAmount(text);
  const dateISO = extractDate(text);
  const time = extractTime(text);
  const person = extractPerson(text);
  const title = titleCase(text).slice(0, 90);

  const spend = /(gast|pagu[eé]|compr[eé]|spent|bought|\bpaid\b|invert[ií]|me cost[oó])/i.test(t);
  const earn = /(cobr[eé]|recib[ií]|me pagaron|ingres|vend[ií]|sold|got paid|received|dep[oó]sito|factur[eé])/i.test(t);
  const billish = /(renta|\brent\b|factura|\bbill\b|vence|\bdue\b|hipoteca|mortgage|seguro|p[oó]liza|colegiatura|mensualidad|pago de)/i.test(t);
  const payFuture = /(pagar|debo pagar|hay que pagar|remind.*pay)/i.test(t);
  const meeting = /(reuni[oó]n|junta|cita|meeting|appointment|\bcall\b|llamada|sync|entrevista|consulta)/i.test(t);
  const remind = /(recu[eé]rda|recordar|recordatorio|remind|remember|no olvidar|don'?t forget|acu[eé]rda)/i.test(t);
  const idea = /(\bidea\b|podr[ií]a|what if|y si\b|concepto|brainstorm)/i.test(t);
  const task = /(tengo que|necesito|hacer|enviar|mandar|terminar|preparar|llamar a|to ?do|finish|send|prepare)/i.test(t);

  if ((billish || payFuture) && (amount != null || dateISO)) {
    return [{ type: "obligation", area: /oficina|office|negocio|business|trabajo/i.test(t) ? "work" : "personal", title, amount, dateISO, dateLabel: labelFor(dateISO, es), priority: "medium" }];
  }
  if (spend && amount != null && !earn) {
    const cat = guessCat(text);
    return [{ type: "expense", title, amount, dateISO: dateISO || todayISO(), financeCat: cat, account: guessAccount(text), deductible: cat !== "personal" && cat !== "clothing" }];
  }
  if (earn && amount != null) {
    return [{ type: "income", title, amount, dateISO: dateISO || todayISO(), incomeCat: guessIncomeCat(text), account: guessAccount(text) }];
  }
  if (meeting || (time && !spend && !earn)) {
    const area = /trabajo|work|cliente|client|negocio|board|investor|junta/i.test(t) ? "work" : /familia|family|hija|hijo|esposa|esposo|cumple|mam[aá]|pap[aá]/i.test(t) ? "family" : "personal";
    return [{ type: "event", area, title, dateISO, dateLabel: time || labelFor(dateISO, es), person, priority: "medium" }];
  }
  if (remind) {
    return [{ type: "reminder", area: "personal", title, dateISO, dateLabel: labelFor(dateISO, es) }];
  }
  if (idea) {
    return [{ type: "idea", area: "work", title, detail: "" }];
  }
  if (task) {
    return [{ type: "task", area: /trabajo|work|cliente|client/i.test(t) ? "work" : "personal", title, dateISO, dateLabel: labelFor(dateISO, es), priority: /urgent|urgente|importante|asap/i.test(t) ? "high" : "medium" }];
  }
  return [{ type: "note", area: "personal", title, detail: "" }];
}

// One sentence can carry several items — split on connectors and classify each.
function splitClauses(text) {
  const parts = text.split(/\s+y\s+|\s+e\s+|\s+and\s+|\s*;\s*|\s+adem[aá]s\s+|\s+tambi[eé]n\s+/i).map((s) => s.trim()).filter(Boolean);
  return parts.length ? parts : [text];
}
function classifyAll(text) {
  const segs = splitClauses(text);
  if (segs.length <= 1) return classify(text);
  let items = [];
  for (const s of segs) {
    const r = classify(s);
    if (r.length === 1 && r[0].type === "note" && s.split(/\s+/).length < 3) continue; // drop tiny fragments
    items = items.concat(r);
  }
  return items.length ? items : classify(text);
}

// ---------- response builders ----------
function destLabel(it, es) {
  if (it.type === "expense" || it.type === "income" || it.type === "obligation") return es ? "Finanzas" : "Money";
  if (it.type === "event") return "Agenda";
  if (it.type === "note" || it.type === "idea" || it.type === "contact") return es ? "Notas" : "Notes";
  return es ? "Pendientes" : "To-dos";
}
function buildReply(items, es) {
  if (!items.length) return es ? "Mmm, no lo capté bien. ¿Me das un poco más de detalle? 🙏" : "Hmm, I didn't catch that. Can you add a bit more detail? 🙏";
  const it = items[0];
  let what = it.title;
  if (it.amount != null) what += ` · ${fmtMoney(it.amount)}`;
  return `✓ ${what} → ${destLabel(it, es)}`;
}
function listJoin(arr, es) {
  if (arr.length <= 1) return arr.join("");
  return arr.slice(0, -1).join(", ") + (es ? " y " : " and ") + arr[arr.length - 1];
}
function buildBriefing(userContent, lang) {
  const es = lang === "es";
  let hour = new Date().getHours();
  const mh = userContent.match(/Hora:\s*(\d+)\s*h/i); if (mh) hour = +mh[1];
  let st = {};
  const ms = userContent.match(/Estado:\s*(\{[\s\S]*\})/); if (ms) { try { st = JSON.parse(ms[1]); } catch { /* ignore */ } }
  const ev = st.eventsToday || [], urgent = st.urgent || [], rem = st.reminders || [], due = st.due || [];
  const greet = hour < 12 ? (es ? "Buenos días" : "Good morning") : hour < 19 ? (es ? "Buenas tardes" : "Good afternoon") : (es ? "Buenas noches" : "Good evening");
  const parts = [`${greet}.`];
  if (ev.length) parts.push(es ? `Hoy tienes ${ev.length === 1 ? "una cita" : ev.length + " citas"}: ${listJoin(ev, es)}.` : `You've got ${ev.length === 1 ? "one appointment" : ev.length + " appointments"} today: ${listJoin(ev, es)}.`);
  else parts.push(es ? "No tienes citas en la agenda de hoy." : "Nothing on your calendar today.");
  if (urgent.length) parts.push(es ? `Lo más importante por avanzar: ${listJoin(urgent, es)}.` : `Top priority to move: ${listJoin(urgent, es)}.`);
  const soon = due.filter((d) => d.days != null && d.days <= 7).sort((a, b) => a.days - b.days);
  if (soon.length) { const d0 = soon[0]; parts.push(es ? `Ojo con un pago: ${d0.t} ${d0.days <= 0 ? "vence hoy" : "vence en " + d0.days + " día" + (d0.days === 1 ? "" : "s")}.` : `Heads up on a bill: ${d0.t} ${d0.days <= 0 ? "is due today" : "is due in " + d0.days + " day" + (d0.days === 1 ? "" : "s")}.`); }
  else if (rem.length) parts.push(es ? `Y no olvides: ${rem[0]}.` : `And don't forget: ${rem[0]}.`);
  parts.push(es ? "Vas bien — aquí te acompaño. ✦" : "You've got this — I'm on it. ✦");
  return parts.join(" ");
}
function buildAsk(userContent) {
  const parts = userContent.split(/\n\nPregunta:\s*/);
  let data = { items: [], txns: [], today: todayISO() };
  try { data = JSON.parse((parts[0] || "").replace(/^Datos:\s*\n?/, "")); } catch { /* ignore */ }
  const q = (parts[1] || "").trim(); const ql = q.toLowerCase(); const es = isSpanish(q);
  const txns = data.txns || [], items = data.items || [];
  const sum = (arr) => arr.reduce((s, x) => s + (x.amount || 0), 0);
  const exp = txns.filter((x) => x.kind === "expense"), inc = txns.filter((x) => x.kind === "income");
  if (/deduc/i.test(ql)) { const d = txns.reduce((s, x) => s + (x.deductibleAmount || 0), 0); return es ? `Llevas ${fmtMoney(d)} en gastos deducibles registrados.` : `You have ${fmtMoney(d)} in deductible expenses logged.`; }
  if (/gast|spent|expense|gasto/i.test(ql)) { const total = sum(exp); const top = [...exp].sort((a, b) => b.amount - a.amount)[0]; return es ? `Llevas ${fmtMoney(total)} en gastos${top ? `; el mayor fue ${fmtMoney(top.amount)} en ${top.category || top.note || "—"}` : ""}.` : `You've spent ${fmtMoney(total)}${top ? `; the biggest was ${fmtMoney(top.amount)} on ${top.category || top.note || "—"}` : ""}.`; }
  if (/ingres|cobr|income|gan[eé]|earn|factur/i.test(ql)) { return es ? `Has ingresado ${fmtMoney(sum(inc))} en total.` : `You've brought in ${fmtMoney(sum(inc))} in total.`; }
  if (/neto|\bnet\b|ganancia|profit|utilidad/i.test(ql)) { const n = sum(inc) - sum(exp); return es ? `Tu neto es ${fmtMoney(n)} (ingresos ${fmtMoney(sum(inc))} − gastos ${fmtMoney(sum(exp))}).` : `Your net is ${fmtMoney(n)} (income ${fmtMoney(sum(inc))} − expenses ${fmtMoney(sum(exp))}).`; }
  if (/cita|agenda|reuni|meeting|event|hoy|today/i.test(ql)) { const evs = items.filter((i) => i.type === "event"); const use = /hoy|today/i.test(ql) ? evs.filter((e) => e.dateISO === data.today) : evs.slice(0, 4); if (!use.length) return es ? "No veo citas para eso en tu agenda." : "I don't see anything on your calendar for that."; return (es ? "Tienes: " : "You have: ") + use.map((e) => `${e.title}${e.dateLabel ? ` (${e.dateLabel})` : ""}`).join("; ") + "."; }
  if (/pend|task|todo|hacer|to-?do/i.test(ql)) { const ts = items.filter((i) => (i.type === "task" || i.type === "reminder") && !i.done); if (!ts.length) return es ? "No tienes pendientes abiertos. 🎉" : "You're all caught up — no open to-dos. 🎉"; return (es ? "Pendientes: " : "To-dos: ") + ts.slice(0, 5).map((i) => i.title).join("; ") + "."; }
  if (/pag|\bbill\b|vence|\bdue\b|debo/i.test(ql)) { const ob = items.filter((i) => i.type === "obligation"); if (!ob.length) return es ? "No tienes pagos próximos registrados." : "No upcoming bills logged."; return (es ? "Por pagar: " : "Upcoming bills: ") + ob.map((o) => `${o.title}${o.amount ? ` (${fmtMoney(o.amount)})` : ""}`).join("; ") + "."; }
  const n = sum(inc) - sum(exp);
  return es
    ? `Esto es lo que veo: ${fmtMoney(sum(inc))} de ingresos, ${fmtMoney(sum(exp))} de gastos (neto ${fmtMoney(n)}), ${items.filter((i) => i.type === "event").length} citas y ${items.filter((i) => i.type === "task" || i.type === "reminder").length} pendientes. Pregúntame algo más específico y te lo afino.`
    : `Here's what I see: ${fmtMoney(sum(inc))} income, ${fmtMoney(sum(exp))} expenses (net ${fmtMoney(n)}), ${items.filter((i) => i.type === "event").length} appointments and ${items.filter((i) => i.type === "task" || i.type === "reminder").length} to-dos. Ask me something more specific and I'll dig in.`;
}

// ---------- router ----------
function mockRespond(body) {
  const sys = body.system || "";
  const first = (body.messages || [])[0] || {};
  const content = first.content;
  const hasImage = Array.isArray(content) && content.some((c) => c && c.type === "image");
  const userText = typeof content === "string" ? content : Array.isArray(content) ? content.filter((c) => c && c.type === "text").map((c) => c.text).join(" ") : "";

  if (hasImage) {
    if (/whatsapp/i.test(sys)) return JSON.stringify({ items: [{ type: "expense", title: "Office Depot", amount: 42.75, financeCat: "office", account: "amex", deductible: true, area: "personal" }], reply: "✓ $42.75 en Office Depot → Finanzas" });
    if (/recibo|comprobante/i.test(sys)) return JSON.stringify({ kind: "expense", amount: 42.75, merchant: "Office Depot", dateISO: todayISO(), financeCat: "office", deductible: true });
    const note = (sys.match(/Nota:\s*"([^"]*)"/) || [])[1] || "";
    return JSON.stringify({ title: note || "Recordatorio con foto", detail: "", area: "personal" });
  }
  // Order matters: the "Ask" prompt also says "chief of staff", so match it FIRST.
  if (/USANDO ÚNICAMENTE|USANDO UNICAMENTE/i.test(sys)) return buildAsk(userText);
  if (/Chief of Staff/i.test(sys)) return buildBriefing(userText, detectLang(sys));
  if (/WhatsApp/i.test(sys)) { const items = classifyAll(userText); return JSON.stringify({ items, reply: buildReply(items, isSpanish(userText)) }); }
  return JSON.stringify({ items: classifyAll(userText) });
}

export default function installMockClaude() {
  const real = window.fetch ? window.fetch.bind(window) : null;
  window.fetch = async (url, opts = {}) => {
    const u = typeof url === "string" ? url : (url && url.url) || "";
    if (!/api\.anthropic\.com/.test(u)) return real ? real(url, opts) : Promise.reject(new Error("no fetch"));
    let body = {};
    try { body = JSON.parse(opts.body || "{}"); } catch { /* ignore */ }
    let text;
    try { text = mockRespond(body); } catch (e) { text = JSON.stringify({ items: [] }); }
    await delay(420 + Math.random() * 480); // feel like a network round-trip
    return new Response(JSON.stringify({ content: [{ type: "text", text }] }), { status: 200, headers: { "Content-Type": "application/json" } });
  };
  // eslint-disable-next-line no-console
  console.log("%c[ATLAS preview] IA simulada localmente (sin Claude real).", "color:#CDB079");
}
