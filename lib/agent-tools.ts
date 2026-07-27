import type { SupabaseClient } from "@supabase/supabase-js";

// Herramientas que el agente puede llamar. Cada una acota estrictamente lo que
// puede leer/escribir y siempre agrega user_id, así que un agente descarriado
// no puede tocar datos de otro usuario ni salirse del scope autorizado.

/* eslint-disable @typescript-eslint/no-explicit-any */
type DB = SupabaseClient<any, any, any>;

const CATS = ["gas", "food", "tech", "travel", "clothing", "software", "ads", "office", "phone", "pro", "insurance", "rent", "home", "education", "personal"];

export const TOOL_SCHEMAS = [
  {
    name: "list_txns",
    description: "Lee movimientos del usuario. Filtra por tipo (income/expense), cuenta (personal=Empleado, business=Oprinte/negocio), rango de fechas ISO (YYYY-MM-DD) y limita el número.",
    input_schema: {
      type: "object",
      properties: {
        kind: { type: "string", enum: ["income", "expense"] },
        account: { type: "string", enum: ["personal", "business"] },
        from: { type: "string", description: "Fecha ISO YYYY-MM-DD (>=)" },
        to: { type: "string", description: "Fecha ISO YYYY-MM-DD (<=)" },
        cat: { type: "string", description: "Categoría exacta" },
        ded: { type: "boolean", description: "Solo deducibles (true) o no deducibles (false)" },
        limit: { type: "number", description: "Máximo 100" },
      },
    },
  },
  {
    name: "categorize_txn",
    description: "Cambia la categoría, cuenta o deducibilidad de UN movimiento por id. Úsalo con cuidado: si mueves un gasto a account='business' y ded=true, cuenta como deducible del Schedule C.",
    input_schema: {
      type: "object",
      required: ["id"],
      properties: {
        id: { type: "number" },
        cat: { type: "string", enum: CATS },
        account: { type: "string", enum: ["personal", "business"] },
        ded: { type: "boolean" },
      },
    },
  },
  {
    name: "list_items",
    description: "Lee items del usuario: event, task, reminder, obligation (bil), subscription, note, birthday, place, journal. Filtra por tipo y estado (done true/false).",
    input_schema: {
      type: "object",
      properties: {
        type: { type: "string" },
        done: { type: "boolean" },
        limit: { type: "number", description: "Máximo 50" },
      },
    },
  },
  {
    name: "create_item",
    description: "Crea un item. type: 'task' (pendiente), 'reminder' (recordatorio), 'obligation' (bil), 'event' (cita), 'note' (nota). area: 'work' o 'personal'. Fecha en ISO YYYY-MM-DD.",
    input_schema: {
      type: "object",
      required: ["type", "title"],
      properties: {
        type: { type: "string", enum: ["task", "reminder", "obligation", "event", "note"] },
        title: { type: "string" },
        area: { type: "string", enum: ["work", "personal"] },
        date_iso: { type: "string" },
        date_label: { type: "string" },
        person: { type: "string" },
        amount: { type: "number" },
        detail: { type: "string" },
        repeat: { type: "string", enum: ["monthly"] },
      },
    },
  },
  {
    name: "update_item",
    description: "Actualiza un item existente por id.",
    input_schema: {
      type: "object",
      required: ["id"],
      properties: {
        id: { type: "string" },
        title: { type: "string" },
        date_iso: { type: "string" },
        done: { type: "boolean" },
        detail: { type: "string" },
      },
    },
  },
  {
    name: "get_balances",
    description: "Saldos actuales de cada cuenta bancaria conectada (label personal|business).",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "list_tax_forms",
    description: "Formas fiscales guardadas (W-2, 1099-*). Filtra por año.",
    input_schema: { type: "object", properties: { year: { type: "number" } } },
  },
  {
    name: "get_car",
    description: "Info del vehículo del usuario y sus servicios/recordatorios.",
    input_schema: { type: "object", properties: {} },
  },
] as const;

