// Google Calendar OAuth 2.0 + read-only Calendar API helpers.
// Raw fetch (no googleapis dependency). Used only by the /api/google/* routes.

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const USERINFO_URL = "https://www.googleapis.com/oauth2/v2/userinfo";
const EVENTS_URL = "https://www.googleapis.com/calendar/v3/calendars/primary/events";

// Read-only calendar access + the connected account's email (to show which one).
export const SCOPES = [
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
].join(" ");

export function googleConfigured(): boolean {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

// Public origin of THIS request, so the OAuth redirect_uri matches whatever host
// we're served from (localhost:3030 in dev, onucore.vercel.app in prod).
export function getOrigin(request: Request): string {
  const h = request.headers;
  const host = h.get("x-forwarded-host") || h.get("host") || "localhost:3030";
  const proto =
    h.get("x-forwarded-proto") ||
    (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  return `${proto}://${host}`;
}

export function callbackUrl(origin: string): string {
  return `${origin}/api/google/callback`;
}

export function buildAuthUrl(origin: string, state: string): string {
  const p = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: callbackUrl(origin),
    response_type: "code",
    scope: SCOPES,
    access_type: "offline", // ask for a refresh_token
    prompt: "consent", // force a refresh_token every time
    include_granted_scopes: "true",
    state,
  });
  return `${AUTH_URL}?${p.toString()}`;
}

type TokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  error?: string;
  error_description?: string;
};

export async function exchangeCode(code: string, origin: string): Promise<TokenResponse> {
  const body = new URLSearchParams({
    code,
    client_id: process.env.GOOGLE_CLIENT_ID!,
    client_secret: process.env.GOOGLE_CLIENT_SECRET!,
    redirect_uri: callbackUrl(origin),
    grant_type: "authorization_code",
  });
  const r = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  return (await r.json()) as TokenResponse;
}

export async function refreshAccessToken(refreshToken: string): Promise<TokenResponse> {
  const body = new URLSearchParams({
    refresh_token: refreshToken,
    client_id: process.env.GOOGLE_CLIENT_ID!,
    client_secret: process.env.GOOGLE_CLIENT_SECRET!,
    grant_type: "refresh_token",
  });
  const r = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  return (await r.json()) as TokenResponse;
}

export async function getEmail(accessToken: string): Promise<string | null> {
  const r = await fetch(USERINFO_URL, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!r.ok) return null;
  const j = (await r.json()) as { email?: string };
  return j.email ?? null;
}

export type GCalEvent = {
  id: string;
  source: "google";
  title: string;
  time: string;
  dateISO: string;
  allDay: boolean;
};

// Wall-clock time/date straight from the RFC3339 string, so an event shows in
// the time it was set in — independent of the server timezone (Vercel = UTC).
function normalizeEvent(e: {
  id?: string;
  summary?: string;
  start?: { dateTime?: string; date?: string };
}): GCalEvent | null {
  const start = e.start || {};
  const base = { id: `google-${e.id}`, source: "google" as const, title: e.summary || "—" };
  if (start.dateTime) {
    const s = start.dateTime; // e.g. 2026-06-30T16:00:00-06:00
    const dateISO = s.slice(0, 10);
    const m = s.match(/T(\d{2}):(\d{2})/);
    let time = "";
    if (m) {
      let h = parseInt(m[1], 10);
      const min = m[2];
      const ap = h < 12 ? "AM" : "PM";
      h = h % 12 || 12;
      time = `${h}:${min} ${ap}`;
    }
    return { ...base, time, dateISO, allDay: false };
  }
  if (start.date) {
    return { ...base, time: "", dateISO: start.date, allDay: true };
  }
  return null;
}

export async function listEvents(
  accessToken: string,
  timeMin: string,
  timeMax: string,
): Promise<{ ok: boolean; status: number; events: GCalEvent[] }> {
  const p = new URLSearchParams({
    timeMin,
    timeMax,
    singleEvents: "true",
    orderBy: "startTime",
    maxResults: "250",
  });
  const r = await fetch(`${EVENTS_URL}?${p.toString()}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!r.ok) return { ok: false, status: r.status, events: [] };
  const j = (await r.json()) as { items?: Array<Parameters<typeof normalizeEvent>[0]> };
  const events = (j.items || [])
    .map(normalizeEvent)
    .filter((e): e is GCalEvent => e !== null);
  return { ok: true, status: 200, events };
}
