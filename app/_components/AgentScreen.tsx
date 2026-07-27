"use client";
import { useState } from "react";

// Pantalla del Agente: le das una misión, él ejecuta pasos, reporta.
// Presets rápidos + input libre. Los pasos se muestran arriba del resumen.
type Step = { tool: string; input: unknown; output: unknown };

const TOOL_ES: Record<string, string> = {
  list_txns: "Leer movimientos",
  categorize_txn: "Recategorizar gasto",
  update_txn: "Actualizar movimiento",
  list_items: "Leer items",
  create_item: "Crear item",
  update_item: "Actualizar item",
  delete_item: "Borrar item",
  add_subscription: "Agregar suscripción",
  add_birthday: "Agregar cumpleaños",
  add_place: "Agregar lugar",
  add_car_service: "Agregar servicio del carro",
  add_tax_form: "Agregar forma fiscal",
  get_balances: "Leer saldos",
  list_tax_forms: "Leer formas fiscales",
  list_documents: "Leer documentos",
  get_car: "Leer info del carro",
  get_profile: "Leer perfil",
  web_search: "Buscar en internet",
  build_tax_package: "Armar paquete fiscal",
};

const YEAR_NOW = new Date().getFullYear();
const TAX_YEAR = new Date().getMonth() <= 3 ? YEAR_NOW - 1 : YEAR_NOW;
const PRESETS = [
  { icon: "📊", label: `Paquete completo para mi contador (${TAX_YEAR})`, mission: `Prepara el paquete COMPLETO para mi preparador de impuestos del año fiscal ${TAX_YEAR}. Usa build_tax_package(${TAX_YEAR}). Devuelve un TEXTO CLARO listo para enviarle a mi contador con: 1) resumen ejecutivo (ingresos negocio, deducible total, utilidad neta, W-2 salarios y retención), 2) deducibles por línea del Schedule C, 3) formas W-2 y 1099 con retenciones, 4) match 1099 vs depósitos (qué falta), 5) millaje del carro y su deducción, 6) documentos guardados. Formato lista, sin markdown, en español. Al final: 'Cualquier duda me avisas.'` },
  { icon: "💵", label: "Revisar mis gastos ambiguos", mission: "Revisa mis gastos de los últimos 14 días en la cuenta 'personal' (Empleado). Si alguno claramente parece de negocio (Uber, gasolina, comida con cliente, software), muévelo a cuenta 'business' con la categoría correcta y márcalo deducible. Explica qué moviste." },
  { icon: "🧾", label: "Deducibles perdidos en Oprinte", mission: "Busca gastos de la cuenta 'business' que estén categorizados como 'personal' y no deducibles. Recategorízalos con la categoría correcta del Schedule C (gas, food, tech, travel, software, office, phone, pro, education) y márcalos deducibles. Sé conservador." },
  { icon: "🕵️", label: "Suscripciones que no uso", mission: "Revisa mis suscripciones (list_items type=subscription) y mis movimientos de los últimos 60 días. Dime cuáles no he cobrado o que ya no aparecen en Plaid (posiblemente canceladas o no uso). Sugiere cuáles cancelar y cuánto ahorraría al mes." },
  { icon: "📅", label: "Preparar mis biles del mes", mission: "Revisa mis biles (obligation) del próximo mes. Si alguno no tiene fecha o repeat, arréglalo. Dime cuánto suma en total y en qué días caen." },
  { icon: "💼", label: "Estado de Oprinte este mes", mission: "Suma mis ingresos y gastos de la cuenta 'business' de este mes. Compara con el mes anterior. Dime el neto y si estoy creciendo." },
  { icon: "🍽️", label: "Sugerir lugar para reunión", mission: "Voy a tener una reunión con un cliente en Los Angeles. Revisa mis lugares favoritos (list_items type=place). Sugiere 2-3 opciones y por qué. Si tengo pocos, usa web_search para recomendar restaurantes de negocio bien ubicados en LA (Westside/DTLA)." },
  { icon: "🚗", label: "Revisar el carro", mission: "Revisa el estado de mi carro con get_car. Dime qué está por vencer en 30 días (aceite, placas, seguro), qué millaje va, y qué me recomiendas hacer. Si el aceite se debe cambiar, agenda un recordatorio (create_item type=reminder) para llamar al mecánico." },
  { icon: "🌐", label: "Investigar algo en LA", mission: "" },
];

