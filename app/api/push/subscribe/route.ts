import { createClient as createServerSupabase } from "@/lib/supabase/server";

// Saves / removes this device's push subscription for the signed-in user.
export const runtime = "nodejs";

export async function POST(request: Request) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  let body: { subscription?: { endpoint?: string; keys?: { p256dh?: string; auth?: string } } };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }
  const s = body.subscription;
  if (!s?.endpoint || !s.keys?.p256dh || !s.keys?.auth) return Response.json({ error: "bad_subscription" }, { status: 400 });

  const { error } = await supabase
    .from("push_subs")
    .upsert({ user_id: user.id, endpoint: s.endpoint, p256dh: s.keys.p256dh, auth: s.keys.auth }, { onConflict: "endpoint" });
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}

export async function DELETE(request: Request) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  let body: { endpoint?: string };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }
  if (!body.endpoint) return Response.json({ error: "no_endpoint" }, { status: 400 });
  await supabase.from("push_subs").delete().eq("user_id", user.id).eq("endpoint", body.endpoint);
  return Response.json({ ok: true });
}
