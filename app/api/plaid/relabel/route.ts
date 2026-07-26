import { createClient as createServerSupabase } from "@/lib/supabase/server";

// Sets an account's tag (personal | business) and re-labels its imported
// transactions so the money view and the tax report split correctly.
export const runtime = "nodejs";

export async function POST(request: Request) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  let body: { account_id?: string; label?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }
  const label = body.label === "business" ? "business" : body.label === "personal" ? "personal" : null;
  if (!body.account_id || !label) return Response.json({ error: "bad_request" }, { status: 400 });

  await supabase.from("plaid_accounts").update({ label }).eq("user_id", user.id).eq("account_id", body.account_id);
  await supabase
    .from("txns")
    .update({ account: label })
    .eq("user_id", user.id)
    .eq("source", "plaid")
    .eq("plaid_account", body.account_id);

  return Response.json({ ok: true });
}