export default function AgentScreen({ lang = "es", C, SF, onApplied }: { lang?: string; C: Record<string, string>; SF: string; onApplied?: () => void }) {
  const [mission, setMission] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ summary: string; steps: Step[] } | null>(null);
  const [copied, setCopied] = useState(false);
  const [deep, setDeep] = useState(false);
  const es = lang === "es";

  const run = async (m: string) => {
    if (busy || !m.trim()) return;
    setBusy(true);
    setResult(null);
    try {
      const r = await fetch("/api/agent/run", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mission: m, deep }) });
      const d = await r.json();
      if (d.error) setResult({ summary: es ? `Error: ${d.error}` : `Error: ${d.error}`, steps: [] });
      else setResult({ summary: d.summary || "", steps: d.steps || [] });
      if (onApplied) onApplied();
    } catch (e) {
      setResult({ summary: es ? "No se pudo conectar con el agente." : "Could not connect to the agent.", steps: [] });
    }
    setBusy(false);
  };

  const stepLabel = (s: Step) => {
    const base = TOOL_ES[s.tool] || s.tool;
    const err = s.output && typeof s.output === "object" && (s.output as { error?: string }).error;
    return err ? `${base} · error` : base;
  };

  return (
    <div style={{ fontFamily: SF, paddingTop: 6 }}>
      <div style={{ fontSize: 22, fontWeight: 600, color: C.text }}>🤖 {es ? "Agente" : "Agent"}</div>
      <div style={{ fontSize: 13.5, color: C.dim, marginTop: 4, lineHeight: 1.5 }}>
        {es ? "Dale una misión y el agente lee tus datos, ejecuta los pasos y te reporta." : "Give it a mission — the agent reads your data, runs the steps and reports back."}
      </div>

      <div style={{ marginTop: 18, background: C.surface, border: `1px solid ${C.borderSoft}`, borderRadius: 16, padding: 12 }}>
        <textarea
          value={mission}
          onChange={(e) => setMission(e.target.value)}
          placeholder={es ? "Ej. Revisa mis gastos de esta semana y categoriza los de Uber como negocio." : "e.g. Review this week's expenses and mark Uber trips as business."}
          rows={3}
          style={{ width: "100%", background: "transparent", border: "none", outline: "none", color: C.text, fontSize: 15, lineHeight: 1.5, resize: "vertical", fontFamily: SF }}
        />
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 8, paddingLeft: 2 }}>
          <button onClick={() => setDeep((v) => !v)} style={{ display: "flex", alignItems: "center", gap: 8, background: "transparent", border: "none", cursor: "pointer", fontFamily: SF, padding: 4 }}>
            <span style={{ width: 34, height: 20, borderRadius: 999, background: deep ? C.gold : C.surface2, border: `1px solid ${deep ? C.gold : C.border}`, position: "relative", transition: "background .2s" }}>
              <span style={{ position: "absolute", top: 1, left: deep ? 15 : 1, width: 16, height: 16, borderRadius: 999, background: deep ? "#ffffff" : C.mute, transition: "left .2s" }} />
            </span>
            <span style={{ fontSize: 12.5, color: deep ? C.gold : C.mute }}>🧠 {es ? "Modo profundo" : "Deep mode"}</span>
          </button>
          <span style={{ fontSize: 10.5, color: C.mute }}>{deep ? "Opus 4.8" : "Haiku 4.5"}</span>
        </div>
        <button
          onClick={() => run(mission)}
          disabled={busy || !mission.trim()}
          style={{ width: "100%", height: 44, marginTop: 8, borderRadius: 12, border: "none", background: C.red, color: "#ffffff", fontSize: 14.5, fontWeight: 600, cursor: mission.trim() && !busy ? "pointer" : "default", opacity: mission.trim() && !busy ? 1 : 0.5, fontFamily: SF }}
        >
          {busy ? (es ? "Ejecutando…" : "Running…") : (es ? "Ejecutar misión" : "Run mission")}
        </button>
      </div>

      <div style={{ marginTop: 18 }}>
        <div style={{ fontSize: 10.5, letterSpacing: "0.2em", color: C.dim, marginBottom: 10, textTransform: "uppercase" }}>{es ? "Misiones sugeridas" : "Suggested missions"}</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {PRESETS.map((p) => (
            <button key={p.label} onClick={() => { if (!p.mission) { setMission("Busca en internet: "); return; } setMission(p.mission); run(p.mission); }} disabled={busy} style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "12px 14px", borderRadius: 12, border: `1px solid ${C.borderSoft}`, background: C.surface, color: C.text, cursor: busy ? "default" : "pointer", fontFamily: SF, textAlign: "left", opacity: busy ? 0.5 : 1 }}>
              <span style={{ fontSize: 18, lineHeight: 1, flexShrink: 0 }}>{p.icon}</span>
              <span style={{ flex: 1, fontSize: 14 }}>{p.label}</span>
              <span style={{ color: C.mute, fontSize: 16 }}>›</span>
            </button>
          ))}
        </div>
      </div>

      {result && (
        <div style={{ marginTop: 18, background: C.surface, border: `1px solid ${C.goldSoft}`, borderRadius: 16, padding: "14px 16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <div style={{ fontSize: 10.5, letterSpacing: "0.2em", color: C.gold, textTransform: "uppercase" }}>{es ? "Resumen" : "Summary"}</div>
            {result.summary ? (
              <div style={{ display: "flex", gap: 6 }}>
                <button onClick={async () => { try { await navigator.clipboard.writeText(result.summary); setCopied(true); setTimeout(() => setCopied(false), 1500); } catch { /* noop */ } }} style={{ background: "transparent", border: `1px solid ${C.borderSoft}`, color: copied ? C.green : C.mute, fontSize: 11.5, padding: "5px 12px", borderRadius: 999, cursor: "pointer", fontFamily: SF }}>{copied ? (es ? "Copiado ✓" : "Copied ✓") : (es ? "Copiar" : "Copy")}</button>
                {typeof navigator !== "undefined" && (navigator as Navigator & { share?: unknown }).share ? (
                  <button onClick={() => { const nav = navigator as Navigator & { share?: (d: { text: string }) => Promise<void> }; nav.share?.({ text: result.summary }).catch(() => { /* user cancelled */ }); }} style={{ background: "transparent", border: `1px solid ${C.borderSoft}`, color: C.mute, fontSize: 11.5, padding: "5px 12px", borderRadius: 999, cursor: "pointer", fontFamily: SF }}>{es ? "↗ Compartir" : "↗ Share"}</button>
                ) : null}
              </div>
            ) : null}
          </div>
          <p style={{ margin: 0, fontSize: 14.5, color: C.text, lineHeight: 1.55, whiteSpace: "pre-wrap" }}>{result.summary}</p>
          {result.steps.length > 0 && (
            <div style={{ marginTop: 12, paddingTop: 10, borderTop: `1px solid ${C.borderSoft}` }}>
              <div style={{ fontSize: 10.5, letterSpacing: "0.15em", color: C.mute, textTransform: "uppercase", marginBottom: 6 }}>{es ? "Pasos" : "Steps"} · {result.steps.length}</div>
              {result.steps.map((s, i) => (<div key={i} style={{ fontSize: 12.5, color: C.dim, padding: "3px 0" }}>{i + 1}. {stepLabel(s)}</div>))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
