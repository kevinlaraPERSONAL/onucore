"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

const C = {
  bg: "#1A1A1F", surface: "#242429", surface2: "#2C2C33", border: "#3B3B43",
  text: "#ECEBE7", dim: "#ABACB4", mute: "#7C7D85", red: "#e5484d",
};
const SF = `-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Helvetica Neue", Helvetica, Arial, sans-serif`;

type Lang = "en" | "es";

const TR: Record<Lang, Record<string, string>> = {
  en: {
    tagline: "Your personal chief of staff",
    login: "Sign in",
    signup: "Create account",
    emailPh: "you@email.com",
    pwPh: "Password (min. 6)",
    noAcct: "Don't have an account? ",
    haveAcct: "Already have an account? ",
    createOne: "Create one",
    signinLink: "Sign in",
    created: "Account created. Check your email to confirm it, then sign in.",
    badCreds: "Wrong email or password.",
    generic: "Something went wrong. Please try again.",
  },
  es: {
    tagline: "Tu jefe de gabinete personal",
    login: "Entrar",
    signup: "Crear cuenta",
    emailPh: "tu@correo.com",
    pwPh: "Contraseña (mín. 6)",
    noAcct: "¿No tienes cuenta? ",
    haveAcct: "¿Ya tienes cuenta? ",
    createOne: "Crea una",
    signinLink: "Entra",
    created: "Cuenta creada. Revisa tu correo para confirmarla y luego entra.",
    badCreds: "Correo o contraseña incorrectos.",
    generic: "Algo salió mal. Intenta de nuevo.",
  },
};

// Initial language: a saved choice wins; otherwise guess from the browser; else English.
function initialLang(): Lang {
  if (typeof window !== "undefined") {
    const saved = window.localStorage.getItem("onucore_lang");
    if (saved === "en" || saved === "es") return saved;
    if (typeof navigator !== "undefined" && navigator.language?.toLowerCase().startsWith("es")) return "es";
  }
  return "en";
}

