"use client";
import { useState } from "react";

// Live brand logo for a subscription / merchant. Derives a domain from the
// name and loads the real logo (Clearbit → Google favicon), falling back to a
// letter tile. `logo` (if given, e.g. from Plaid) is tried first.
const DOMAINS: Record<string, string> = {
  netflix: "netflix.com",
  spotify: "spotify.com",
  chatgpt: "openai.com",
  openai: "openai.com",
  anthropic: "anthropic.com",
  claude: "claude.ai",
  "prime video": "primevideo.com",
  "amazon prime": "amazon.com",
  "amazon music": "music.amazon.com",
  amazon: "amazon.com",
  "apple music": "apple.com",
  "app store": "apple.com",
  icloud: "icloud.com",
  apple: "apple.com",
  "google one": "one.google.com",
  "google drive": "drive.google.com",
  "youtube premium": "youtube.com",
  youtube: "youtube.com",
  google: "google.com",
  "microsoft 365": "microsoft.com",
  microsoft: "microsoft.com",
  office: "office.com",
  xbox: "xbox.com",
  playstation: "playstation.com",
  nintendo: "nintendo.com",
  steam: "steampowered.com",
  adobe: "adobe.com",
  dropbox: "dropbox.com",
  notion: "notion.so",
  figma: "figma.com",
  canva: "canva.com",
  slack: "slack.com",
  zoom: "zoom.us",
  github: "github.com",
  gitlab: "gitlab.com",
  vercel: "vercel.com",
  linkedin: "linkedin.com",
  "disney+": "disneyplus.com",
  disney: "disneyplus.com",
  hulu: "hulu.com",
  hbo: "max.com",
  max: "max.com",
  paramount: "paramountplus.com",
  peacock: "peacocktv.com",
  audible: "audible.com",
  twitch: "twitch.tv",
  patreon: "patreon.com",
  substack: "substack.com",
  medium: "medium.com",
  grammarly: "grammarly.com",
  "1password": "1password.com",
  lastpass: "lastpass.com",
  nordvpn: "nordvpn.com",
  expressvpn: "expressvpn.com",
  "uber one": "uber.com",
  uber: "uber.com",
  lyft: "lyft.com",
  doordash: "doordash.com",
  instacart: "instacart.com",
  "at&t": "att.com",
  att: "att.com",
  verizon: "verizon.com",
  "t-mobile": "t-mobile.com",
  tmobile: "t-mobile.com",
  xfinity: "xfinity.com",
  comcast: "xfinity.com",
  spectrum: "spectrum.com",
};

function domainFor(title: string): string | null {
  const key = (title || "").toLowerCase().trim();
  if (!key) return null;
  for (const k of Object.keys(DOMAINS)) {
    if (key.includes(k)) return DOMAINS[k];
  }
  const w = key
    .replace(/[^a-z0-9 ]/g, "")
    .trim()
    .split(/\s+/)[0];
  return w ? `${w}.com` : null;
}

export default function SubLogo({
  logo,
  title,
  size = 38,
  C,
}: {
  logo?: string | null;
  title: string;
  size?: number;
  C: Record<string, string>;
}) {
  const domain = domainFor(title);
  const chain = [
    logo || null,
    domain ? `https://icons.duckduckgo.com/ip3/${domain}.ico` : null,
    domain ? `https://www.google.com/s2/favicons?domain=${domain}&sz=128` : null,
  ].filter(Boolean) as string[];
  const [idx, setIdx] = useState(0);
  const letter = ((title || "?").trim().charAt(0) || "?").toUpperCase();

  const box: React.CSSProperties = {
    width: size,
    height: size,
    borderRadius: 10,
    flexShrink: 0,
    objectFit: "contain",
    background: "#ffffff",
    border: `1px solid ${C.border}`,
  };

  if (idx >= chain.length) {
    return (
      <div
        style={{
          ...box,
          background: C.surface2,
          color: C.dim,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: size * 0.42,
          fontWeight: 700,
        }}
      >
        {letter}
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={chain[idx]}
      alt=""
      width={size}
      height={size}
      style={box}
      referrerPolicy="no-referrer"
      onError={() => setIdx((i) => i + 1)}
    />
  );
}
