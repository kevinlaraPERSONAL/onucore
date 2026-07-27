import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";

// Daily 9 AM (LA) digest → push notification with the app closed:
// bills due soon, today's appointments, car services and quarterly taxes.
// Runs via Vercel Cron; protected with CRON_SECRET.
export const runtime = "nodejs";
export const maxDuration = 60;

const LA_TZ = "America/Los_Angeles";
const laToday = () => new Date().toLocaleDateString("en-CA", { timeZone: LA_TZ });
const daysFrom = (todayISO: string, iso: string) =>
  Math.round((new Date(iso + "T00:00:00").getTime() - new Date(todayISO + "T00:00:00").getTime()) / 864e5);

export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const pub = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const svc = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!pub || !priv || !svc || !url) return Response.json({ error: "unconfigured" }, { status: 500 });

  webpush.setVapidDetails(process.env.VAPID_SUBJECT || "mailto:hello@onucore.app", pub, priv);
  const admin = createClient(url, svc, { auth: { persistSession: false } });

  const { data: subs } = await admin.from("push_subs").select("*");
  if (!subs || !subs.length) return Response.json({ ok: true, sent: 0, reason: "no_subs" });

  // Test mode (?test=1): send a hello to every registered device, no matter what.
  if (new URL(request.url).searchParams.get("test") === "1") {
    let tSent = 0;
    const tErr: string[] = [];
    const hello = JSON.stringify({ title: "onucore", body: "🎉 ¡Avisos activados! Así te llegarán tus biles, citas, carro e impuestos.", url: "/" });
    for (const s of subs) {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, hello);
        tSent++;
      } catch (e) {
        tErr.push("t:" + ((e as { statusCode?: number })?.statusCode || "err"));
      }
    }
    return Response.json({ ok: true, sent: tSent, test: true, errors: tErr });
  }

  const byUser = new Map<string, typeof subs>();
  for (const s of subs) {
    const arr = byUser.get(s.user_id) || [];
    arr.push(s);
    byUser.set(s.user_id, arr);
  }

  const today = laToday();
  const yq = Number(today.slice(0, 4));
  let sent = 0;
  const errors: string[] = [];

  for (const [uid, userSubs] of byUser) {
    try {
      const lines: string[] = [];

      const { data: items } = await admin
        .from("items")
        .select("type,title,amount,date_iso,done,repeat")
        .eq("user_id", uid);
      const its = items || [];

      // Bills due within 3 days (or overdue)
      const bills = its
        .filter((i) => i.type === "obligation" && !i.done && i.date_iso)
        .map((i) => ({ ...i, du: daysFrom(today, i.date_iso) }))
        .filter((i) => i.du <= 3)
        .sort((a, b) => a.du - b.du);
      for (const b of bills.slice(0, 2)) {
        const when = b.du < 0 ? `venció hace ${-b.du} día(s)` : b.du === 0 ? "vence HOY" : `vence en ${b.du} día(s)`;
        lines.push(`💳 ${b.title} ${when}${b.amount ? ` · $${Number(b.amount).toFixed(0)}` : ""}`);
      }

      // Today's appointments
      const evs = its.filter((i) => i.type === "event" && i.date_iso === today);
      if (evs.length) lines.push(`📅 ${evs.length === 1 ? `Hoy: ${evs[0].title}` : `${evs.length} citas hoy`}`);

      // Car services due within 7 days
      const { data: cars } = await admin.from("car_records").select("kind,title,due_iso").eq("user_id", uid);
      const KIND: Record<string, string> = { oil: "Cambio de aceite", registration: "Placas", insurance: "Seguro del carro", tires: "Llantas", brakes: "Frenos", inspection: "Inspección", service: "Servicio del carro" };
      const car = (cars || [])
        .filter((r) => r.due_iso)
        .map((r) => ({ ...r, du: daysFrom(today, r.due_iso) }))
        .filter((r) => r.du <= 7)
        .sort((a, b) => a.du - b.du)[0];
      if (car) lines.push(`🚗 ${car.title || KIND[car.kind] || "Servicio"} ${car.du < 0 ? "vencido" : car.du === 0 ? "vence hoy" : `en ${car.du} día(s)`}`);

      // Quarterly estimated taxes within 5 days
      const q = [`${yq}-04-15`, `${yq}-06-15`, `${yq}-09-15`, `${yq + 1}-01-15`]
        .map((d) => ({ d, du: daysFrom(today, d) }))
        .find((x) => x.du >= 0 && x.du <= 5);
      if (q) lines.push(`💵 Pago trimestral de impuestos ${q.du === 0 ? "HOY" : `en ${q.du} día(s)`}`);

      // Low balance vs bills coming in the next 7 days
      const { data: acctBalances } = await admin
        .from("plaid_accounts")
        .select("label,balance_available,balance_current")
        .eq("user_id", uid);
      if (acctBalances && acctBalances.length) {
        const bills7 = { personal: 0, business: 0 };
        its
          .filter((i) => i.type === "obligation" && !i.done && i.date_iso)
          .forEach((o) => {
            const du = daysFrom(today, o.date_iso);
            if (du < 0 || du > 7) return;
            // items don't carry an account tag; assume personal unless area=work
            bills7.personal += Number(o.amount || 0);
          });
        const sumFor = (label: string) => acctBalances.filter((a) => a.label === label).reduce((s, a) => s + Number(a.balance_available ?? a.balance_current ?? 0), 0);
        const pAvail = sumFor("personal");
        if (bills7.personal > 0 && pAvail > 0 && pAvail < bills7.personal) {
          lines.push(`⚠️ Saldo bajo: cuenta Empleado tiene $${pAvail.toFixed(0)} y vienen $${bills7.personal.toFixed(0)} en biles`);
        }
      }

      if (!lines.length) continue; // nothing urgent → no noise

      const payload = JSON.stringify({ title: "onucore", body: lines.join("\n"), url: "/" });
      for (const s of userSubs) {
        try {
          await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload);
          sent++;
        } catch (e) {
          const code = (e as { statusCode?: number })?.statusCode;
          if (code === 404 || code === 410) await admin.from("push_subs").delete().eq("endpoint", s.endpoint);
          else errors.push(`send:${code}`);
        }
      }
    } catch (e) {
      errors.push("user:" + ((e as { message?: string })?.message || "err"));
    }
  }

  return Response.json({ ok: true, sent, errors });
}
