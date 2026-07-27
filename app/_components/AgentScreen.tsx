"use client";
import { useState } from "react";

// Pantalla del Agente: le das una misión, él ejecuta pasos, reporta.
// Presets rápidos + input libre. Los pasos se muestran arriba del resumen.
type Step = { tool: string; input: unknown; output: unknown };

const TOOL_ES: Record<string, string> = {
  list_txns: "Leer movimientos",
  categorize_txn: "Recategorizar gasto",
  list_items: "Leer items",
  create_item: "Crear item",
  update_item: "Actualizar item",
  get_balances: "Leer saldos",
  list_tax_forms: "Leer formas fiscales",
  get_car: "Leer info del carro",
};

const PRESETS = [
  { icon: "💵", label: "Revisar mis gastos ambiguos", mission: "Revisa mis gastos de los últimos 14 días en la cuenta 'personal' (Empleado). Si alguno claramente parece de negocio (Uber, gasolina, comida con cliente, software), muévelo a cuenta 'business' con la categoría correcta y márcalo deducible. Explica qué moviste." },
  { icon: "🧾", label: "Deducibles perdidos en Oprinte", mission: "Busca gastos de la cuenta 'business' que estén categorizados como 'personal' y no deducibles. Recategorízalos con la categoría correcta del Schedule C (gas, food, tech, travel, software, office, phone, pro, education) y márcalos deducibles. Sé conservador." },
  { icon: "📅", label: "Preparar mis biles del mes", mission: "Revisa mis biles (obligation) del próximo mes. Si alguno no tiene fecha o repeat, arréglalo. Dime cuánto suma en total y en qué días caen." },
  { icon: "💼", label: "Estado de Oprinte este mes", mission: "Suma mis ingresos y gastos de la cuenta 'business' de este mes. Compara con el mes anterior. Dime el neto y si estoy creciendo." },
];

export default function AgentScreen({ lang = "es", C, SF, onApplied }: { lang?: string; C: Record<string, string>; SF: string; onApplied?: () => void }) {
  const [mission, setMission] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<{ summary: string; steps: Step[] } | null>(null);
  const es = lang === "es";

  const run = async (m: string) => {
    if (busy || !m.trim()) return;
    setBusy(true);
    setResult(null);
    try {
      const r = await fetch("/api/agent/run", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mission: m }) });
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
            <button key={p.label} onClick={() => { setMission(p.mission); run(p.mission); }} disabled={busy} style={{ display: "flex", alignItems: "center", gap: 12, width: "100%", padding: "12px 14px", borderRadius: 12, border: `1px solid ${C.borderSoft}`, background: C.surface, color: C.text, cursor: busy ? "default" : "pointer", fontFamily: SF, textAlign: "left", opacity: busy ? 0.5 : 1 }}>
              <span style={{ fontSize: 18, lineHeight: 1, flexShrink: 0 }}>{p.icon}</span>
              <span style={{ flex: 1, fontSize: 14 }}>{p.label}</span>
              <span style={{ color: C.mute, fontSize: 16 }}>›</span>
            </button>
          ))}
        </div>
      </div>

      {result && (
        <div style={{ marginTop: 18, background: C.surface, border: `1px solid ${C.goldSoft}`, borderRadius: 16, padding: "14px 16px" }}>
          <div style={{ fontSize: 10.5, letterSpacing: "0.2em", color: C.gold, marginBottom: 10, textTransform: "uppercase" }}>{es ? "Resumen" : "Summary"}</div>
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
