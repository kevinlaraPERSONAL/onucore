"use client";
import { useEffect, useState, useCallback } from "react";

// Real phone notifications (Web Push). On iPhone this only works once the app
// is added to the Home Screen (iOS 16.4+), so we guide the user there first.
function b64ToU8(base64: string) {
  const pad = "=".repeat((4 - (base64.length % 4)) % 4);
  const b = (base64 + pad).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

export default function PushCard({
  lang = "es",
  variant = "card",
  C,
  SF,
}: {
  lang?: string;
  variant?: "card" | "row";
  C: Record<string, string>;
  SF: string;
}) {
  const [state, setState] = useState("loading"); // loading|unsupported|need-install|off|on
  const [busy, setBusy] = useState(false);
  const [hidden, setHidden] = useState(false);
  const es = lang === "es";

  useEffect(() => {
    (async () => {
      if (typeof window === "undefined") return;
      if (variant === "card" && window.localStorage.getItem("onucore_push_hide") === "1") setHidden(true);
      const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
      const nav = navigator as Navigator & { standalone?: boolean };
      const standalone = window.matchMedia("(display-mode: standalone)").matches || nav.standalone === true;
      if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
        setState(isIOS && !standalone ? "need-install" : "unsupported");
        return;
      }
      try {
        const reg = await navigator.serviceWorker.register("/sw.js");
        const sub = await reg.pushManager.getSubscription();
        setState(sub ? "on" : "off");
      } catch {
        setState("unsupported");
      }
    })();
  }, [variant]);

  const enable = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setBusy(false);
        return;
      }
      const reg = await navigator.serviceWorker.ready;
      const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!key) {
        if (typeof window !== "undefined") window.alert(es ? "Falta configurar la llave de avisos (VAPID) en el servidor." : "Push key (VAPID) not configured yet.");
        setBusy(false);
        return;
      }
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToU8(key) });
      const r = await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscription: sub.toJSON() }),
      });
      if (r.ok) setState("on");
    } catch {
      /* noop */
    }
    setBusy(false);
  }, [busy, es]);

  const disable = async () => {
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch("/api/push/subscribe", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ endpoint: sub.endpoint }) });
        await sub.unsubscribe();
      }
    } catch {
      /* noop */
    }
    setState("off");
  };

  const installMsg = es
    ? "Para recibir avisos en tu iPhone: toca Compartir ⬆️ en Safari y elige “Agregar a pantalla de inicio”. Luego abre onucore desde ese ícono."
    : "To get alerts on your iPhone: tap Share ⬆️ in Safari and choose “Add to Home Screen”, then open onucore from that icon.";

  if (variant === "row") {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, padding: "10px 0", fontFamily: SF }}>
        <span style={{ fontSize: 14.5, color: C.text }}>{es ? "Avisos en este teléfono" : "Alerts on this phone"}</span>
        {state === "on" ? (
          <button onClick={disable} style={{ background: "transparent", border: `1px solid ${C.border}`, color: C.ok, borderRadius: 999, padding: "6px 13px", fontSize: 12.5, cursor: "pointer", fontFamily: SF }}>{es ? "Activados ✓" : "On ✓"}</button>
        ) : state === "off" ? (
          <button onClick={enable} disabled={busy} style={{ background: C.gold, border: "none", color: "#ffffff", borderRadius: 999, padding: "7px 14px", fontSize: 12.5, fontWeight: 600, cursor: "pointer", fontFamily: SF, opacity: busy ? 0.6 : 1 }}>{busy ? "…" : es ? "Activar" : "Enable"}</button>
        ) : (
          <span style={{ fontSize: 11.5, color: C.mute, maxWidth: 200, textAlign: "right" }}>{state === "need-install" ? (es ? "Agrega la app a tu pantalla de inicio" : "Add the app to your Home Screen") : es ? "No disponible en este navegador" : "Not available in this browser"}</span>
        )}
      </div>
    );
  }

  if (hidden || state === "loading" || state === "on" || state === "unsupported") return null;

  return (
    <div className="rise" style={{ marginTop: 12, background: C.surface, border: `1px solid ${C.goldSoft}`, borderRadius: 16, padding: "14px 16px", fontFamily: SF, position: "relative" }}>
      <button onClick={() => { setHidden(true); if (typeof window !== "undefined") window.localStorage.setItem("onucore_push_hide", "1"); }} style={{ position: "absolute", top: 8, right: 10, background: "transparent", border: "none", color: C.mute, fontSize: 14, cursor: "pointer" }}>✕</button>
      <div style={{ fontSize: 14.5, fontWeight: 600, color: C.text, marginBottom: 6 }}>🔔 {es ? "Avisos aunque la app esté cerrada" : "Alerts even with the app closed"}</div>
      {state === "need-install" ? (
        <div style={{ fontSize: 12.5, color: C.dim, lineHeight: 1.55 }}>{installMsg}</div>
      ) : (
        <>
          <div style={{ fontSize: 12.5, color: C.dim, lineHeight: 1.5, marginBottom: 10 }}>{es ? "“La renta vence en 3 días”, citas de hoy, el carro y los impuestos, directo a tu pantalla a las 9 AM." : "Bills due, today's events, car and taxes, right on your screen at 9 AM."}</div>
          <button onClick={enable} disabled={busy} style={{ background: C.gold, border: "none", color: "#ffffff", borderRadius: 10, padding: "10px 16px", fontSize: 13.5, fontWeight: 600, cursor: "pointer", fontFamily: SF, opacity: busy ? 0.6 : 1 }}>{busy ? "…" : es ? "Activar avisos" : "Enable alerts"}</button>
        </>
      )}
    </div>
  );
}
