"use client";
import { useEffect, useState, useCallback } from "react";

// Lists the accounts of the connected bank(s) and lets the user tag each one as
// Personal or Oprinte. One bank login (e.g. Chase) can hold both, so tagging is
// per-account, not per-connection. Changing a tag re-labels its transactions.
type Acct = { id: number; account_id: string; name: string | null; mask: string | null; label: string };

export default function PlaidAccounts({
  lang = "es",
  C,
  SF,
}: {
  lang?: string;
  C: Record<string, string>;
  SF: string;
}) {
  const [accts, setAccts] = useState<Acct[] | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const es = lang === "es";

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/plaid/accounts");
      const d = await r.json();
      setAccts(Array.isArray(d.accounts) ? d.accounts : []);
    } catch {
      setAccts([]);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const setLabel = async (account_id: string, label: string) => {
    setSaving(account_id);
    try {
      await fetch("/api/plaid/relabel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ account_id, label }),
      });
    } catch {
      /* noop */
    }
    if (typeof window !== "undefined") window.location.reload();
  };

  if (!accts || accts.length === 0) return null;

  return (
    <div style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 11.5, color: C.mute, fontFamily: SF, marginBottom: 8, paddingLeft: 2 }}>
        {es ? "Marca cada cuenta" : "Tag each account"}
      </div>
      {accts.map((a) => {
        const tag = (val: string, txt: string) => {
          const on = a.label === val;
          return (
            <button
              key={val}
              disabled={saving === a.account_id}
              onClick={() => a.label !== val && setLabel(a.account_id, val)}
              style={{
                padding: "6px 13px",
                borderRadius: 999,
                border: on ? "none" : `1px solid ${C.border}`,
                background: on ? C.gold : "transparent",
                color: on ? "#ffffff" : C.dim,
                fontSize: 12.5,
                fontWeight: 600,
                fontFamily: SF,
                cursor: "pointer",
                opacity: saving === a.account_id ? 0.5 : 1,
              }}
            >
              {txt}
            </button>
          );
        };
        return (
          <div
            key={a.account_id}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 10,
              padding: "10px 12px",
              borderRadius: 12,
              border: `1px solid ${C.border}`,
              marginBottom: 8,
            }}
          >
            <div style={{ minWidth: 0, fontFamily: SF }}>
              <div style={{ fontSize: 14, color: C.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {a.name || (es ? "Cuenta" : "Account")}
              </div>
              <div style={{ fontSize: 11.5, color: C.mute, marginTop: 2 }}>
                {a.mask ? `•• ${a.mask}` : a.account_id.slice(-4)}
              </div>
            </div>
            <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
              {tag("personal", es ? "Empleado" : "Employee")}
              {tag("business", es ? "Contratista" : "Contractor")}
            </div>
          </div>
        );
      })}
    </div>
  );
}
