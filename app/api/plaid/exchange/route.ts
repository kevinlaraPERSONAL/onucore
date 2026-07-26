import { plaidClient } from "@/lib/plaid";
import { createClient as createServerSupabase } from "@/lib/supabase/server";

// Trades the public_token (from Plaid Link) for an access_token and stores it.
export const runtime = "nodejs";

export async function POST(request: Request) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  let body: { public_token?: string; label?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!body.public_token) return Response.json({ error: "no_token" }, { status: 400 });
  const label = body.label === "business" ? "business" : "personal";

  try {
    const ex = await plaidClient().itemPublicTokenExchange({ public_token: body.public_token });
    await supabase.from("plaid_items").insert({
      user_id: user.id,
      access_token: ex.data.access_token,
      item_id: ex.data.item_id,
      label,
    });
    return Response.json({ ok: true });
  } catch (e) {
    return Response.json({ error: (e as { message?: string })?.message || "plaid_error" }, { status: 500 });
  }
}
