import { plaidClient, plaidConfigured } from "@/lib/plaid";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { Products, CountryCode } from "plaid";

// Creates a Plaid Link token so the client can open the bank-connect widget.
export const runtime = "nodejs";

export async function POST() {
  if (!plaidConfigured()) return Response.json({ error: "unconfigured" }, { status: 500 });
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  try {
    const r = await plaidClient().linkTokenCreate({
      user: { client_user_id: user.id },
      client_name: "onucore",
      products: [Products.Transactions],
      country_codes: [CountryCode.Us],
      language: "en",
    });
    return Response.json({ link_token: r.data.link_token });
  } catch (e) {
    const pd = (e as { response?: { data?: { error_code?: string; error_message?: string } } })?.response?.data;
    const msg = pd?.error_code ? `${pd.error_code}: ${pd.error_message || ""}` : (e as { message?: string })?.message || "plaid_error";
    return Response.json({ error: msg }, { status: 500 });
  }
}
