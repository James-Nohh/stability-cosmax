// 사용법: node scripts/hash-password.mjs <username> <password>
// 출력된 SQL을 `wrangler d1 execute DB --remote --command "..."` 로 실행해 관리자 계정을 만드세요.
import { webcrypto as crypto } from "node:crypto";

const ITERATIONS = 100_000;
const KEY_LENGTH_BITS = 256;

function toHex(buffer) {
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const derived = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations: ITERATIONS, hash: "SHA-256" },
    keyMaterial,
    KEY_LENGTH_BITS
  );
  return `${toHex(salt)}:${toHex(derived)}`;
}

const [username, password] = process.argv.slice(2);
if (!username || !password) {
  console.error("사용법: node scripts/hash-password.mjs <username> <password>");
  process.exit(1);
}

const hash = await hashPassword(password);
const sql = `INSERT INTO users (username, password_hash) VALUES ('${username.replace(/'/g, "''")}', '${hash}');`;

console.log("\n아래 SQL을 실행하세요:\n");
console.log(sql);
console.log("\n예)");
console.log(`wrangler d1 execute DB --remote --command "${sql.replace(/"/g, '\\"')}"\n`);
