import { createClient as createServerSupabase } from "@/lib/supabase/server";

// Forget the user's Google Calendar connection (deletes their stored tokens).

export const runtime = "nodejs";

export async function POST() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ ok: false }, { status: 401 });

  await supabase.from("google_tokens").delete().eq("user_id", user.id);
  return Response.json({ ok: true });
}
