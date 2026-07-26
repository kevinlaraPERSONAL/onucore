import { plaidClient, plaidConfigured } from "@/lib/plaid";
import { CountryCode } from "plaid";

// TEMP diagnostic: reports whether the Plaid keys/env are valid, without
// exposing any secret. Remove after debugging.
export const runtime = "nodejs";

export async function GET() {
  const info = {
    env: process.env.PLAID_ENV || "(unset)",
    clientIdSet: !!process.env.PLAID_CLIENT_ID,
    secretSet: !!process.env.PLAID_SECRET,
    secretLen: (process.env.PLAID_SECRET || "").length,
  };
  if (!plaidConfigured()) return Response.json({ ...info, ok: false, error: "unconfigured" });
  try {
    await plaidClient().institutionsGet({ count: 1, offset: 0, country_codes: [CountryCode.Us] });
    return Response.json({ ...info, ok: true });
  } catch (e) {
    const pd = (e as { response?: { data?: { error_code?: string; error_message?: string } } })?.response?.data;
    return Response.json({
      ...info,
      ok: false,
      error: pd?.error_code ? `${pd.error_code}: ${pd.error_message}` : String((e as { message?: string })?.message),
    });
  }
}
