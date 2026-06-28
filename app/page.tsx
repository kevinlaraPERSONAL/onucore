"use client";

import { useState, useEffect } from "react";
import OnucoreApp from "./_components/OnucoreApp";

// The app holds rich client-only state (random ids, dates, speech recognition,
// a fetch override, etc.), so we render it only after mount to avoid any
// server/client hydration mismatch.
export default function Page() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return <div style={{ minHeight: "100vh", background: "#1A1A1F" }} />;
  return <OnucoreApp />;
}
