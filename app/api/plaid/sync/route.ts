import { plaidClient } from "@/lib/plaid";
import { createClient as createServerSupabase } from "@/lib/supabase/server";

// Pulls the connected bank(s): recurring charges → subscriptions, and recent
// transactions → income/expenses. De-dupes (plaid_id on txns, title on subs).
// Retries briefly on PRODUCT_NOT_READY (Plaid needs a few seconds after linking).
export const runtime = "nodejs";
export const maxDuration = 30;

const FREQ: Record<string, string> = {
  WEEKLY: "weekly",
  BIWEEKLY: "monthly",
  MONTHLY: "monthly",
  SEMI_MONTHLY: "monthly",
  ANNUALLY: "yearly",
  UNKNOWN: "monthly",
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Retry a Plaid call while it reports PRODUCT_NOT_READY (data still preparing).
async function ready<T>(fn: () => Promise<T>): Promise<T> {
  for (let i = 0; i < 4; i++) {
    try {
      return await fn();
    } catch (e) {
      const code = (e as { response?: { data?: { error_code?: string } } })?.response?.data?.error_code;
      if (code === "PRODUCT_NOT_READY" && i < 3) {
        await sleep(3000);
        continue;
      }
      throw e;
    }
  }
  throw new Error("not_ready");
}

export async function POST() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  const { data: items } = await supabase.from("plaid_items").select("*").eq("user_id", user.id);
  if (!items || !items.length) return Response.json({ error: "no_bank", subsAdded: 0, txnsAdded: 0 }, { status: 400 });

  const client = plaidClient();
  const { data: existSubs } = await supabase
    .from("items")
    .select("title")
    .eq("user_id", user.id)
    .eq("type", "subscription");
  const seen = new Set((existSubs || []).map((s: { title?: string }) => (s.title || "").toLowerCase()));

  let subsAdded = 0;
  let txnsAdded = 0;
  const errors: string[] = [];

  for (const it of items) {
    // recent transactions → income / expenses
    try {
      const end = new Date().toISOString().slice(0, 10);
      const start = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
      const tx = await ready(() =>
        client.transactionsGet({
          access_token: it.access_token,
          start_date: start,
          end_date: end,
          options: { count: 250, offset: 0 },
        }),
      );
      const rows = (tx.data.transactions || [])
        .filter((t) => !t.pending)
        .map((t) => ({
          user_id: user.id,
          kind: t.amount > 0 ? "expense" : "income",
          amount: Math.abs(t.amount),
          cat: t.amount > 0 ? "personal" : "other_income",
          account: it.label || "personal",
          date_iso: t.date,
          note: t.merchant_name || t.name || "",
          ded: false,
          source: "plaid",
          plaid_id: t.transaction_id,
        }));
      if (rows.length) {
        const ids = rows.map((r) => r.plaid_id);
        const { data: existing } = await supabase.from("txns").select("plaid_id").eq("user_id", user.id).in("plaid_id", ids);
        const have = new Set((existing || []).map((x: { plaid_id: string }) => x.plaid_id));
        const fresh = rows.filter((r) => !have.has(r.plaid_id));
        if (fresh.length) {
          const ins = await supabase.from("txns").insert(fresh);
          if (ins.error) errors.push("ins:" + ins.error.message);
          else txnsAdded += fresh.length;
        }
      }
    } catch (e) {
      errors.push("tx:" + ((e as { message?: string })?.message || "err"));
    }

    // recurring outflow streams → subscriptions
    try {
      const rec = await ready(() => client.transactionsRecurringGet({ access_token: it.access_token }));
      for (const s of rec.data.outflow_streams || []) {
        const title = s.merchant_name || s.description || "Subscription";
        if (seen.has(title.toLowerCase())) continue;
        seen.add(title.toLowerCase());
        const amount = Math.abs(s.average_amount?.amount || s.last_amount?.amount || 0);
        await supabase.from("items").insert({
          user_id: user.id,
          type: "subscription",
          area: "personal",
          title,
          amount,
          date_iso: s.last_date || null,
          date_label: FREQ[s.frequency] || "monthly",
          source: "plaid",
        });
        subsAdded++;
      }
    } catch (e) {
      errors.push("rec:" + ((e as { message?: string })?.message || "err"));
    }
  }

  return Response.json({ subsAdded, txnsAdded, errors });
}
