"use client";
import { useState, useRef, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import * as db from "@/lib/data";

// onucore AI — App consolidada (mobile-first)
// Hoy · Agenda (calendario + Google/Apple) · ➕Capturar · Dinero (finanzas self-employed) · Notas
// Captura voz/texto/foto → Claude estructura y enruta: gasto→Finanzas, cita→Agenda, nota→Notas.

const C = {
  bg: "#1A1A1F", surface: "#242429", surface2: "#2C2C33", border: "#3B3B43", borderSoft: "#312F37",
  text: "#ECEBE7", dim: "#ABACB4", mute: "#7C7D85", gold: "#e5484d", goldSoft: "#a8383c",
  red: "#e5484d", green: "#8a8b93", google: "#8a8b93", apple: "#8a8b93",
};
const SF = `-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Helvetica Neue", Helvetica, Arial, sans-serif`;
const MODEL = "claude-haiku-4-5";
const VISION_OK = ["image/jpeg", "image/png", "image/gif", "image/webp"];
const WACL = { bg: "#0B141A", header: "#1F2C34", inB: "#1F2C34", outB: "#005C4B", txt: "#E9EDEF", dim: "#8696A0", grn: "#00A884" };
const WDEST = { Finanzas: { color: "#8a8b93", icon: "💰" }, Agenda: { color: "#8a8b93", icon: "📅" }, Pendientes: { color: "#e5484d", icon: "✓" }, Notas: { color: "#8a8b93", icon: "📝" } };
const WAEX = [{ label: "Gasté $86 en gasolina con la Visa", kind: "text" }, { label: "🎤 Nota de voz", kind: "voice", text: "Recuérdame pagar la renta de la oficina el 1 de julio, son 4200 dólares" }, { label: "Reunión con María mañana 2pm", kind: "text" }, { label: "Cobré $1,800 de un cliente por PayPal", kind: "text" }];
const YEAR = new Date().getFullYear();
const GOALS = [
  { en: "Stay on top of taxes", es: "Estar al día con impuestos" },
  { en: "Grow my business", es: "Crecer mi negocio" },
  { en: "Organize my finances", es: "Organizar mis finanzas" },
  { en: "More family time", es: "Más tiempo en familia" },
  { en: "Better health & routine", es: "Mejor salud y rutina" },
  { en: "Less stress, forget less", es: "Menos estrés, olvidar menos" },
];
const CONNS = [
  { k: "google", name: "Google", en: "Sync your calendar (Gmail & contacts soon)", es: "Sincroniza tu calendario (Gmail y contactos pronto)" },
  { k: "apple", name: "Apple Calendar", en: "Sync your iPhone calendar", es: "Sincroniza el calendario de tu iPhone", soon: true },
  { k: "whatsapp", name: "WhatsApp", en: "Capture by message or voice note", es: "Captura por mensaje o nota de voz" },
];

const LANGS = [
  { code: "en", short: "EN", label: "English", speech: "en-US", locale: "en-US", aiName: "English" },
  { code: "es", short: "ES", label: "Español", speech: "es-MX", locale: "es-MX", aiName: "español" },
  { code: "pt", short: "PT", label: "Português", speech: "pt-BR", locale: "pt-BR", aiName: "português" },
  { code: "fr", short: "FR", label: "Français", speech: "fr-FR", locale: "fr-FR", aiName: "français" },
];
const AREAS = {
  work: { en: "Work", es: "Trabajo", color: "#8a8b93" }, family: { en: "Family", es: "Familia", color: "#8a8b93" },
  personal: { en: "Personal", es: "Personal", color: "#8a8b93" }, health: { en: "Health", es: "Salud", color: "#8a8b93" },
};
const CATS = [
  { k: "gas", en: "Gas & Vehicle", es: "Gasolina y auto", color: "#8a8b93", line: "Car & truck (L9)", ded: "partial", n_en: "Business miles only — 72.5¢/mi (2026). Commuting isn't deductible.", n_es: "Solo millas de negocio — 72.5¢/mi (2026). El traslado casa–oficina no deduce." },
  { k: "food", en: "Meals", es: "Comida", color: "#8a8b93", line: "Meals (L24b)", ded: "meals50", n_en: "Business meals only — 50% deductible.", n_es: "Solo comidas de negocio — 50% deducible." },
  { k: "tech", en: "Technology & Equipment", es: "Tecnología y equipo", color: "#8a8b93", line: "Depreciation / Supplies", ded: "full", n_en: "Business equipment — 100% bonus depreciation (2026).", n_es: "Equipo de negocio — depreciación bonus 100% (2026)." },
  { k: "travel", en: "Travel", es: "Viajes", color: "#8a8b93", line: "Travel (L24a)", ded: "full" },
  { k: "clothing", en: "Clothing", es: "Ropa", color: "#8a8b93", line: "—", ded: "none", n_en: "Everyday clothing is NOT deductible — only uniforms / protective gear.", n_es: "La ropa de uso diario NO deduce — solo uniformes / equipo de protección." },
  { k: "software", en: "Software & Subscriptions", es: "Software y suscripciones", color: "#8a8b93", line: "Other (L27a)", ded: "full" },
  { k: "ads", en: "Advertising & Marketing", es: "Publicidad", color: "#8a8b93", line: "Advertising (L8)", ded: "full" },
  { k: "office", en: "Office & Supplies", es: "Oficina y suministros", color: "#8a8b93", line: "Office / Supplies", ded: "full" },
  { k: "phone", en: "Phone & Internet", es: "Teléfono e internet", color: "#8a8b93", line: "Utilities / Other", ded: "partial", n_en: "Business-use portion only.", n_es: "Solo la parte de uso de negocio." },
  { k: "pro", en: "Professional services", es: "Servicios profesionales", color: "#8a8b93", line: "Legal & professional (L17)", ded: "full" },
  { k: "insurance", en: "Business insurance", es: "Seguro de negocio", color: "#8a8b93", line: "Insurance (L15)", ded: "full", n_en: "Self-employed health insurance deducts separately (Schedule 1).", n_es: "El seguro médico del independiente deduce aparte (Schedule 1)." },
  { k: "rent", en: "Rent & Coworking", es: "Renta y coworking", color: "#8a8b93", line: "Rent / lease (L20b)", ded: "full" },
  { k: "home", en: "Home office", es: "Oficina en casa", color: "#8a8b93", line: "Home office (8829)", ded: "full", n_en: "Simplified: $5/sq ft up to 300 sq ft (2026).", n_es: "Simplificado: $5/pie² hasta 300 pies² (2026)." },
  { k: "education", en: "Education & Training", es: "Educación", color: "#8a8b93", line: "Other (L27a)", ded: "full" },
  { k: "personal", en: "Personal / Other", es: "Personal / Otros", color: "#7C7D85", line: "—", ded: "none", n_en: "Personal expenses are never deductible.", n_es: "Los gastos personales nunca deducen." },
];
const INCOME = [{ k: "client", en: "Client payment", es: "Pago de cliente", color: "#8a8b93" }, { k: "sales", en: "Product sales", es: "Venta de productos", color: "#8a8b93" }, { k: "other_income", en: "Other income", es: "Otro ingreso", color: "#8a8b93" }];
const ACCOUNTS = [{ k: "amex", label: "Amex", type: "credit" }, { k: "visa", label: "Visa", type: "credit" }, { k: "paypal", label: "PayPal", type: "paypal" }, { k: "bank", label: "Checking", type: "bank" }, { k: "cash", label: "Cash", type: "cash" }];

const STR = {
  en: {
    nav_today: "Today", nav_agenda: "Agenda", nav_capture: "Add", nav_chat: "Chat", nav_money: "Money", nav_notes: "Notes", area_all: "All",
    briefing_label: "Daily briefing", regenerate: "Regenerate",
    today_attention: "Needs your attention", today_appts: "Today's appointments", today_todo: "To-do & reminders", today_bills: "Bills due soon", today_clear: "Nothing pressing. You're clear.",
    cal_connect: "Connect", ev_new: "New event", f_time: "Time", f_area: "Area",
    s_income: "Income", s_expenses: "Expenses", s_net: "Net", s_deductible: "Deductible",
    money_topay: "To pay", seg_txns: "Activity", seg_cats: "Categories", seg_accts: "Accounts", money_add: "Add income / expense", report: "Accountant report", none_txns: "Nothing here yet.",
    add_income: "Income", add_expense: "Expense", scan_receipt: "Scan receipt", scanning: "Reading receipt…", f_amount: "Amount", f_cat: "Category", f_acct: "Account", f_note: "Note (optional)", f_date: "Date", f_ded: "Tax-deductible", save: "Save", del: "Delete",
    rep_title: "Tax year {y} — for your accountant", rep_income: "Total income", rep_expenses: "Total expenses", rep_ded: "Total deductible", rep_by: "Deductible by Schedule C line", rep_export: "Export CSV", rep_close: "Close", rep_share: "Share", rep_copied: "Report copied to clipboard", rep_disc: "Guide only — not tax advice. Confirm with your accountant.",
    ded_full: "Deductible", ded_meals50: "50% deductible", ded_partial: "Business-use only", ded_none: "Not deductible",
    notes_none: "Your notes and ideas appear here.",
    cap_title: "Add anything", cap_sub: "Speak, snap a photo, or type — in any language. onucore files it where it belongs.", cap_speak: "Speak", cap_photo: "Photo reminder", cap_recent: "Just added",
    ph_idle: "Type in any language…", processing: "Processing…", added: "Added", nothing: "Nothing actionable found.", error: "Couldn't process that. Try again.",
    due_in: "Due in {n} days", due_today: "Due today", high: "High",
    type_event: "Appointment", type_task: "Task", type_followup: "Task", type_obligation: "Bill", type_expense: "Expense", type_income: "Income", type_note: "Note", type_idea: "Idea", type_contact: "Contact", type_reminder: "Reminder",
    voice_listening: "Listening…", voice_idle: "Tap and speak", voice_confirm: "Capture", voice_cancel: "Cancel", voice_unavail: "Microphone unavailable — type below", v_edit: "Edit or type…",
    rem_new: "New reminder", rem_note: "Note (optional) — e.g. buy this part", rem_save: "Save reminder", rem_reading: "Reading photo…", rem_choose: "Take / choose photo", rem_retake: "Change photo",
    edit_title: "Edit", area_label: "Area", amount_label: "Amount", date_label: "When", done_label: "Mark done",
    review_title: "Got this right?", review_sub: "Fix it before saving.", review_confirm: "Save", review_discard: "Discard",
    ask_label: "Ask onucore", ask_ph: "Ask onucore anything about your life…", ask_thinking: "Thinking…",
    alerts_label: "Heads up",
    tax_label: "Taxes", tax_setaside: "Set aside for taxes", tax_quarterly: "Quarterly estimate", tax_net: "Est. net (income − deductible)", tax_disc: "Rough estimate — not tax advice. Confirm with your accountant.",
    f_miles: "Miles (×$0.725/mi)",
    prof_title: "You & settings", sec_profile: "Profile", sec_about: "About you", sec_conn: "Connections", sec_settings: "Settings",
    f_name: "Name", f_role: "What you do", f_business: "Business / brand", f_tone: "How should onucore talk to you?", tone_casual: "Casual", tone_formal: "Formal",
    f_hobbies: "Interests & hobbies", f_people: "Key people", f_goals: "What should onucore help with?", f_wake: "Wake time", f_work: "Work hours", f_briefing: "Briefing time",
    add_ph: "Type and press Enter", person_name: "Name", person_rel: "Relationship",
    conn_sub: "Connect your accounts so onucore works better for you.", connect: "Connect", connected: "Connected", built_in: "Built-in",
    set_notif: "Daily briefing & proactive alerts", set_quiet: "Quiet hours", set_acct: "Default account for expenses", set_taxpct: "Tax set-aside (% of net)", set_lang: "Language", set_export: "Export my data", set_signout: "Sign out",
    f_nickname: "What you like to be called", f_pronouns: "Pronouns", f_birthday: "Birthday", f_whatsapp: "WhatsApp number", f_city: "City", f_tz: "Time zone",
    f_workertype: "You work as", wt_employee: "Employee", wt_freelance: "Self-employed", wt_owner: "Business owner",
    f_industry: "Industry", f_tax: "Tax structure", tx_sole: "Sole prop", tx_llc: "LLC", tx_scorp: "S-corp", tx_other: "Other",
    f_website: "Website / social", f_dietary: "Dietary preferences", f_about: "About me", about_ph: "Anything onucore should know — e.g. I drive a lot for work, I hate meetings before 10am, my accountant is Luis…",
    more_details: "More details", less_details: "Show less", prof_complete: "complete", priv_hint: "Optional. Don't store sensitive IDs (SSN, tax ID, card numbers).",
    set_brieflen: "Briefing length", bl_short: "Short", bl_detailed: "Detailed", set_remstyle: "Reminder style", rs_gentle: "Gentle", rs_firm: "Insistent", set_channel: "Preferred alert channel",
  },
  es: {
    nav_today: "Hoy", nav_agenda: "Agenda", nav_capture: "Agregar", nav_chat: "Chat", nav_money: "Dinero", nav_notes: "Notas", area_all: "Todo",
    briefing_label: "Briefing del día", regenerate: "Regenerar",
    today_attention: "Requiere tu atención", today_appts: "Citas de hoy", today_todo: "Pendientes y recordatorios", today_bills: "Pagos próximos", today_clear: "Nada urgente. Estás al día.",
    cal_connect: "Conectar", ev_new: "Nuevo evento", f_time: "Hora", f_area: "Área",
    s_income: "Ingresos", s_expenses: "Gastos", s_net: "Neto", s_deductible: "Deducible",
    money_topay: "Por pagar", seg_txns: "Movimientos", seg_cats: "Categorías", seg_accts: "Cuentas", money_add: "Agregar ingreso / gasto", report: "Reporte para contador", none_txns: "Nada aquí todavía.",
    add_income: "Ingreso", add_expense: "Gasto", scan_receipt: "Escanear recibo", scanning: "Leyendo recibo…", f_amount: "Monto", f_cat: "Categoría", f_acct: "Cuenta", f_note: "Nota (opcional)", f_date: "Fecha", f_ded: "Deducible de impuestos", save: "Guardar", del: "Eliminar",
    rep_title: "Año fiscal {y} — para tu contador", rep_income: "Ingresos totales", rep_expenses: "Gastos totales", rep_ded: "Total deducible", rep_by: "Deducible por línea del Schedule C", rep_export: "Exportar CSV", rep_close: "Cerrar", rep_share: "Compartir", rep_copied: "Reporte copiado al portapapeles", rep_disc: "Solo guía — no es asesoría fiscal. Confirma con tu contador.",
    ded_full: "Deducible", ded_meals50: "50% deducible", ded_partial: "Solo uso de negocio", ded_none: "No deducible",
    notes_none: "Tus notas e ideas aparecerán aquí.",
    cap_title: "Agrega lo que sea", cap_sub: "Habla, toma una foto o escribe — en cualquier idioma. onucore lo acomoda donde va.", cap_speak: "Hablar", cap_photo: "Recordatorio con foto", cap_recent: "Recién agregado",
    ph_idle: "Escribe en cualquier idioma…", processing: "Procesando…", added: "Agregado", nothing: "No encontré nada accionable.", error: "No pude procesar eso. Intenta de nuevo.",
    due_in: "Vence en {n} días", due_today: "Vence hoy", high: "Alta",
    type_event: "Cita", type_task: "Pendiente", type_followup: "Pendiente", type_obligation: "Pago", type_expense: "Gasto", type_income: "Ingreso", type_note: "Nota", type_idea: "Idea", type_contact: "Contacto", type_reminder: "Recordatorio",
    voice_listening: "Escuchando…", voice_idle: "Toca y habla", voice_confirm: "Capturar", voice_cancel: "Cancelar", voice_unavail: "Micrófono no disponible — escribe abajo", v_edit: "Edita o escribe…",
    rem_new: "Nuevo recordatorio", rem_note: "Nota (opcional) — ej. comprar esta pieza", rem_save: "Guardar recordatorio", rem_reading: "Leyendo foto…", rem_choose: "Tomar / elegir foto", rem_retake: "Cambiar foto",
    edit_title: "Editar", area_label: "Área", amount_label: "Monto", date_label: "Cuándo", done_label: "Marcar hecho",
    review_title: "¿Quedó bien?", review_sub: "Corrígelo antes de guardar.", review_confirm: "Guardar", review_discard: "Descartar",
    ask_label: "Pregúntale a onucore", ask_ph: "Pregúntale a onucore sobre tu vida…", ask_thinking: "Pensando…",
    alerts_label: "Atención",
    tax_label: "Impuestos", tax_setaside: "Aparta para impuestos", tax_quarterly: "Estimado trimestral", tax_net: "Neto est. (ingresos − deducible)", tax_disc: "Estimado aproximado — no es asesoría fiscal. Confirma con tu contador.",
    f_miles: "Millas (×$0.725/mi)",
    prof_title: "Tú y ajustes", sec_profile: "Perfil", sec_about: "Sobre ti", sec_conn: "Conexiones", sec_settings: "Ajustes",
    f_name: "Nombre", f_role: "A qué te dedicas", f_business: "Negocio / marca", f_tone: "¿Cómo te habla onucore?", tone_casual: "Cercano", tone_formal: "Formal",
    f_hobbies: "Intereses y hobbies", f_people: "Personas clave", f_goals: "¿En qué quieres que onucore te ayude?", f_wake: "Hora de despertar", f_work: "Horario laboral", f_briefing: "Hora del briefing",
    add_ph: "Escribe y presiona Enter", person_name: "Nombre", person_rel: "Relación",
    conn_sub: "Conecta tus cuentas para que onucore funcione mejor para ti.", connect: "Conectar", connected: "Conectado", built_in: "Integrado",
    set_notif: "Briefing diario y alertas proactivas", set_quiet: "Horas de silencio", set_acct: "Cuenta por defecto para gastos", set_taxpct: "Apartado de impuestos (% del neto)", set_lang: "Idioma", set_export: "Exportar mis datos", set_signout: "Cerrar sesión",
    f_nickname: "Cómo te gusta que te llamen", f_pronouns: "Pronombres", f_birthday: "Cumpleaños", f_whatsapp: "Número de WhatsApp", f_city: "Ciudad", f_tz: "Zona horaria",
    f_workertype: "Trabajas como", wt_employee: "Empleado", wt_freelance: "Independiente", wt_owner: "Dueño de negocio",
    f_industry: "Industria / rubro", f_tax: "Estructura fiscal", tx_sole: "Persona física", tx_llc: "LLC", tx_scorp: "S-corp", tx_other: "Otro",
    f_website: "Sitio web / redes", f_dietary: "Preferencias alimentarias", f_about: "Sobre mí", about_ph: "Lo que quieras que onucore sepa — ej. manejo mucho por trabajo, odio reuniones antes de las 10, mi contador es Luis…",
    more_details: "Más detalles", less_details: "Ver menos", prof_complete: "completo", priv_hint: "Opcional. No guardes datos sensibles (SSN, RFC, números de tarjeta).",
    set_brieflen: "Largo del briefing", bl_short: "Corto", bl_detailed: "Detallado", set_remstyle: "Estilo de recordatorios", rs_gentle: "Suave", rs_firm: "Insistente", set_channel: "Canal de aviso preferido",
  },
};

const uid = () => (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2, 10));
const todayISO = () => new Date().toISOString().slice(0, 10);
const money = (n, loc) => new Intl.NumberFormat(loc || "en-US", { style: "currency", currency: "USD", maximumFractionDigits: 2 }).format(n || 0);
const num = (v) => (typeof v === "number" ? v : parseFloat(v) || 0);
const daysUntil = (iso) => { if (!iso) return null; const d = new Date(iso + "T00:00:00"); const n = new Date(); n.setHours(0, 0, 0, 0); return Math.round((d - n) / 86400000); };
const areaName = (a, lang) => (AREAS[a] ? AREAS[a][lang === "es" ? "es" : "en"] : a);
const areaColor = (a) => (AREAS[a] ? AREAS[a].color : C.mute);
const catBy = (k) => CATS.find((c) => c.k === k) || CATS[CATS.length - 1];
const incBy = (k) => INCOME.find((c) => c.k === k) || INCOME[0];
const acctBy = (k) => ACCOUNTS.find((a) => a.k === k) || ACCOUNTS[0];
const dpct = (ded) => (ded === "meals50" ? 0.5 : ded === "none" ? 0 : 1);
const dedAmount = (tx) => (tx.kind !== "expense" || tx.ded === false ? 0 : tx.amount * dpct(catBy(tx.cat).ded));
const pad = (n) => String(n).padStart(2, "0");
const toISO = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;
function parseT(s) { if (!s) return 9999; const m = s.match(/(\d+):?(\d+)?\s*(AM|PM)?/i); if (!m) return 9999; let h = +m[1]; const mi = +(m[2] || 0); const ap = (m[3] || "").toUpperCase(); if (ap === "PM" && h !== 12) h += 12; if (ap === "AM" && h === 12) h = 0; return h * 60 + mi; }
function fmtDate(iso, lang) { return new Date(iso + "T00:00:00").toLocaleDateString(lang === "es" ? "es-MX" : "en-US", { weekday: "short", day: "numeric", month: "short" }); }

