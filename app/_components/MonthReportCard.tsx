"use client";
import { useCallback, useEffect, useState } from "react";

// Aparece los primeros 5 días del mes con el resumen automático del mes previo.
// El usuario puede pedir refrescar o cerrarlo (se oculta hasta el próximo mes).
export default function MonthReportCard({ lang = "es", C, SF }: { lang?: string; C: Record<string, string>; SF: string }) {
  const [text, setText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [hidden, setHidden] = useState(false);
  const es = lang === "es";
  const now = new Date();
  const monthKey = `${now.getFullYear()}-${now.getMonth()}`;
  const early = now.getDate() <= 5;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const r = await fetch("/api/report-month", { method: "POST" });
      const d = await r.json();
      setText(d.text || null);
    } catch { setText(null); }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.localStorage.getItem(`onucore_month_report_dismiss:${monthKey}`) === "1") { setHidden(true); return; }
    if (!early) return;
    if (window.localStorage.getItem(`onucore_month_report_loaded:${monthKey}`) === "1") return;
    window.localStorage.setItem(`onucore_month_report_loaded:${monthKey}`, "1");
    load();
  }, [early, monthKey, load]);

  if (hidden) return null;
  if (!early && !text) return null;

  const dismiss = () => { setHidden(true); if (typeof window !== "undefined") window.localStorage.setItem(`onucore_month_report_dismiss:${monthKey}`, "1"); };

  const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1).toLocaleDateString("es-MX", { month: "long" });
  return (
    <div className="rise" style={{ marginTop: 12, background: C.surface, border: `1px solid ${C.borderSoft}`, borderRadius: 18, padding: "14px 18px", fontFamily: SF, position: "relative" }}>
      <button onClick={dismiss} style={{ position: "absolute", top: 8, right: 10, background: "transparent", border: "none", color: C.mute, fontSize: 15, cursor: "pointer" }}>✕</button>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, paddingRight: 22 }}>
        <div style={{ fontSize: 9.5, letterSpacing: "0.26em", color: C.gold, textTransform: "uppercase" }}>📅 {es ? `Cómo te fue en ${prev}` : "Last month recap"}</div>
        <button onClick={load} disabled={loading} style={{ background: "transparent", border: `1px solid ${C.borderSoft}`, color: C.mute, fontSize: 11.5, padding: "5px 12px", borderRadius: 999, cursor: "pointer", fontFamily: SF, opacity: loading ? 0.5 : 1, marginRight: 8 }}>↻</button>
      </div>
      {loading ? (<div className="shimmer" style={{ height: 14, borderRadius: 6, width: "94%" }} />)
        : text ? (<p style={{ margin: 0, fontSize: 14.5, lineHeight: 1.5, color: C.text }}>{text}</p>)
        : (<div style={{ fontSize: 13, color: C.mute }}>{es ? "Sin datos suficientes del mes previo." : "Not enough data for last month."}</div>)}
    </div>
  );
}
