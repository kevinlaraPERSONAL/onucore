import type { SupabaseClient } from "@supabase/supabase-js";

// Data layer for onucore: translates between the app's in-memory shapes
// (camelCase, e.g. dateISO) and the Postgres rows (snake_case, e.g. date_iso),
// and reads/writes through Supabase. Row Level Security guarantees each user
// only ever touches their own rows.

/* eslint-disable @typescript-eslint/no-explicit-any */
type Any = any;

const orNull = (v: Any) => (v === "" || v === undefined ? null : v);

// ---------- items ----------
function itemToRow(it: Any, userId: string) {
  return {
    id: it.id,
    user_id: userId,
    type: it.type,
    area: it.area ?? "personal",
    title: it.title ?? "",
    detail: it.detail ?? "",
    amount: typeof it.amount === "number" ? it.amount : null,
    date_iso: orNull(it.dateISO),
    date_label: it.dateLabel ?? "",
    person: it.person ?? "",
    priority: it.priority ?? "medium",
    done: !!it.done,
    photo_url: it.photo ?? it.photo_url ?? null,
    source: it.source ?? "app",
  };
}
function itemFromRow(r: Any) {
  return {
    id: r.id, type: r.type, area: r.area, title: r.title, detail: r.detail ?? "",
    amount: r.amount === null ? null : Number(r.amount),
    dateISO: r.date_iso ?? null, dateLabel: r.date_label ?? "", person: r.person ?? "",
    priority: r.priority ?? "medium", done: !!r.done, photo: r.photo_url ?? null,
    source: r.source ?? "app",
  };
}

// ---------- txns ----------
function txnToRow(tx: Any, userId: string) {
  return {
    id: tx.id,
    user_id: userId,
    kind: tx.kind,
    amount: Number(tx.amount) || 0,
    cat: tx.cat,
    account: tx.account ?? "",
    date_iso: orNull(tx.dateISO) ?? new Date().toISOString().slice(0, 10),
    note: tx.note ?? "",
    ded: !!tx.ded,
    source: tx.source ?? "app",
  };
}
function txnFromRow(r: Any) {
  return {
    id: r.id, kind: r.kind, amount: Number(r.amount), cat: r.cat, account: r.account ?? "",
    dateISO: r.date_iso, note: r.note ?? "", ded: !!r.ded, source: r.source ?? "app",
  };
}

// ---------- profile ----------
function profileToRow(p: Any) {
  return {
    name: p.name ?? "", nickname: p.nickname ?? "", role: p.role ?? "", photo_url: p.photo ?? null,
    tone: p.tone ?? "casual", birthday: orNull(p.birthday), whatsapp: p.whatsapp ?? "",
    city: p.city ?? "", tz: p.tz ?? "", dietary: p.dietary ?? "", about: p.about ?? "",
    hobbies: p.hobbies ?? [], people: p.people ?? [], goals: p.goals ?? [],
    wake: p.wake ?? "", work_hours: p.workHours ?? "", briefing_time: p.briefingTime ?? "",
    notif: !!p.notif, brief_len: p.briefLen ?? "short", reminder_style: p.reminderStyle ?? "gentle",
    notify_channel: p.notifyChannel ?? "push", quiet: p.quiet ?? "",
    default_account: p.defaultAccount ?? "amex", set_aside_pct: p.setAsidePct ?? 30,
    conns: p.conns ?? {}, lang: p.lang ?? "es",
  };
}
function profileFromRow(r: Any) {
  return {
    name: r.name ?? "", nickname: r.nickname ?? "", role: r.role ?? "", photo: r.photo_url ?? null,
    tone: r.tone ?? "casual", birthday: r.birthday ?? "", whatsapp: r.whatsapp ?? "",
    city: r.city ?? "", tz: r.tz ?? "", dietary: r.dietary ?? "", about: r.about ?? "",
    hobbies: r.hobbies ?? [], people: r.people ?? [], goals: r.goals ?? [],
    wake: r.wake ?? "", workHours: r.work_hours ?? "", briefingTime: r.briefing_time ?? "",
    notif: r.notif ?? true, briefLen: r.brief_len ?? "short", reminderStyle: r.reminder_style ?? "gentle",
    notifyChannel: r.notify_channel ?? "push", quiet: r.quiet ?? "",
    defaultAccount: r.default_account ?? "amex", setAsidePct: r.set_aside_pct ?? 30,
    conns: r.conns ?? {},
  };
}

// ---------- reads / writes ----------
export async function loadAll(supabase: SupabaseClient, userId: string) {
  const [itemsRes, txnsRes, profRes] = await Promise.all([
    supabase.from("items").select("*").order("created_at", { ascending: false }),
    supabase.from("txns").select("*").order("created_at", { ascending: false }),
    supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
  ]);
  return {
    items: (itemsRes.data ?? []).map(itemFromRow),
    txns: (txnsRes.data ?? []).map(txnFromRow),
    profile: profRes.data ? profileFromRow(profRes.data) : null,
  };
}

export function upsertItem(supabase: SupabaseClient, it: Any, userId: string) {
  return supabase.from("items").upsert(itemToRow(it, userId));
}
export function deleteItem(supabase: SupabaseClient, id: string) {
  return supabase.from("items").delete().eq("id", id);
}
export function upsertTxn(supabase: SupabaseClient, tx: Any, userId: string) {
  return supabase.from("txns").upsert(txnToRow(tx, userId));
}
export function deleteTxn(supabase: SupabaseClient, id: string) {
  return supabase.from("txns").delete().eq("id", id);
}
export function saveProfile(supabase: SupabaseClient, p: Any, userId: string) {
  return supabase.from("profiles").update(profileToRow(p)).eq("id", userId);
}