function seedItems() {
  const iso = (o) => { const d = new Date(); d.setDate(d.getDate() + o); return d.toISOString().slice(0, 10); };
  return [
    { id: uid(), type: "event", area: "work", title: "Q3 Board meeting", person: "Board", dateISO: iso(0), dateLabel: "10:00 AM", priority: "high" },
    { id: uid(), type: "event", area: "work", title: "Investor call", person: "Carlos M.", dateISO: iso(0), dateLabel: "3:30 PM" },
    { id: uid(), type: "event", area: "family", title: "Daughter's recital", dateISO: iso(1), dateLabel: "6:00 PM" },
    { id: uid(), type: "event", area: "health", title: "Dentist", dateISO: iso(5), dateLabel: "9:00 AM" },
    { id: uid(), type: "reminder", area: "personal", title: "Buy HVAC air filter", detail: "Size 20x25x1", done: false },
    { id: uid(), type: "reminder", area: "family", title: "Buy birthday gift for Elva", done: false },
    { id: uid(), type: "task", area: "work", title: "Send Texas expansion proposal", person: "Juan", dateISO: iso(2), dateLabel: "In 2 days", priority: "high", done: false },
    { id: uid(), type: "task", area: "personal", title: "Renew gym membership", done: false },
    { id: uid(), type: "obligation", area: "personal", title: "Vehicle registration", amount: 485, dateISO: iso(6) },
    { id: uid(), type: "obligation", area: "work", title: "Office rent", amount: 4200, dateISO: iso(27), dateLabel: "Jul 1" },
    { id: uid(), type: "obligation", area: "health", title: "Health insurance", amount: 640, dateISO: iso(12) },
    { id: uid(), type: "idea", area: "work", title: "Premium package for VIP clients", detail: "Membership with exclusive perks and priority booking." },
    { id: uid(), type: "note", area: "family", title: "Anniversary dinner — book Providence", detail: "Ask for the chef's table." },
  ];
}
function seedTxns() {
  const iso = (o) => { const d = new Date(); d.setDate(d.getDate() + o); return d.toISOString().slice(0, 10); };
  return [
    { id: uid(), kind: "income", amount: 6500, dateISO: iso(-2), cat: "client", account: "bank", note: "Retainer — Aequalend", ded: false },
    { id: uid(), kind: "income", amount: 1800, dateISO: iso(-9), cat: "client", account: "paypal", note: "Design project", ded: false },
    { id: uid(), kind: "income", amount: 920, dateISO: iso(-18), cat: "sales", account: "paypal", note: "Template pack", ded: false },
    { id: uid(), kind: "expense", amount: 248.12, dateISO: iso(0), cat: "office", account: "amex", note: "Costco supplies", ded: true },
    { id: uid(), kind: "expense", amount: 138, dateISO: iso(0), cat: "food", account: "amex", note: "Client lunch", ded: true },
    { id: uid(), kind: "expense", amount: 86, dateISO: iso(-1), cat: "gas", account: "visa", note: "Shell", ded: true },
    { id: uid(), kind: "expense", amount: 1299, dateISO: iso(-4), cat: "tech", account: "amex", note: "MacBook", ded: true },
    { id: uid(), kind: "expense", amount: 52, dateISO: iso(-4), cat: "software", account: "visa", note: "Adobe CC", ded: true },
    { id: uid(), kind: "expense", amount: 220, dateISO: iso(-7), cat: "clothing", account: "amex", note: "New jacket", ded: false },
    { id: uid(), kind: "expense", amount: 640, dateISO: iso(-12), cat: "travel", account: "amex", note: "Flight LAX–SFO", ded: true },
    { id: uid(), kind: "expense", amount: 300, dateISO: iso(-15), cat: "pro", account: "bank", note: "Bookkeeper", ded: true },
    { id: uid(), kind: "expense", amount: 95, dateISO: iso(-20), cat: "phone", account: "visa", note: "Cell plan", ded: true },
    { id: uid(), kind: "expense", amount: 64, dateISO: iso(-26), cat: "personal", account: "amex", note: "Groceries", ded: false },
  ];
}
function mockCal(source, y, m) {
  const days = source === "google"
    ? [{ d: 4, t: "9:00 AM", title: "Team sync" }, { d: 12, t: "11:00 AM", title: "Budget review" }, { d: 19, t: "4:00 PM", title: "1:1 with Sandra" }, { d: 26, t: "10:00 AM", title: "Q4 planning" }]
    : [{ d: 7, t: "7:00 PM", title: "Family dinner" }, { d: 15, t: "6:30 AM", title: "Gym" }, { d: 21, t: "8:00 PM", title: "Elva's birthday" }];
  const dim = new Date(y, m + 1, 0).getDate();
  return days.filter((e) => e.d <= dim).map((e, i) => ({ id: `${source}-${y}-${m}-${i}`, source, title: e.title, time: e.t, dateISO: toISO(y, m, e.d) }));
}

