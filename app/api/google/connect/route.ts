import { NextResponse } from "next/server";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { buildAuthUrl, getOrigin, googleConfigured } from "@/lib/google";

// Starts the Google OAuth flow: redirects the user to Google's consent screen.
// Requires a logged-in onucore user (so we know whose calendar to link).

export const runtime = "nodejs";

export async function GET(request: Request) {
  const origin = getOrigin(request);
  const home = (flag: string) => NextResponse.redirect(`${origin}/?gcal=${flag}`);

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return home("login");
  if (!googleConfigured()) return home("unconfigured");

  const state = crypto.randomUUID();
  const res = NextResponse.redirect(buildAuthUrl(origin, state));
  // CSRF guard: echo this back from Google and compare on the callback.
  res.cookies.set("g_oauth_state", state, {
    httpOnly: true,
    secure: origin.startsWith("https"),
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return res;
}
