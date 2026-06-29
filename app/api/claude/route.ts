import Anthropic from "@anthropic-ai/sdk";
import { createClient as createServerSupabase } from "@/lib/supabase/server";

// Server-side proxy to Claude.
//
// The browser used to call api.anthropic.com directly (key exposed in the
// client — only OK while the mock intercepted it). Now the browser POSTs the
// same body it always built ({ model, max_tokens, system, messages }) to
// /api/claude, and the real ANTHROPIC_API_KEY lives ONLY here on the server.
// The response keeps the raw Anthropic shape ({ content: [{ type, text }] })
// that OnucoreApp already parses, so no client parsing had to change.

export const runtime = "nodejs";

const DEFAULT_MODEL = "claude-haiku-4-5";
// Only models we actually want billed; the client picks the model but the
// server is the source of truth and falls back to the cheap default.
const ALLOWED_MODELS = new Set([
  "claude-haiku-4-5",
  "claude-sonnet-4-6",
  "claude-opus-4-8",
]);

const anthropic = new Anthropic(); // reads ANTHROPIC_API_KEY from the environment

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return Response.json({ error: "missing_api_key" }, { status: 500 });
  }

  // Require a logged-in user: blocks anonymous visitors from spending the API key.
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: {
    model?: unknown;
    max_tokens?: unknown;
    system?: unknown;
    messages?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const messages = body?.messages;
  if (!Array.isArray(messages) || messages.length === 0) {
    return Response.json({ error: "messages_required" }, { status: 400 });
  }

  const reqModel = typeof body?.model === "string" ? body.model : "";
  const model = ALLOWED_MODELS.has(reqModel) ? reqModel : DEFAULT_MODEL;
  const max_tokens = Math.min(Math.max(Number(body?.max_tokens) || 1024, 1), 4096);
  const system = typeof body?.system === "string" && body.system ? body.system : undefined;

  try {
    const msg = await anthropic.messages.create({
      model,
      max_tokens,
      ...(system ? { system } : {}),
      // The app builds messages in the exact Anthropic format (string content,
      // or [{type:"image",...},{type:"text",...}] for vision).
      messages: messages as Anthropic.MessageParam[],
    });
    return Response.json({ content: msg.content });
  } catch (err) {
    const status = (err as { status?: number })?.status ?? 500;
    const message = (err as { message?: string })?.message ?? "claude_error";
    console.error("[/api/claude] error", status, message);
    return Response.json({ error: message }, { status });
  }
}
