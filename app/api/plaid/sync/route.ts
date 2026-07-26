import { plaidClient } from "@/lib/plaid";
import type { Transaction } from "plaid";
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

// Maps a Plaid transaction's category to an onucore Schedule C category.
// Unknown / clearly-personal categories fall back to "personal" (not deductible)
// so we under-claim rather than over-claim.
function plaidCat(t: { personal_finance_category?: { primary?: string; detailed?: string | null } | null }): string {
  const p = t.personal_finance_category?.primary || "";
  const d = t.personal_finance_category?.detailed || "";
  if (d.includes("SUBSCRIPTION") || d.includes("SOFTWARE")) return "software";
  switch (p) {
    case "FOOD_AND_DRINK":
      return "food";
    case "TRANSPORTATION":
      return "gas";
    case "TRAVEL":
      return "travel";
    case "RENT_AND_UTILITIES":
      return "phone";
    case "GENERAL_SERVICES":
      return "pro";
    case "GENERAL_MERCHANDISE":
    case "HOME_IMPROVEMENT":
    case "BANK_FEES":
      return "office";
    default:
      return "personal";
  }
}

// Transfers between the user's own accounts, credit-card payments and loan
// payments are NOT income/expenses — exclude them so the report isn't inflated.
function isTransfer(t: { personal_finance_category?: { primary?: string } | null }): boolean {
  const p = t.personal_finance_category?.primary || "";
  return p === "TRANSFER_IN" || p === "TRANSFER_OUT" || p === "LOAN_PAYMENTS";
}

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

  // Per-account tags (personal | business). A single login can hold both.
  const { data: accRows } = await supabase.from("plaid_accounts").select("account_id, label").eq("user_id", user.id);
  const accMap = new Map<string, string>(
    (accRows || []).map((a: { account_id: string; label: string }) => [a.account_id, a.label]),
  );

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
    // accounts on this login → store them so the user can tag each one
    try {
      const acc = await ready(() => client.accountsGet({ access_token: it.access_token }));
      const toUpsert = (acc.data.accounts || []).map((a) => ({
        user_id: user.id,
        account_id: a.account_id,
        name: a.official_name || a.name || null,
        mask: a.mask || null,
        label: accMap.get(a.account_id) || it.label || "personal",
      }));
      if (toUpsert.length) {
        await supabase.from("plaid_accounts").upsert(toUpsert, { onConflict: "user_id,account_id", ignoreDuplicates: true });
        for (const a of toUpsert) if (!accMap.has(a.account_id)) accMap.set(a.account_id, a.label);
      }
    } catch (e) {
      errors.push("acc:" + ((e as { message?: string })?.message || "err"));
    }

    // transactions → income / expenses (full fiscal year, paginated)
    try {
      const end = new Date().toISOString().slice(0, 10);
      const start = `${new Date().getFullYear() - 1}-01-01`;
      const allTx: Transaction[] = [];
      let offset = 0;
      let total = Infinity;
      while (offset < total && offset < 5000) {
        const tx = await ready(() =>
          client.transactionsGet({
            access_token: it.access_token,
            start_date: start,
            end_date: end,
            options: { count: 500, offset },
          }),
        );
        total = tx.data.total_transactions ?? (tx.data.transactions || []).length;
        const batch = tx.data.transactions || [];
        allTx.push(...batch);
        if (batch.length === 0) break;
        offset += batch.length;
      }
      const rows = allTx
        .filter((t) => !t.pending && !isTransfer(t))
        .map((t) => {
          const acctLabel = accMap.get(t.account_id) || it.label || "personal";
          const isExpense = t.amount > 0;
          const isBiz = acctLabel === "business";
          // Business-account expenses are deductible business expenses, categorized
          // by Plaid; personal-account spending stays personal / non-deductible.
          const cat = !isExpense ? "other_income" : isBiz ? plaidCat(t) : "personal";
          return {
            user_id: user.id,
            kind: isExpense ? "expense" : "income",
            amount: Math.abs(t.amount),
            cat,
            account: acctLabel,
            date_iso: t.date,
            note: t.merchant_name || t.name || "",
            ded: isExpense && isBiz && cat !== "personal",
            source: "plaid",
            plaid_id: t.transaction_id,
            plaid_account: t.account_id,
          };
        });
      if (rows.length) {
        const ids = rows.map((r) => r.plaid_id);
        const { data: existing } = await supabase
          .from("txns")
          .select("plaid_id, cat, ded, plaid_account")
          .eq("user_id", user.id)
          .in("plaid_id", ids);
        const have = new Set((existing || []).map((x: { plaid_id: string }) => x.plaid_id));
        // "Pristine" imported rows (still Personal / non-deductible — untouched by
        // categorization or by the user) may be re-categorized with the account tags.
        const pristine = new Set(
          (existing || [])
            .filter((x: { cat?: string; ded?: boolean }) => x.cat === "personal" && x.ded === false)
            .map((x: { plaid_id: string }) => x.plaid_id),
        );
        const noAcct = new Set(
          (existing || [])
            .filter((x: { plaid_account?: string | null }) => !x.plaid_account)
            .map((x: { plaid_id: string }) => x.plaid_id),
        );

        const fresh = rows.filter((r) => !have.has(r.plaid_id));
        if (fresh.length) {
          const ins = await supabase.from("txns").insert(fresh);
          if (ins.error) errors.push("ins:" + ins.error.message);
          else txnsAdded += fresh.length;
        }

        // Bulk-update the legacy rows, grouped by (account, cat, ded).
        const groups = new Map<string, { account: string; cat: string; ded: boolean; account_id: string; ids: string[] }>();
        for (const r of rows) {
          if (!pristine.has(r.plaid_id)) continue;
          // skip rows already settled (personal + already carrying their account tag)
          if (r.cat === "personal" && r.ded === false && !noAcct.has(r.plaid_id)) continue;
          const key = `${r.plaid_account}|${r.cat}|${r.ded}`;
          let g = groups.get(key);
          if (!g) {
            g = { account: r.account, cat: r.cat, ded: r.ded, account_id: r.plaid_account, ids: [] };
            groups.set(key, g);
          }
          g.ids.push(r.plaid_id);
        }
        for (const g of groups.values()) {
          const up = await supabase
            .from("txns")
            .update({ account: g.account, cat: g.cat, ded: g.ded, plaid_account: g.account_id })
            .eq("user_id", user.id)
            .in("plaid_id", g.ids);
          if (up.error) errors.push("fix:" + up.error.message);
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