function Eye() { return (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" /><circle cx="12" cy="12" r="3" /></svg>); }
function EyeOff() { return (<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20C5 20 1 12 1 12a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>); }

export default function AuthScreen() {
  const [lang, setLang] = useState<Lang>(initialLang);
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPw, setShowPw] = useState(false);
  const [msg, setMsg] = useState<{ kind: "err" | "ok"; text: string } | null>(null);
  const tr = TR[lang];

  // Persist the active language (even the auto-detected default) so the app
  // picks up the same language after login.
  useEffect(() => {
    if (typeof window !== "undefined") window.localStorage.setItem("onucore_lang", lang);
  }, [lang]);

  function pickLang(l: Lang) {
    setLang(l);
    setMsg(null);
  }

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
        if (data.session) {
          // Fresh account with an instant session: tell the app to run onboarding.
          if (typeof window !== "undefined") window.sessionStorage.setItem("onucore_onboard", "1");
          // The app swaps in automatically via the session listener.
        } else {
          setMsg({ kind: "ok", text: tr.created });
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: pw });
        if (error) throw error;
      }
    } catch (err) {
      let text = tr.generic;
      if (err instanceof Error) text = /invalid login credentials/i.test(err.message) ? tr.badCreds : err.message;
      setMsg({ kind: "err", text });
    } finally {
      setBusy(false);
    }
  }

  const input: React.CSSProperties = {
    width: "100%", background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 12,
    outline: "none", color: C.text, fontSize: 15.5, padding: "13px 15px", fontFamily: SF, marginTop: 10,
  };

  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: SF, display: "flex", alignItems: "center", justifyContent: "center", padding: 20, position: "relative", overflow: "hidden" }}>
      <style>{`@keyframes obGlow{0%,100%{opacity:.8;}50%{opacity:1;}}`}</style>
      <div aria-hidden style={{ position: "absolute", inset: 0, pointerEvents: "none", zIndex: 0, background: "radial-gradient(96% 62% at 50% 114%, rgba(229,72,77,.44), rgba(229,72,77,.16) 44%, transparent 76%)", animation: "obGlow 7s ease-in-out infinite" }} />
      <div aria-hidden style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: "44%", pointerEvents: "none", zIndex: 0, background: "radial-gradient(58% 100% at 50% 126%, rgba(229,72,77,.58), transparent 72%)", animation: "obGlow 7s ease-in-out infinite" }} />
      <div style={{ position: "absolute", top: 18, right: 18, display: "flex", gap: 3, background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 999, padding: 3, zIndex: 2 }}>
        {(["es", "en"] as Lang[]).map((l) => (
          <button key={l} type="button" onClick={() => pickLang(l)} style={{ background: lang === l ? C.red : "transparent", color: lang === l ? "#ffffff" : C.dim, border: "none", borderRadius: 999, padding: "5px 11px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: SF }}>{l.toUpperCase()}</button>
        ))}
      </div>

      <div style={{ width: "100%", maxWidth: 380, position: "relative", zIndex: 1 }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div style={{ fontSize: 30, fontWeight: 600, letterSpacing: "0.14em" }}>
            onucore<span style={{ color: C.red, fontSize: 13, verticalAlign: "super", marginLeft: 3, fontWeight: 700 }}>AI</span>
          </div>
          <div style={{ fontSize: 13.5, color: C.dim, marginTop: 8 }}>{tr.tagline}</div>
        </div>

        <form onSubmit={submit} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 18, padding: "20px 18px" }}>
          <div style={{ fontSize: 16, fontWeight: 600 }}>{mode === "login" ? tr.login : tr.signup}</div>
          <input style={input} type="email" required placeholder={tr.emailPh} value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
          <div style={{ position: "relative", marginTop: 10 }}>
            <input style={{ ...input, marginTop: 0, paddingRight: 46 }} type={showPw ? "text" : "password"} required minLength={6} placeholder={tr.pwPh} value={pw} onChange={(e) => setPw(e.target.value)} autoComplete={mode === "login" ? "current-password" : "new-password"} />
            <button type="button" tabIndex={-1} onClick={() => setShowPw((v) => !v)} aria-label={showPw ? (lang === "es" ? "Ocultar contraseña" : "Hide password") : (lang === "es" ? "Mostrar contraseña" : "Show password")} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", width: 34, height: 34, display: "flex", alignItems: "center", justifyContent: "center", background: "transparent", border: "none", color: showPw ? C.red : C.mute, cursor: "pointer", padding: 0 }}>
              {showPw ? <EyeOff /> : <Eye />}
            </button>
          </div>

          {msg && (
            <div style={{ marginTop: 12, fontSize: 13, color: msg.kind === "err" ? C.red : C.dim, lineHeight: 1.45 }}>{msg.text}</div>
          )}

          <button type="submit" disabled={busy} style={{ width: "100%", height: 48, marginTop: 16, borderRadius: 12, border: "none", background: C.red, color: "#ffffff", fontSize: 15, fontWeight: 600, cursor: busy ? "default" : "pointer", fontFamily: SF, opacity: busy ? 0.7 : 1 }}>
            {busy ? "…" : mode === "login" ? tr.login : tr.signup}
          </button>
        </form>

        <div style={{ textAlign: "center", marginTop: 16, fontSize: 13.5, color: C.dim }}>
          {mode === "login" ? tr.noAcct : tr.haveAcct}
          <button onClick={() => { setMode(mode === "login" ? "signup" : "login"); setMsg(null); }} style={{ background: "none", border: "none", color: C.red, cursor: "pointer", fontFamily: SF, fontSize: 13.5, fontWeight: 600, padding: 0 }}>
            {mode === "login" ? tr.createOne : tr.signinLink}
          </button>
        </div>
      </div>
    </div>
  );
}
