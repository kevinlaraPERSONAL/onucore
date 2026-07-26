import { Configuration, PlaidApi, PlaidEnvironments } from "plaid";

// Server-side Plaid client. Keys live only in env (PLAID_CLIENT_ID / PLAID_SECRET).
export function plaidConfigured(): boolean {
  return Boolean(process.env.PLAID_CLIENT_ID && process.env.PLAID_SECRET);
}

export function plaidClient(): PlaidApi {
  const env = (process.env.PLAID_ENV || "sandbox") as keyof typeof PlaidEnvironments;
  return new PlaidApi(
    new Configuration({
      basePath: PlaidEnvironments[env] || PlaidEnvironments.sandbox,
      baseOptions: {
        headers: {
          "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID,
          "PLAID-SECRET": process.env.PLAID_SECRET,
        },
      },
    }),
  );
}
