import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { googleConfigured } from "@/lib/google";

// Is Google Calendar connected for the current user? Returns the linked email.
// `configured` = whether the server has the Google keys set (a boolean only —
// never the values), so the UI (and we) can tell setup is done.

export const runtime = "nodejs";

export async function GET() {
  const configured = googleConfigured();
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ connected: false, configured });

  const { data } = await supabase
    .from("google_tokens")
    .select("email")
    .eq("user_id", user.id)
    .maybeSingle();

  return Response.json({ connected: !!data, email: data?.email ?? null, configured });
}
