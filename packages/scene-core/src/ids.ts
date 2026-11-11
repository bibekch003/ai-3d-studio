const ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyz";

function randomBytes(n: number): Uint8Array {
  const out = new Uint8Array(n);
  const c = (globalThis as { crypto?: Crypto }).crypto;
  if (c && typeof c.getRandomValues === "function") {
    c.getRandomValues(out);
    return out;
  }
  for (let i = 0; i < n; i += 1) out[i] = Math.floor(Math.random() * 256);
  return out;
}

/** Short, URL-safe, collision-resistant id with a readable prefix. */
export function newId(prefix = "id"): string {
  const bytes = randomBytes(12);
  let body = "";
  for (const b of bytes) body += ALPHABET[b % ALPHABET.length];
  return `${prefix}_${body}`;
}

export function isId(value: string, prefix?: string): boolean {
  const re = prefix ? new RegExp(`^${prefix}_[0-9a-z]{8,}$`) : /^[a-z_]+_[0-9a-z]{8,}$/;
  return re.test(value);
}
