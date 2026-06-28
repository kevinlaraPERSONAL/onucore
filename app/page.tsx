"use client";

import { useState, useEffect } from "react";
import type { Session } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import OnucoreApp from "./_components/OnucoreApp";
import AuthScreen from "./_components/AuthScreen";

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

  if (!ready) return <div style={{ minHeight: "100vh", background: "#1A1A1F" }} />;
  if (!session) return <AuthScreen />;
  return <OnucoreApp />;
}