export default function AtlasAI() {
  const [items, setItems] = useState([]);
  const [txns, setTxns] = useState([]);
  const [tab, setTab] = useState("today");
  const [chatMsgs, setChatMsgs] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [vw, setVw] = useState(() => (typeof window !== "undefined" ? window.innerWidth : 1024));
  const desktop = vw >= 1024;
  const contentMax = desktop ? 720 : vw >= 680 ? 600 : 440;
  const navMax = Math.min(contentMax, 560);
  const [lang, setLang] = useState(() => { if (typeof window !== "undefined") { const s = window.localStorage.getItem("onucore_lang"); if (s === "es" || s === "en") return s; } return "en"; });
  const [langOpen, setLangOpen] = useState(false);
  const [areaFilter, setAreaFilter] = useState("all");
  const [input, setInput] = useState("");
  const [processing, setProcessing] = useState(false);
  const [briefing, setBriefing] = useState("");
  const [briefingLoading, setBriefingLoading] = useState(false);
  const [toast, setToast] = useState(null);
  const [voiceMode, setVoiceMode] = useState(false);
  const [listening, setListening] = useState(false);
  const [voiceAvailable, setVoiceAvailable] = useState(true);
  const [recentId, setRecentId] = useState(null);
  const [remOpen, setRemOpen] = useState(false);
  const [photo, setPhoto] = useState(null);
  const [photoType, setPhotoType] = useState(null);
  const [note, setNote] = useState("");
  const [remBusy, setRemBusy] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [waOpen, setWaOpen] = useState(false);
  const [waMsgs, setWaMsgs] = useState([{ id: uid(), from: "bot", text: "Hola 👋 Soy onucore. Mándame un gasto, una cita, un pendiente o una idea — por texto, voz o foto — y lo acomodo en tu app." }]);
  const [waInput, setWaInput] = useState("");
  const [waTyping, setWaTyping] = useState(false);
  const [waShowEx, setWaShowEx] = useState(true);
  const [askQ, setAskQ] = useState("");
  const [askA, setAskA] = useState("");
  const [askLoading, setAskLoading] = useState(false);
  const [profile, setProfile] = useState({ name: "", nickname: "", role: "", business: "", photo: null, tone: "casual", pronouns: "", birthday: "", whatsapp: "", city: "", tz: "", workerType: "", industry: "", taxStructure: "", website: "", dietary: "", about: "", hobbies: [], people: [], goals: [], wake: "7:00 AM", workHours: "9–6", briefingTime: "8:00 AM", notif: true, briefLen: "short", reminderStyle: "gentle", notifyChannel: "push", quiet: "10pm–7am", defaultAccount: "amex", setAsidePct: 30, conns: { gmail: false, bank: false, contacts: false, whatsapp: true } });
  const [profileOpen, setProfileOpen] = useState(false);
  const [profMore, setProfMore] = useState(false);
  const [hobbyInput, setHobbyInput] = useState(""); const [pName, setPName] = useState(""); const [pRel, setPRel] = useState("");
  const [itemDraft, setItemDraft] = useState(null);
  const [txnDraft, setTxnDraft] = useState(null);
  const [review, setReview] = useState(null);
  const [reportOpen, setReportOpen] = useState(false);
  // calendar
  const now0 = new Date();
  const [calY, setCalY] = useState(now0.getFullYear());
  const [calM, setCalM] = useState(now0.getMonth());
  const [calSel, setCalSel] = useState(todayISO());
  const [calSrc, setCalSrc] = useState({ google: false, apple: false });
  // Google Calendar — real connection state + events fetched for the visible month.
  const [gcal, setGcal] = useState({ connected: false, email: null, loading: true });
  const [gcalEvents, setGcalEvents] = useState([]);
  // finance
  const [period, setPeriod] = useState("year");
  const [fseg, setFseg] = useState("txns");
  const recogRef = useRef(null); const fileRef = useRef(null); const receiptRef = useRef(null); const waFileRef = useRef(null); const waEndRef = useRef(null); const chatEndRef = useRef(null); const profileFileRef = useRef(null);

  const supabase = useMemo(() => createClient(), []);
  const [userId, setUserId] = useState(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      const user = data && data.user;
      if (!user || !alive) return;
      setUserId(user.id);
      try {
        const d = await db.loadAll(supabase, user.id);
        if (!alive) return;
        setItems(d.items);
        setTxns(d.txns);
        if (d.profile) setProfile((p) => ({ ...p, ...d.profile }));
      } catch { /* noop */ }
    })();
    return () => { alive = false; };
  }, [supabase]);
  const profSaveRef = useRef(null);
  useEffect(() => {
    if (!userId) return;
    if (profSaveRef.current) clearTimeout(profSaveRef.current);
    profSaveRef.current = setTimeout(() => { db.saveProfile(supabase, profile); }, 800);
    return () => { if (profSaveRef.current) clearTimeout(profSaveRef.current); };
  }, [profile, userId, supabase]);

  const L = LANGS.find((l) => l.code === lang) || LANGS[0];
  const t = STR[lang] || STR.en; const loc = L.locale; const now = new Date();
  const byArea = (arr) => (areaFilter === "all" ? arr : arr.filter((i) => i.area === areaFilter));

  // ── Google Calendar sync ────────────────────────────────────────────────
  const connectGoogle = () => { if (typeof window !== "undefined") window.location.href = "/api/google/connect"; };
  const disconnectGoogle = () => {
    fetch("/api/google/disconnect", { method: "POST" }).then(() => {
      setGcal({ connected: false, email: null, loading: false });
      setGcalEvents([]);
      setCalSrc((c) => ({ ...c, google: false }));
      setToast({ kind: "ok", text: lang === "es" ? "Google Calendar desconectado" : "Google Calendar disconnected" });
    });
  };
  // On mount: read the OAuth return flag (?gcal=…), clean the URL, check status.
  useEffect(() => {
    let flag = null;
    if (typeof window !== "undefined") {
      const u = new URL(window.location.href);
      flag = u.searchParams.get("gcal");
      if (flag) { u.searchParams.delete("gcal"); window.history.replaceState({}, "", u.pathname + u.search); }
    }
    if (flag === "connected") setToast({ kind: "ok", text: lang === "es" ? "Google Calendar conectado ✓" : "Google Calendar connected ✓" });
    else if (flag === "unconfigured") setToast({ kind: "warn", text: lang === "es" ? "Google aún no está configurado (faltan las claves)" : "Google isn't set up yet (missing keys)" });
    else if (flag === "error") setToast({ kind: "warn", text: lang === "es" ? "No se pudo conectar con Google" : "Couldn't connect to Google" });
    else if (flag === "login") setToast({ kind: "warn", text: lang === "es" ? "Inicia sesión primero" : "Sign in first" });
    fetch("/api/google/status").then((r) => r.json()).then((d) => {
      setGcal({ connected: !!d.connected, email: d.email || null, loading: false });
      if (d.connected) setCalSrc((c) => ({ ...c, google: true }));
    }).catch(() => setGcal({ connected: false, email: null, loading: false }));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // When connected (or the month changes): load that month's Google events.
  useEffect(() => {
    if (!gcal.connected) { setGcalEvents([]); return; }
    const timeMin = new Date(calY, calM, -1).toISOString();
    const timeMax = new Date(calY, calM + 1, 3).toISOString();
    let cancelled = false;
    fetch(`/api/google/events?timeMin=${encodeURIComponent(timeMin)}&timeMax=${encodeURIComponent(timeMax)}`)
      .then((r) => r.json())
      .then((d) => { if (cancelled) return; if (d && d.connected === false) { setGcal((g) => ({ ...g, connected: false })); setGcalEvents([]); } else setGcalEvents((d && d.events) || []); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [gcal.connected, calY, calM]);

  async function processCapture(raw) {
    const text = (raw ?? "").trim(); if (!text) return;
    setProcessing(true); setToast(null);
    const sys = `Eres el motor de estructuración de onucore AI. El usuario escribe en CUALQUIER idioma; entiéndelo igual.
Hoy es ${todayISO()}. Resuelve fechas relativas a ISO. Una frase puede tener VARIOS ítems.
type ∈ event,task,obligation,expense,income,note,idea,contact,followup,reminder. area ∈ work,family,personal,health.
Si type=expense: agrega financeCat ∈ [${CATS.map((c) => c.k).join(",")}], account ∈ [amex,visa,paypal,bank,cash], deductible (bool).
Si type=income: agrega incomeCat ∈ [client,sales,other_income], account.
Redacta title/dateLabel/detail en ${L.aiName}.
SOLO JSON: {"items":[{"type":"","area":"personal","title":"","amount":null,"dateISO":null,"dateLabel":"","person":"","priority":"medium","detail":"","financeCat":"","incomeCat":"","account":"","deductible":true}]}
Si nada accionable: {"items":[]}.${userCtx()}`;
    try {
      const res = await fetch("/api/claude", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: MODEL, max_tokens: 1000, system: sys, messages: [{ role: "user", content: text }] }) });
      const data = await res.json();
      const out = (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n").replace(/```json|```/g, "").trim();
      const parsed = JSON.parse(out);
      const ni = (parsed.items || []).map((it) => {
        const type = it.type || "note";
        if (type === "expense") { const cat = catBy(it.financeCat).k === it.financeCat ? it.financeCat : "personal"; const account = acctBy(it.account).k === it.account ? it.account : "amex"; return { _dest: "txn", id: uid(), kind: "expense", amount: num(it.amount), cat, account, dateISO: it.dateISO || todayISO(), title: it.title || text, ded: typeof it.deductible === "boolean" ? it.deductible : catBy(cat).ded !== "none" }; }
        if (type === "income") { const cat = incBy(it.incomeCat).k === it.incomeCat ? it.incomeCat : "client"; const account = acctBy(it.account).k === it.account ? it.account : "bank"; return { _dest: "txn", id: uid(), kind: "income", amount: num(it.amount), cat, account, dateISO: it.dateISO || todayISO(), title: it.title || text, ded: false }; }
        return { _dest: "item", id: uid(), type, area: AREAS[it.area] ? it.area : "personal", title: it.title || text, amount: typeof it.amount === "number" ? it.amount : null, dateISO: it.dateISO || null, dateLabel: it.dateLabel || "", person: it.person || "", priority: it.priority || "medium", detail: it.detail || "", done: false };
      });
      if (ni.length === 0) setToast({ kind: "warn", text: t.nothing }); else setReview(ni);
      setInput("");
    } catch { setToast({ kind: "warn", text: t.error }); } finally { setProcessing(false); }
  }
  function confirmReview() {
    if (!review || !review.length) { setReview(null); return; }
    const its = review.filter((r) => r._dest === "item").map((r) => { const { _dest, ...x } = r; return x; });
    const tx = review.filter((r) => r._dest === "txn").map((r) => { const { _dest, title, ...x } = r; return { ...x, note: title }; });
    if (its.length) setItems((p) => [...its, ...p]);
    if (tx.length) setTxns((p) => [...tx, ...p]);
    its.forEach((it) => db.upsertItem(supabase, it)); tx.forEach((x) => db.upsertTxn(supabase, x));
    setRecentId((its[0] || tx[0]).id); setTimeout(() => setRecentId(null), 2000);
    setToast({ kind: "ok", text: `${t.added} · ${review.length}` }); setReview(null);
  }

  async function generateBriefing(data) {
    setBriefingLoading(true);
    const st = { eventsToday: data.filter((i) => i.type === "event" && i.dateISO === todayISO()).map((i) => i.title), urgent: data.filter((i) => (i.type === "task" || i.type === "followup") && i.priority === "high" && !i.done).map((i) => i.title), reminders: data.filter((i) => i.type === "reminder" && !i.done).map((i) => i.title), due: data.filter((i) => i.type === "obligation").map((i) => ({ t: i.title, days: daysUntil(i.dateISO) })).filter((o) => o.days != null && o.days <= 10) };
    try {
      const res = await fetch("/api/claude", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: MODEL, max_tokens: 1000, system: `Eres el Chief of Staff de onucore AI. Briefing de ${profile.briefLen === "detailed" ? "4-5" : "2-3"} frases EN ${L.aiName}, sobrio y cálido, segunda persona, solo prosa. Saludo según la hora.${userCtx()}`, messages: [{ role: "user", content: `Hora: ${now.getHours()}h. Estado: ${JSON.stringify(st)}.` }] }) });
      const d = await res.json(); setBriefing((d.content || []).filter((b) => b.type === "text").map((b) => b.text).join(" ").trim() || "—");
    } catch { setBriefing("—"); } finally { setBriefingLoading(false); }
  }
  useEffect(() => { generateBriefing(items); /* eslint-disable-next-line */ }, [lang]);
  useEffect(() => { waEndRef.current && waEndRef.current.scrollIntoView({ behavior: "smooth" }); }, [waMsgs, waTyping]);
  useEffect(() => { chatEndRef.current && chatEndRef.current.scrollIntoView({ behavior: "smooth" }); }, [chatMsgs, chatLoading]);
  useEffect(() => { if (typeof window !== "undefined" && window.sessionStorage.getItem("onucore_onboard") === "1") setShowOnboarding(true); }, []);
  useEffect(() => { const onR = () => setVw(window.innerWidth); window.addEventListener("resize", onR); return () => window.removeEventListener("resize", onR); }, []);

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition; if (!SR) { setVoiceAvailable(false); return; }
    const r = new SR(); r.interimResults = true; r.continuous = false;
    r.onresult = (ev) => setInput(Array.from(ev.results).map((x) => x[0].transcript).join("")); r.onend = () => setListening(false);
    r.onerror = (e) => { setListening(false); if (e.error === "not-allowed" || e.error === "service-not-allowed") setVoiceAvailable(false); };
    recogRef.current = r;
  }, []);
  function openVoice() { setVoiceMode(true); setInput(""); const r = recogRef.current; if (r && voiceAvailable) { try { r.lang = L.speech; r.start(); setListening(true); } catch {} } }
  function stopListen() { const r = recogRef.current; if (r) { try { r.stop(); } catch {} } setListening(false); }
  function confirmVoice() { stopListen(); const v = input; setVoiceMode(false); processCapture(v); }
  function cancelVoice() { stopListen(); setVoiceMode(false); setInput(""); }
  function restartListen() { const r = recogRef.current; if (r && voiceAvailable) { try { setInput(""); r.lang = L.speech; r.start(); setListening(true); } catch {} } }

  function pickPhoto(e) { const f = e.target.files && e.target.files[0]; if (!f) return; setPhotoType(f.type); const rd = new FileReader(); rd.onload = () => { setPhoto(rd.result); setRemOpen(true); }; rd.readAsDataURL(f); e.target.value = ""; }
  async function saveReminder() {
    if (!photo && !note.trim()) return; setRemBusy(true); let title = note.trim(); let detail = ""; let area = "personal";
    if (photo && VISION_OK.includes(photoType)) {
      try {
        const b64 = photo.split(",")[1];
        const res = await fetch("/api/claude", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: MODEL, max_tokens: 1000, system: `Eres onucore AI. El usuario fotografió algo que necesita recordar.${note.trim() ? ' Nota: "' + note.trim() + '".' : ""} SOLO JSON: {"title":"","detail":"","area":"personal"}. title EN ${L.aiName}, accionable. area ∈ work|family|personal|health.`, messages: [{ role: "user", content: [{ type: "image", source: { type: "base64", media_type: photoType, data: b64 } }, { type: "text", text: "Genera el recordatorio." }] }] }) });
        const d = await res.json(); const o = (d.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n").replace(/```json|```/g, "").trim(); const p = JSON.parse(o); title = p.title || title; detail = p.detail || ""; if (AREAS[p.area]) area = p.area;
      } catch {}
    }
    if (!title) title = lang === "es" ? "Recordatorio" : "Reminder";
    const id = uid(); const remIt = { id, type: "reminder", area, title, detail, photo, done: false }; setItems((p) => [remIt, ...p]); db.upsertItem(supabase, remIt); setRecentId(id); setTimeout(() => setRecentId(null), 2000);
    setPhoto(null); setPhotoType(null); setNote(""); setRemOpen(false); setRemBusy(false); setTab("today");
  }

  const openEdit = (it) => setItemDraft({ ...it });
  const saveItem = () => { const { _new, ...x } = itemDraft; setItems((p) => (p.some((i) => i.id === x.id) ? p.map((i) => (i.id === x.id ? x : i)) : [x, ...p])); db.upsertItem(supabase, x); setItemDraft(null); };
  const deleteItem = () => { const id = itemDraft.id; setItems((p) => p.filter((i) => i.id !== id)); db.deleteItem(supabase, id); setItemDraft(null); };
  const toggleDone = (id) => { setItems((p) => p.map((i) => (i.id === id ? { ...i, done: !i.done } : i))); const cur = items.find((i) => i.id === id); if (cur) db.upsertItem(supabase, { ...cur, done: !cur.done }); };
  const newEvent = () => setItemDraft({ id: uid(), type: "event", area: "work", title: "", dateISO: calSel, dateLabel: "", _new: true });
  const openTxn = (tx) => setTxnDraft({ ...tx, amount: String(tx.amount) });
  const newTxn = () => setTxnDraft({ id: uid(), kind: "expense", amount: "", dateISO: todayISO(), cat: "office", account: profile.defaultAccount || "amex", note: "", ded: true, _new: true });
  const saveTxn = () => { const a = parseFloat(txnDraft.amount); if (!a || a <= 0) return; const { _new, ...x } = { ...txnDraft, amount: a }; setTxns((p) => (p.some((i) => i.id === x.id) ? p.map((i) => (i.id === x.id ? x : i)) : [x, ...p])); db.upsertTxn(supabase, x); setTxnDraft(null); };
  const deleteTxn = () => { const id = txnDraft.id; setTxns((p) => p.filter((x) => x.id !== id)); db.deleteTxn(supabase, id); setTxnDraft(null); };
  function scanReceipt(e) {
    const f = e.target.files && e.target.files[0]; if (!f) return; const type = f.type; e.target.value = "";
    const rd = new FileReader();
    rd.onload = async () => {
      if (!VISION_OK.includes(type)) return;
      setScanning(true);
      try {
        const b64 = rd.result.split(",")[1];
        const res = await fetch("/api/claude", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: MODEL, max_tokens: 1000, system: `Eres onucore AI. El usuario fotografió un recibo o comprobante para registrar un movimiento financiero. Extrae los datos. SOLO JSON: {"kind":"expense","amount":0,"merchant":"","dateISO":"","financeCat":"office","deductible":true}. kind: "expense" si es recibo de compra/gasto, "income" si es un comprobante de pago recibido o factura cobrada. financeCat ∈ [${CATS.map((c) => c.k).join(",")}]. dateISO la fecha del recibo (YYYY-MM-DD) o "". merchant: el comercio o la fuente del dinero. deductible: true si parece gasto de negocio deducible.`, messages: [{ role: "user", content: [{ type: "image", source: { type: "base64", media_type: type, data: b64 } }, { type: "text", text: "Extrae los datos del recibo." }] }] }) });
        const d = await res.json(); const o = (d.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n").replace(/```json|```/g, "").trim(); const p = JSON.parse(o);
        const kind = p.kind === "income" ? "income" : "expense";
        const cat = kind === "income" ? "client" : (catBy(p.financeCat).k === p.financeCat ? p.financeCat : "office");
        setTxnDraft((dft) => ({ ...dft, kind, amount: p.amount ? String(p.amount) : dft.amount, note: p.merchant || dft.note, dateISO: p.dateISO || dft.dateISO, cat, ded: kind === "expense" ? (typeof p.deductible === "boolean" ? p.deductible : catBy(cat).ded !== "none") : false }));
      } catch {} finally { setScanning(false); }
    };
    rd.readAsDataURL(f);
  }

  function destOf(n) { if (n._dest === "txn") return "Finanzas"; if (n.type === "event") return "Agenda"; if (n.type === "obligation") return "Finanzas"; if (n.type === "note" || n.type === "idea" || n.type === "contact") return "Notas"; return "Pendientes"; }
  function commitNi(ni) {
    const its = ni.filter((r) => r._dest === "item").map((r) => { const { _dest, ...x } = r; return x; });
    const tx = ni.filter((r) => r._dest === "txn").map((r) => { const { _dest, title, ...x } = r; return { ...x, note: title }; });
    if (its.length) setItems((p) => [...its, ...p]);
    if (tx.length) setTxns((p) => [...tx, ...p]);
    its.forEach((it) => db.upsertItem(supabase, it)); tx.forEach((x) => db.upsertTxn(supabase, x));
  }
  function normalizeNi(list) {
    return (list || []).map((it) => {
      const type = it.type || "note";
      if (type === "expense") { const cat = catBy(it.financeCat).k === it.financeCat ? it.financeCat : "personal"; const account = acctBy(it.account).k === it.account ? it.account : "amex"; return { _dest: "txn", id: uid(), kind: "expense", amount: num(it.amount), cat, account, dateISO: it.dateISO || todayISO(), title: it.title || "", ded: typeof it.deductible === "boolean" ? it.deductible : catBy(cat).ded !== "none" }; }
      if (type === "income") { const cat = incBy(it.incomeCat).k === it.incomeCat ? it.incomeCat : "client"; const account = acctBy(it.account).k === it.account ? it.account : "bank"; return { _dest: "txn", id: uid(), kind: "income", amount: num(it.amount), cat, account, dateISO: it.dateISO || todayISO(), title: it.title || "", ded: false }; }
      return { _dest: "item", id: uid(), type, area: AREAS[it.area] ? it.area : "personal", title: it.title || "", amount: typeof it.amount === "number" ? it.amount : null, dateISO: it.dateISO || null, dateLabel: it.dateLabel || "", person: "", priority: it.priority || "medium", detail: it.detail || "", done: false };
    });
  }
  async function waStructure(text) {
    const sys = `Eres onucore AI conectado por WhatsApp. El usuario escribe en CUALQUIER idioma. Hoy es ${todayISO()}. Resuelve fechas relativas. Una frase puede tener varios ítems.
type ∈ event,task,obligation,expense,income,note,idea,reminder. area ∈ work,family,personal,health. Si expense: financeCat ∈ [${CATS.map((c) => c.k).join(",")}], account ∈ [amex,visa,paypal,bank,cash], deductible bool. Si income: incomeCat ∈ [client,sales,other_income], account.
Devuelve SOLO JSON: {"items":[{"type":"","area":"personal","title":"","amount":null,"dateISO":null,"dateLabel":"","financeCat":"","incomeCat":"","account":"","deductible":true}],"reply":""}
reply: confirmación CORTA estilo WhatsApp EN EL MISMO IDIOMA del usuario, empieza con ✓, di qué entendiste. Si nada accionable: items vacío y reply pidiendo más detalle.${userCtx()}`;
    const res = await fetch("/api/claude", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: MODEL, max_tokens: 1000, system: sys, messages: [{ role: "user", content: text }] }) });
    const d = await res.json(); const o = (d.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n").replace(/```json|```/g, "").trim(); return JSON.parse(o);
  }
  async function waSend(text, kind, voiceText) {
    const content = kind === "voice" ? voiceText : text; if (!content || !content.trim()) return;
    setWaShowEx(false);
    setWaMsgs((m) => [...m, kind === "voice" ? { id: uid(), from: "me", kind: "voice", dur: "0:06" } : { id: uid(), from: "me", text: content }]);
    setWaInput(""); setWaTyping(true);
    try {
      const p = await waStructure(content); const ni = normalizeNi(p.items);
      if (ni.length) { commitNi(ni); setRecentId(ni[0].id); setTimeout(() => setRecentId(null), 2000); }
      setWaTyping(false);
      setWaMsgs((m) => [...m, { id: uid(), from: "bot", text: p.reply || "✓", cards: ni.map((n) => ({ title: n.title, dest: destOf(n), amount: n.amount, ded: n.ded })) }]);
    } catch { setWaTyping(false); setWaMsgs((m) => [...m, { id: uid(), from: "bot", text: t.error }]); }
  }
  async function waPhoto(e) {
    const f = e.target.files && e.target.files[0]; if (!f) return; const type = f.type; e.target.value = "";
    const rd = new FileReader();
    rd.onload = async () => {
      setWaShowEx(false); setWaMsgs((m) => [...m, { id: uid(), from: "me", kind: "photo", src: rd.result }]);
      if (!VISION_OK.includes(type)) { setWaMsgs((m) => [...m, { id: uid(), from: "bot", text: "📷 ✓" }]); return; }
      setWaTyping(true);
      try {
        const b64 = rd.result.split(",")[1];
        const res = await fetch("/api/claude", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: MODEL, max_tokens: 1000, system: `Eres onucore AI por WhatsApp. El usuario mandó la foto de un recibo. Extrae el gasto. SOLO JSON: {"items":[{"type":"expense","title":"","amount":0,"financeCat":"office","account":"amex","deductible":true,"area":"personal"}],"reply":""}. financeCat ∈ [${CATS.map((c) => c.k).join(",")}]. reply: confirmación corta estilo WhatsApp en español con ✓, monto y comercio, "→ Finanzas".`, messages: [{ role: "user", content: [{ type: "image", source: { type: "base64", media_type: type, data: b64 } }, { type: "text", text: "Lee el recibo y regístralo." }] }] }) });
        const d = await res.json(); const o = (d.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n").replace(/```json|```/g, "").trim(); const p = JSON.parse(o); const ni = normalizeNi(p.items);
        if (ni.length) { commitNi(ni); setRecentId(ni[0].id); setTimeout(() => setRecentId(null), 2000); }
        setWaTyping(false); setWaMsgs((m) => [...m, { id: uid(), from: "bot", text: p.reply || "✓ → Finanzas", cards: ni.map((n) => ({ title: n.title, dest: "Finanzas", amount: n.amount, ded: n.ded })) }]);
      } catch { setWaTyping(false); setWaMsgs((m) => [...m, { id: uid(), from: "bot", text: t.error }]); }
    };
    rd.readAsDataURL(f);
  }

  async function askAtlas(q) {
    const query = (q ?? "").trim(); if (!query) return;
    setAskLoading(true); setAskA("");
    const snapshot = {
      today: todayISO(),
      items: items.map((i) => ({ type: i.type, area: i.area, title: i.title, dateISO: i.dateISO, dateLabel: i.dateLabel, amount: i.amount, done: i.done, detail: i.detail })),
      txns: txns.map((x) => ({ kind: x.kind, amount: x.amount, category: (x.kind === "income" ? incBy(x.cat) : catBy(x.cat))[lang === "es" ? "es" : "en"], account: acctBy(x.account).label, dateISO: x.dateISO, note: x.note, deductibleAmount: dedAmount(x) })),
    };
    try {
      const res = await fetch("/api/claude", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ model: MODEL, max_tokens: 1000, system: `Eres onucore AI, el chief of staff del usuario. Responde su pregunta USANDO ÚNICAMENTE los datos JSON que te paso (su agenda, pendientes, pagos, finanzas y notas). Hoy es ${todayISO()}. Responde CORTO, directo y útil, EN EL MISMO IDIOMA de la pregunta. Montos en USD. Si te piden sumar/contar, hazlo con precisión. Si los datos no alcanzan para responder, dilo con honestidad. Solo prosa, sin markdown.${userCtx()}`, messages: [{ role: "user", content: `Datos:\n${JSON.stringify(snapshot)}\n\nPregunta: ${query}` }] }) });
      const d = await res.json(); setAskA((d.content || []).filter((b) => b.type === "text").map((b) => b.text).join(" ").trim() || "—");
    } catch { setAskA(t.error); } finally { setAskLoading(false); }
  }

  const CHAT_TOOL = {
    name: "add_to_onucore",
    description: "Guarda entradas REALES en onucore (agenda, dinero, pendientes, notas). Úsala SOLO cuando el usuario quiera AGREGAR o REGISTRAR algo (agendar una cita, anotar un gasto/ingreso, crear un recordatorio, tarea o nota). NO la uses para responder preguntas sobre datos que ya existen. Una sola frase puede contener varios ítems.",
    input_schema: {
      type: "object",
      properties: {
        items: {
          type: "array",
          description: "Entradas a crear.",
          items: {
            type: "object",
            properties: {
              type: { type: "string", enum: ["event", "task", "reminder", "obligation", "note", "idea", "followup", "contact", "expense", "income"], description: "Tipo de entrada." },
              title: { type: "string", description: "Título corto y accionable." },
              area: { type: "string", enum: ["work", "family", "personal", "health"] },
              amount: { type: "number", description: "Monto (solo para expense/income)." },
              dateISO: { type: "string", description: "Fecha YYYY-MM-DD si aplica." },
              dateLabel: { type: "string", description: "Etiqueta de fecha legible, ej. 'mañana 3pm'." },
              detail: { type: "string" },
              priority: { type: "string", enum: ["low", "medium", "high"] },
              financeCat: { type: "string", description: "Categoría de gasto. Una de: " + CATS.map((c) => c.k).join(", ") },
              incomeCat: { type: "string", description: "Categoría de ingreso: client, sales u other_income." },
              account: { type: "string", description: "Método: amex, visa, paypal, bank o cash." },
              deductible: { type: "boolean", description: "Si el gasto parece deducible de impuestos." },
            },
            required: ["type", "title"],
          },
        },
      },
      required: ["items"],
    },
  };

  async function sendChat(text) {
    const msg = (text ?? "").trim();
    if (!msg || chatLoading) return;
    setChatMsgs((prev) => [...prev, { role: "user", content: msg }]);
    setChatInput("");
    setChatLoading(true);
    const snapshot = {
      today: todayISO(),
      items: items.map((i) => ({ type: i.type, area: i.area, title: i.title, dateISO: i.dateISO, dateLabel: i.dateLabel, amount: i.amount, done: i.done, detail: i.detail })),
      txns: txns.map((x) => ({ kind: x.kind, amount: x.amount, category: (x.kind === "income" ? incBy(x.cat) : catBy(x.cat))[lang === "es" ? "es" : "en"], account: acctBy(x.account).label, dateISO: x.dateISO, note: x.note, deductibleAmount: dedAmount(x) })),
    };
    const sys = `Eres onucore AI, el asistente personal y chief of staff del usuario, conversando por chat. Cálido, cercano y útil. IDIOMA (OBLIGATORIO): TODA tu respuesta — y cualquier título que generes para guardar — van en ${lang === "es" ? "ESPAÑOL" : "INGLÉS"}, sin excepción, sin importar el idioma de estas instrucciones ni de los datos.
PUEDES ACTUAR: cuando el usuario quiera AGREGAR o REGISTRAR algo (agendar una cita, anotar un gasto o ingreso, crear un recordatorio, tarea o nota), usa la herramienta add_to_onucore para guardarlo DE VERDAD. Resuelve fechas relativas a ISO (hoy es ${todayISO()}). Para gastos, infiere financeCat, account y deducible razonables. Después de guardar, confirma en UNA frase corta y natural lo que hiciste (no repitas todos los campos). NO uses la herramienta para responder preguntas sobre datos que ya existen — eso respóndelo con texto usando los datos de abajo.
Usa los datos del usuario para responder con precisión (sumas, fechas, conteos); si no alcanzan, dilo con honestidad. Conversacional y conciso (1-4 frases salvo que pidan más). Solo prosa, sin markdown.${userCtx()}

Datos del usuario:
${JSON.stringify(snapshot)}`;
    const apiMsgs = [...chatMsgs.map((m) => ({ role: m.role, content: m.content })), { role: "user", content: msg }];
    try {
      const cards = [];
      for (let turn = 0; turn < 4; turn++) {
        const res = await fetch("/api/claude", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model: MODEL, max_tokens: 1200, system: sys, messages: apiMsgs, tools: [CHAT_TOOL] }),
        });
        const d = await res.json();
        const content = d.content || [];
        const toolUses = content.filter((b) => b.type === "tool_use");
        if (d.stop_reason === "tool_use" && toolUses.length) {
          apiMsgs.push({ role: "assistant", content });
          const results = [];
          for (const tu of toolUses) {
            let note = "ok";
            if (tu.name === "add_to_onucore" && tu.input && Array.isArray(tu.input.items)) {
              const ni = normalizeNi(tu.input.items);
              if (ni.length) {
                commitNi(ni);
                cards.push(...ni.map((n) => ({ title: n.title, dest: destOf(n), amount: n.amount, ded: n.ded })));
                setRecentId(ni[0].id); setTimeout(() => setRecentId(null), 2000);
              }
              note = `saved=${ni.length}`;
            }
            results.push({ type: "tool_result", tool_use_id: tu.id, content: note });
          }
          apiMsgs.push({ role: "user", content: results });
          continue;
        }
        const reply = content.filter((b) => b.type === "text").map((b) => b.text).join(" ").trim() || (cards.length ? "✓" : "—");
        setChatMsgs((h) => [...h, { role: "assistant", content: reply, cards: cards.length ? cards : undefined }]);
        return;
      }
      setChatMsgs((h) => [...h, { role: "assistant", content: "✓", cards: cards.length ? cards : undefined }]);
    } catch {
      setChatMsgs((h) => [...h, { role: "assistant", content: t.error }]);
    } finally {
      setChatLoading(false);
    }
  }

  function userCtx() {
    const p = profile; const es = lang === "es"; const b = [];
    if (p.name) b.push(`${es ? "Nombre" : "Name"}: ${p.name}`);
    if (p.role) b.push(`${es ? "Ocupación" : "Role"}: ${p.role}`);
    b.push(es ? `trátalo de forma ${p.tone === "formal" ? "formal" : "cercana (tú)"}` : `address them ${p.tone}`);
    if (p.hobbies.length) b.push(`${es ? "Intereses" : "Interests"}: ${p.hobbies.join(", ")}`);
    if (p.people.length) b.push(`${es ? "Personas clave" : "Key people"}: ${p.people.map((x) => x.name + (x.rel ? ` (${x.rel})` : "")).join(", ")}`);
    if (p.goals.length) b.push(`${es ? "Metas" : "Goals"}: ${p.goals.join(", ")}`);
    if (p.workHours) b.push(`${es ? "Horario" : "Hours"}: ${p.workHours}`);
    if (p.nickname) b.push(`${es ? "Llámalo/a" : "Call them"}: ${p.nickname}`);
    if (p.city || p.tz) b.push(`${es ? "Ubicación" : "Location"}: ${[p.city, p.tz].filter(Boolean).join(", ")}`);
    if (p.dietary) b.push(`${es ? "Dieta" : "Dietary"}: ${p.dietary}`);
    if (p.birthday) b.push(`${es ? "Cumpleaños" : "Birthday"}: ${p.birthday}`);
    if (p.about) b.push(`${es ? "Sobre la persona" : "About them"}: ${p.about}`);
    return b.length ? `\n[${es ? "Contexto del usuario" : "User context"}: ${b.join("; ")}.]` : "";
  }
  function pickProfilePhoto(e) { const f = e.target.files && e.target.files[0]; if (!f) return; const rd = new FileReader(); rd.onload = () => setProfile((p) => ({ ...p, photo: rd.result })); rd.readAsDataURL(f); e.target.value = ""; }
  const addHobby = () => { const v = hobbyInput.trim(); if (!v) return; setProfile((p) => ({ ...p, hobbies: [...p.hobbies, v] })); setHobbyInput(""); };
  const addPerson = () => { const v = pName.trim(); if (!v) return; setProfile((p) => ({ ...p, people: [...p.people, { name: v, rel: pRel.trim() }] })); setPName(""); setPRel(""); };
  const toggleGoal = (g) => setProfile((p) => ({ ...p, goals: p.goals.includes(g) ? p.goals.filter((x) => x !== g) : [...p.goals, g] }));
  const obIn = { width: "100%", background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 12, outline: "none", color: C.text, fontSize: 15.5, padding: "12px 14px", fontFamily: SF, marginTop: 8 };
  const obLbl = { display: "block", fontSize: 13, color: C.dim, fontWeight: 500, marginTop: 18 };
  function finishOnboarding() {
    setShowOnboarding(false);
    if (typeof window !== "undefined") window.sessionStorage.removeItem("onucore_onboard");
    db.saveProfile(supabase, profile);
    setTab("today");
  }
  const exportData = () => { try { const blob = new Blob([JSON.stringify({ profile, items, txns }, null, 2)], { type: "application/json" }); const u = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = u; a.download = "atlas-data.json"; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(u); } catch {} };

  // derived
  const events = items.filter((i) => i.type === "event");
  const reminders = items.filter((i) => i.type === "reminder");
  const tasks = items.filter((i) => i.type === "task" || i.type === "followup");
  const obligations = items.filter((i) => i.type === "obligation").sort((a, b) => (a.dateISO || "9").localeCompare(b.dateISO || "9"));
  const notes = items.filter((i) => i.type === "note" || i.type === "idea" || i.type === "contact");
  const recent = [...items].slice(0, 3).concat([...txns].slice(0, 1));
  const alerts = (() => {
    const out = []; const es = lang === "es";
    const evByDay = {};
    items.filter((i) => i.type === "event" && i.dateISO).forEach((e) => { (evByDay[e.dateISO] = evByDay[e.dateISO] || []).push(e); });
    Object.entries(evByDay).forEach(([d, evs]) => { const du = daysUntil(d); if (evs.length >= 2 && du != null && du >= 0 && du <= 7) out.push({ kind: "conflict", color: C.red, text: es ? `${evs.length} citas el ${fmtDate(d, lang)} — revisa que no se empalmen` : `${evs.length} appointments on ${fmtDate(d, lang)} — check for overlaps` }); });
    items.filter((i) => i.type === "obligation").forEach((o) => { const du = daysUntil(o.dateISO); if (du != null && du >= 0 && du <= 3) out.push({ kind: "bill", color: C.gold, text: (es ? `${o.title} vence ${du <= 0 ? "hoy" : "en " + du + " día(s)"}` : `${o.title} due ${du <= 0 ? "today" : "in " + du + " day(s)"}`) + (o.amount ? ` · ${money(o.amount, loc)}` : "") }); });
    const m = new Date(); const inMonth = (iso) => { const dt = new Date(iso + "T00:00:00"); return dt.getFullYear() === m.getFullYear() && dt.getMonth() === m.getMonth(); };
    const mInc = txns.filter((x) => x.kind === "income" && inMonth(x.dateISO)).reduce((s, x) => s + x.amount, 0);
    const mExp = txns.filter((x) => x.kind === "expense" && inMonth(x.dateISO)).reduce((s, x) => s + x.amount, 0);
    if (mExp > mInc && mExp > 0) out.push({ kind: "spend", color: C.red, text: es ? `Este mes gastaste ${money(mExp - mInc, loc)} más de lo que ingresaste` : `This month you spent ${money(mExp - mInc, loc)} more than you earned` });
    return out;
  })();

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: SF, WebkitFontSmoothing: "antialiased" }}>
      <style>{`*{box-sizing:border-box;-webkit-tap-highlight-color:transparent;}.num{font-variant-numeric:tabular-nums;}
        @keyframes riseIn{from{opacity:0;transform:translateY(8px);}to{opacity:1;transform:none;}}@keyframes shimmer{0%{background-position:-200% 0;}100%{background-position:200% 0;}}
        @keyframes orbBreathe{0%,100%{transform:scale(1);}50%{transform:scale(1.07);}}
        @keyframes ringPulse{0%{transform:scale(.7);opacity:.5;}100%{transform:scale(2.7);opacity:0;}}@keyframes eq{0%{transform:scaleY(.16);}100%{transform:scaleY(1);}}@keyframes scan{0%{top:-12%;}100%{top:112%;}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(14px);}to{opacity:1;transform:none;}}@keyframes sheetUp{from{opacity:0;transform:translateY(40px);}to{opacity:1;transform:none;}}@keyframes spin{to{transform:rotate(360deg)}}@keyframes blink{0%,80%,100%{opacity:.3;}40%{opacity:1;}}
        .rise{animation:riseIn .4s cubic-bezier(.2,.7,.2,1) both;}.shimmer{background:linear-gradient(90deg,${C.surface2} 25%,#34343c 50%,${C.surface2} 75%);background-size:200% 100%;animation:shimmer 1.4s infinite;}
        .ph::placeholder{color:${C.mute};}::-webkit-scrollbar{width:0;height:0;}
        .grid-bg{background-image:linear-gradient(rgba(229,72,77,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(229,72,77,.05) 1px,transparent 1px);background-size:34px 34px;}`}</style>
      <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={pickPhoto} style={{ display: "none" }} />
      <input ref={receiptRef} type="file" accept="image/*" capture="environment" onChange={scanReceipt} style={{ display: "none" }} />
      <input ref={waFileRef} type="file" accept="image/*" capture="environment" onChange={waPhoto} style={{ display: "none" }} />
      <input ref={profileFileRef} type="file" accept="image/*" onChange={pickProfilePhoto} style={{ display: "none" }} />

      {desktop && (
        <aside style={{ position: "fixed", left: 0, top: 0, width: 220, height: "100vh", background: C.surface, borderRight: `1px solid ${C.borderSoft}`, padding: "22px 14px 18px", display: "flex", flexDirection: "column", gap: 5, zIndex: 25, boxSizing: "border-box" }}>
          <div style={{ padding: "0 10px 16px", fontSize: 21, fontWeight: 600, letterSpacing: "0.1em" }}>onucore<span style={{ color: C.red, fontSize: 10, verticalAlign: "super", marginLeft: 2, fontWeight: 700 }}>AI</span></div>
          <button onClick={() => setTab("capture")} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, padding: "11px 14px", borderRadius: 12, border: "none", background: C.red, color: "#ffffff", cursor: "pointer", fontFamily: SF, fontSize: 14.5, fontWeight: 600, marginBottom: 6 }}><PlusI /> {lang === "es" ? "Capturar" : "Capture"}</button>
          {[["today", t.nav_today, <HomeI />], ["agenda", t.nav_agenda, <CalI />], ["chat", t.nav_chat, <ChatI />], ["money", t.nav_money, <WalletI />], ["notes", t.nav_notes, <NoteI />]].map(([id, label, icon]) => { const on = tab === id; return (<button key={id} onClick={() => setTab(id)} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 12px", borderRadius: 11, border: "none", background: on ? "rgba(229,72,77,.13)" : "transparent", color: on ? C.red : C.dim, cursor: "pointer", fontFamily: SF, fontSize: 14.5, fontWeight: on ? 600 : 500, textAlign: "left", width: "100%" }}><span style={{ width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{icon}</span>{label}</button>); })}
        </aside>
      )}
      <div style={{ maxWidth: contentMax, marginLeft: desktop ? `max(220px, calc(220px + (100% - ${contentMax + 220}px) / 2))` : "auto", marginRight: "auto", minHeight: "100vh", position: "relative", paddingBottom: desktop ? 40 : 86 }}>
        <div style={{ position: "sticky", top: 0, zIndex: 20, backdropFilter: "blur(14px)", background: "rgba(26,26,31,.72)", padding: "16px 20px 12px", borderBottom: `1px solid ${C.borderSoft}`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>{desktop ? (<div style={{ fontSize: 20, fontWeight: 600, textTransform: "capitalize" }}>{t["nav_" + tab]}</div>) : (<><div style={{ fontSize: 22, fontWeight: 600, letterSpacing: "0.16em" }}>onucore<span style={{ color: C.gold, fontSize: 10, verticalAlign: "super", marginLeft: 3, fontWeight: 700 }}>AI</span></div><div style={{ fontSize: 9, letterSpacing: "0.26em", color: C.mute, marginTop: 2, textTransform: "uppercase" }}>{t["nav_" + tab]}</div></>)}</div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ position: "relative" }}>
              <button onClick={() => setLangOpen((v) => !v)} style={{ display: "flex", alignItems: "center", gap: 6, background: C.surface2, border: `1px solid ${C.border}`, color: C.text, borderRadius: 999, padding: "7px 12px", fontSize: 12.5, fontWeight: 500, cursor: "pointer", fontFamily: SF }}><GlobeIcon /> {L.short}</button>
              {langOpen && (<div className="rise" style={{ position: "absolute", right: 0, top: 42, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 14, padding: 6, minWidth: 150, zIndex: 30, boxShadow: "0 18px 40px rgba(0,0,0,.45)" }}>{LANGS.map((l) => (<button key={l.code} onClick={() => { setLang(l.code); setLangOpen(false); if (typeof window !== "undefined") window.localStorage.setItem("onucore_lang", l.code); }} style={{ display: "flex", width: "100%", justifyContent: "space-between", alignItems: "center", background: l.code === lang ? C.surface2 : "transparent", border: "none", color: l.code === lang ? C.gold : C.text, padding: "10px 12px", borderRadius: 9, fontSize: 14, cursor: "pointer", fontFamily: SF }}><span>{l.label}</span><span style={{ fontSize: 11, color: C.mute }}>{l.short}</span></button>))}</div>)}
            </div>
            <button onClick={() => setProfileOpen(true)} aria-label="Profile" style={{ width: 36, height: 36, borderRadius: 999, border: `1px solid ${C.border}`, padding: 0, overflow: "hidden", cursor: "pointer", flexShrink: 0, background: profile.photo ? "transparent" : C.gold, color: "#ffffff", fontWeight: 700, fontFamily: SF, display: "flex", alignItems: "center", justifyContent: "center" }}>{profile.photo ? <img src={profile.photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : (profile.name ? profile.name[0].toUpperCase() : "A")}</button>
          </div>
        </div>

        {(tab === "today" || tab === "notes") && (
          <div style={{ display: "flex", gap: 8, padding: "12px 20px 4px", overflowX: "auto" }}>
            <AreaPill label={t.area_all} color={C.gold} on={areaFilter === "all"} onClick={() => setAreaFilter("all")} />
            {Object.keys(AREAS).map((a) => <AreaPill key={a} label={areaName(a, lang)} color={AREAS[a].color} on={areaFilter === a} onClick={() => setAreaFilter(a)} />)}
          </div>
        )}

        <div style={{ padding: "8px 20px 0" }}>
          {tab === "today" && <Today {...{ t, lang, loc, briefing, briefingLoading, regenerate: () => generateBriefing(items), events: byArea(events), tasks: byArea(tasks), reminders: byArea(reminders), obligations: byArea(obligations), recentId, toggleDone, onEdit: openEdit, alerts, askQ, setAskQ, askA, askLoading, onAsk: askAtlas, clearAsk: () => { setAskA(""); setAskQ(""); } }} />}
          {tab === "agenda" && <Agenda {...{ t, lang, items, calY, calM, calSel, calSrc, setCalSel, setCalSrc, setCalY, setCalM, newEvent, onEdit: openEdit, gcal, gcalEvents, connectGoogle, desktop }} />}
          {tab === "money" && <Money {...{ t, lang, loc, txns, obligations, period, setPeriod, fseg, setFseg, recentId, onEditTxn: openTxn, onEditItem: openEdit, onAdd: newTxn, onReport: () => setReportOpen(true), setAsidePct: profile.setAsidePct }} />}
          {tab === "notes" && <Notes {...{ t, lang, notes: byArea(notes), recentId, onEdit: openEdit }} />}
          {tab === "capture" && <Capture {...{ t, lang, input, setInput, processCapture, processing, openVoice, openPhoto: () => fileRef.current && fileRef.current.click(), openWhatsapp: () => setWaOpen(true), recent }} />}
        </div>
      </div>

      {!desktop && (
      <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, zIndex: 30, display: "flex", justifyContent: "center" }}>
        <div style={{ width: "100%", maxWidth: navMax, display: "flex", alignItems: "center", justifyContent: "space-around", padding: "8px 10px calc(8px + env(safe-area-inset-bottom))", background: "rgba(26,26,31,.92)", backdropFilter: "blur(16px)", borderTop: `1px solid ${C.borderSoft}` }}>
          <Tab id="today" cur={tab} set={setTab} label={t.nav_today} icon={<HomeI />} />
          <Tab id="agenda" cur={tab} set={setTab} label={t.nav_agenda} icon={<CalI />} />
          <button onClick={() => setTab("capture")} style={{ width: 54, height: 54, marginTop: -18, borderRadius: 999, border: `3px solid ${C.bg}`, background: C.gold, color: "#ffffff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><PlusI /></button>
          <Tab id="chat" cur={tab} set={setTab} label={t.nav_chat} icon={<ChatI />} />
          <Tab id="money" cur={tab} set={setTab} label={t.nav_money} icon={<WalletI />} />
          <Tab id="notes" cur={tab} set={setTab} label={t.nav_notes} icon={<NoteI />} />
        </div>
      </div>
      )}

      {tab === "chat" && (
        <div style={{ position: "fixed", inset: 0, zIndex: 18, display: "flex", justifyContent: "center", background: C.bg }}>
          <div style={{ width: "100%", maxWidth: contentMax, height: "100%", display: "flex", flexDirection: "column", paddingTop: 66 }}>
            <div style={{ flex: 1, overflowY: "auto", padding: "10px 16px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
              {chatMsgs.length === 0 && !chatLoading && (
                <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", gap: 16, padding: "0 8px" }}>
                  <div style={{ width: 62, height: 62, borderRadius: 999, background: C.red, display: "flex", alignItems: "center", justifyContent: "center", color: "#ffffff" }}><ChatI big /></div>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 600 }}>{lang === "es" ? "Hola, soy onucore" : "Hi, I'm onucore"}</div>
                    <div style={{ fontSize: 13.5, color: C.dim, marginTop: 7, lineHeight: 1.5, maxWidth: 290 }}>{lang === "es" ? "Tu asistente personal. Pregúntame lo que sea sobre tu agenda, tu dinero o tus pendientes." : "Your personal assistant. Ask me anything about your schedule, money, or to-dos."}</div>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center", marginTop: 2 }}>
                    {(lang === "es" ? ["¿Qué tengo hoy?", "¿Cuánto gasté este mes?", "¿Qué pagos vienen?"] : ["What's on today?", "How much did I spend this month?", "Any upcoming payments?"]).map((s) => (
                      <button key={s} onClick={() => sendChat(s)} style={{ background: C.surface, border: `1px solid ${C.border}`, color: C.text, borderRadius: 999, padding: "9px 14px", fontSize: 13, cursor: "pointer", fontFamily: SF }}>{s}</button>
                    ))}
                  </div>
                </div>
              )}
              {chatMsgs.map((m, i) => (
                <div key={i} style={{ alignSelf: m.role === "user" ? "flex-end" : "flex-start", maxWidth: "86%" }}>
                  <div style={{ background: m.role === "user" ? C.red : C.surface, color: m.role === "user" ? "#ffffff" : C.text, border: m.role === "assistant" ? `1px solid ${C.border}` : "none", padding: "10px 13px", borderRadius: 16, borderBottomRightRadius: m.role === "user" ? 5 : 16, borderBottomLeftRadius: m.role === "assistant" ? 5 : 16, fontSize: 14.5, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{m.content}{m.cards && m.cards.length > 0 && (<div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 10 }}>{m.cards.map((c, ci) => { const dd = WDEST[c.dest] || WDEST.Notas; return (<div key={ci} style={{ display: "flex", alignItems: "center", gap: 9, background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 10, padding: "8px 10px" }}><span style={{ fontSize: 15 }}>{dd.icon}</span><div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 13, color: C.text }}>{c.title}</div><div style={{ fontSize: 11, color: C.dim, marginTop: 1 }}>{c.dest}{c.amount != null ? ` · $${c.amount}` : ""}{c.ded ? " · deducible" : ""}</div></div></div>); })}</div>)}</div>
                </div>
              ))}
              {chatLoading && (
                <div style={{ alignSelf: "flex-start", background: C.surface, border: `1px solid ${C.border}`, borderRadius: 16, borderBottomLeftRadius: 5, padding: "13px 15px", display: "flex", gap: 4 }}>{[0, 1, 2].map((i) => <span key={i} style={{ width: 7, height: 7, borderRadius: 999, background: C.mute, animation: `blink 1.3s ${i * 0.2}s infinite` }} />)}</div>
              )}
              <div ref={chatEndRef} />
            </div>
            <div style={{ flexShrink: 0, padding: "8px 14px calc(80px + env(safe-area-inset-bottom))" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, background: C.surface, border: `1px solid ${C.border}`, borderRadius: 24, padding: "5px 5px 5px 16px" }}>
                <input className="ph" value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendChat(chatInput)} placeholder={lang === "es" ? "Escríbele a onucore…" : "Message onucore…"} style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: C.text, fontSize: 15, fontFamily: SF, minWidth: 0 }} />
                <button onClick={() => sendChat(chatInput)} disabled={!chatInput.trim() || chatLoading} aria-label="Send" style={{ width: 42, height: 42, borderRadius: 999, border: "none", background: C.red, color: "#ffffff", fontSize: 17, cursor: chatInput.trim() && !chatLoading ? "pointer" : "default", opacity: chatInput.trim() && !chatLoading ? 1 : 0.45, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>➤</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {toast && (<div className="rise" onClick={() => setToast(null)} style={{ position: "fixed", left: "50%", transform: "translateX(-50%)", bottom: 86, maxWidth: 400, width: "calc(100% - 40px)", zIndex: 40, background: C.surface, border: `1px solid ${toast.kind === "ok" ? C.goldSoft : C.red}`, borderRadius: 14, padding: "12px 16px", fontSize: 12.5, color: toast.kind === "ok" ? C.gold : C.red, boxShadow: "0 14px 40px rgba(0,0,0,.45)" }}>{toast.text}</div>)}

      {voiceMode && (
        <div style={{ position: "fixed", inset: 0, zIndex: 100, display: "flex", flexDirection: "column", alignItems: "center", background: "rgba(26,26,31,.96)", backdropFilter: "blur(8px)", animation: "fadeUp .35s ease both" }}>
          <div className="grid-bg" style={{ position: "absolute", inset: 0, opacity: 0.5, maskImage: "radial-gradient(circle at 50% 40%, black, transparent 75%)", WebkitMaskImage: "radial-gradient(circle at 50% 40%, black, transparent 75%)" }} />
          <div style={{ position: "absolute", left: "12%", right: "12%", height: 2, background: C.gold, opacity: 0.5, animation: "scan 3.4s linear infinite" }} />
          <button onClick={cancelVoice} style={{ position: "absolute", top: 22, right: 22, width: 40, height: 40, borderRadius: 999, background: C.surface2, border: `1px solid ${C.border}`, color: C.dim, cursor: "pointer", fontSize: 18, fontFamily: SF }}>✕</button>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", width: "100%", zIndex: 2 }}>
            <div style={{ position: "relative", width: 240, height: 240, display: "flex", alignItems: "center", justifyContent: "center" }} onClick={listening ? stopListen : restartListen}>
              {[0, 1, 2].map((i) => (<div key={i} style={{ position: "absolute", width: 130, height: 130, borderRadius: 999, border: `1px solid ${C.gold}`, animation: `ringPulse 2.6s ease-out ${i * 0.85}s infinite`, opacity: listening ? 1 : 0.3 }} />))}
              <div style={{ width: 124, height: 124, borderRadius: 999, background: C.gold, display: "flex", alignItems: "center", justifyContent: "center", color: "#ffffff", cursor: "pointer", animation: listening ? "orbBreathe 2.4s ease-in-out infinite" : "none" }}><MicIcon huge /></div>
            </div>
            <Equalizer active={listening} />
            <div style={{ marginTop: 26, fontSize: 13, letterSpacing: "0.18em", textTransform: "uppercase", color: listening ? C.gold : C.mute }}>{voiceAvailable ? (listening ? t.voice_listening : t.voice_idle) : t.voice_unavail}</div>
            <div style={{ marginTop: 22, width: "82%", maxWidth: 360 }}><input className="ph" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && confirmVoice()} placeholder={t.v_edit} autoFocus style={{ width: "100%", textAlign: "center", background: "transparent", border: "none", borderBottom: `1px solid ${C.border}`, outline: "none", color: C.text, fontSize: 19, fontWeight: 300, padding: "10px 4px", fontFamily: SF }} /></div>
          </div>
          <div style={{ display: "flex", gap: 14, padding: "0 24px 42px", width: "100%", maxWidth: 440, zIndex: 2 }}>
            <button onClick={cancelVoice} style={{ flex: 1, height: 52, borderRadius: 16, background: C.surface2, border: `1px solid ${C.border}`, color: C.dim, fontSize: 15, cursor: "pointer", fontFamily: SF }}>{t.voice_cancel}</button>
            <button onClick={confirmVoice} disabled={!input.trim()} style={{ flex: 2, height: 52, borderRadius: 16, border: "none", background: input.trim() ? C.gold : "#34343c", color: input.trim() ? C.bg : C.mute, fontSize: 15, fontWeight: 600, cursor: input.trim() ? "pointer" : "default", fontFamily: SF }}>{t.voice_confirm}</button>
          </div>
        </div>
      )}

      {profileOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 106, background: C.bg, overflowY: "auto" }}>
          <div style={{ maxWidth: 440, margin: "0 auto", minHeight: "100vh", paddingBottom: 40 }}>
            <div style={{ position: "sticky", top: 0, zIndex: 2, background: "rgba(26,26,31,.9)", backdropFilter: "blur(14px)", display: "flex", alignItems: "center", gap: 10, padding: "16px 18px", borderBottom: `1px solid ${C.borderSoft}` }}>
              <button onClick={() => setProfileOpen(false)} style={{ background: "transparent", border: "none", color: C.text, fontSize: 24, cursor: "pointer", lineHeight: 1, fontFamily: SF }}>‹</button>
              <div style={{ fontSize: 17, fontWeight: 600 }}>{t.prof_title}</div>
            </div>
            <div style={{ padding: "20px 20px 0" }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
                <button onClick={() => profileFileRef.current && profileFileRef.current.click()} style={{ width: 92, height: 92, borderRadius: 999, border: `1px solid ${C.border}`, padding: 0, overflow: "hidden", cursor: "pointer", position: "relative", background: profile.photo ? "transparent" : C.gold, color: "#ffffff", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: SF }}>
                  {profile.photo ? <img src={profile.photo} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <span style={{ fontSize: 34, fontWeight: 700 }}>{profile.name ? profile.name[0].toUpperCase() : "A"}</span>}
                  <span style={{ position: "absolute", bottom: -2, right: -2, width: 30, height: 30, borderRadius: 999, background: C.gold, border: `2px solid ${C.bg}`, display: "flex", alignItems: "center", justifyContent: "center", color: "#ffffff" }}><CamIcon /></span>
                </button>
                {profile.name ? <div style={{ fontSize: 18, fontWeight: 600 }}>{profile.name}{profile.role ? <span style={{ color: C.mute, fontWeight: 400 }}> · {profile.role}</span> : null}</div> : null}
              </div>

              <SectionLabel>{t.sec_profile}</SectionLabel>
              {(() => { const fields = [profile.name, profile.role, profile.photo, profile.nickname, profile.birthday, profile.whatsapp, profile.city, profile.dietary, profile.about, profile.hobbies.length, profile.people.length, profile.goals.length]; const filled = fields.filter(Boolean).length; const pct = Math.round((filled / fields.length) * 100); return (<div style={{ margin: "0 2px 8px" }}><div style={{ fontSize: 11, color: C.mute, marginBottom: 5 }}>{pct}% {t.prof_complete}</div><div style={{ height: 5, borderRadius: 4, background: C.surface2, overflow: "hidden" }}><div style={{ width: pct + "%", height: "100%", background: C.gold, transition: "width .3s" }} /></div></div>); })()}
              <div style={cardS}>
                <PField label={t.f_name}><input className="ph" value={profile.name} onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))} placeholder="—" style={pin} /></PField>
                <PField label={t.f_role}><input className="ph" value={profile.role} onChange={(e) => setProfile((p) => ({ ...p, role: e.target.value }))} placeholder="—" style={pin} /></PField>
                <PField label={t.f_tone}><div style={{ display: "flex", gap: 8 }}>{[["casual", t.tone_casual], ["formal", t.tone_formal]].map(([k, lbl]) => <Chip key={k} label={lbl} color={C.gold} on={profile.tone === k} onClick={() => setProfile((p) => ({ ...p, tone: k }))} />)}</div></PField>
                {profMore && (<>
                  <PField label={`✨ ${t.f_about}`}><textarea className="ph" value={profile.about} onChange={(e) => setProfile((p) => ({ ...p, about: e.target.value }))} placeholder={t.about_ph} rows={3} style={{ ...pin, resize: "vertical", lineHeight: 1.4 }} /></PField>
                  <PField label={t.f_nickname}><input className="ph" value={profile.nickname} onChange={(e) => setProfile((p) => ({ ...p, nickname: e.target.value }))} placeholder="—" style={pin} /></PField>
                  <div style={{ display: "flex", gap: 8 }}>
                    <PField label={t.f_birthday}><input type="date" value={profile.birthday} onChange={(e) => setProfile((p) => ({ ...p, birthday: e.target.value }))} style={{ ...pin, colorScheme: "dark" }} /></PField>
                    <PField label={t.f_whatsapp}><input className="ph" type="tel" value={profile.whatsapp} onChange={(e) => setProfile((p) => ({ ...p, whatsapp: e.target.value }))} placeholder="+1 …" style={pin} /></PField>
                  </div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <PField label={t.f_city}><input className="ph" value={profile.city} onChange={(e) => setProfile((p) => ({ ...p, city: e.target.value }))} placeholder="—" style={pin} /></PField>
                    <PField label={t.f_tz}><select value={profile.tz} onChange={(e) => setProfile((p) => ({ ...p, tz: e.target.value }))} style={{ ...pin, colorScheme: "dark" }}><option value="">—</option>{["America/Los_Angeles", "America/Denver", "America/Chicago", "America/New_York", "America/Mexico_City", "America/Bogota", "Europe/Madrid", "UTC"].map((z) => <option key={z} value={z}>{z}</option>)}</select></PField>
                  </div>
                  <PField label={t.f_dietary}><input className="ph" value={profile.dietary} onChange={(e) => setProfile((p) => ({ ...p, dietary: e.target.value }))} placeholder="—" style={pin} /></PField>
                  <div style={{ fontSize: 11, color: C.mute, marginTop: 2, lineHeight: 1.45 }}>ⓘ {t.priv_hint}</div>
                </>)}
                <button onClick={() => setProfMore((v) => !v)} style={{ background: "transparent", border: "none", color: C.gold, fontSize: 13, cursor: "pointer", fontFamily: SF, padding: "8px 0 2px" }}>{profMore ? t.less_details : `＋ ${t.more_details}`}</button>
              </div>

              <SectionLabel>{t.sec_about}</SectionLabel>
              <div style={cardS}>
                <PField label={t.f_hobbies}>
                  <div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginBottom: profile.hobbies.length ? 8 : 0 }}>{profile.hobbies.map((h, i) => <button key={i} onClick={() => setProfile((p) => ({ ...p, hobbies: p.hobbies.filter((_, j) => j !== i) }))} style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(229,72,77,.10)", border: `1px solid ${C.goldSoft}`, color: C.text, borderRadius: 999, padding: "6px 11px", fontSize: 12.5, cursor: "pointer", fontFamily: SF }}>{h} ✕</button>)}</div>
                  <input className="ph" value={hobbyInput} onChange={(e) => setHobbyInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addHobby()} placeholder={t.add_ph} style={pin} />
                </PField>
                <PField label={t.f_people}>
                  {profile.people.map((pe, i) => (<div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 0", borderBottom: `1px solid ${C.borderSoft}` }}><span style={{ fontSize: 14 }}>{pe.name}{pe.rel ? <span style={{ color: C.mute }}> · {pe.rel}</span> : null}</span><button onClick={() => setProfile((p) => ({ ...p, people: p.people.filter((_, j) => j !== i) }))} style={{ background: "transparent", border: "none", color: C.mute, fontSize: 15, cursor: "pointer" }}>✕</button></div>))}
                  <div style={{ display: "flex", gap: 7, marginTop: profile.people.length ? 8 : 0 }}><input className="ph" value={pName} onChange={(e) => setPName(e.target.value)} placeholder={t.person_name} style={{ ...pin, flex: 1 }} /><input className="ph" value={pRel} onChange={(e) => setPRel(e.target.value)} onKeyDown={(e) => e.key === "Enter" && addPerson()} placeholder={t.person_rel} style={{ ...pin, flex: 1 }} /><button onClick={addPerson} style={{ width: 44, borderRadius: 10, border: "none", background: C.gold, color: "#ffffff", fontSize: 20, cursor: "pointer", flexShrink: 0 }}>＋</button></div>
                </PField>
                <PField label={t.f_goals}>
                  <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>{GOALS.map((g) => { const lbl = g[lang === "es" ? "es" : "en"]; return <Chip key={lbl} label={lbl} color={C.green} on={profile.goals.includes(lbl)} onClick={() => toggleGoal(lbl)} />; })}</div>
                </PField>
                <div style={{ display: "flex", gap: 8 }}>
                  <PField label={t.f_wake}><input className="ph" value={profile.wake} onChange={(e) => setProfile((p) => ({ ...p, wake: e.target.value }))} style={pin} /></PField>
                  <PField label={t.f_work}><input className="ph" value={profile.workHours} onChange={(e) => setProfile((p) => ({ ...p, workHours: e.target.value }))} style={pin} /></PField>
                </div>
              </div>

              <SectionLabel>{t.sec_conn}</SectionLabel>
              <div style={{ fontSize: 12.5, color: C.mute, margin: "0 2px 8px", lineHeight: 1.45 }}>{t.conn_sub}</div>
              <div style={cardS}>
                {CONNS.map((cn, i) => {
                  const on = cn.k === "google" ? gcal.connected : cn.k === "whatsapp" ? true : false;
                  const builtin = cn.k === "whatsapp";
                  const soon = !!cn.soon;
                  const toggle = () => { if (builtin || soon) return; if (cn.k === "google") { if (gcal.connected) disconnectGoogle(); else connectGoogle(); } };
                  return (<div key={cn.k} style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 0", borderBottom: i < CONNS.length - 1 ? `1px solid ${C.borderSoft}` : "none" }}>
                    <span style={{ width: 36, height: 36, borderRadius: 9, background: C.surface2, border: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center", color: on ? C.gold : C.mute, flexShrink: 0 }}><LinkIcon /></span>
                    <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 14.5 }}>{cn.name}</div><div style={{ fontSize: 11.5, color: C.mute, marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{cn.k === "google" && gcal.connected && gcal.email ? gcal.email : cn[lang === "es" ? "es" : "en"]}</div></div>
                    <button onClick={toggle} disabled={builtin || soon} style={{ flexShrink: 0, borderRadius: 999, padding: "7px 14px", fontSize: 12.5, fontWeight: 600, cursor: (builtin || soon) ? "default" : "pointer", fontFamily: SF, border: `1px solid ${on ? C.goldSoft : C.border}`, background: on ? "rgba(229,72,77,.12)" : "transparent", color: on ? C.gold : (soon ? C.mute : C.dim) }}>{builtin ? t.built_in : soon ? (lang === "es" ? "Pronto" : "Soon") : on ? t.connected : t.connect}</button>
                  </div>);
                })}
              </div>

              <SectionLabel>{t.sec_settings}</SectionLabel>
              <div style={cardS}>
                <PField label={t.set_lang}><div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>{LANGS.map((l) => <Chip key={l.code} label={l.label} color={C.gold} on={l.code === lang} onClick={() => setLang(l.code)} />)}</div></PField>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0" }}><span style={{ fontSize: 14.5 }}>{t.set_notif}</span><button onClick={() => setProfile((p) => ({ ...p, notif: !p.notif }))} style={{ width: 46, height: 27, borderRadius: 999, border: `1px solid ${profile.notif ? C.gold : C.border}`, background: profile.notif ? C.gold : C.surface2, position: "relative", cursor: "pointer" }}><span style={{ position: "absolute", top: 2, left: profile.notif ? 21 : 2, width: 21, height: 21, borderRadius: 999, background: profile.notif ? C.bg : C.mute, transition: "left .2s" }} /></button></div>
                <PField label={t.set_brieflen}><div style={{ display: "flex", gap: 8 }}>{[["short", t.bl_short], ["detailed", t.bl_detailed]].map(([k, lbl]) => <Chip key={k} label={lbl} color={C.gold} on={profile.briefLen === k} onClick={() => setProfile((p) => ({ ...p, briefLen: k }))} />)}</div></PField>
                <PField label={t.set_remstyle}><div style={{ display: "flex", gap: 8 }}>{[["gentle", t.rs_gentle], ["firm", t.rs_firm]].map(([k, lbl]) => <Chip key={k} label={lbl} color={C.gold} on={profile.reminderStyle === k} onClick={() => setProfile((p) => ({ ...p, reminderStyle: k }))} />)}</div></PField>
                <PField label={t.set_channel}><div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{[["push", "Push"], ["whatsapp", "WhatsApp"], ["email", "Email"]].map(([k, lbl]) => <Chip key={k} label={lbl} color={C.gold} on={profile.notifyChannel === k} onClick={() => setProfile((p) => ({ ...p, notifyChannel: k }))} />)}</div></PField>
                <PField label={t.set_acct}><div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>{ACCOUNTS.map((a) => <Chip key={a.k} label={a.label} color={C.gold} on={profile.defaultAccount === a.k} onClick={() => setProfile((p) => ({ ...p, defaultAccount: a.k }))} />)}</div></PField>
                <PField label={`${t.set_taxpct}: ${profile.setAsidePct}%`}><input type="range" min="10" max="45" value={profile.setAsidePct} onChange={(e) => setProfile((p) => ({ ...p, setAsidePct: +e.target.value }))} style={{ width: "100%", accentColor: C.gold }} /></PField>
                <button onClick={exportData} style={{ width: "100%", textAlign: "left", background: "transparent", border: "none", color: C.text, fontSize: 14.5, padding: "12px 0", cursor: "pointer", fontFamily: SF, borderTop: `1px solid ${C.borderSoft}` }}>↓ {t.set_export}</button>
                <button onClick={() => setProfileOpen(false)} style={{ width: "100%", textAlign: "left", background: "transparent", border: "none", color: C.dim, fontSize: 14.5, padding: "12px 0", cursor: "pointer", fontFamily: SF, borderTop: `1px solid ${C.borderSoft}` }}>{t.set_signout}</button>
              </div>

              <button onClick={() => { setProfileOpen(false); generateBriefing(items); }} style={{ ...btnGold, width: "100%", marginTop: 18 }}>{t.save}</button>
            </div>
          </div>
        </div>
      )}

      {showOnboarding && (
        <div style={{ position: "fixed", inset: 0, zIndex: 130, background: C.bg, display: "flex", justifyContent: "center", overflowY: "auto" }}>
          <div style={{ width: "100%", maxWidth: Math.min(contentMax, 560), padding: "calc(env(safe-area-inset-top) + 30px) 22px 36px", display: "flex", flexDirection: "column" }}>
            <div style={{ fontSize: 24, fontWeight: 600, letterSpacing: "0.08em" }}>onucore<span style={{ color: C.red, fontSize: 11, verticalAlign: "super", marginLeft: 2, fontWeight: 700 }}>AI</span></div>
            <div style={{ fontSize: 21, fontWeight: 600, marginTop: 20, lineHeight: 1.3 }}>{lang === "es" ? "Personalicemos onucore" : "Let's set up onucore"}</div>
            <div style={{ fontSize: 13.5, color: C.dim, marginTop: 8, lineHeight: 1.5 }}>{lang === "es" ? "Cuéntame un poco de ti para que sea TU asistente, no uno genérico. Puedes cambiar todo después en tu perfil." : "Tell me a bit about you so it's YOUR assistant, not a generic one. You can change all of this later in your profile."}</div>

            <label style={obLbl}>{lang === "es" ? "¿Cómo te llamas?" : "What's your name?"}</label>
            <input className="ph" style={obIn} value={profile.name} onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))} placeholder={lang === "es" ? "Tu nombre" : "Your name"} />

            <label style={obLbl}>{lang === "es" ? "¿Cómo prefieres que te diga?" : "What should I call you?"} <span style={{ fontSize: 11, color: C.mute, fontWeight: 400 }}>· {lang === "es" ? "opcional" : "optional"}</span></label>
            <input className="ph" style={obIn} value={profile.nickname} onChange={(e) => setProfile((p) => ({ ...p, nickname: e.target.value }))} placeholder={lang === "es" ? "Apodo" : "Nickname"} />

            <label style={obLbl}>{lang === "es" ? "¿A qué te dedicas?" : "What do you do for work?"}</label>
            <input className="ph" style={obIn} value={profile.role} onChange={(e) => setProfile((p) => ({ ...p, role: e.target.value }))} placeholder={lang === "es" ? "Ej: diseñador freelance, consultora…" : "e.g. freelance designer, consultant…"} />

            <label style={obLbl}>{lang === "es" ? "¿Cómo quieres que te hable?" : "How should I talk to you?"}</label>
            <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
              {[["casual", lang === "es" ? "Cercano (tú)" : "Casual"], ["formal", lang === "es" ? "Formal (usted)" : "Formal"]].map(([k, lbl]) => (
                <button key={k} type="button" onClick={() => setProfile((p) => ({ ...p, tone: k }))} style={{ flex: 1, padding: "12px 0", borderRadius: 12, cursor: "pointer", fontFamily: SF, fontSize: 14, fontWeight: profile.tone === k ? 600 : 400, background: profile.tone === k ? C.red : "transparent", color: profile.tone === k ? "#ffffff" : C.dim, border: `1px solid ${profile.tone === k ? C.red : C.border}` }}>{lbl}</button>
              ))}
            </div>

            <label style={obLbl}>{lang === "es" ? "¿Tu meta principal ahora?" : "Your main goal right now?"} <span style={{ fontSize: 11, color: C.mute, fontWeight: 400 }}>· {lang === "es" ? "opcional" : "optional"}</span></label>
            <input className="ph" style={obIn} value={(profile.goals && profile.goals[0]) || ""} onChange={(e) => setProfile((p) => ({ ...p, goals: e.target.value ? [e.target.value] : [] }))} placeholder={lang === "es" ? "Ej: conseguir 3 clientes nuevos" : "e.g. land 3 new clients"} />

            <label style={obLbl}>{lang === "es" ? "¿En qué ciudad estás?" : "What city are you in?"} <span style={{ fontSize: 11, color: C.mute, fontWeight: 400 }}>· {lang === "es" ? "opcional" : "optional"}</span></label>
            <input className="ph" style={obIn} value={profile.city} onChange={(e) => setProfile((p) => ({ ...p, city: e.target.value }))} placeholder={lang === "es" ? "Ej: Ciudad de México" : "e.g. Mexico City"} />

            <button type="button" onClick={finishOnboarding} disabled={!profile.name.trim()} style={{ width: "100%", height: 50, marginTop: 26, borderRadius: 12, border: "none", background: C.red, color: "#ffffff", fontSize: 15.5, fontWeight: 600, cursor: profile.name.trim() ? "pointer" : "default", opacity: profile.name.trim() ? 1 : 0.45, fontFamily: SF }}>{lang === "es" ? "Empezar a usar onucore" : "Start using onucore"}</button>
            <button type="button" onClick={finishOnboarding} style={{ background: "none", border: "none", color: C.mute, fontSize: 13, cursor: "pointer", fontFamily: SF, marginTop: 14, alignSelf: "center" }}>{lang === "es" ? "Saltar por ahora" : "Skip for now"}</button>
          </div>
        </div>
      )}

      {waOpen && (
        <div style={{ position: "fixed", inset: 0, zIndex: 105, display: "flex", justifyContent: "center", background: "#0a0a0a" }}>
          <div style={{ width: "100%", maxWidth: 440, display: "flex", flexDirection: "column", background: WACL.bg }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "14px 14px", background: WACL.header, flexShrink: 0 }}>
              <button onClick={() => setWaOpen(false)} style={{ background: "transparent", border: "none", color: WACL.txt, fontSize: 24, cursor: "pointer", fontFamily: SF, lineHeight: 1 }}>‹</button>
              <div style={{ width: 38, height: 38, borderRadius: 999, background: C.gold, display: "flex", alignItems: "center", justifyContent: "center", color: "#ffffff", fontWeight: 700 }}>A</div>
              <div style={{ flex: 1 }}><div style={{ color: WACL.txt, fontSize: 15.5, fontWeight: 600 }}>onucore AI</div><div style={{ color: WACL.grn, fontSize: 12 }}>{waTyping ? (lang === "es" ? "escribiendo…" : "typing…") : (lang === "es" ? "en línea" : "online")}</div></div>
            </div>
            <div style={{ flex: 1, overflowY: "auto", padding: "16px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
              {waMsgs.map((m) => (
                <div key={m.id} style={{ alignSelf: m.from === "me" ? "flex-end" : "flex-start", maxWidth: "82%" }}>
                  <div style={{ background: m.from === "me" ? WACL.outB : WACL.inB, color: WACL.txt, padding: m.kind === "photo" ? 4 : "8px 11px", borderRadius: 12, borderTopRightRadius: m.from === "me" ? 3 : 12, borderTopLeftRadius: m.from === "bot" ? 3 : 12, fontSize: 14.5, lineHeight: 1.45 }}>
                    {m.kind === "voice" ? (<div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 180, padding: "4px 2px" }}><div style={{ width: 30, height: 30, borderRadius: 999, background: WACL.grn, display: "flex", alignItems: "center", justifyContent: "center", color: WACL.bg, fontSize: 12 }}>▶</div><div style={{ flex: 1, display: "flex", alignItems: "center", gap: 2, height: 22 }}>{Array.from({ length: 20 }).map((_, i) => <span key={i} style={{ flex: 1, height: `${30 + Math.abs(Math.sin(i)) * 60}%`, background: WACL.dim, borderRadius: 2 }} />)}</div><span style={{ fontSize: 11, color: WACL.dim }}>{m.dur}</span></div>)
                      : m.kind === "photo" ? (<img src={m.src} alt="" style={{ width: 200, maxWidth: "100%", borderRadius: 9, display: "block" }} />)
                      : (<span>{m.text}</span>)}
                    {m.cards && m.cards.length > 0 && (<div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 9 }}>{m.cards.map((c, i) => { const dd = WDEST[c.dest] || WDEST.Notas; return (<div key={i} style={{ display: "flex", alignItems: "center", gap: 9, background: "rgba(0,0,0,.22)", border: `1px solid ${dd.color}44`, borderRadius: 9, padding: "7px 10px" }}><span style={{ fontSize: 14 }}>{dd.icon}</span><div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 13 }}>{c.title}</div><div style={{ fontSize: 11, color: dd.color, marginTop: 1 }}>{c.dest}{c.amount != null ? ` · $${c.amount}` : ""}{c.ded ? " · deducible" : ""}</div></div></div>); })}</div>)}
                  </div>
                </div>
              ))}
              {waTyping && (<div style={{ alignSelf: "flex-start", background: WACL.inB, borderRadius: 12, borderTopLeftRadius: 3, padding: "12px 14px", display: "flex", gap: 4 }}>{[0, 1, 2].map((i) => <span key={i} style={{ width: 7, height: 7, borderRadius: 999, background: WACL.dim, animation: `blink 1.3s ${i * 0.2}s infinite` }} />)}</div>)}
              <div ref={waEndRef} />
            </div>
            {waShowEx && (<div style={{ display: "flex", gap: 7, padding: "0 12px 8px", flexWrap: "wrap" }}>{WAEX.map((ex, i) => <button key={i} onClick={() => waSend(ex.label, ex.kind, ex.text)} style={{ background: "transparent", border: `1px solid ${WACL.grn}66`, color: WACL.grn, borderRadius: 999, padding: "7px 12px", fontSize: 12.5, cursor: "pointer", fontFamily: SF }}>{ex.label}</button>)}</div>)}
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 12px 14px", flexShrink: 0 }}>
              <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8, background: WACL.header, borderRadius: 24, padding: "6px 8px 6px 16px" }}>
                <input className="ph" value={waInput} onChange={(e) => setWaInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && waSend(waInput, "text")} placeholder={lang === "es" ? "Mensaje" : "Message"} style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: WACL.txt, fontSize: 15, fontFamily: SF, minWidth: 0 }} />
                <button onClick={() => waFileRef.current && waFileRef.current.click()} style={{ background: "transparent", border: "none", color: WACL.dim, fontSize: 19, cursor: "pointer" }}>📎</button>
              </div>
              <button onClick={() => waSend(waInput, "text")} style={{ width: 46, height: 46, borderRadius: 999, border: "none", background: WACL.grn, color: WACL.bg, fontSize: 19, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{waInput.trim() ? "➤" : "🎤"}</button>
            </div>
          </div>
        </div>
      )}

      {remOpen && (
        <Sheet onClose={() => !remBusy && setRemOpen(false)}>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 14 }}>{t.rem_new}</div>
          {photo ? (<div style={{ position: "relative" }}><img src={photo} alt="" style={{ width: "100%", height: 200, objectFit: "cover", borderRadius: 14, border: `1px solid ${C.border}` }} /><button onClick={() => fileRef.current && fileRef.current.click()} style={{ position: "absolute", bottom: 10, right: 10, background: "rgba(0,0,0,.6)", border: `1px solid ${C.border}`, color: C.text, borderRadius: 999, padding: "6px 12px", fontSize: 12, cursor: "pointer", fontFamily: SF }}>{t.rem_retake}</button></div>)
            : (<button onClick={() => fileRef.current && fileRef.current.click()} style={{ width: "100%", height: 130, borderRadius: 14, border: `1.5px dashed ${C.border}`, background: C.surface2, color: C.dim, cursor: "pointer", fontFamily: SF, fontSize: 14, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8 }}><CamIcon big /> {t.rem_choose}</button>)}
          <input className="ph" value={note} onChange={(e) => setNote(e.target.value)} placeholder={t.rem_note} onKeyDown={(e) => e.key === "Enter" && saveReminder()} style={inputS} />
          <div style={{ display: "flex", gap: 12, marginTop: 18 }}><button onClick={() => setRemOpen(false)} disabled={remBusy} style={btnGhost}>{t.voice_cancel}</button><button onClick={saveReminder} disabled={remBusy || (!photo && !note.trim())} style={{ ...btnGold, flex: 2, opacity: remBusy || (!photo && !note.trim()) ? 0.5 : 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 8 }}>{remBusy ? <><Spinner /> {t.rem_reading}</> : t.rem_save}</button></div>
        </Sheet>
      )}

      {itemDraft && (
        <Sheet onClose={() => setItemDraft(null)}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}><div style={{ fontSize: 16, fontWeight: 600 }}>{itemDraft._new ? t.ev_new : t.edit_title}</div><span style={{ fontSize: 10.5, letterSpacing: "0.1em", textTransform: "uppercase", color: C.mute }}>{t["type_" + itemDraft.type] || ""}</span></div>
          <input className="ph" value={itemDraft.title} onChange={(e) => setItemDraft({ ...itemDraft, title: e.target.value })} placeholder={t.ev_new} style={{ ...inputS, marginTop: 0 }} />
          <FieldLabel>{t.area_label}</FieldLabel>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>{Object.keys(AREAS).map((a) => <AreaPill key={a} label={areaName(a, lang)} color={AREAS[a].color} on={itemDraft.area === a} onClick={() => setItemDraft({ ...itemDraft, area: a })} />)}</div>
          {(itemDraft.type === "expense" || itemDraft.type === "obligation") && (<><FieldLabel>{t.amount_label}</FieldLabel><input className="ph" type="number" value={itemDraft.amount ?? ""} onChange={(e) => setItemDraft({ ...itemDraft, amount: e.target.value === "" ? null : parseFloat(e.target.value) })} style={{ ...inputS, marginTop: 0 }} /></>)}
          {(itemDraft.type === "event" || itemDraft.type === "obligation" || itemDraft.type === "task") && (<><FieldLabel>{itemDraft.type === "event" ? t.f_time : t.date_label}</FieldLabel><input className="ph" value={itemDraft.dateLabel || ""} onChange={(e) => setItemDraft({ ...itemDraft, dateLabel: e.target.value })} style={{ ...inputS, marginTop: 0 }} /></>)}
          {(itemDraft.type === "task" || itemDraft.type === "reminder" || itemDraft.type === "followup") && (<button onClick={() => setItemDraft({ ...itemDraft, done: !itemDraft.done })} style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 16, background: "transparent", border: "none", color: C.text, cursor: "pointer", fontFamily: SF, fontSize: 15 }}><span style={{ width: 20, height: 20, borderRadius: 6, border: `1.5px solid ${itemDraft.done ? C.gold : C.border}`, background: itemDraft.done ? C.gold : "transparent" }} /> {t.done_label}</button>)}
          <div style={{ display: "flex", gap: 12, marginTop: 22 }}>{!itemDraft._new && <button onClick={deleteItem} style={{ ...btnGhost, color: C.red, borderColor: "#5a2b2d", flex: 1 }}>{t.del}</button>}<button onClick={saveItem} disabled={!itemDraft.title.trim()} style={{ ...btnGold, flex: 2, opacity: itemDraft.title.trim() ? 1 : 0.5 }}>{t.save}</button></div>
        </Sheet>
      )}

      {txnDraft && (
        <Sheet onClose={() => setTxnDraft(null)}>
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>{[["expense", t.add_expense], ["income", t.add_income]].map(([k, lbl]) => (<button key={k} onClick={() => setTxnDraft({ ...txnDraft, kind: k, cat: k === "income" ? "client" : "office", ded: k === "expense" })} style={{ flex: 1, padding: "10px 0", borderRadius: 12, cursor: "pointer", fontFamily: SF, fontSize: 14, fontWeight: txnDraft.kind === k ? 600 : 400, background: txnDraft.kind === k ? (k === "income" ? C.green : C.surface2) : "transparent", color: txnDraft.kind === k ? (k === "income" ? C.bg : C.text) : C.mute, border: `1px solid ${txnDraft.kind === k ? (k === "income" ? C.green : C.border) : C.border}` }}>{lbl}</button>))}</div>
          <button onClick={() => receiptRef.current && receiptRef.current.click()} disabled={scanning} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", padding: "12px", borderRadius: 12, marginBottom: 12, background: C.surface2, border: `1px solid ${C.goldSoft}`, color: C.gold, fontSize: 13.5, fontWeight: 600, cursor: scanning ? "default" : "pointer", fontFamily: SF }}>{scanning ? t.scanning : <><CamIcon /> {t.scan_receipt}</>}</button>
          <div style={{ display: "flex", alignItems: "center", background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 12, padding: "4px 16px" }}><span style={{ fontSize: 22, color: C.mute }}>$</span><input className="ph" type="number" inputMode="decimal" autoFocus value={txnDraft.amount} onChange={(e) => setTxnDraft({ ...txnDraft, amount: e.target.value })} placeholder="0.00" style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: C.text, fontSize: 26, fontWeight: 300, padding: "10px 8px", fontFamily: SF }} /></div>
          <FieldLabel>{t.f_cat}</FieldLabel>
          <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>{(txnDraft.kind === "income" ? INCOME : CATS).map((c) => <Chip key={c.k} label={c[lang === "es" ? "es" : "en"]} color={c.color} on={txnDraft.cat === c.k} onClick={() => setTxnDraft({ ...txnDraft, cat: c.k, ded: txnDraft.kind === "expense" ? catBy(c.k).ded !== "none" : false })} />)}</div>
          {txnDraft.kind === "expense" && (() => { const c = catBy(txnDraft.cat); const nt = c[lang === "es" ? "n_es" : "n_en"]; return nt ? <div style={{ fontSize: 11.5, color: C.dim, marginTop: 10, lineHeight: 1.45 }}>ⓘ {nt}</div> : null; })()}
          {txnDraft.kind === "expense" && txnDraft.cat === "gas" && (<><FieldLabel>{t.f_miles}</FieldLabel><input className="ph" type="number" inputMode="decimal" value={txnDraft.miles || ""} onChange={(e) => { const mi = e.target.value; setTxnDraft({ ...txnDraft, miles: mi, amount: mi ? (parseFloat(mi) * 0.725).toFixed(2) : txnDraft.amount }); }} placeholder="0" style={{ ...inputS, marginTop: 0 }} /></>)}
          <FieldLabel>{t.f_acct}</FieldLabel>
          <div style={{ display: "flex", gap: 7, flexWrap: "wrap" }}>{ACCOUNTS.map((a) => <Chip key={a.k} label={a.label} color={C.gold} on={txnDraft.account === a.k} onClick={() => setTxnDraft({ ...txnDraft, account: a.k })} />)}</div>
          <FieldLabel>{t.f_date}</FieldLabel><input type="date" value={txnDraft.dateISO} onChange={(e) => setTxnDraft({ ...txnDraft, dateISO: e.target.value })} style={{ ...inputS, marginTop: 0, colorScheme: "dark" }} />
          <input className="ph" value={txnDraft.note} onChange={(e) => setTxnDraft({ ...txnDraft, note: e.target.value })} placeholder={t.f_note} style={inputS} />
          {txnDraft.kind === "expense" && (<button onClick={() => setTxnDraft({ ...txnDraft, ded: !txnDraft.ded })} disabled={catBy(txnDraft.cat).ded === "none"} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", marginTop: 16, background: "transparent", border: "none", cursor: catBy(txnDraft.cat).ded === "none" ? "default" : "pointer", fontFamily: SF }}><span style={{ fontSize: 15, color: catBy(txnDraft.cat).ded === "none" ? C.mute : C.text }}>{t.f_ded}</span><span style={{ width: 46, height: 27, borderRadius: 999, background: txnDraft.ded ? C.gold : C.surface2, border: `1px solid ${txnDraft.ded ? C.gold : C.border}`, position: "relative" }}><span style={{ position: "absolute", top: 2, left: txnDraft.ded ? 21 : 2, width: 21, height: 21, borderRadius: 999, background: txnDraft.ded ? C.bg : C.mute, transition: "left .2s" }} /></span></button>)}
          <div style={{ display: "flex", gap: 12, marginTop: 20 }}>{!txnDraft._new && <button onClick={deleteTxn} style={{ ...btnGhost, color: C.red, borderColor: "#5a2b2d", flex: 1 }}>{t.del}</button>}<button onClick={saveTxn} disabled={!parseFloat(txnDraft.amount)} style={{ ...btnGold, flex: 2, opacity: parseFloat(txnDraft.amount) ? 1 : 0.5 }}>{t.save}</button></div>
        </Sheet>
      )}

      {review && (
        <Sheet onClose={() => setReview(null)}>
          <div style={{ fontSize: 16, fontWeight: 600 }}>{t.review_title}</div>
          <div style={{ fontSize: 12.5, color: C.mute, marginTop: 4, marginBottom: 14 }}>{t.review_sub}</div>
          {review.map((it, idx) => (
            <div key={it.id} style={{ background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 14, padding: "12px 14px", marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontSize: 10, letterSpacing: "0.1em", textTransform: "uppercase", color: C.dim }}>{it._dest === "txn" ? t["type_" + it.kind] : t["type_" + it.type]}{it._dest === "txn" ? ` · ${money(it.amount, loc)}` : it.amount != null ? ` · ${money(it.amount, loc)}` : ""}</span>
                <button onClick={() => setReview((r) => r.filter((_, i) => i !== idx))} style={{ background: "transparent", border: "none", color: C.mute, fontSize: 16, cursor: "pointer" }}>✕</button>
              </div>
              <input className="ph" value={it.title} onChange={(e) => setReview((r) => r.map((x, i) => (i === idx ? { ...x, title: e.target.value } : x)))} style={{ width: "100%", background: "transparent", border: "none", borderBottom: `1px solid ${C.border}`, outline: "none", color: C.text, fontSize: 15, padding: "4px 0 8px", fontFamily: SF }} />
              {it._dest === "item" ? (<div style={{ display: "flex", gap: 7, flexWrap: "wrap", marginTop: 10 }}>{Object.keys(AREAS).map((a) => <AreaPill key={a} small label={areaName(a, lang)} color={AREAS[a].color} on={it.area === a} onClick={() => setReview((r) => r.map((x, i) => (i === idx ? { ...x, area: a } : x)))} />)}</div>)
                : (<div style={{ fontSize: 12, color: C.mute, marginTop: 8 }}>{(it.kind === "income" ? incBy(it.cat) : catBy(it.cat))[lang === "es" ? "es" : "en"]} · {acctBy(it.account).label}{it.kind === "expense" && it.ded ? " · ✓" : ""}</div>)}
            </div>
          ))}
          <div style={{ display: "flex", gap: 12, marginTop: 8 }}><button onClick={() => setReview(null)} style={btnGhost}>{t.review_discard}</button><button onClick={confirmReview} disabled={!review.length} style={{ ...btnGold, flex: 2 }}>{t.review_confirm}</button></div>
        </Sheet>
      )}

      {reportOpen && (
        <Sheet onClose={() => setReportOpen(false)}>
          {(() => {
            const yT = txns.filter((x) => new Date(x.dateISO).getFullYear() === YEAR);
            const yInc = yT.filter((x) => x.kind === "income").reduce((s, x) => s + x.amount, 0);
            const yExp = yT.filter((x) => x.kind === "expense").reduce((s, x) => s + x.amount, 0);
            const yDed = yT.reduce((s, x) => s + dedAmount(x), 0);
            const lines = (() => { const m = {}; yT.filter((x) => x.kind === "expense").forEach((x) => { const d = dedAmount(x); if (d <= 0) return; const ln = catBy(x.cat).line; m[ln] = (m[ln] || 0) + d; }); return Object.entries(m).sort((a, b) => b[1] - a[1]); })();
            const exportCSV = () => { const head = ["Date", "Type", "Category", "Schedule C", "Account", "Note", "Amount", "Deductible"]; const rows = yT.slice().sort((a, b) => a.dateISO.localeCompare(b.dateISO)).map((x) => [x.dateISO, x.kind, (x.kind === "income" ? incBy(x.cat) : catBy(x.cat))[lang === "es" ? "es" : "en"], x.kind === "expense" ? catBy(x.cat).line : "Income", acctBy(x.account).label, (x.note || "").replace(/"/g, "'"), x.amount.toFixed(2), dedAmount(x).toFixed(2)]); const csv = [head, ...rows].map((r) => r.map((c) => `"${c}"`).join(",")).join("\n"); try { const b = new Blob([csv], { type: "text/csv" }); const u = URL.createObjectURL(b); const a = document.createElement("a"); a.href = u; a.download = `onucore-finance-${YEAR}.csv`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(u); } catch {} };
            const shareReport = async () => {
              const title = t.rep_title.replace("{y}", YEAR);
              const body = [title, `${t.rep_income}: ${money(yInc, loc)}`, `${t.rep_expenses}: ${money(yExp, loc)}`, `${t.rep_ded}: ${money(yDed, loc)}`, "", `${t.rep_by}:`, ...lines.map(([ln, amt]) => `• ${ln}: ${money(amt, loc)}`), "", t.rep_disc].join("\n");
              try { if (navigator.share) { await navigator.share({ title, text: body }); return; } throw 0; }
              catch (e) { if (e && e.name === "AbortError") return; try { await navigator.clipboard.writeText(body); setToast({ kind: "ok", text: t.rep_copied }); } catch {} }
            };
            return (<>
              <div style={{ fontSize: 17, fontWeight: 600 }}>{t.rep_title.replace("{y}", YEAR)}</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 16 }}><Sum label={t.rep_income} value={money(yInc, loc)} color={C.green} /><Sum label={t.rep_expenses} value={money(yExp, loc)} color={C.red} /></div>
              <div style={{ background: C.surface2, border: `1px solid ${C.goldSoft}`, borderRadius: 14, padding: "14px 16px", marginTop: 10 }}><div style={{ fontSize: 10.5, letterSpacing: "0.1em", textTransform: "uppercase", color: C.gold }}>{t.rep_ded}</div><div className="num" style={{ fontSize: 28, fontWeight: 300, color: C.gold, marginTop: 4 }}>{money(yDed, loc)}</div></div>
              <FieldLabel>{t.rep_by}</FieldLabel>
              <div style={cardS}>{lines.map(([ln, amt]) => (<div key={ln} style={{ display: "flex", justifyContent: "space-between", padding: "10px 0", borderBottom: `1px solid ${C.borderSoft}`, fontSize: 14 }}><span style={{ color: C.dim }}>{ln}</span><span className="num">{money(amt, loc)}</span></div>))}</div>
              <div style={{ fontSize: 11, color: C.mute, marginTop: 12, lineHeight: 1.5 }}>ⓘ {t.rep_disc}</div>
              <div style={{ display: "flex", gap: 8, marginTop: 18 }}><button onClick={() => setReportOpen(false)} style={{ ...btnGhost, flex: "0 0 auto", padding: "0 16px", fontSize: 14, whiteSpace: "nowrap" }}>{t.rep_close}</button><button onClick={exportCSV} style={{ ...btnGhost, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 14, whiteSpace: "nowrap" }}><DownI /> {t.rep_export}</button><button onClick={shareReport} style={{ ...btnGold, flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, fontSize: 14, whiteSpace: "nowrap" }}><ShareI /> {t.rep_share}</button></div>
            </>);
          })()}
        </Sheet>
      )}
    </div>
  );
}

