import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { generateNudges } from "@/lib/nudges";

// GET: pending suggestions for the signed-in user.
// POST: regenerate (runs heuristics + Claude, upserts new nudges).
export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  const { data } = await supabase
    .from("ai_nudges")
    .select("id,kind,text,action,created_at")
    .eq("user_id", user.id)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(10);
  return Response.json({ nudges: data || [] });
}

export async function POST() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  const added = await generateNudges(supabase, user.id);
  const { data } = await supabase
    .from("ai_nudges")
    .select("id,kind,text,action,created_at")
    .eq("user_id", user.id)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(10);
  return Response.json({ added, nudges: data || [] });
}
