import { createClient as createServerSupabase } from "@/lib/supabase/server";

// Is Google Calendar connected for the current user? Returns the linked email.

export const runtime = "nodejs";

export async function GET() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ connected: false });

  const { data } = await supabase
    .from("google_tokens")
    .select("email")
    .eq("user_id", user.id)
    .maybeSingle();

  return Response.json({ connected: !!data, email: data?.email ?? null });
}
