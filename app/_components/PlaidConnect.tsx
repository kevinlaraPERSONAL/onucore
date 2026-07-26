"use client";
import { useState, useEffect, useCallback } from "react";
import { usePlaidLink, type PlaidLinkOnSuccess } from "react-plaid-link";

// "Connect bank" button. Fetches a Link token, opens Plaid Link, and on success
// exchanges the public token + syncs transactions/subscriptions, then onDone().
export default function PlaidConnect({
  label,
  accountLabel,
  busyLabel = "…",
  onDone,
  style,
}: {
  label: string;
  accountLabel?: string;
  busyLabel?: string;
  onDone?: () => void;
  style?: React.CSSProperties;
}) {
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const onSuccess = useCallback<PlaidLinkOnSuccess>(
    (public_token) => {
      setBusy(true);
      (async () => {
        try {
          await fetch("/api/plaid/exchange", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ public_token, label: accountLabel }),
          });
          await fetch("/api/plaid/sync", { method: "POST" });
        } catch {
          /* noop */
        }
        setBusy(false);
        setToken(null);
        if (onDone) onDone();
      })();
    },
    [onDone],
  );

  const { open, ready } = usePlaidLink({ token, onSuccess });

  // Open the widget as soon as the token is ready.
  useEffect(() => {
    if (token && ready) {
      open();
      setBusy(false);
    }
  }, [token, ready, open]);

  const start = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const r = await fetch("/api/plaid/link-token", { method: "POST" });
      const d = await r.json();
      if (d.link_token) setToken(d.link_token);
      else setBusy(false);
    } catch {
      setBusy(false);
    }
  };

  return (
    <button onClick={start} disabled={busy} style={style}>
      {busy ? busyLabel : label}
    </button>
  );
}
