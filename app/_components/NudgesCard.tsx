"use client";
import { useCallback, useEffect, useState } from "react";

// Bandeja de sugerencias de la IA en Hoy. Refresca al montar (max cada 4 h),
// pinta las pendientes con ✓ y ✕. Cada acción se aplica en el servidor y la
// tarjeta se refresca; si no hay nada, no se muestra (no ocupa espacio).
type Nudge = { id: number; kind: string; text: string };

export default function NudgesCard({
  lang = "es",
  C,
  SF,
  onApplied,
}: {
  lang?: string;
  C: Record<string, string>;
  SF: string;
  onApplied?: () => void;
}) {
  const [nudges, setNudges] = useState<Nudge[] | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const es = lang === "es";

  const load = useCallback(async (regen = false) => {
    try {
      const r = await fetch("/api/nudges", { method: regen ? "POST" : "GET" });
      const d = await r.json();
      setNudges(Array.isArray(d.nudges) ? d.nudges : []);
    } catch {
      setNudges([]);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const key = "onucore_nudges_at";
    const last = Number(window.localStorage.getItem(key) || 0);
    const stale = Date.now() - last > 4 * 3600e3;
    if (stale) {
      window.localStorage.setItem(key, String(Date.now()));
      load(true);
    } else {
      load(false);
    }
  }, [load]);

  const act = async (id: number, decision: "accept" | "dismiss") => {
    setBusy(id);
    try {
      await fetch("/api/nudges/act", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, decision }),
      });
      setNudges((ns) => (ns || []).filter((n) => n.id !== id));
      if (decision === "accept" && onApplied) onApplied();
    } catch {
      /* noop */
    }
    setBusy(null);
  };

  if (!nudges || nudges.length === 0) return null;

  return (
    <div className="rise" style={{ marginTop: 12, background: C.surface, border: `1px solid ${C.borderSoft}`, borderRadius: 18, padding: "14px 16px 8px", fontFamily: SF }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
        <div style={{ fontSize: 9.5, letterSpacing: "0.26em", color: C.gold, textTransform: "uppercase" }}>🧠 {es ? "Sugerencias" : "Suggestions"}</div>
        <span style={{ fontSize: 11, color: C.mute }}>{nudges.length}</span>
      </div>
      {nudges.slice(0, 4).map((n) => (
        <div key={n.id} style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: "10px 0", borderTop: `1px solid ${C.borderSoft}` }}>
          <div style={{ flex: 1, minWidth: 0, fontSize: 13.5, color: C.text, lineHeight: 1.45 }}>{n.text}</div>
          <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
            <button disabled={busy === n.id} onClick={() => act(n.id, "accept")} style={{ width: 34, height: 34, borderRadius: 999, border: "none", background: C.green, color: "#ffffff", cursor: "pointer", fontSize: 15, fontFamily: SF, opacity: busy === n.id ? 0.5 : 1 }}>✓</button>
            <button disabled={busy === n.id} onClick={() => act(n.id, "dismiss")} style={{ width: 34, height: 34, borderRadius: 999, border: `1px solid ${C.border}`, background: "transparent", color: C.mute, cursor: "pointer", fontSize: 14, fontFamily: SF, opacity: busy === n.id ? 0.5 : 1 }}>✕</button>
          </div>
        </div>
      ))}
    </div>
  );
}
