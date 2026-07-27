import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { runPlaidSync } from "@/lib/plaid-sync";

// Manual / app-open sync for the signed-in user (shared engine in lib/plaid-sync).
export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  const result = await runPlaidSync(supabase, user.id);
  if (result.error === "no_bank") return Response.json(result, { status: 400 });
  return Response.json(result);
}
