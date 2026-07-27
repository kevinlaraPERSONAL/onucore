import type { SupabaseClient } from "@supabase/supabase-js";

// Herramientas que el agente puede llamar. Cada una acota estrictamente lo que
// puede leer/escribir y siempre agrega user_id, así que un agente descarriado
// no puede tocar datos de otro usuario ni salirse del scope autorizado.

/* eslint-disable @typescript-eslint/no-explicit-any */
type DB = SupabaseClient<any, any, any>;

const CATS = ["gas", "food", "tech", "travel", "clothing", "software", "ads", "office", "phone", "pro", "insurance", "rent", "home", "education", "personal"];

// Same rules the UI uses (Schedule C line + deductibility % per category).
const CAT_META: Record<string, { line: string; ded: "full" | "meals50" | "partial" | "none" }> = {
  gas: { line: "Car & truck (L9)", ded: "full" },
  food: { line: "Meals (L24b)", ded: "meals50" },
  tech: { line: "Depreciation / Supplies", ded: "full" },
  travel: { line: "Travel (L24a)", ded: "full" },
  clothing: { line: "—", ded: "none" },
  software: { line: "Other (L27a)", ded: "full" },
  ads: { line: "Advertising (L8)", ded: "full" },
  office: { line: "Office / Supplies", ded: "full" },
  phone: { line: "Utilities / Other", ded: "partial" },
  pro: { line: "Legal & professional (L17)", ded: "full" },
  insurance: { line: "Insurance (L15)", ded: "full" },
  rent: { line: "Rent / lease (L20b)", ded: "full" },
  home: { line: "Home office (8829)", ded: "full" },
  education: { line: "Other (L27a)", ded: "full" },
  personal: { line: "—", ded: "none" },
};
const dpct = (ded: string) => (ded === "meals50" ? 0.5 : ded === "partial" ? 0.5 : ded === "none" ? 0 : 1);

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
  {
    name: "delete_item",
    description: "Borra un item por id (task, event, obligation, note, subscription, birthday, place, journal).",
    input_schema: { type: "object", required: ["id"], properties: { id: { type: "string" } } },
  },
  {
    name: "update_txn",
    description: "Actualiza campos de un movimiento (amount, note, date_iso, miles). Para categoría/cuenta/deducible usa categorize_txn.",
    input_schema: {
      type: "object",
      required: ["id"],
      properties: {
        id: { type: "number" },
        amount: { type: "number" },
        note: { type: "string" },
        date_iso: { type: "string" },
        miles: { type: "number", description: "Millas de negocio (para el metodo de millaje del carro)" },
      },
    },
  },
  {
    name: "add_subscription",
    description: "Guarda una suscripcion recurrente (Netflix, Spotify, gimnasio…). dateLabel: monthly|yearly|weekly. dateISO: próxima renovación.",
    input_schema: {
      type: "object",
      required: ["title", "amount"],
      properties: {
        title: { type: "string" },
        amount: { type: "number" },
        date_label: { type: "string", enum: ["monthly", "yearly", "weekly"] },
        date_iso: { type: "string" },
        area: { type: "string", enum: ["personal", "work"] },
      },
    },
  },
  {
    name: "add_birthday",
    description: "Guarda un cumpleaños/aniversario. mmdd formato MM-DD (ej. '03-15').",
    input_schema: {
      type: "object",
      required: ["name", "mmdd"],
      properties: {
        name: { type: "string" },
        mmdd: { type: "string", pattern: "^\\d{2}-\\d{2}$" },
        relation: { type: "string", description: "Ej. mamá, hermano, cliente" },
      },
    },
  },
  {
    name: "add_place",
    description: "Guarda un lugar favorito (restaurante, café, coworking, etc).",
    input_schema: {
      type: "object",
      required: ["title"],
      properties: {
        title: { type: "string" },
        category: { type: "string", enum: ["restaurante", "cafe", "bar", "coworking", "evento", "otro"] },
        detail: { type: "string", description: "Dirección, qué pedir, notas" },
        area: { type: "string", enum: ["personal", "work"] },
      },
    },
  },
  {
    name: "add_car_service",
    description: "Guarda un servicio o recordatorio del carro (aceite, placas, seguro, llantas, frenos, inspección).",
    input_schema: {
      type: "object",
      required: ["kind"],
      properties: {
        kind: { type: "string", enum: ["oil", "registration", "insurance", "tires", "brakes", "inspection", "service", "note"] },
        title: { type: "string" },
        date_iso: { type: "string", description: "Cuándo se hizo" },
        due_iso: { type: "string", description: "Próxima fecha" },
        mileage: { type: "number" },
        due_mileage: { type: "number" },
        cost: { type: "number" },
        note: { type: "string" },
      },
    },
  },
  {
    name: "add_tax_form",
    description: "Guarda una forma fiscal (W-2, 1099-NEC, 1099-MISC, 1099-K, otra).",
    input_schema: {
      type: "object",
      required: ["kind", "year", "payer"],
      properties: {
        kind: { type: "string" },
        year: { type: "number" },
        payer: { type: "string" },
        amount: { type: "number" },
        withheld: { type: "number" },
      },
    },
  },
  {
    name: "get_profile",
    description: "Lee el perfil del usuario (nombre, ciudad, ocupación, etc) para personalizar respuestas.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "list_documents",
    description: "Lista los documentos guardados en la Bóveda del usuario (nombre + nota). No devuelve el contenido, solo el índice.",
    input_schema: {
      type: "object",
      properties: {
        category: { type: "string", enum: ["tax", "receipt", "insurance", "id", "media", "other"] },
      },
    },
  },
  {
    name: "web_search",
    description: "Busca en internet para info externa (precios, horarios, direcciones, trámites en Los Angeles, noticias, etc). Úsalo cuando el usuario pregunte algo que no está en sus datos.",
    input_schema: {
      type: "object",
      required: ["query"],
      properties: {
        query: { type: "string", description: "Búsqueda en lenguaje natural" },
      },
    },
  },
  {
    name: "build_tax_package",
    description: "Arma el paquete COMPLETO para el preparador de impuestos del año fiscal indicado. Devuelve un objeto con: ingresos por cuenta (Empleado W-2 vs Contratista/Oprinte 1099), gastos totales del negocio, DEDUCIBLE TOTAL, deducible desglosado por línea del Schedule C, utilidad neta de Oprinte, formas W-2/1099 con retenciones, match 1099-vs-depósitos por pagador (cuánto llegó, cuánto falta), millaje de negocio del año (millas totales × $0.70/mi = deducción), lista de documentos fiscales guardados en la Bóveda, y datos del vehículo (marca/modelo/placa). Usa esto DIRECTAMENTE en vez de leer todo por separado cuando el usuario pida su reporte fiscal.",
    input_schema: {
      type: "object",
      required: ["year"],
      properties: { year: { type: "number", description: "Año fiscal (ej. 2025)" } },
    },
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
    case "delete_item": {
      if (!input?.id) return { error: "id required" };
      const { error } = await db.from("items").delete().eq("id", input.id).eq("user_id", userId);
      if (error) return { error: error.message };
      return { ok: true };
    }
    case "update_txn": {
      if (!input?.id) return { error: "id required" };
      const patch: any = {};
      if (typeof input.amount === "number") patch.amount = input.amount;
      if (typeof input.note === "string") patch.note = input.note;
      if (input.date_iso) patch.date_iso = input.date_iso;
      if (typeof input.miles === "number") patch.miles = input.miles;
      if (Object.keys(patch).length === 0) return { error: "nothing to update" };
      const { error } = await db.from("txns").update(patch).eq("id", input.id).eq("user_id", userId);
      if (error) return { error: error.message };
      return { ok: true };
    }
    case "add_subscription": {
      if (!input?.title || typeof input?.amount !== "number") return { error: "title and amount required" };
      const { data, error } = await db.from("items").insert({
        user_id: userId, type: "subscription", title: input.title, amount: input.amount,
        area: input.area === "work" ? "work" : "personal",
        date_iso: input.date_iso || null,
        date_label: input.date_label || "monthly",
        source: "agent", done: false,
      }).select("id").single();
      if (error) return { error: error.message };
      return { ok: true, id: data?.id };
    }
    case "add_birthday": {
      if (!input?.name || !/^\d{2}-\d{2}$/.test(input?.mmdd || "")) return { error: "name and mmdd (MM-DD) required" };
      const [m, d] = input.mmdd.split("-").map(Number);
      const t = new Date(); t.setHours(0, 0, 0, 0);
      let y = t.getFullYear(); const cand = new Date(y, m - 1, d);
      if (cand < t) y++;
      const nextISO = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const { data, error } = await db.from("items").insert({
        user_id: userId, type: "birthday", title: input.name, area: "personal",
        person: input.relation || "", date_iso: nextISO, date_label: input.mmdd,
        source: "agent", done: false,
      }).select("id").single();
      if (error) return { error: error.message };
      return { ok: true, id: data?.id, next: nextISO };
    }
    case "add_place": {
      if (!input?.title) return { error: "title required" };
      const { data, error } = await db.from("items").insert({
        user_id: userId, type: "place", title: input.title,
        area: input.area === "work" ? "work" : "personal",
        person: input.category || "otro", detail: input.detail || "",
        source: "agent", done: false,
      }).select("id").single();
      if (error) return { error: error.message };
      return { ok: true, id: data?.id };
    }
    case "add_car_service": {
      if (!input?.kind) return { error: "kind required" };
      const row: any = {
        user_id: userId, kind: input.kind, title: input.title || null,
        date_iso: input.date_iso || null, due_iso: input.due_iso || null,
        mileage: typeof input.mileage === "number" ? input.mileage : null,
        due_mileage: typeof input.due_mileage === "number" ? input.due_mileage : null,
        cost: typeof input.cost === "number" ? input.cost : null,
        note: input.note || null,
      };
      const { data, error } = await db.from("car_records").insert(row).select("id").single();
      if (error) return { error: error.message };
      return { ok: true, id: data?.id };
    }
    case "add_tax_form": {
      if (!input?.kind || !input?.year || !input?.payer) return { error: "kind, year, payer required" };
      const { data, error } = await db.from("tax_forms").insert({
        user_id: userId, kind: input.kind, year: input.year, payer: input.payer,
        amount: typeof input.amount === "number" ? input.amount : 0,
        withheld: typeof input.withheld === "number" ? input.withheld : 0,
      }).select("id").single();
      if (error) return { error: error.message };
      return { ok: true, id: data?.id };
    }
    case "get_profile": {
      const { data } = await db.from("profiles").select("name,nickname,role,business,city,tz,about,goals,people").eq("id", userId).maybeSingle();
      return { profile: data || null };
    }
    case "list_documents": {
      let q = db.from("documents").select("id,name,category,mime,note,created_at").eq("user_id", userId).order("created_at", { ascending: false });
      if (input?.category) q = q.eq("category", input.category);
      const { data } = await q;
      return { documents: data || [] };
    }
    case "web_search": {
      // Signal to the caller (agent route) that this needs Claude's native web_search tool.
      // The runTool caller isolates the search into a separate Claude call.
      return { __needs_web_search: true, query: input?.query || "" };
    }
    case "build_tax_package": {
      const year = Number(input?.year);
      if (!year) return { error: "year required" };
      const start = `${year}-01-01`;
      const end = `${year}-12-31`;
      const [{ data: txns }, { data: forms }, { data: docs }, { data: vehicle }] = await Promise.all([
        db.from("txns").select("id,kind,amount,cat,account,date_iso,note,ded,miles").eq("user_id", userId).gte("date_iso", start).lte("date_iso", end),
        db.from("tax_forms").select("id,year,kind,payer,amount,withheld").eq("user_id", userId).eq("year", year),
        db.from("documents").select("id,name,category,mime,note,created_at").eq("user_id", userId).eq("category", "tax"),
        db.from("vehicles").select("make,model,year,plate,vin").eq("user_id", userId).limit(1),
      ]);
      const tx = txns || [];
      const bizInc = tx.filter((x) => x.kind === "income" && x.account === "business").reduce((s, x) => s + Number(x.amount || 0), 0);
      const bizExp = tx.filter((x) => x.kind === "expense" && x.account === "business").reduce((s, x) => s + Number(x.amount || 0), 0);
      const perInc = tx.filter((x) => x.kind === "income" && x.account !== "business").reduce((s, x) => s + Number(x.amount || 0), 0);
      const perExp = tx.filter((x) => x.kind === "expense" && x.account !== "business").reduce((s, x) => s + Number(x.amount || 0), 0);
      // Deductible per transaction (mileage: only when miles are logged).
      const dedOf = (t: { kind: string; ded?: boolean; amount: number; cat: string; miles?: number | null }) => {
        if (t.kind !== "expense" || t.ded === false) return 0;
        if (t.cat === "gas") return t.miles ? Number(t.amount) || 0 : 0;
        const meta = CAT_META[t.cat] || CAT_META.personal;
        return (Number(t.amount) || 0) * dpct(meta.ded);
      };
      const deductibleTotal = tx.reduce((s, x) => s + dedOf(x), 0);
      const byLine: Record<string, number> = {};
      tx.filter((x) => x.kind === "expense").forEach((x) => {
        const d = dedOf(x); if (d <= 0) return;
        const line = (CAT_META[x.cat] || CAT_META.personal).line;
        byLine[line] = (byLine[line] || 0) + d;
      });
      const deductibleByScheduleCLine = Object.entries(byLine).sort((a, b) => b[1] - a[1]).map(([line, amount]) => ({ line, amount: Math.round(amount * 100) / 100 }));

      const w2 = (forms || []).filter((f) => f.kind === "W-2");
      const c1099 = (forms || []).filter((f) => (f.kind || "").startsWith("1099") && f.payer && Number(f.amount) > 0);
      // 1099 match: sum business-account income lines whose note contains the payer name.
      const bizIncomeYT = tx.filter((x) => x.kind === "income" && x.account === "business");
      const match1099 = c1099.map((f) => {
        const target = Number(f.amount) || 0;
        const payer = (f.payer || "").toLowerCase();
        const matched = bizIncomeYT.filter((x) => (x.note || "").toLowerCase().includes(payer)).reduce((s, x) => s + Number(x.amount || 0), 0);
        return { form: f.kind, payer: f.payer, expected: target, matched: Math.round(matched * 100) / 100, gap: Math.round((target - matched) * 100) / 100 };
      });

      const businessMiles = tx.reduce((s, x) => s + (Number(x.miles) || 0), 0);
      const mileageDeduction = Math.round(businessMiles * 0.70 * 100) / 100;

      return {
        year,
        business_schedule_c: {
          income: Math.round(bizInc * 100) / 100,
          expenses_total: Math.round(bizExp * 100) / 100,
          deductible_total: Math.round(deductibleTotal * 100) / 100,
          net_profit: Math.round((bizInc - deductibleTotal) * 100) / 100,
          deductible_by_schedule_c_line: deductibleByScheduleCLine,
        },
        employee_w2: {
          wages: Math.round(w2.reduce((s, f) => s + Number(f.amount || 0), 0) * 100) / 100,
          federal_withheld: Math.round(w2.reduce((s, f) => s + Number(f.withheld || 0), 0) * 100) / 100,
          forms: w2.map((f) => ({ payer: f.payer, wages: Number(f.amount || 0), federal_withheld: Number(f.withheld || 0) })),
        },
        forms_1099: c1099.map((f) => ({ kind: f.kind, payer: f.payer, amount: Number(f.amount || 0), federal_withheld: Number(f.withheld || 0) })),
        deposits_vs_1099: match1099,
        vehicle_mileage: {
          business_miles: businessMiles,
          rate_per_mile: 0.70,
          deduction: mileageDeduction,
          vehicle: vehicle?.[0] ? `${vehicle[0].year || ""} ${vehicle[0].make || ""} ${vehicle[0].model || ""}`.trim() : null,
          plate: vehicle?.[0]?.plate || null,
        },
        personal_summary: {
          income: Math.round(perInc * 100) / 100,
          expenses: Math.round(perExp * 100) / 100,
        },
        documents_stored: (docs || []).map((d) => ({ name: d.name, note: d.note || null, uploaded: (d.created_at || "").slice(0, 10) })),
        notes: [
          "Los montos vienen de tus movimientos reales de Chase (Empleado 8050 = W-2, Oprinte 8178 = negocio).",
          "El deducible de gasolina solo cuenta si registraste millas (método de millaje IRS, 70¢/mi 2026).",
          "Categorías 'partial' (teléfono/internet) se deducen al 50%. Comidas al 50% (L24b).",
          "Esto es guía, no asesoría fiscal. Tu preparador debe confirmar.",
        ],
      };
    }
    default:
      return { error: `unknown tool: ${name}` };
  }
}
