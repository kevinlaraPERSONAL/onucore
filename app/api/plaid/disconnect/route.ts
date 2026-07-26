import { plaidClient } from "@/lib/plaid";
import { createClient as createServerSupabase } from "@/lib/supabase/server";

// Disconnects the bank(s): revokes the tokens at Plaid (best effort) and wipes
// the locally imported data (plaid_items + txns/subscriptions with source=plaid).
export const runtime = "nodejs";

export async function POST() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  const { data: items } = await supabase.from("plaid_items").select("access_token").eq("user_id", user.id);
  try {
    const client = plaidClient();
    for (const it of items || []) {
      try {
        await client.itemRemove({ access_token: it.access_token });
      } catch {
        /* already gone */
      }
    }
  } catch {
    /* plaid unavailable — still wipe local */
  }

  await supabase.from("plaid_items").delete().eq("user_id", user.id);
  await supabase.from("plaid_accounts").delete().eq("user_id", user.id);
  await supabase.from("txns").delete().eq("user_id", user.id).eq("source", "plaid");
  await supabase.from("items").delete().eq("user_id", user.id).eq("source", "plaid");

  return Response.json({ ok: true });
}
