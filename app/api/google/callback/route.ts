import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { exchangeCode, getEmail, getOrigin } from "@/lib/google";

// Google redirects back here with ?code & ?state. We validate the state cookie,
// trade the code for tokens, and store them for the current user.

export const runtime = "nodejs";

export async function GET(request: Request) {
  const origin = getOrigin(request);
  const home = (flag: string) => NextResponse.redirect(`${origin}/?gcal=${flag}`);

  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");
  if (oauthError || !code) return home("error");

  // CSRF: the state must match the cookie we set in /connect.
  const cookieStore = await cookies();
  const cookieState = cookieStore.get("g_oauth_state")?.value;
  if (!state || !cookieState || state !== cookieState) return home("error");

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return home("login");

  const tok = await exchangeCode(code, origin);
  if (!tok.access_token) return home("error");

  const email = await getEmail(tok.access_token);
  const expiry = new Date(Date.now() + (tok.expires_in || 3600) * 1000).toISOString();

  // Keep an existing refresh_token if Google didn't send a new one.
  const row: Record<string, unknown> = {
    user_id: user.id,
    access_token: tok.access_token,
    expiry,
    scope: tok.scope ?? null,
    email,
    updated_at: new Date().toISOString(),
  };
  if (tok.refresh_token) row.refresh_token = tok.refresh_token;

  const { error } = await supabase.from("google_tokens").upsert(row);
  if (error) return home("error");

  const res = home("connected");
  res.cookies.set("g_oauth_state", "", { path: "/", maxAge: 0 });
  return res;
}
