"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const C = {
  bg: "#1A1A1F", surface: "#242429", surface2: "#2C2C33", border: "#3B3B43",
  text: "#ECEBE7", dim: "#ABACB4", mute: "#7C7D85", red: "#e5484d",
};
const SF = `-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Helvetica Neue", Helvetica, Arial, sans-serif`;

export default function AuthScreen() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "err" | "ok"; text: string } | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setMsg(null);
    const supabase = createClient();
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password: pw });
        if (error) throw error;
        if (!data.session) {
          setMsg({ kind: "ok", text: "Cuenta creada. Revisa tu correo para confirmarla y luego entra." });
        }
        // If confirmation is disabled, a session is returned and the app swaps in automatically.
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: pw });
        if (error) throw error;
      }
    } catch (err) {
      const m = err instanceof Error ? err.message : "Algo salió mal. Intenta de nuevo.";
      setMsg({ kind: "err", text: m });
    } finally {
      setBusy(false);
    }
  }

  const input: React.CSSProperties = {
    width: "100%", background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 12,
    outline: "none", color: C.text, fontSize: 15.5, padding: "13px 15px", fontFamily: SF, marginTop: 10,
  };

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: SF, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
      <div style={{ width: "100%", maxWidth: 380 }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 30, fontWeight: 600, letterSpacing: "0.14em" }}>
            onucore<span style={{ color: C.red, fontSize: 13, verticalAlign: "super", marginLeft: 3, fontWeight: 700 }}>AI</span>
          </div>
          <div style={{ fontSize: 13.5, color: C.dim, marginTop: 8 }}>Tu jefe de gabinete personal</div>
        </div>

        <form onSubmit={submit} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 18, padding: "20px 18px" }}>
          <div style={{ fontSize: 16, fontWeight: 600 }}>{mode === "login" ? "Entrar" : "Crear cuenta"}</div>
          <input style={input} type="email" required placeholder="tu@correo.com" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          <input style={input} type="password" required minLength={6} placeholder="Contraseña (mín. 6)" value={pw} onChange={(e) => setPw(e.target.value)} autoComplete={mode === "login" ? "current-password" : "new-password"} />

          {msg && (
            <div style={{ marginTop: 12, fontSize: 13, color: msg.kind === "err" ? C.red : C.dim, lineHeight: 1.45 }}>{msg.text}</div>
          )}

          <button type="submit" disabled={busy} style={{ width: "100%", height: 48, marginTop: 16, borderRadius: 12, border: "none", background: C.red, color: "#ffffff", fontSize: 15, fontWeight: 600, cursor: busy ? "default" : "pointer", fontFamily: SF, opacity: busy ? 0.7 : 1 }}>
            {busy ? "…" : mode === "login" ? "Entrar" : "Crear cuenta"}
          </button>
        </form>

        <div style={{ textAlign: "center", marginTop: 16, fontSize: 13.5, color: C.dim }}>
          {mode === "login" ? "¿No tienes cuenta? " : "¿Ya tienes cuenta? "}
          <button onClick={() => { setMode(mode === "login" ? "signup" : "login"); setMsg(null); }} style={{ background: "none", border: "none", color: C.red, cursor: "pointer", fontFamily: SF, fontSize: 13.5, fontWeight: 600, padding: 0 }}>
            {mode === "login" ? "Crea una" : "Entra"}
          </button>
        </div>
      </div>
    </div>
  );
}
