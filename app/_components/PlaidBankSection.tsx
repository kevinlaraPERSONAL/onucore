"use client";
import { useEffect, useState } from "react";
import PlaidConnect from "./PlaidConnect";
import PlaidAccounts from "./PlaidAccounts";

// The bank area under Suscripciones. Shows a single "Connect bank" button when no
// bank is linked; once linked, it shows only the per-account tags + sync/disconnect
// (no Plaid-opening buttons), so tagging an account never re-opens Plaid Link.
export default function PlaidBankSection({
  lang = "es",
  C,
  SF,
}: {
  lang?: string;
  C: Record<string, string>;
  SF: string;
}) {
  const [count, setCount] = useState<number | null>(null);
  const es = lang === "es";
  const reload = () => {
    if (typeof window !== "undefined") window.location.reload();
  };

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/plaid/accounts");
        const d = await r.json();
        setCount(Array.isArray(d.accounts) ? d.accounts.length : 0);
      } catch {
        setCount(0);
      }
    })();
  }, []);

  const sync = async () => {
    const r = await fetch("/api/plaid/sync", { method: "POST" });
    if (r.ok) reload();
  };
  const disconnect = async () => {
    if (typeof window !== "undefined" && !window.confirm(es ? "¿Desconectar el banco y borrar los datos importados?" : "Disconnect bank and delete imported data?")) return;
    await fetch("/api/plaid/disconnect", { method: "POST" });
    reload();
  };

  const link: React.CSSProperties = {
    display: "block",
    width: "100%",
    background: "transparent",
    border: "none",
    color: C.mute,
    fontSize: 11.5,
    cursor: "pointer",
    fontFamily: SF,
    marginTop: 2,
    marginBottom: 10,
  };

  if (count === null) return null;

  // No bank linked yet → one clear connect button.
  if (count === 0) {
    return (
      <div style={{ marginBottom: 12 }}>
        <PlaidConnect
          accountLabel="personal"
          label={es ? "🏦 Conectar banco" : "🏦 Connect bank"}
          onDone={reload}
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            width: "100%",
            padding: "12px",
            borderRadius: 12,
            border: "none",
            background: C.gold,
            color: "#ffffff",
            cursor: "pointer",
            fontFamily: SF,
            fontSize: 13.5,
            fontWeight: 600,
          }}
        />
        <button onClick={sync} style={{ ...link, marginTop: 10 }}>
          ↻ {es ? "Sincronizar (si ya conectaste el banco)" : "Sync (if bank already connected)"}
        </button>
      </div>
    );
  }

  // Bank linked → tags + maintenance only, nothing that re-opens Plaid.
  return (
    <div style={{ marginBottom: 4 }}>
      <PlaidAccounts lang={lang} C={C} SF={SF} />
      <button onClick={sync} style={link}>
        ↻ {es ? "Sincronizar movimientos" : "Sync transactions"}
      </button>
      <button onClick={disconnect} style={link}>
        {es ? "Desconectar / limpiar banco" : "Disconnect / clear bank"}
      </button>
    </div>
  );
}
