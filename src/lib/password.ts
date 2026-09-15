// Cloudflare Workers 런타임에는 bcrypt 네이티브 바인딩이 없어
// Web Crypto의 PBKDF2로 비밀번호를 해싱합니다.

const ITERATIONS = 100_000;
const KEY_LENGTH_BITS = 256;

function toHex(buffer: ArrayBuffer | Uint8Array): string {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function fromHex(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

async function pbkdf2(password: string, salt: Uint8Array): Promise<ArrayBuffer> {
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  return crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: ITERATIONS, hash: "SHA-256" },
    keyMaterial,
    KEY_LENGTH_BITS
  );
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const derived = await pbkdf2(password, salt);
  return `${toHex(salt)}:${toHex(derived)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [saltHex, hashHex] = stored.split(":");
  if (!saltHex || !hashHex) return false;
  const derived = await pbkdf2(password, fromHex(saltHex));
  const derivedHex = toHex(derived);
  // 타이밍 공격 방지를 위한 상수 시간 비교
  if (derivedHex.length !== hashHex.length) return false;
  let diff = 0;
  for (let i = 0; i < derivedHex.length; i++) {
    diff |= derivedHex.charCodeAt(i) ^ hashHex.charCodeAt(i);
  }
  return diff === 0;
}
