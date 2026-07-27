"use client";
import { useEffect, useState } from "react";

// Saldos vivos + alerta si el saldo disponible no alcanza para los biles
// próximos 7 días. Se refresca al abrir la app (el sync de Plaid ya lo hace).
type Acct = { account_id: string; name: string | null; mask: string | null; label: string; balance_available: number | null; balance_current: number | null };

const money = (n: number, loc = "en-US") => new Intl.NumberFormat(loc, { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n || 0);

export default function BalanceCard({
  lang = "es",
  loc = "en-US",
  billsNext7ByAccount,
  C,
  SF,
}: {
  lang?: string;
  loc?: string;
  billsNext7ByAccount: { personal: number; business: number };
  C: Record<string, string>;
  SF: string;
}) {
  const [accts, setAccts] = useState<Acct[] | null>(null);
  const es = lang === "es";

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch("/api/plaid/accounts");
        const d = await r.json();
        setAccts(Array.isArray(d.accounts) ? d.accounts : []);
      } catch {
        setAccts([]);
      }
    })();
  }, []);

  if (!accts || accts.length === 0) return null;

  const byLabel: Record<string, Acct[]> = { personal: [], business: [] };
  accts.forEach((a) => { (byLabel[a.label] || (byLabel[a.label] = [])).push(a); });
  const sumAvail = (arr: Acct[]) => arr.reduce((s, a) => s + (Number(a.balance_available ?? a.balance_current) || 0), 0);
  const personalAvail = sumAvail(byLabel.personal || []);
  const businessAvail = sumAvail(byLabel.business || []);
  const personalGap = billsNext7ByAccount.personal - personalAvail;
  const businessGap = billsNext7ByAccount.business - businessAvail;
  const alerts: string[] = [];
  if (personalAvail > 0 && personalGap > 0)
    alerts.push(es
      ? `Cuidado: tu cuenta Empleado tiene ${money(personalAvail, loc)} y vienen biles por ${money(billsNext7ByAccount.personal, loc)} en 7 días.`
      : `Heads up: your Employee account has ${money(personalAvail, loc)} and ${money(billsNext7ByAccount.personal, loc)} in bills is due within 7 days.`);
  if (businessAvail > 0 && businessGap > 0)
    alerts.push(es
      ? `Ojo con Oprinte: ${money(businessAvail, loc)} disponibles y ${money(billsNext7ByAccount.business, loc)} por pagar pronto.`
      : `Heads up on Oprinte: ${money(businessAvail, loc)} available, ${money(billsNext7ByAccount.business, loc)} in bills coming.`);

  return (
    <div className="rise" style={{ marginTop: 12, background: C.surface, border: `1px solid ${alerts.length ? C.red : C.borderSoft}`, borderRadius: 18, padding: "14px 18px 12px", fontFamily: SF }}>
      <div style={{ fontSize: 9.5, letterSpacing: "0.26em", color: alerts.length ? C.red : C.gold, textTransform: "uppercase", marginBottom: 10 }}>💵 {es ? "Saldos" : "Balances"}</div>
      {accts.map((a) => {
        const avail = Number(a.balance_available ?? a.balance_current);
        const low = a.label === "personal" ? billsNext7ByAccount.personal > 0 && avail < billsNext7ByAccount.personal : a.label === "business" ? billsNext7ByAccount.business > 0 && avail < billsNext7ByAccount.business : false;
        return (
          <div key={a.account_id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderTop: `1px solid ${C.borderSoft}` }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13.5, color: C.text }}>{a.label === "business" ? "Oprinte" : es ? "Empleado" : "Employee"}<span style={{ color: C.mute, fontWeight: 400 }}> · {a.name || (es ? "Cuenta" : "Account")}{a.mask ? ` •• ${a.mask}` : ""}</span></div>
            </div>
            <span className="num" style={{ fontSize: 15, fontWeight: 600, color: low ? C.red : C.text, flexShrink: 0 }}>{Number.isFinite(avail) ? money(avail, loc) : "—"}</span>
          </div>
        );
      })}
      {alerts.map((txt, i) => (
        <div key={i} style={{ fontSize: 12.5, color: C.red, marginTop: 10, lineHeight: 1.5 }}>⚠️ {txt}</div>
      ))}
    </div>
  );
}
