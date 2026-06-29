import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { listEvents, refreshAccessToken } from "@/lib/google";

// Returns the user's Google Calendar events in [timeMin, timeMax].
// Refreshes the access token on the fly when it's about to expire.

export const runtime = "nodejs";

export async function GET(request: Request) {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ connected: false, events: [] }, { status: 401 });

  const { data: row } = await supabase
    .from("google_tokens")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!row) return Response.json({ connected: false, events: [] });

  const url = new URL(request.url);
  const timeMin = url.searchParams.get("timeMin") || new Date().toISOString();
  const timeMax =
    url.searchParams.get("timeMax") || new Date(Date.now() + 31 * 864e5).toISOString();

  let accessToken: string = row.access_token;

  // Refresh if it expires within a minute.
  if (new Date(row.expiry).getTime() - Date.now() < 60_000) {
    if (!row.refresh_token) {
      return Response.json({ connected: false, events: [], error: "no_refresh" });
    }
    const t = await refreshAccessToken(row.refresh_token);
    if (!t.access_token) {
      // Refresh token revoked/expired → connection is dead; clear it.
      await supabase.from("google_tokens").delete().eq("user_id", user.id);
      return Response.json({ connected: false, events: [], error: "refresh_failed" });
    }
    accessToken = t.access_token;
    await supabase
      .from("google_tokens")
      .update({
        access_token: accessToken,
        expiry: new Date(Date.now() + (t.expires_in || 3600) * 1000).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", user.id);
  }

  const r = await listEvents(accessToken, timeMin, timeMax);
  if (!r.ok) {
    return Response.json({ connected: true, events: [], error: `calendar_${r.status}` });
  }
  return Response.json({ connected: true, events: r.events });
}
