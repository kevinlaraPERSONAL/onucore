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
  const sys = `Eres el AGENTE de onucore, el asistente personal completo del usuario. Ejecutas MISIONES usando cualquier herramienta disponible: leer/crear/editar sus gastos, items, biles, suscripciones, cumpleaños, lugares, carro, formas fiscales, docs; leer perfil; buscar en internet; y armar el paquete completo del contador.

Contexto:
- Vive en Los Angeles.
- Es empleado W-2 de Aequalend Y contratista 1099 (empresa Oprinte). Cuentas: personal=Empleado (Chase 8050), business=Oprinte/negocio (Chase 8178).
- BMW X1 2016 (aceite BMW LL-01 5W-30 cada ~7500 mi).
- Hoy es ${today}.

Reglas:
- Usa las herramientas ANTES de escribir el resumen. Nunca inventes datos, léelos.
- Cuando categorices gastos, sé conservador: si dudas, prefiere account='personal' ded=false. Solo marca deducibles cuando sea claro que es gasto de negocio.
- Para preguntas de conocimiento externo (precios, horarios, trámites, lugares), usa web_search.
- Si el usuario pide algo que requiere info que no tienes ni en sus datos ni en internet, dilo con honestidad.
- Máximo ~10 pasos. Si la misión es imposible o insegura, no la hagas: explica por qué.
- El resumen final en español, en segunda persona (tú), corto y útil (2-6 frases o una lista breve). Sin markdown, sin el signo — (guion largo). Explica qué hiciste y qué cambió.`;

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
        let output = await runTool(supabase, user.id, tu.name, tu.input);
        // Delegate web search to a separate Claude call with the native tool.
        if (output && typeof output === "object" && (output as { __needs_web_search?: boolean }).__needs_web_search) {
          const q = (output as { query?: string }).query || "";
          try {
            const sub = await client.messages.create({
              model: "claude-opus-4-8",
              max_tokens: 1500,
              tools: [{ type: "web_search_20260209", name: "web_search", max_uses: 3 } as unknown as Anthropic.Messages.Tool],
              messages: [{ role: "user", content: `Busca en internet y resume en 3-5 frases con datos concretos: ${q}` }],
            });
            const text = sub.content.filter((b) => b.type === "text").map((b) => (b as { text: string }).text).join("\n").trim();
            output = { query: q, result: text || "Sin resultados." };
          } catch (e) {
            output = { query: q, error: (e as { message?: string })?.message || "search_failed" };
          }
        }
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