// ---------- PAGES ----------
function Today({ t, lang, loc, briefing, briefingLoading, regenerate, events, tasks, reminders, obligations, recentId, toggleDone, onEdit, alerts, askQ, setAskQ, askA, askLoading, onAsk, clearAsk }) {
  const evToday = events.filter((e) => e.dateISO === todayISO());
  const todo = [...tasks.filter((x) => !x.done), ...reminders.filter((r) => !r.done)];
  const bills = obligations.filter((o) => { const d = daysUntil(o.dateISO); return d != null && d <= 10; });
  const empty = evToday.length + todo.length + bills.length === 0;
  return (<>
    <div className="rise" style={{ marginTop: 6, padding: 22, background: C.surface, border: `1px solid ${C.borderSoft}`, borderRadius: 22 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}><div style={{ fontSize: 9.5, letterSpacing: "0.26em", color: C.gold, textTransform: "uppercase" }}>{t.briefing_label}</div><button onClick={regenerate} style={{ background: "transparent", border: `1px solid ${C.borderSoft}`, color: C.mute, fontSize: 11.5, padding: "5px 12px", borderRadius: 999, cursor: "pointer", fontFamily: SF }}>↻ {t.regenerate}</button></div>
      {briefingLoading ? (<div><div className="shimmer" style={{ height: 17, borderRadius: 6, width: "94%", marginBottom: 9 }} /><div className="shimmer" style={{ height: 17, borderRadius: 6, width: "66%" }} /></div>) : <p style={{ fontWeight: 300, fontSize: 21, lineHeight: 1.42, margin: 0, letterSpacing: "-0.01em" }}>{briefing}</p>}
    </div>

    <div className="rise" style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8, background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 999, padding: "5px 6px 5px 16px" }}>
      <SparkIcon /><input className="ph" value={askQ} onChange={(e) => setAskQ(e.target.value)} onKeyDown={(e) => e.key === "Enter" && onAsk(askQ)} placeholder={t.ask_ph} style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: C.text, fontSize: 14.5, fontFamily: SF, minWidth: 0 }} /><button onClick={() => onAsk(askQ)} disabled={askLoading || !askQ.trim()} style={{ width: 38, height: 38, borderRadius: 999, border: "none", cursor: !askQ.trim() ? "default" : "pointer", background: askQ.trim() ? C.gold : "#34343c", color: askQ.trim() ? C.bg : C.mute, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>{askLoading ? <Spinner /> : <ArrowIcon />}</button>
    </div>
    {(askLoading || askA) && (<div className="rise" style={{ marginTop: 8, background: C.surface, border: `1px solid ${C.goldSoft}`, borderRadius: 16, padding: "14px 16px" }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: askA ? 6 : 0 }}><div style={{ fontSize: 9.5, letterSpacing: "0.18em", textTransform: "uppercase", color: C.gold }}>{t.ask_label}</div>{askA && <button onClick={clearAsk} style={{ background: "transparent", border: "none", color: C.mute, fontSize: 15, cursor: "pointer" }}>✕</button>}</div>{askLoading ? <div style={{ fontSize: 13.5, color: C.mute }}>{t.ask_thinking}</div> : <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5, color: C.text }}>{askA}</p>}</div>)}

    {alerts && alerts.length > 0 && (<><SectionLabel>{t.alerts_label}</SectionLabel><div className="rise" style={{ background: C.surface, border: `1px solid ${C.borderSoft}`, borderRadius: 18, padding: "6px 18px" }}>{alerts.map((a, i) => (<div key={i} style={{ display: "flex", alignItems: "center", gap: 11, padding: "12px 0", borderBottom: i < alerts.length - 1 ? `1px solid ${C.borderSoft}` : "none" }}><span style={{ width: 7, height: 7, borderRadius: 999, background: a.color, flexShrink: 0 }} /><span style={{ fontSize: 14, color: C.text }}>{a.text}</span></div>))}</div></>)}
    <SectionLabel>{t.today_attention}</SectionLabel>
    {empty ? <Card><Empty>{t.today_clear}</Empty></Card> : <>
      {evToday.length > 0 && <Card title={t.today_appts} count={evToday.length}>{evToday.map((e) => <ItemRow key={e.id} it={e} lang={lang} recent={e.id === recentId} onOpen={onEdit} sub={[e.dateLabel, e.person].filter(Boolean).join(" · ")} />)}</Card>}
      {todo.length > 0 && <Card title={t.today_todo} count={todo.length}>{todo.map((x) => <ItemRow key={x.id} it={x} lang={lang} recent={x.id === recentId} onOpen={onEdit} check toggle={() => toggleDone(x.id)} sub={x.detail || [x.priority === "high" ? t.high : "", x.dateLabel].filter(Boolean).join(" · ")} photo={x.photo} />)}</Card>}
      {bills.length > 0 && <Card title={t.today_bills} count={bills.length}>{bills.map((o) => { const d = daysUntil(o.dateISO); return <ItemRow key={o.id} it={o} lang={lang} recent={o.id === recentId} onOpen={onEdit} right={money(o.amount, loc)} sub={d <= 0 ? t.due_today : t.due_in.replace("{n}", d)} subColor={d <= 3 ? C.red : C.gold} />; })}</Card>}
    </>}
  </>);
}
function Agenda({ t, lang, items, calY, calM, calSel, calSrc, setCalSel, setCalSrc, setCalY, setCalM, newEvent, onEdit, gcal, gcalEvents, connectGoogle, desktop }) {
  const SRC = { atlas: C.red, google: "#6b93d6", apple: C.apple };
  const SLABEL = { atlas: "onucore", google: "Google", apple: "Apple" };
  const allDay = lang === "es" ? "Todo el día" : "All day";
  const monthLabel = new Date(calY, calM, 1).toLocaleDateString(lang === "es" ? "es-MX" : "en-US", { month: "long", year: "numeric" });
  const firstOffset = (new Date(calY, calM, 1).getDay() + 6) % 7;
  const dim = new Date(calY, calM + 1, 0).getDate();
  const dayEvents = (iso) => { let a = items.filter((i) => i.type === "event" && i.dateISO === iso).map((e) => ({ ...e, source: "atlas", time: e.dateLabel })); if (calSrc.google) a = a.concat((gcalEvents || []).filter((e) => e.dateISO === iso)); return a.sort((x, y) => parseT(x.time) - parseT(y.time)); };
  const shift = (delta) => { let nm = calM + delta, ny = calY; if (nm < 0) { nm = 11; ny--; } if (nm > 11) { nm = 0; ny++; } setCalY(ny); setCalM(nm); setCalSel(toISO(ny, nm, 1)); };
  const sel = dayEvents(calSel); const selDate = new Date(calSel + "T00:00:00"); const WD = lang === "es" ? ["L", "M", "X", "J", "V", "S", "D"] : ["M", "T", "W", "T", "F", "S", "S"];
  // Every event in the visible month → for the "more this month" agenda list and the month count.
  const monthEvents = []; for (let d = 1; d <= dim; d++) { const iso = toISO(calY, calM, d); dayEvents(iso).forEach((e) => monthEvents.push({ ...e, iso })); }
  const upcoming = monthEvents.filter((e) => e.iso !== calSel);
  return (<>
    <div style={{ display: "flex", gap: 8, marginTop: 6, alignItems: "center" }}>
      <SrcChip label="onucore" color={SRC.atlas} on count />
      <SrcChip label="Google" color={SRC.google} on={gcal.connected && calSrc.google} connectLabel={gcal.connected ? undefined : t.cal_connect} onClick={() => (gcal.connected ? setCalSrc((c) => ({ ...c, google: !c.google })) : connectGoogle())} />
      <div style={{ marginLeft: "auto", fontSize: 12, color: C.mute }}>{monthEvents.length} {monthEvents.length === 1 ? (lang === "es" ? "evento" : "event") : (lang === "es" ? "eventos" : "events")}</div>
    </div>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "16px 0 10px" }}>
      <button onClick={() => shift(-1)} style={navBtn}>‹</button>
      <div style={{ fontSize: 19, textTransform: "capitalize", fontWeight: 600 }}>{monthLabel}</div>
      <button onClick={() => shift(1)} style={navBtn}>›</button>
    </div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", marginBottom: 6 }}>{WD.map((d, i) => <div key={i} style={{ textAlign: "center", fontSize: 10.5, color: C.mute, fontWeight: 600, letterSpacing: "0.05em" }}>{d}</div>)}</div>
    <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 4 }}>
      {Array.from({ length: 42 }).map((_, i) => { const dn = i - firstOffset + 1; const real = dn >= 1 && dn <= dim; const iso = real ? toISO(calY, calM, dn) : null; const isSel = iso === calSel; const isToday = iso === todayISO(); const evs = real ? dayEvents(iso) : []; const has = evs.length > 0;
        return (<button key={i} disabled={!real} onClick={() => setCalSel(iso)} style={{ minHeight: desktop ? 76 : 50, border: `1px solid ${isSel ? C.red : has ? C.borderSoft : "transparent"}`, borderRadius: 11, background: isSel ? "rgba(229,72,77,.10)" : has ? C.surface : "transparent", cursor: real ? "pointer" : "default", display: "flex", flexDirection: "column", alignItems: desktop ? "stretch" : "center", justifyContent: "flex-start", gap: 3, padding: desktop ? "5px 5px 6px" : "6px 2px", fontFamily: SF, overflow: "hidden" }}>
          {real && (<>
            <span style={{ fontSize: 13, fontWeight: isToday ? 700 : 500, color: isToday ? "#fff" : isSel ? C.text : C.dim, alignSelf: desktop ? "flex-start" : "center", minWidth: 22, height: 22, lineHeight: "22px", textAlign: "center", borderRadius: 999, background: isToday ? C.red : "transparent", flexShrink: 0, padding: isToday ? "0 6px" : 0 }}>{dn}</span>
            {desktop ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 2, width: "100%", marginTop: 1 }}>
                {evs.slice(0, 2).map((e, k) => (<div key={k} style={{ fontSize: 9.5, lineHeight: "14px", color: C.text, background: `${SRC[e.source] || C.mute}26`, borderLeft: `2px solid ${SRC[e.source] || C.mute}`, borderRadius: "0 3px 3px 0", padding: "1px 5px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.title}</div>))}
                {evs.length > 2 && <div style={{ fontSize: 9, color: C.mute, paddingLeft: 3 }}>+{evs.length - 2} {lang === "es" ? "más" : "more"}</div>}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 2.5, alignItems: "center", marginTop: 1 }}>
                {evs.slice(0, 3).map((e, k) => (<span key={k} style={{ width: 15, height: 3, borderRadius: 2, background: SRC[e.source] || C.mute }} />))}
              </div>
            )}
          </>)}
        </button>);
      })}
    </div>
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "22px 0 10px" }}>
      <div style={{ fontSize: 14.5, fontWeight: 600, textTransform: "capitalize" }}>{selDate.toLocaleDateString(lang === "es" ? "es-MX" : "en-US", { weekday: "long", day: "numeric", month: "long" })}</div>
      <button onClick={newEvent} style={{ display: "flex", alignItems: "center", gap: 6, background: C.red, color: "#ffffff", border: "none", borderRadius: 999, padding: "8px 15px", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: SF }}>＋ {t.ev_new}</button>
    </div>
    {sel.length === 0
      ? <div style={{ padding: "22px 14px", background: C.surface, border: `1px dashed ${C.border}`, borderRadius: 14, textAlign: "center", color: C.mute, fontSize: 13.5 }}>{lang === "es" ? "Sin eventos este día" : "No events this day"}</div>
      : sel.map((e) => (<div key={e.id} className="rise" onClick={() => e.source === "atlas" && onEdit(items.find((i) => i.id === e.id))} style={{ display: "flex", gap: 12, alignItems: "stretch", padding: "13px 14px", background: C.surface, border: `1px solid ${C.borderSoft}`, borderRadius: 14, marginBottom: 9, cursor: e.source === "atlas" ? "pointer" : "default" }}>
          <div style={{ width: 4, alignSelf: "stretch", borderRadius: 4, background: SRC[e.source] || C.mute, minHeight: 38 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 500 }}>{e.title}</div>
            <div style={{ fontSize: 12.5, color: C.dim, marginTop: 3 }}>{e.time || allDay}{e.person ? ` · ${e.person}` : ""}</div>
          </div>
          <span style={{ alignSelf: "center", fontSize: 9.5, letterSpacing: "0.06em", textTransform: "uppercase", color: SRC[e.source] || C.mute, background: `${SRC[e.source] || C.mute}1e`, border: `1px solid ${SRC[e.source] || C.mute}55`, borderRadius: 999, padding: "3px 9px", flexShrink: 0 }}>{SLABEL[e.source] || e.source}</span>
        </div>))}
    {upcoming.length > 0 && (<>
      <div style={{ fontSize: 10.5, letterSpacing: "0.18em", color: C.mute, textTransform: "uppercase", margin: "24px 2px 10px" }}>{lang === "es" ? "Más este mes" : "More this month"}</div>
      {upcoming.map((e) => (<div key={e.id + e.iso} className="rise" onClick={() => setCalSel(e.iso)} style={{ display: "flex", gap: 12, alignItems: "center", padding: "11px 14px", background: C.surface, border: `1px solid ${C.borderSoft}`, borderRadius: 14, marginBottom: 8, cursor: "pointer" }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 30, flexShrink: 0 }}>
            <span style={{ fontSize: 9, color: C.mute, textTransform: "uppercase", letterSpacing: "0.04em" }}>{new Date(e.iso + "T00:00:00").toLocaleDateString(lang === "es" ? "es-MX" : "en-US", { weekday: "short" }).replace(".", "")}</span>
            <span style={{ fontSize: 17, fontWeight: 600, color: C.text }}>{parseInt(e.iso.slice(8), 10)}</span>
          </div>
          <div style={{ width: 3, alignSelf: "stretch", borderRadius: 4, background: SRC[e.source] || C.mute, minHeight: 26 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 14, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.title}</div>
            <div style={{ fontSize: 11.5, color: C.mute, marginTop: 2 }}>{e.time || allDay}</div>
          </div>
          <span style={{ width: 7, height: 7, borderRadius: 999, background: SRC[e.source] || C.mute, flexShrink: 0 }} />
        </div>))}
    </>)}
  </>);
}
function Money({ t, lang, loc, txns, obligations, period, setPeriod, fseg, setFseg, recentId, onEditTxn, onEditItem, onAdd, onReport, setAsidePct }) {
  const inP = (x) => { if (period === "all") return true; const d = new Date(x.dateISO + "T00:00:00"); const n = new Date(); if (period === "year") return d.getFullYear() === n.getFullYear(); return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth(); };
  const view = txns.filter(inP).sort((a, b) => b.dateISO.localeCompare(a.dateISO));
  const income = view.filter((x) => x.kind === "income").reduce((s, x) => s + x.amount, 0);
  const expenses = view.filter((x) => x.kind === "expense").reduce((s, x) => s + x.amount, 0);
  const deductible = view.reduce((s, x) => s + dedAmount(x), 0);
  const catT = CATS.map((c) => { const l = view.filter((x) => x.kind === "expense" && x.cat === c.k); return { c, total: l.reduce((s, x) => s + x.amount, 0), ded: l.reduce((s, x) => s + dedAmount(x), 0), n: l.length }; }).filter((r) => r.n > 0).sort((a, b) => b.total - a.total);
  const acctT = ACCOUNTS.map((a) => { const l = view.filter((x) => x.account === a.k); return { a, out: l.filter((x) => x.kind === "expense").reduce((s, x) => s + x.amount, 0), inc: l.filter((x) => x.kind === "income").reduce((s, x) => s + x.amount, 0), n: l.length }; }).filter((r) => r.n > 0);
  const dlabel = (d) => (d === "meals50" ? t.ded_meals50 : d === "partial" ? t.ded_partial : d === "none" ? t.ded_none : t.ded_full);
  return (<>
    <div style={{ display: "flex", gap: 8, marginTop: 6 }}>{[["month", "Mes/Month"], ["year", t.s_deductible && (lang === "es" ? "Año" : "Year")], ["all", lang === "es" ? "Todo" : "All"]].map(([k]) => (<button key={k} onClick={() => setPeriod(k)} style={{ flex: 1, padding: "9px 0", borderRadius: 999, cursor: "pointer", fontFamily: SF, fontSize: 13, fontWeight: period === k ? 600 : 400, background: period === k ? C.gold : "transparent", color: period === k ? "#ffffff" : C.dim, border: `1px solid ${period === k ? C.gold : C.border}` }}>{k === "month" ? (lang === "es" ? "Mes" : "Month") : k === "year" ? (lang === "es" ? "Año" : "Year") : (lang === "es" ? "Todo" : "All")}</button>))}</div>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginTop: 12 }}><Sum label={t.s_income} value={money(income, loc)} color={C.green} /><Sum label={t.s_expenses} value={money(expenses, loc)} color={C.red} /><Sum label={t.s_net} value={money(income - expenses, loc)} color={income - expenses >= 0 ? C.text : C.red} /><Sum label={t.s_deductible} value={money(deductible, loc)} color={C.gold} hint /></div>
    <button onClick={onReport} style={{ width: "100%", padding: 13, borderRadius: 14, background: C.surface, border: `1px solid ${C.goldSoft}`, color: C.gold, fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: SF, display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginTop: 14 }}><DocI /> {t.report}</button>
    {(() => {
      const yr = new Date().getFullYear();
      const yT = txns.filter((x) => new Date(x.dateISO + "T00:00:00").getFullYear() === yr);
      const yInc = yT.filter((x) => x.kind === "income").reduce((s, x) => s + x.amount, 0);
      const yDed = yT.reduce((s, x) => s + dedAmount(x), 0);
      const net = Math.max(0, yInc - yDed); const setAside = net * ((setAsidePct || 30) / 100);
      if (yInc <= 0) return null;
      return (<div className="rise" style={{ marginTop: 12, background: C.surface, border: `1px solid ${C.borderSoft}`, borderRadius: 18, padding: "16px 18px" }}>
        <div style={{ fontSize: 10.5, letterSpacing: "0.18em", textTransform: "uppercase", color: C.dim, marginBottom: 12 }}>{t.tax_label} · {yr}</div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}><div><div style={{ fontSize: 12, color: C.mute }}>{t.tax_setaside}</div><div className="num" style={{ fontSize: 26, fontWeight: 300, color: C.gold, marginTop: 3 }}>{money(setAside, loc)}</div></div><div style={{ textAlign: "right" }}><div style={{ fontSize: 12, color: C.mute }}>{t.tax_quarterly}</div><div className="num" style={{ fontSize: 18, color: C.text, marginTop: 3 }}>{money(setAside / 4, loc)}</div></div></div>
        <div style={{ fontSize: 11.5, color: C.dim, marginTop: 10 }}>{t.tax_net}: <span className="num">{money(net, loc)}</span></div>
        <div style={{ fontSize: 11, color: C.mute, marginTop: 8, lineHeight: 1.5 }}>ⓘ {t.tax_disc}</div>
      </div>);
    })()}
    {obligations.length > 0 && (<><SectionLabel>{t.money_topay}</SectionLabel><Card>{obligations.map((o) => { const d = daysUntil(o.dateISO); const col = d == null ? C.mute : d <= 3 ? C.red : d <= 14 ? C.gold : C.mute; return <ItemRow key={o.id} it={o} lang={lang} onOpen={onEditItem} right={money(o.amount, loc)} sub={d != null ? (d <= 0 ? t.due_today : t.due_in.replace("{n}", d)) : o.dateLabel} subColor={col} />; })}</Card></>)}
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "18px 0 4px" }}><div style={{ display: "flex", gap: 6 }}>{[["txns", t.seg_txns], ["cats", t.seg_cats], ["accts", t.seg_accts]].map(([k, lbl]) => (<button key={k} onClick={() => setFseg(k)} style={{ padding: "7px 12px", borderRadius: 10, cursor: "pointer", fontFamily: SF, fontSize: 12.5, fontWeight: fseg === k ? 600 : 400, background: fseg === k ? C.surface2 : "transparent", color: fseg === k ? C.text : C.mute, border: `1px solid ${fseg === k ? C.border : "transparent"}` }}>{lbl}</button>))}</div><button onClick={onAdd} style={{ width: 34, height: 34, borderRadius: 999, border: "none", background: C.gold, color: "#ffffff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}><PlusSm /></button></div>
    {fseg === "txns" && <Card>{view.length === 0 ? <Empty>{t.none_txns}</Empty> : view.map((x) => { const meta = x.kind === "income" ? incBy(x.cat) : catBy(x.cat); return (<div key={x.id} onClick={() => onEditTxn(x)} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, padding: "12px 0", borderBottom: `1px solid ${C.borderSoft}`, cursor: "pointer", background: x.id === recentId ? "rgba(229,72,77,.08)" : "transparent" }}><div style={{ display: "flex", gap: 11, alignItems: "center", minWidth: 0 }}><span style={{ width: 9, height: 9, borderRadius: 999, background: meta.color, flexShrink: 0 }} /><div style={{ minWidth: 0 }}><div style={{ fontSize: 15 }}>{x.note || meta[lang === "es" ? "es" : "en"]}</div><div style={{ fontSize: 11.5, color: C.mute, marginTop: 3 }}>{meta[lang === "es" ? "es" : "en"]} · {acctBy(x.account).label} · {fmtDate(x.dateISO, lang)}{x.kind === "expense" && dedAmount(x) > 0 ? "  · ✓" : ""}</div></div></div><div className="num" style={{ fontSize: 15, color: x.kind === "income" ? C.green : C.text, flexShrink: 0 }}>{x.kind === "income" ? "+" : "−"}{money(x.amount, loc)}</div></div>); })}</Card>}
    {fseg === "cats" && <Card>{catT.length === 0 ? <Empty>{t.none_txns}</Empty> : catT.map(({ c, total, ded }) => (<div key={c.k} style={{ padding: "12px 0", borderBottom: `1px solid ${C.borderSoft}` }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}><div style={{ display: "flex", gap: 11, alignItems: "center" }}><span style={{ width: 9, height: 9, borderRadius: 999, background: c.color }} /><span style={{ fontSize: 15 }}>{c[lang === "es" ? "es" : "en"]}</span></div><div className="num" style={{ fontSize: 15 }}>{money(total, loc)}</div></div><div style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 6, paddingLeft: 20, flexWrap: "wrap" }}><span style={{ fontSize: 10, letterSpacing: "0.05em", textTransform: "uppercase", color: c.ded === "none" ? C.mute : C.gold, border: `1px solid ${c.ded === "none" ? C.border : C.goldSoft}`, borderRadius: 6, padding: "1px 7px" }}>{dlabel(c.ded)}</span>{ded > 0 && <span style={{ fontSize: 11.5, color: C.gold }}>{money(ded, loc)} · {c.line}</span>}</div></div>))}</Card>}
    {fseg === "accts" && <Card>{acctT.map(({ a, out, inc }) => (<div key={a.k} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "13px 0", borderBottom: `1px solid ${C.borderSoft}` }}><div style={{ display: "flex", gap: 12, alignItems: "center" }}><span style={{ width: 34, height: 34, borderRadius: 9, background: C.surface2, border: `1px solid ${C.border}`, display: "flex", alignItems: "center", justifyContent: "center", color: C.gold }}><AcctI type={a.type} /></span><div><div style={{ fontSize: 15 }}>{a.label}</div><div style={{ fontSize: 11.5, color: C.mute, textTransform: "capitalize" }}>{a.type}</div></div></div><div style={{ textAlign: "right" }}>{inc > 0 && <div className="num" style={{ fontSize: 13.5, color: C.green }}>+{money(inc, loc)}</div>}{out > 0 && <div className="num" style={{ fontSize: 13.5, color: C.dim }}>−{money(out, loc)}</div>}</div></div>))}</Card>}
  </>);
}
function Notes({ t, lang, notes, recentId, onEdit }) { return (<><SectionLabel>{t.nav_notes}</SectionLabel><Card>{notes.length === 0 ? <Empty>{t.notes_none}</Empty> : notes.map((b) => <ItemRow key={b.id} it={b} lang={lang} recent={b.id === recentId} onOpen={onEdit} typeTag={t["type_" + b.type]} sub={b.detail} />)}</Card></>); }
function Capture({ t, lang, input, setInput, processCapture, processing, openVoice, openPhoto, openWhatsapp, recent }) {
  return (<div style={{ marginTop: 4 }}>
    <div style={{ fontSize: 26, fontWeight: 600, letterSpacing: "-0.02em", marginTop: 8 }}>{t.cap_title}</div>
    <div style={{ fontSize: 14, color: C.dim, marginTop: 8, lineHeight: 1.5, maxWidth: 360 }}>{t.cap_sub}</div>
    <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 22 }}><BigBtn onClick={openVoice} icon={<MicIcon big />} title={t.cap_speak} primary /><BigBtn onClick={openPhoto} icon={<CamIcon big />} title={t.cap_photo} /><BigBtn onClick={openWhatsapp} icon={<WaIcon />} title="WhatsApp" /></div>
    <div style={{ display: "flex", alignItems: "center", background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 999, padding: "5px 6px 5px 18px", marginTop: 16 }}><input className="ph" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && processCapture(input)} placeholder={t.ph_idle} style={{ flex: 1, background: "transparent", border: "none", outline: "none", color: C.text, fontSize: 15, fontFamily: SF, minWidth: 0 }} /><button onClick={() => processCapture(input)} disabled={processing || !input.trim()} style={{ width: 40, height: 40, borderRadius: 999, border: "none", cursor: !input.trim() ? "default" : "pointer", background: input.trim() ? C.gold : "#34343c", color: input.trim() ? C.bg : C.mute, display: "flex", alignItems: "center", justifyContent: "center" }}>{processing ? <Spinner /> : <ArrowIcon />}</button></div>
    {recent.length > 0 && <><SectionLabel>{t.cap_recent}</SectionLabel><Card>{recent.map((it) => (it.kind ? <div key={it.id} style={{ display: "flex", justifyContent: "space-between", padding: "11px 0", borderBottom: `1px solid ${C.borderSoft}` }}><div style={{ fontSize: 15 }}>{it.note}</div><div className="num" style={{ fontSize: 14, color: it.kind === "income" ? C.green : C.text }}>{it.kind === "income" ? "+" : "−"}{money(it.amount, lang === "es" ? "es-MX" : "en-US")}</div></div> : <ItemRow key={it.id} it={it} lang={lang} sub={it.detail || it.dateLabel} />))}</Card></>}
  </div>);
}

