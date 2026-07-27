import { createClient as createServerSupabase } from "@/lib/supabase/server";

// POST { id, decision: 'accept' | 'dismiss' }
// Accept applies the nudge's action (categorize a txn, create a follow-up task)
// then marks the nudge as accepted. Dismiss just marks it dismissed.
export const runtime = "nodejs";

export async function POST(request: Request) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  let body: { id?: number; decision?: string };
  try { body = await request.json(); } catch { return Response.json({ error: "invalid_json" }, { status: 400 }); }
  if (!body.id || (body.decision !== "accept" && body.decision !== "dismiss")) {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }

  const { data: nudge } = await supabase
    .from("ai_nudges")
    .select("id,action,status")
    .eq("id", body.id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!nudge) return Response.json({ error: "not_found" }, { status: 404 });
  if (nudge.status !== "pending") return Response.json({ ok: true, already: nudge.status });

  if (body.decision === "accept" && nudge.action) {
    const a = nudge.action as { type?: string; txn_id?: number; account?: string; cat?: string; ded?: boolean; title?: string; date_iso?: string; person?: string };
    if (a.type === "categorize_txn" && a.txn_id) {
      await supabase
        .from("txns")
        .update({ account: a.account, cat: a.cat, ded: !!a.ded })
        .eq("id", a.txn_id)
        .eq("user_id", user.id);
    } else if (a.type === "create_task" && a.title) {
      await supabase.from("items").insert({
        user_id: user.id,
        type: "task",
        area: "work",
        title: a.title,
        date_iso: a.date_iso || null,
        person: a.person || "",
        done: false,
        source: "app",
      });
    }
  }

  await supabase
    .from("ai_nudges")
    .update({ status: body.decision === "accept" ? "accepted" : "dismissed" })
    .eq("id", body.id)
    .eq("user_id", user.id);

  return Response.json({ ok: true });
}
