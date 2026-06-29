import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// Server-side Supabase client. Reads the user's session from the request
// cookies (the browser client stores the session there), so route handlers can
// verify there's a real logged-in user before doing privileged work — e.g.
// calling Claude, so anonymous visitors can't burn the API key.
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Setting cookies isn't allowed in every context; we only need to
            // READ the session here to authenticate, so this is safe to ignore.
          }
        },
      },
    },
  );
}
