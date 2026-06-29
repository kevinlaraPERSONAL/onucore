"use client";

import { useState, useEffect } from "react";
import type { Session } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import OnucoreApp from "./_components/OnucoreApp";
import AuthScreen from "./_components/AuthScreen";

const SF = `-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Helvetica Neue", Helvetica, Arial, sans-serif`;

// Branded loading splash shown while the session is being checked (instead of a
// blank dark screen). Red accent — wordmark breathes, a ring spins, soft glow.
function LoadingScreen() {
  return (
    <div style={{ minHeight: "100vh", background: "#1A1A1F", color: "#ECEBE7", fontFamily: SF, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden" }}>
      <style>{`@keyframes ocSpin{to{transform:rotate(360deg);}}@keyframes ocPulse{0%,100%{opacity:.6;}50%{opacity:1;}}@keyframes ocGlow{0%,100%{opacity:.4;transform:scale(.9);}50%{opacity:.85;transform:scale(1.06);}}`}</style>
      <div aria-hidden style={{ position: "absolute", width: 380, height: 380, borderRadius: "50%", background: "radial-gradient(circle, rgba(229,72,77,.26), rgba(229,72,77,.06) 45%, transparent 70%)", animation: "ocGlow 2.8s ease-in-out infinite" }} />
      <div style={{ fontSize: 30, fontWeight: 600, letterSpacing: "0.14em", zIndex: 1, animation: "ocPulse 2.8s ease-in-out infinite" }}>
        onucore<span style={{ color: "#e5484d", fontSize: 13, verticalAlign: "super", marginLeft: 3, fontWeight: 700 }}>AI</span>
      </div>
      <div aria-hidden style={{ marginTop: 28, width: 30, height: 30, borderRadius: "50%", border: "3px solid rgba(229,72,77,.18)", borderTopColor: "#e5484d", animation: "ocSpin .8s linear infinite", zIndex: 1 }} />
    </div>
  );
}

// Auth gate: no session → login screen; session → the app.
// Everything renders only after the client checks the session, which also
// avoids any server/client hydration mismatch from the app's client-only state.
export default function Page() {
  const [ready, setReady] = useState(false);
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => sub.subscription.unsubscribe();
  }, []);

  if (!ready) return <LoadingScreen />;
  if (!session) return <AuthScreen />;
  return <OnucoreApp />;
}
