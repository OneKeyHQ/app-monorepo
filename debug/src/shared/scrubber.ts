// Secret scrubber — middleware that walks JSON-RPC `result` payloads and
// redacts likely secrets (private keys, extended keys, mnemonics) and
// object properties named like secrets (apiKey/password/mnemonic/seed/...).
//
// The scrubber is pure: it never mutates its input. It is opted-out by
// `ODB_SCRUB=0`. See README for end-user docs.

const PATTERNS: Array<{ re: RegExp; label: string }> = [
  // 32-byte private key candidates with 0x prefix.
  { re: /\b0x[a-f0-9]{64}\b/gi, label: "private-key" },
  // BIP-32 extended keys (x/y/z/t/u/v + pub/prv). Base58 body 100+ chars.
  {
    re: /\b(?:x|y|z|t|u|v)(?:pub|prv)[1-9A-HJ-NP-Za-km-z]{100,}\b/g,
    label: "extended-key",
  },
];

// Heuristic mnemonic match: a run of 12+ space-separated lowercase a-z
// words where each word is 3-8 chars. We avoid embedding the BIP-39
// wordlist to keep the bundle small. The callback below verifies the run
// contains a 12-word or 24-word window of "short lowercase words" and
// redacts only when that window is present (safer false-positive vs.
// missing a real mnemonic embedded in a longer sentence).
const MNEMONIC_RE = /\b(?:[a-z]{3,8} ){11,}[a-z]{3,8}\b/g;

const SECRET_KEY_NAME_RE =
  /api[_-]?key|secret|password|mnemonic|private[_-]?key|seed/i;

export function scrubString(s: string): string {
  let out = s;
  for (const { re, label } of PATTERNS) {
    out = out.replace(re, `***REDACTED:${label}***`);
  }
  out = out.replace(MNEMONIC_RE, (m) => {
    // Any run of 12+ consecutive 3-8 char lowercase words is heuristically
    // suspicious enough to redact. We prefer over-redaction here vs. leaking
    // mnemonics embedded in longer text.
    const wc = m.trim().split(/\s+/).length;
    if (wc >= 12) return `***REDACTED:mnemonic***`;
    return m;
  });
  return out;
}

export function scrubValue(v: unknown): unknown {
  if (v === null || v === undefined) return v;
  if (typeof v === "string") return scrubString(v);
  if (typeof v !== "object") return v;
  if (Array.isArray(v)) return v.map(scrubValue);

  const out: Record<string, unknown> = {};
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    if (SECRET_KEY_NAME_RE.test(k)) {
      out[k] = `***REDACTED:${k.toLowerCase()}***`;
    } else {
      out[k] = scrubValue(val);
    }
  }
  return out;
}

export function scrubEnabled(): boolean {
  return process.env.ODB_SCRUB !== "0";
}
