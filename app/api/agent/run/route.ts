import { createClient as createServerSupabase } from "@/lib/supabase/server";
import Anthropic from "@anthropic-ai/sdk";
import { TOOL_SCHEMAS, runTool } from "@/lib/agent-tools";

// Agente autónomo de onucore: recibe una misión en lenguaje natural, planea
// pasos, llama herramientas (leer/escribir en Supabase con RLS del usuario),
// y regresa un resumen + la lista de pasos ejecutados.
export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_ITER = 10;

export async function POST(request: Request) {
  const supabase = await createServerSupabase();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  if (!process.env.ANTHROPIC_API_KEY) return Response.json({ error: "no_api_key" }, { status: 500 });

  let body: { mission?: string };
  try { body = await request.json(); } catch { return Response.json({ error: "invalid_json" }, { status: 400 }); }
  const mission = (body.mission || "").trim();
  if (!mission) return Response.json({ error: "missing_mission" }, { status: 400 });

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const today = new Date().toISOString().slice(0, 10);
  const sys = `Eres el AGENTE de onucore (asistente personal). Ejecutas MISIONES usando las herramientas disponibles. Reglas:
- El usuario vive en Los Angeles. Es empleado W-2 de Aequalend y contratista 1099 (empresa Oprinte). Cuentas: personal=Empleado, business=Oprinte/negocio.
- Hoy es ${today}.
- Usa las herramientas ANTES de escribir el resumen final. Nunca inventes datos, léelos.
- Cuando categorices gastos, sé conservador: si dudas, prefiere account='personal' ded=false. Solo marca deducibles cuando sea claro que es gasto de negocio.
- Máximo ~8 pasos. Si la misión es imposible o insegura, no la hagas: explica por qué.
- El resumen final en español, MUY corto (2-4 frases), sin markdown, sin el signo — (guion largo). Explica qué hiciste y qué cambió.`;

  type Step = { tool: string; input: unknown; output: unknown };
  const steps: Step[] = [];
  const messages: Anthropic.Messages.MessageParam[] = [{ role: "user", content: mission }];

  let finalText = "";
  for (let i = 0; i < MAX_ITER; i++) {
    const resp = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 4000,
      system: sys,
      tools: TOOL_SCHEMAS as unknown as Anthropic.Messages.Tool[],
      messages,
    });

    const toolUses = resp.content.filter((b) => b.type === "tool_use") as Anthropic.Messages.ToolUseBlock[];
    const textBlocks = resp.content.filter((b) => b.type === "text") as Anthropic.Messages.TextBlock[];

    if (resp.stop_reason === "end_turn" || toolUses.length === 0) {
      finalText = textBlocks.map((b) => b.text).join("\n").trim();
      break;
    }

    messages.push({ role: "assistant", content: resp.content });
    const toolResults: Anthropic.Messages.ToolResultBlockParam[] = [];
    for (const tu of toolUses) {
      try {
        const output = await runTool(supabase, user.id, tu.name, tu.input);
        steps.push({ tool: tu.name, input: tu.input, output });
        toolResults.push({ type: "tool_result", tool_use_id: tu.id, content: JSON.stringify(output).slice(0, 8000) });
      } catch (e) {
        const msg = (e as { message?: string })?.message || "error";
        steps.push({ tool: tu.name, input: tu.input, output: { error: msg } });
        toolResults.push({ type: "tool_result", tool_use_id: tu.id, content: JSON.stringify({ error: msg }), is_error: true });
      }
    }
    messages.push({ role: "user", content: toolResults });
  }

  return Response.json({
    summary: finalText || "El agente terminó sin resumen.",
    steps,
  });
}
