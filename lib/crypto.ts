// Cifrado del cofre de contraseñas. TODO ocurre en el dispositivo:
// la clave maestra nunca se guarda ni se envía, y el servidor solo ve
// texto cifrado (AES-GCM 256) que no puede descifrar.

const enc = new TextEncoder();
const dec = new TextDecoder();

const b64 = (buf: ArrayBuffer | Uint8Array) => {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
};
const unb64 = (s: string) => {
  const raw = atob(s);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
};

// Derive an AES key from a passphrase (PBKDF2, 310k iterations — OWASP's floor
// for SHA-256). The salt is per-user and stored in the clear; it is not a
// secret, it only stops precomputed-table attacks.
export async function deriveKey(passphrase: string, saltB64: string): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey("raw", enc.encode(passphrase), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: unb64(saltB64), iterations: 310000, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"],
  );
}

// The secrets are encrypted with a random VAULT KEY, and that key is stored
// twice: wrapped by the master password and wrapped by the recovery code.
// Either one unlocks the same vault, and changing the password only rewraps
// the key (no need to re-encrypt every secret).
export async function generateVaultKey(): Promise<CryptoKey> {
  return crypto.subtle.generateKey({ name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]);
}

export async function wrapVaultKey(vaultKey: CryptoKey, wrappingKey: CryptoKey): Promise<string> {
  const raw = await crypto.subtle.exportKey("raw", vaultKey);
  return encryptJSON(wrappingKey, b64(raw));
}

export async function unwrapVaultKey(wrappedB64: string, wrappingKey: CryptoKey): Promise<CryptoKey> {
  const rawB64 = await decryptJSON<string>(wrappingKey, wrappedB64);
  return crypto.subtle.importKey("raw", unb64(rawB64), { name: "AES-GCM" }, true, ["encrypt", "decrypt"]);
}

export function randomSaltB64(): string {
  return b64(crypto.getRandomValues(new Uint8Array(16)));
}

// Each encryption gets a fresh 12-byte IV, prepended to the ciphertext.
export async function encryptJSON(key: CryptoKey, value: unknown): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const data = enc.encode(JSON.stringify(value));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, data);
  const merged = new Uint8Array(iv.length + ct.byteLength);
  merged.set(iv, 0);
  merged.set(new Uint8Array(ct), iv.length);
  return b64(merged);
}

export async function decryptJSON<T>(key: CryptoKey, blobB64: string): Promise<T> {
  const merged = unb64(blobB64);
  const iv = merged.slice(0, 12);
  const ct = merged.slice(12);
  const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
  return JSON.parse(dec.decode(plain)) as T;
}

// A known plaintext encrypted with the key: lets us tell "wrong master
// password" apart from "corrupted data" without ever storing the password.
const CHECK_VALUE = "onucore-vault-v1";

export async function makeVerifier(key: CryptoKey): Promise<string> {
  return encryptJSON(key, CHECK_VALUE);
}

export async function verifyKey(key: CryptoKey, verifierB64: string): Promise<boolean> {
  try {
    const v = await decryptJSON<string>(key, verifierB64);
    return v === CHECK_VALUE;
  } catch {
    return false;
  }
}

// One-time recovery code: a random 24-char code that can also unlock the vault.
// We store the master key encrypted under a key derived from this code, so the
// user can get back in if they forget the password (but lose everything if they
// lose both).
export function makeRecoveryCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // sin I/O/0/1 para no confundir
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  let out = "";
  for (let i = 0; i < 24; i++) {
    out += alphabet[bytes[i] % alphabet.length];
    if (i % 6 === 5 && i < 23) out += "-";
  }
  return out;
}
