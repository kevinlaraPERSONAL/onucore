import { createClient as createServerSupabase } from "@/lib/supabase/server";

// Swaps the Personal <-> Business (Oprinte) labels for this user's connected
// banks and their imported transactions (in case a bank was tagged wrong).
export const runtime = "nodejs";

export async function POST() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  const uid = user.id;

  // plaid_items.label: personal <-> business (via a temp value to avoid collision)
  await supabase.from("plaid_items").update({ label: "__swap__" }).eq("user_id", uid).eq("label", "personal");
  await supabase.from("plaid_items").update({ label: "personal" }).eq("user_id", uid).eq("label", "business");
  await supabase.from("plaid_items").update({ label: "business" }).eq("user_id", uid).eq("label", "__swap__");

  // txns.account (imported from plaid): personal <-> business
  await supabase.from("txns").update({ account: "__swap__" }).eq("user_id", uid).eq("source", "plaid").eq("account", "personal");
  await supabase.from("txns").update({ account: "personal" }).eq("user_id", uid).eq("source", "plaid").eq("account", "business");
  await supabase.from("txns").update({ account: "business" }).eq("user_id", uid).eq("source", "plaid").eq("account", "__swap__");

  return Response.json({ ok: true });
}