// ---------- SHARED ----------
function ItemRow({ it, lang, recent, sub, subColor, right, rightColor, check, toggle, photo, onOpen, typeTag }) {
  return (<div className={recent ? "rise" : ""} onClick={() => onOpen && onOpen(it)} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, padding: "11px 0", borderBottom: `1px solid ${C.borderSoft}`, background: recent ? "rgba(229,72,77,.08)" : "transparent", borderRadius: recent ? 8 : 0, paddingLeft: recent ? 8 : 0, marginLeft: recent ? -8 : 0, cursor: onOpen ? "pointer" : "default" }}>
    <div style={{ display: "flex", gap: 11, alignItems: "flex-start", flex: 1, minWidth: 0 }}>
      {check ? <button onClick={(e) => { e.stopPropagation(); toggle(); }} style={{ marginTop: 2, width: 18, height: 18, borderRadius: 6, flexShrink: 0, cursor: "pointer", border: `1.5px solid ${it.done ? C.gold : C.border}`, background: it.done ? C.gold : "transparent" }} /> : <span style={{ marginTop: 6, width: 8, height: 8, borderRadius: 999, flexShrink: 0, background: areaColor(it.area) }} />}
      {photo && <img src={photo} alt="" style={{ width: 42, height: 42, borderRadius: 9, objectFit: "cover", flexShrink: 0, border: `1px solid ${C.border}` }} />}
      <div style={{ minWidth: 0 }}>{typeTag && <div style={{ fontSize: 9.5, letterSpacing: "0.18em", textTransform: "uppercase", color: areaColor(it.area), marginBottom: 3 }}>{typeTag}</div>}<div style={{ fontSize: 15, color: it.done ? C.mute : C.text, textDecoration: it.done ? "line-through" : "none" }}>{it.title}</div><div style={{ display: "flex", gap: 7, alignItems: "center", marginTop: 4, flexWrap: "wrap" }}><span style={{ fontSize: 9.5, letterSpacing: "0.06em", textTransform: "uppercase", color: areaColor(it.area), border: `1px solid ${areaColor(it.area)}55`, borderRadius: 6, padding: "1px 6px" }}>{areaName(it.area, lang)}</span>{sub && <span style={{ fontSize: 12, color: subColor || C.mute }}>{sub}</span>}</div></div>
    </div>
    {right && <div className="num" style={{ fontSize: 15, color: rightColor || C.text, flexShrink: 0 }}>{right}</div>}
  </div>);
}
function Sheet({ children, onClose }) { return (<div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 110, background: "rgba(0,0,0,.55)", backdropFilter: "blur(4px)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}><div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 440, maxHeight: "90vh", overflowY: "auto", background: C.surface, borderTop: `1px solid ${C.border}`, borderRadius: "22px 22px 0 0", padding: "20px 22px 30px", animation: "sheetUp .3s ease both" }}><div style={{ width: 38, height: 4, borderRadius: 4, background: C.border, margin: "0 auto 16px" }} />{children}</div></div>); }
function FieldLabel({ children }) { return <div style={{ fontSize: 10.5, letterSpacing: "0.1em", textTransform: "uppercase", color: C.mute, margin: "18px 0 9px" }}>{children}</div>; }
function PField({ label, children }) { return (<div style={{ flex: 1, marginBottom: 12 }}><div style={{ fontSize: 11, color: C.mute, marginBottom: 6 }}>{label}</div>{children}</div>); }
function AreaPill({ label, color, on, onClick, small }) { return (<button onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0, padding: small ? "5px 10px" : "7px 13px", borderRadius: 999, cursor: "pointer", fontFamily: SF, fontSize: small ? 12 : 12.5, background: on ? "rgba(255,255,255,0.05)" : "transparent", border: `1px solid ${on ? color : C.border}`, color: on ? C.text : C.dim }}><span style={{ width: 8, height: 8, borderRadius: 999, background: color }} />{label}</button>); }
function SrcChip({ label, color, on, count, connectLabel, onClick }) { return (<button onClick={onClick} disabled={!onClick} style={{ display: "flex", alignItems: "center", gap: 7, flexShrink: 0, padding: "8px 13px", borderRadius: 999, cursor: onClick ? "pointer" : "default", fontFamily: SF, fontSize: 12.5, background: on ? "rgba(255,255,255,0.04)" : "transparent", border: `1px solid ${on ? color : C.border}`, color: on ? C.text : C.dim }}><span style={{ width: 9, height: 9, borderRadius: 999, background: on ? color : "transparent", border: `1.5px solid ${color}` }} />{label}{!on && connectLabel && <span style={{ fontSize: 11, color: C.mute }}>· {connectLabel}</span>}</button>); }
function Chip({ label, color, on, onClick }) { return (<button onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 6, padding: "7px 12px", borderRadius: 999, cursor: "pointer", fontFamily: SF, fontSize: 12.5, background: on ? "rgba(255,255,255,0.05)" : "transparent", border: `1px solid ${on ? color : C.border}`, color: on ? C.text : C.dim }}><span style={{ width: 8, height: 8, borderRadius: 999, background: color }} />{label}</button>); }
function Sum({ label, value, color, hint }) { return (<div style={{ background: C.surface, border: `1px solid ${hint ? C.goldSoft : C.borderSoft}`, borderRadius: 16, padding: "14px 16px" }}><div style={{ fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: C.mute }}>{label}</div><div className="num" style={{ fontSize: 21, fontWeight: 300, marginTop: 5, color: color || C.text, letterSpacing: "-0.01em" }}>{value}</div></div>); }
function BigBtn({ onClick, icon, title, primary }) { return (<button onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 14, width: "100%", padding: "16px 18px", borderRadius: 16, cursor: "pointer", fontFamily: SF, textAlign: "left", background: primary ? C.gold : C.surface, color: primary ? "#ffffff" : C.text, border: primary ? "none" : `1px solid ${C.border}` }}><span style={{ width: 38, height: 38, borderRadius: 999, display: "flex", alignItems: "center", justifyContent: "center", background: primary ? "rgba(0,0,0,.12)" : C.surface2, color: primary ? "#ffffff" : C.gold }}>{icon}</span><span style={{ fontSize: 16, fontWeight: 600 }}>{title}</span></button>); }
function SectionLabel({ children }) { return <div style={{ fontSize: 10.5, letterSpacing: "0.2em", textTransform: "uppercase", color: C.dim, margin: "20px 2px 8px" }}>{children}</div>; }
function Card({ title, count, children }) { return (<div className="rise" style={{ background: C.surface, border: `1px solid ${C.borderSoft}`, borderRadius: 18, padding: "16px 18px", marginTop: title ? 8 : 6 }}>{title && <div style={{ fontSize: 10.5, letterSpacing: "0.18em", textTransform: "uppercase", color: C.dim, marginBottom: 8 }}>{title} <span style={{ color: C.mute }}>· {count}</span></div>}{children}</div>); }
function Empty({ children }) { return <div style={{ fontSize: 13.5, color: C.mute, padding: "8px 0" }}>{children}</div>; }
function Tab({ id, cur, set, label, icon }) { const on = cur === id; return (<button onClick={() => set(id)} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, background: "transparent", border: "none", cursor: "pointer", fontFamily: SF, padding: "4px 10px", color: on ? C.gold : C.mute }}><span style={{ width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center" }}>{icon}</span><span style={{ fontSize: 10, fontWeight: on ? 600 : 400 }}>{label}</span></button>); }
const cardS = { background: C.surface, border: `1px solid ${C.borderSoft}`, borderRadius: 18, padding: "4px 18px", marginTop: 8 };
const inputS = { width: "100%", background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 12, outline: "none", color: C.text, fontSize: 15.5, padding: "13px 15px", fontFamily: SF, marginTop: 14 };
const pin = { width: "100%", background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 10, outline: "none", color: C.text, fontSize: 15, padding: "11px 13px", fontFamily: SF };
const btnGhost = { flex: 1, height: 50, borderRadius: 14, background: C.surface2, border: `1px solid ${C.border}`, color: C.dim, fontSize: 15, cursor: "pointer", fontFamily: SF };
const btnGold = { height: 50, borderRadius: 14, border: "none", background: C.gold, color: "#ffffff", fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: SF };
const navBtn = { width: 38, height: 38, borderRadius: 999, background: C.surface2, border: `1px solid ${C.border}`, color: C.text, fontSize: 20, cursor: "pointer", fontFamily: SF, lineHeight: 1 };

function Equalizer({ active }) { return (<div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 4, height: 56, marginTop: 30 }}>{Array.from({ length: 29 }).map((_, i) => { const dur = 0.5 + ((i * 7) % 9) * 0.06; const delay = ((i * 13) % 11) * 0.05; const base = 52 - Math.abs(i - 14) * 2.4; return (<div key={i} style={{ width: 3, height: Math.max(8, base), borderRadius: 4, background: C.gold, transformOrigin: "center", opacity: active ? 0.95 : 0.28, transform: active ? undefined : "scaleY(0.2)", animation: active ? `eq ${dur}s ease-in-out ${delay}s infinite alternate` : "none" }} />); })}</div>); }
function MicIcon({ big, huge }) { const s = huge ? 40 : big ? 22 : 18; return (<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10a7 7 0 0 0 14 0M12 17v4" /></svg>); }
function CamIcon({ big }) { const s = big ? 24 : 19; return (<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M3 8a2 2 0 0 1 2-2h2l1.5-2h7L19 6a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><circle cx="12" cy="13" r="3.4" /></svg>); }
function ArrowIcon() { return (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 19V5M5 12l7-7 7 7" /></svg>); }
function GlobeIcon() { return (<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" /></svg>); }
function Spinner() { return (<svg width="16" height="16" viewBox="0 0 24 24" style={{ animation: "spin 1s linear infinite" }}><circle cx="12" cy="12" r="9" fill="none" stroke="rgba(0,0,0,.22)" strokeWidth="3" /><path d="M12 3a9 9 0 0 1 9 9" fill="none" stroke="#ffffff" strokeWidth="3" strokeLinecap="round" /></svg>); }
function DocI() { return (<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5M9 13h6M9 17h6" /></svg>); }
function DownI() { return (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 4v12M7 11l5 5 5-5M5 20h14" /></svg>); }
function ShareI() { return (<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 15V4M8 8l4-4 4 4M6 13v6a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1v-6" /></svg>); }
function AcctI({ type }) { if (type === "credit") return (<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" /></svg>); if (type === "paypal") return (<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M7 18l1.5-9h4a3 3 0 0 1 0 6H9" /><path d="M10 21l1.2-7h3.3a3 3 0 0 0 0-6" /></svg>); if (type === "bank") return (<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M3 10l9-6 9 6M5 10v8M19 10v8M9 10v8M15 10v8M3 20h18" /></svg>); return (<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="2" y="6" width="20" height="12" rx="2" /><circle cx="12" cy="12" r="2.5" /></svg>); }
function HomeI() { return (<svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M3 11l9-8 9 8M5 10v10h14V10" /></svg>); }
function CalI() { return (<svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 9h18M8 3v4M16 3v4" /></svg>); }
function WalletI() { return (<svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v0H5a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9" /><circle cx="17" cy="13" r="1.3" fill="currentColor" stroke="none" /></svg>); }
function NoteI() { return (<svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 8h8M8 12h8M8 16h5" /></svg>); }
function PlusI() { return (<svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>); }
function ChatI({ big }) { const s = big ? 27 : 21; return (<svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.7a8.5 8.5 0 0 1-.9-3.8 8.5 8.5 0 0 1 8.5-8.5h.5a8.5 8.5 0 0 1 8 8z" /></svg>); }
function PlusSm() { return (<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>); }
function WaIcon() { return (<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.5 8.5 0 0 1-12.3 7.6L3 21l1.9-5.7A8.5 8.5 0 1 1 21 11.5z" /></svg>); }
function SparkIcon() { return (<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#e5484d" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l1.8 4.9L18.7 9.7l-4.9 1.8L12 16.4l-1.8-4.9L5.3 9.7l4.9-1.8z" /><path d="M19 15l.7 1.9 1.9.7-1.9.7-.7 1.9-.7-1.9-1.9-.7 1.9-.7z" /></svg>); }
function LinkIcon() { return (<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1" /><path d="M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1" /></svg>); }
