import { plaidClient } from "@/lib/plaid";
import { createClient as createServerSupabase } from "@/lib/supabase/server";

// Pulls the connected bank(s): recurring charges → subscriptions, and recent
// transactions → income/expenses. De-dupes (plaid_id on txns, title on subs).
export const runtime = "nodejs";

const FREQ: Record<string, string> = {
  WEEKLY: "weekly",
  BIWEEKLY: "monthly",
  MONTHLY: "monthly",
  SEMI_MONTHLY: "monthly",
  ANNUALLY: "yearly",
  UNKNOWN: "monthly",
};

export async function POST() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  const { data: items } = await supabase.from("plaid_items").select("*").eq("user_id", user.id);
  if (!items || !items.length) return Response.json({ error: "no_bank" }, { status: 400 });

  const client = plaidClient();
  const { data: existSubs } = await supabase
    .from("items")
    .select("title")
    .eq("user_id", user.id)
    .eq("type", "subscription");
  const seen = new Set((existSubs || []).map((s: { title?: string }) => (s.title || "").toLowerCase()));

  let subsAdded = 0;
  let txnsAdded = 0;

  for (const it of items) {
    // recurring outflow streams → subscriptions
    try {
      const rec = await client.transactionsRecurringGet({ access_token: it.access_token });
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
    } catch {
      /* recurring may be unavailable */
    }

    // recent transactions → income / expenses
    try {
      const end = new Date().toISOString().slice(0, 10);
      const start = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10);
      const tx = await client.transactionsGet({
        access_token: it.access_token,
        start_date: start,
        end_date: end,
        options: { count: 250, offset: 0 },
      });
      const rows = (tx.data.transactions || [])
        .filter((t) => !t.pending)
        .map((t) => ({
          user_id: user.id,
          kind: t.amount > 0 ? "expense" : "income",
          amount: Math.abs(t.amount),
          cat: t.amount > 0 ? "personal" : "other_income",
          account: "bank",
          date_iso: t.date,
          note: t.merchant_name || t.name || "",
          ded: false,
          source: "plaid",
          plaid_id: t.transaction_id,
        }));
      if (rows.length) {
        const up = await supabase.from("txns").upsert(rows, { onConflict: "plaid_id", ignoreDuplicates: true });
        if (!up.error) txnsAdded += rows.length;
      }
    } catch {
      /* skip */
    }
  }

  return Response.json({ subsAdded, txnsAdded });
}