// Execute a tool call within the user's RLS scope.
export async function runTool(db: DB, userId: string, name: string, input: any): Promise<any> {
  switch (name) {
    case "list_txns": {
      const lim = Math.min(Number(input?.limit) || 30, 100);
      let q = db.from("txns").select("id,kind,amount,cat,account,date_iso,note,ded,plaid_account").eq("user_id", userId).order("date_iso", { ascending: false }).limit(lim);
      if (input?.kind) q = q.eq("kind", input.kind);
      if (input?.account) q = q.eq("account", input.account);
      if (input?.cat) q = q.eq("cat", input.cat);
      if (typeof input?.ded === "boolean") q = q.eq("ded", input.ded);
      if (input?.from) q = q.gte("date_iso", input.from);
      if (input?.to) q = q.lte("date_iso", input.to);
      const { data, error } = await q;
      if (error) return { error: error.message };
      return { txns: data || [] };
    }
    case "categorize_txn": {
      if (!input?.id) return { error: "id required" };
      const patch: any = {};
      if (input.cat) patch.cat = input.cat;
      if (input.account) patch.account = input.account;
      if (typeof input.ded === "boolean") patch.ded = input.ded;
      if (Object.keys(patch).length === 0) return { error: "nothing to update" };
      const { error } = await db.from("txns").update(patch).eq("id", input.id).eq("user_id", userId);
      if (error) return { error: error.message };
      return { ok: true, id: input.id, applied: patch };
    }
    case "list_items": {
      const lim = Math.min(Number(input?.limit) || 30, 50);
      let q = db.from("items").select("id,type,title,area,amount,date_iso,date_label,person,done,detail,repeat").eq("user_id", userId).order("date_iso", { ascending: true }).limit(lim);
      if (input?.type) q = q.eq("type", input.type);
      if (typeof input?.done === "boolean") q = q.eq("done", input.done);
      const { data, error } = await q;
      if (error) return { error: error.message };
      return { items: data || [] };
    }
    case "create_item": {
      if (!input?.type || !input?.title) return { error: "type and title required" };
      const row = {
        user_id: userId,
        type: input.type,
        title: input.title,
        area: input.area === "work" ? "work" : "personal",
        date_iso: input.date_iso || null,
        date_label: input.date_label || "",
        person: input.person || "",
        amount: typeof input.amount === "number" ? input.amount : null,
        detail: input.detail || "",
        repeat: input.repeat || null,
        done: false,
        source: "agent",
      };
      const { data, error } = await db.from("items").insert(row).select("id").single();
      if (error) return { error: error.message };
      return { ok: true, id: data?.id };
    }
    case "update_item": {
      if (!input?.id) return { error: "id required" };
      const patch: any = {};
      if (input.title != null) patch.title = input.title;
      if (input.date_iso != null) patch.date_iso = input.date_iso;
      if (typeof input.done === "boolean") patch.done = input.done;
      if (input.detail != null) patch.detail = input.detail;
      if (Object.keys(patch).length === 0) return { error: "nothing to update" };
      const { error } = await db.from("items").update(patch).eq("id", input.id).eq("user_id", userId);
      if (error) return { error: error.message };
      return { ok: true };
    }
    case "get_balances": {
      const { data } = await db.from("plaid_accounts").select("account_id,name,mask,label,balance_available,balance_current,balance_updated_at").eq("user_id", userId);
      return { accounts: data || [] };
    }
    case "list_tax_forms": {
      let q = db.from("tax_forms").select("id,year,kind,payer,amount,withheld").eq("user_id", userId);
      if (input?.year) q = q.eq("year", input.year);
      const { data } = await q;
      return { forms: data || [] };
    }
    case "get_car": {
      const [{ data: v }, { data: r }] = await Promise.all([
        db.from("vehicles").select("*").eq("user_id", userId).limit(1),
        db.from("car_records").select("id,kind,title,date_iso,due_iso,mileage,due_mileage,cost,note").eq("user_id", userId).order("due_iso", { ascending: true }),
      ]);
      return { vehicle: v?.[0] || null, records: r || [] };
    }
    default:
      return { error: `unknown tool: ${name}` };
  }
}
