"use client";
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { deriveKey, randomSaltB64, makeVerifier, verifyKey, encryptJSON, decryptJSON, generateVaultKey, wrapVaultKey, unwrapVaultKey, makeRecoveryCode } from "@/lib/crypto";

// Cofre de contraseñas cifrado de punta a punta. La clave maestra vive solo en
// memoria mientras el cofre está abierto: no se guarda en disco, no viaja al
// servidor, y el servidor solo almacena texto cifrado.
type Secret = { id: number; title: string; url: string; user: string; pass: string; note: string };
type Row = { id: number; blob: string };

export default function SecretsVault({ lang = "es", C, SF }: { lang?: string; C: Record<string, string>; SF: string }) {
  const es = lang === "es";
  const supabase = createClient();
  const [meta, setMeta] = useState<{ salt: string; verifier: string; wrapped_key: string; recovery_salt: string | null; recovery_wrapped_key: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [vaultKey, setVaultKey] = useState<CryptoKey | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [secrets, setSecrets] = useState<Secret[]>([]);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [newRecovery, setNewRecovery] = useState<string | null>(null);
  const [useRecovery, setUseRecovery] = useState(false);
  const [draft, setDraft] = useState<Secret | null>(null);
  const [query, setQuery] = useState("");
  const [reveal, setReveal] = useState<number | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.from("vault_meta").select("*").maybeSingle();
        setMeta(data || null);
      } catch { setMeta(null); }
      setLoading(false);
    })();
  }, [supabase]);

  const loadSecrets = useCallback(async (key: CryptoKey) => {
    const { data } = await supabase.from("secrets").select("id, blob").order("id", { ascending: false });
    const list = (data || []) as Row[];
    setRows(list);
    const out: Secret[] = [];
    for (const r of list) {
      try {
        const s = await decryptJSON<Omit<Secret, "id">>(key, r.blob);
        out.push({ id: r.id, ...s });
      } catch { /* entrada corrupta: se omite */ }
    }
    out.sort((a, b) => (a.title || "").localeCompare(b.title || ""));
    setSecrets(out);
  }, [supabase]);

  // Crear el cofre por primera vez.
  const createVault = async () => {
    setErr("");
    if (pw.length < 8) { setErr(es ? "Usa al menos 8 caracteres." : "Use at least 8 characters."); return; }
    if (pw !== pw2) { setErr(es ? "Las contraseñas no coinciden." : "Passwords do not match."); return; }
    setBusy(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("no user");
      const salt = randomSaltB64();
      const masterKey = await deriveKey(pw, salt);
      const vk = await generateVaultKey();
      const wrapped = await wrapVaultKey(vk, masterKey);
      const verifier = await makeVerifier(masterKey);
      const code = makeRecoveryCode();
      const recoverySalt = randomSaltB64();
      const recoveryKey = await deriveKey(code, recoverySalt);
      const recoveryWrapped = await wrapVaultKey(vk, recoveryKey);
      const row = { user_id: user.id, salt, verifier, wrapped_key: wrapped, recovery_salt: recoverySalt, recovery_wrapped_key: recoveryWrapped };
      const { error } = await supabase.from("vault_meta").upsert(row);
      if (error) throw new Error(error.message);
      setMeta({ salt, verifier, wrapped_key: wrapped, recovery_salt: recoverySalt, recovery_wrapped_key: recoveryWrapped });
      setVaultKey(vk);
      setNewRecovery(code);
      setPw(""); setPw2("");
      setSecrets([]);
    } catch (e) {
      setErr((e as { message?: string })?.message || (es ? "No se pudo crear el cofre." : "Could not create the vault."));
    }
    setBusy(false);
  };

  const unlock = async () => {
    if (!meta) return;
    setErr("");
    setBusy(true);
    try {
      if (useRecovery) {
        if (!meta.recovery_salt || !meta.recovery_wrapped_key) throw new Error(es ? "Este cofre no tiene código de recuperación." : "No recovery code on this vault.");
        const rKey = await deriveKey(pw.trim().toUpperCase(), meta.recovery_salt);
        const vk = await unwrapVaultKey(meta.recovery_wrapped_key, rKey);
        setVaultKey(vk);
        await loadSecrets(vk);
      } else {
        const mKey = await deriveKey(pw, meta.salt);
        const ok = await verifyKey(mKey, meta.verifier);
        if (!ok) throw new Error(es ? "Clave maestra incorrecta." : "Wrong master password.");
        const vk = await unwrapVaultKey(meta.wrapped_key, mKey);
        setVaultKey(vk);
        await loadSecrets(vk);
      }
      setPw("");
    } catch (e) {
      setErr((e as { message?: string })?.message || (es ? "No se pudo abrir." : "Could not unlock."));
    }
    setBusy(false);
  };

  const lock = () => { setVaultKey(null); setSecrets([]); setRows([]); setReveal(null); setPw(""); };

  const saveSecret = async () => {
    if (!draft || !vaultKey) return;
    if (!draft.title.trim()) return;
    setBusy(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("no user");
      const payload = { title: draft.title.trim(), url: draft.url.trim(), user: draft.user.trim(), pass: draft.pass, note: draft.note.trim() };
      const blob = await encryptJSON(vaultKey, payload);
      if (draft.id) await supabase.from("secrets").update({ blob, updated_at: new Date().toISOString() }).eq("id", draft.id);
      else await supabase.from("secrets").insert({ user_id: user.id, blob });
      setDraft(null);
      await loadSecrets(vaultKey);
    } catch (e) {
      setErr((e as { message?: string })?.message || "");
    }
    setBusy(false);
  };

  const deleteSecret = async (id: number) => {
    if (!vaultKey) return;
    if (typeof window !== "undefined" && !window.confirm(es ? "¿Borrar esta entrada?" : "Delete this entry?")) return;
    await supabase.from("secrets").delete().eq("id", id);
    setDraft(null);
    await loadSecrets(vaultKey);
  };

  const copy = async (text: string, tag: string) => {
    try { await navigator.clipboard.writeText(text); setCopiedId(tag); setTimeout(() => setCopiedId(null), 1400); } catch { /* noop */ }
  };

  const input: React.CSSProperties = { width: "100%", background: C.surface2, border: `1px solid ${C.border}`, borderRadius: 10, color: C.text, fontSize: 15, padding: "11px 13px", fontFamily: SF, outline: "none", marginTop: 6 };
  const label: React.CSSProperties = { fontSize: 10.5, letterSpacing: "0.14em", textTransform: "uppercase", color: C.mute, marginTop: 12 };
  const primary: React.CSSProperties = { width: "100%", height: 46, marginTop: 16, borderRadius: 12, border: "none", background: C.red, color: "#ffffff", fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: SF };

  if (loading) return <div style={{ padding: 24, color: C.mute, fontFamily: SF, fontSize: 13.5 }}>…</div>;

  // Pantalla del código de recuperación recién creado (se muestra una sola vez).
  if (newRecovery) {
    return (
      <div style={{ fontFamily: SF, paddingTop: 10 }}>
        <div style={{ fontSize: 18, fontWeight: 600, color: C.text }}>🔐 {es ? "Guarda tu código de recuperación" : "Save your recovery code"}</div>
        <div style={{ fontSize: 13.5, color: C.dim, marginTop: 8, lineHeight: 1.55 }}>
          {es ? "Es la ÚNICA forma de abrir tu cofre si olvidas la clave maestra. Anótalo en papel o guárdalo en un lugar seguro. No se puede volver a mostrar." : "This is the ONLY way in if you forget your master password. Write it down. It cannot be shown again."}
        </div>
        <div style={{ marginTop: 16, padding: "16px 14px", background: C.surface2, border: `1px solid ${C.goldSoft}`, borderRadius: 12, fontSize: 17, letterSpacing: "0.08em", textAlign: "center", color: C.gold, fontWeight: 600, wordBreak: "break-all" }}>{newRecovery}</div>
        <button onClick={() => copy(newRecovery, "rec")} style={{ ...primary, background: "transparent", border: `1px solid ${C.border}`, color: copiedId === "rec" ? C.ok : C.text, marginTop: 10 }}>{copiedId === "rec" ? (es ? "Copiado ✓" : "Copied ✓") : (es ? "Copiar código" : "Copy code")}</button>
        <button onClick={() => setNewRecovery(null)} style={primary}>{es ? "Ya lo guardé, continuar" : "Saved it, continue"}</button>
      </div>
    );
  }

  // Sin cofre todavía: crearlo.
  if (!meta) {
    return (
      <div style={{ fontFamily: SF, paddingTop: 10 }}>
        <div style={{ fontSize: 18, fontWeight: 600, color: C.text }}>🔐 {es ? "Crear cofre de contraseñas" : "Create password vault"}</div>
        <div style={{ fontSize: 13.5, color: C.dim, marginTop: 8, lineHeight: 1.55 }}>
          {es ? "Tus contraseñas se cifran en este teléfono con una clave maestra. Ni el servidor ni la IA pueden leerlas. Si olvidas la clave maestra y pierdes el código de recuperación, no hay forma de recuperarlas." : "Your passwords are encrypted on this device with a master password. Neither the server nor the AI can read them."}
        </div>
        <div style={label}>{es ? "Clave maestra" : "Master password"}</div>
        <input type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder={es ? "Mínimo 8 caracteres" : "At least 8 characters"} style={input} />
        <div style={label}>{es ? "Repite la clave maestra" : "Repeat master password"}</div>
        <input type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} onKeyDown={(e) => e.key === "Enter" && createVault()} style={input} />
        {err ? <div style={{ color: C.bad, fontSize: 12.5, marginTop: 10 }}>{err}</div> : null}
        <button onClick={createVault} disabled={busy} style={{ ...primary, opacity: busy ? 0.6 : 1 }}>{busy ? "…" : (es ? "Crear cofre" : "Create vault")}</button>
      </div>
    );
  }

  // Cofre cerrado: pedir clave maestra.
  if (!vaultKey) {
    return (
      <div style={{ fontFamily: SF, paddingTop: 10 }}>
        <div style={{ fontSize: 18, fontWeight: 600, color: C.text }}>🔒 {es ? "Cofre cerrado" : "Vault locked"}</div>
        <div style={{ fontSize: 13.5, color: C.dim, marginTop: 8 }}>{useRecovery ? (es ? "Escribe tu código de recuperación." : "Enter your recovery code.") : (es ? "Escribe tu clave maestra para abrirlo." : "Enter your master password.")}</div>
        <input
          type={useRecovery ? "text" : "password"}
          value={pw}
          onChange={(e) => setPw(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && unlock()}
          placeholder={useRecovery ? "XXXXXX-XXXXXX-XXXXXX-XXXXXX" : (es ? "Clave maestra" : "Master password")}
          autoFocus
          style={{ ...input, marginTop: 16 }}
        />
        {err ? <div style={{ color: C.bad, fontSize: 12.5, marginTop: 10 }}>{err}</div> : null}
        <button onClick={unlock} disabled={busy || !pw} style={{ ...primary, opacity: busy || !pw ? 0.6 : 1 }}>{busy ? "…" : (es ? "Abrir cofre" : "Unlock")}</button>
        <button onClick={() => { setUseRecovery((v) => !v); setPw(""); setErr(""); }} style={{ width: "100%", marginTop: 12, background: "transparent", border: "none", color: C.mute, fontSize: 12.5, cursor: "pointer", fontFamily: SF }}>
          {useRecovery ? (es ? "Usar clave maestra" : "Use master password") : (es ? "Olvidé mi clave maestra" : "I forgot my master password")}
        </button>
      </div>
    );
  }

  // Cofre abierto.
  const list = query.trim()
    ? secrets.filter((s) => (s.title + " " + s.url + " " + s.user).toLowerCase().includes(query.trim().toLowerCase()))
    : secrets;

  return (
    <div style={{ fontFamily: SF, paddingTop: 10 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
        <div style={{ fontSize: 18, fontWeight: 600, color: C.text }}>🔓 {es ? "Mis contraseñas" : "My passwords"}</div>
        <button onClick={lock} style={{ background: "transparent", border: `1px solid ${C.border}`, color: C.dim, borderRadius: 999, padding: "6px 13px", fontSize: 12, cursor: "pointer", fontFamily: SF }}>{es ? "Cerrar cofre" : "Lock"}</button>
      </div>

      <button onClick={() => setDraft({ id: 0, title: "", url: "", user: "", pass: "", note: "" })} style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, width: "100%", marginTop: 14, padding: "13px", borderRadius: 14, border: `1px dashed ${C.border}`, background: C.surface, color: C.gold, cursor: "pointer", fontFamily: SF, fontSize: 14.5, fontWeight: 600 }}>＋ {es ? "Agregar" : "Add"}</button>

      {secrets.length > 3 ? (
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder={es ? "Buscar…" : "Search…"} style={{ ...input, marginTop: 12 }} />
      ) : null}

      <div style={{ marginTop: 12 }}>
        {list.length === 0 ? (
          <div style={{ padding: "24px 14px", textAlign: "center", color: C.mute, fontSize: 13.5 }}>{es ? "Sin contraseñas aún. Agrega tu primer sitio." : "No passwords yet."}</div>
        ) : list.map((s) => (
          <div key={s.id} className="rise" style={{ background: C.surface, border: `1px solid ${C.borderSoft}`, borderRadius: 14, padding: "13px 14px", marginBottom: 9 }}>
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 15, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.title}</div>
                {s.user ? <div style={{ fontSize: 12, color: C.mute, marginTop: 3, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.user}</div> : null}
                {s.url ? <a href={s.url.startsWith("http") ? s.url : `https://${s.url}`} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} style={{ fontSize: 11.5, color: C.gold, textDecoration: "none", marginTop: 3, display: "inline-block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "100%" }}>{s.url} ↗</a> : null}
              </div>
              <button onClick={() => setDraft({ ...s })} style={{ background: "transparent", border: "none", color: C.mute, fontSize: 15, cursor: "pointer", padding: 4, flexShrink: 0 }}>✏️</button>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
              {s.user ? <button onClick={() => copy(s.user, `u${s.id}`)} style={{ background: "transparent", border: `1px solid ${C.border}`, color: copiedId === `u${s.id}` ? C.ok : C.dim, borderRadius: 999, padding: "6px 12px", fontSize: 11.5, cursor: "pointer", fontFamily: SF }}>{copiedId === `u${s.id}` ? "✓" : (es ? "Copiar usuario" : "Copy user")}</button> : null}
              {s.pass ? <button onClick={() => copy(s.pass, `p${s.id}`)} style={{ background: copiedId === `p${s.id}` ? "transparent" : C.gold, border: copiedId === `p${s.id}` ? `1px solid ${C.ok}` : "none", color: copiedId === `p${s.id}` ? C.ok : "#ffffff", borderRadius: 999, padding: "6px 13px", fontSize: 11.5, fontWeight: 600, cursor: "pointer", fontFamily: SF }}>{copiedId === `p${s.id}` ? (es ? "Copiada ✓" : "Copied ✓") : (es ? "Copiar clave" : "Copy password")}</button> : null}
              {s.pass ? <button onClick={() => setReveal(reveal === s.id ? null : s.id)} style={{ background: "transparent", border: `1px solid ${C.border}`, color: C.dim, borderRadius: 999, padding: "6px 12px", fontSize: 11.5, cursor: "pointer", fontFamily: SF }}>{reveal === s.id ? (es ? "Ocultar" : "Hide") : (es ? "Ver" : "Show")}</button> : null}
            </div>
            {reveal === s.id ? <div style={{ marginTop: 8, padding: "9px 11px", background: C.surface2, borderRadius: 8, fontSize: 14, color: C.text, wordBreak: "break-all", fontFamily: "ui-monospace, monospace" }}>{s.pass}</div> : null}
            {s.note ? <div style={{ fontSize: 12, color: C.mute, marginTop: 8, lineHeight: 1.5, whiteSpace: "pre-wrap" }}>{s.note}</div> : null}
          </div>
        ))}
      </div>

      {draft ? (
        <div onClick={() => setDraft(null)} style={{ position: "fixed", inset: 0, zIndex: 140, background: "rgba(0,0,0,.6)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 460, background: C.bg, borderTopLeftRadius: 22, borderTopRightRadius: 22, padding: "20px 20px calc(24px + env(safe-area-inset-bottom))", maxHeight: "88vh", overflowY: "auto", border: `1px solid ${C.border}` }}>
            <div style={{ fontSize: 17, fontWeight: 600, color: C.text }}>{draft.id ? (es ? "Editar" : "Edit") : (es ? "Nueva contraseña" : "New password")}</div>
            <div style={label}>{es ? "Nombre" : "Name"}</div>
            <input value={draft.title} onChange={(e) => setDraft({ ...draft, title: e.target.value })} placeholder={es ? "Ej. Chase, Netflix, IRS" : "e.g. Chase"} style={input} autoFocus />
            <div style={label}>{es ? "Link" : "Link"}</div>
            <input value={draft.url} onChange={(e) => setDraft({ ...draft, url: e.target.value })} placeholder="chase.com" style={input} inputMode="url" autoCapitalize="none" />
            <div style={label}>{es ? "Usuario o correo" : "Username or email"}</div>
            <input value={draft.user} onChange={(e) => setDraft({ ...draft, user: e.target.value })} style={input} autoCapitalize="none" />
            <div style={label}>{es ? "Contraseña" : "Password"}</div>
            <input value={draft.pass} onChange={(e) => setDraft({ ...draft, pass: e.target.value })} style={input} autoCapitalize="none" />
            <div style={label}>{es ? "Nota (opcional)" : "Note (optional)"}</div>
            <textarea value={draft.note} onChange={(e) => setDraft({ ...draft, note: e.target.value })} rows={2} style={{ ...input, resize: "vertical", lineHeight: 1.45 }} />
            <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
              {draft.id ? <button onClick={() => deleteSecret(draft.id)} style={{ padding: "0 18px", height: 46, borderRadius: 12, border: `1px solid ${C.border}`, background: "transparent", color: C.bad, cursor: "pointer", fontFamily: SF, fontSize: 14 }}>{es ? "Borrar" : "Delete"}</button> : null}
              <button onClick={saveSecret} disabled={busy || !draft.title.trim()} style={{ flex: 1, height: 46, borderRadius: 12, border: "none", background: C.red, color: "#ffffff", fontSize: 15, fontWeight: 600, cursor: "pointer", fontFamily: SF, opacity: busy || !draft.title.trim() ? 0.6 : 1 }}>{busy ? "…" : (es ? "Guardar" : "Save")}</button>
            </div>
          </div>
        </div>
      ) : null}

      <div style={{ fontSize: 11, color: C.mute, marginTop: 16, lineHeight: 1.5 }}>
        🔒 {es ? "Cifrado en tu dispositivo. Ni el servidor ni la IA pueden leer estas contraseñas." : "Encrypted on your device. Neither the server nor the AI can read these."}
      </div>
      <div style={{ height: 8 }} />
    </div>
  );
}
