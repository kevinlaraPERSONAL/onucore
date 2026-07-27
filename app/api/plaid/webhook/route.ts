import { createClient } from "@supabase/supabase-js";
import { runPlaidSync } from "@/lib/plaid-sync";

// Plaid calls this when a connected bank has new transactions → we import them
// right away, so the app stays fresh without the user tapping anything.
// The payload only tells us WHICH item changed; all data still flows through
// the authenticated Plaid API, so a forged call can at most trigger a re-sync.
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  let body: { webhook_type?: string; webhook_code?: string; item_id?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ ok: true });
  }
  const itemId = body?.item_id;
  const type = body?.webhook_type || "";
  const code = body?.webhook_code || "";
  const wantsSync =
    type === "TRANSACTIONS" &&
    ["SYNC_UPDATES_AVAILABLE", "DEFAULT_UPDATE", "INITIAL_UPDATE", "HISTORICAL_UPDATE", "RECURRING_TRANSACTIONS_UPDATE"].includes(code);
  if (!itemId || !wantsSync) return Response.json({ ok: true, ignored: true });

  const svc = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!svc || !url) return Response.json({ ok: true, skipped: "unconfigured" });

  const admin = createClient(url, svc, { auth: { persistSession: false } });
  const { data: item } = await admin.from("plaid_items").select("user_id").eq("item_id", itemId).maybeSingle();
  if (!item) return Response.json({ ok: true, ignored: true });

  try {
    const r = await runPlaidSync(admin, item.user_id);
    return Response.json({ ok: true, txnsAdded: r.txnsAdded, subsAdded: r.subsAdded });
  } catch {
    return Response.json({ ok: true, error: "sync_failed" });
  }
}
