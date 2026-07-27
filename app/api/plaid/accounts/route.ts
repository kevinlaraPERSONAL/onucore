import { createClient as createServerSupabase } from "@/lib/supabase/server";

// Returns the user's connected bank accounts (with their Personal/Oprinte tag).
export const runtime = "nodejs";

export async function GET() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  const { data } = await supabase
    .from("plaid_accounts")
    .select("id, account_id, name, mask, label, balance_available, balance_current, balance_updated_at")
    .eq("user_id", user.id)
    .order("id");

  return Response.json({ accounts: data || [] });
}
