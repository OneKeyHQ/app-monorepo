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

// Applied line by line so a pattern never spans two log entries.
export function redactSensitiveLogText(text: string): string {
  return text
    .split('\n')
    .map((line) =>
      SENSITIVE_LOG_PATTERNS.reduce(
        (result, pattern) => result.replace(pattern, REDACTED),
        line,
      ),
    )
    .join('\n');
}
