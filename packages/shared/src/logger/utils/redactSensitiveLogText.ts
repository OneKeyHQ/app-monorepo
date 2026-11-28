// The desktop file logger applies these key-material patterns to every line
// (apps/desktop/app/logger.ts). Browser logs are persisted as written, so web
// and extension exports apply the same patterns before building the archive.
const SENSITIVE_LOG_PATTERNS: RegExp[] = [
  /(?:0x)?[0-9a-fA-F]{64}/g,
  /\b[5KL][1-9A-HJ-NP-Za-km-z]{50,51}\b/g,
  /\b[xyzXYZ](?:prv|pub)[1-9A-HJ-NP-Za-km-z]{107,108}\b/g,
  /(?:\b[a-z]{3,8}\b[\s,]+){11,}\b[a-z]{3,8}\b/g,
  /(?:Bearer|token[=:]?)\s*[A-Za-z0-9_.\-+/=]{20,}/g,
  /(?:eyJ|AAAA)[A-Za-z0-9+/=]{40,}/g,
];

const REDACTED = '[REDACTED]';
const PUBLIC_TX_ID = '(?:0x)?[0-9a-fA-F]{64}';
// Public transaction ids share the 64-hex shape of a raw private key. Keep
// them when they sit in a known transaction field; every other 64-hex value
// is still redacted.
const PUBLIC_TX_ID_FIELD = new RegExp(
  `("(?:txid|txId|txHash|transactionHash|transactionId|txids)"\\s*:\\s*)((?:"${PUBLIC_TX_ID}")|(?:\\[\\s*(?:"${PUBLIC_TX_ID}"\\s*,\\s*)*"${PUBLIC_TX_ID}"\\s*\\]))`,
  'g',
);

function redactLine(line: string) {
  const saved: string[] = [];
  const shielded = line.replace(PUBLIC_TX_ID_FIELD, (_match, key, value) => {
    const token = `\u0000TX${saved.length}\u0000`;
    saved.push(value as string);
    return `${key as string}${token}`;
  });
  const redacted = SENSITIVE_LOG_PATTERNS.reduce(
    (result, pattern) => result.replace(pattern, REDACTED),
    shielded,
  );
  return saved.reduce(
    (result, value, index) => result.replace(`\u0000TX${index}\u0000`, value),
    redacted,
  );
}

// Applied line by line so a pattern never spans two log entries.
export function redactSensitiveLogText(text: string): string {
  return text
    .split('\n')
    .map((line) => redactLine(line))
    .join('\n');
}
