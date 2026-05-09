// Pure error-taxonomy utilities for the bundle / app update pipeline.
// Extracted from UpdateReminder/hooks.tsx so the regex catalog and the
// PII scrubber can be unit-tested independently of the React hooks
// that wire them into download / verify / install flows.

/**
 * Defense-in-depth scrubber for free-text error messages before they leave
 * the client. The native modules try not to embed PII, but Node.js fs errors
 * (ENOENT/EACCES on Desktop) and iOS NSError.localizedDescription can carry
 * the user's home-dir path with their OS username, e.g.
 *   "ENOENT: no such file ... open '/Users/john/Library/Application Support/OneKey/...'"
 * Redacting the username segment here means even an unsanitized native
 * payload cannot leak it into Mixpanel.
 *
 * Patterns redacted:
 *   - URL query / fragment       https://host/file?token=… → https://host/file?<redacted>
 *   - macOS  /Users/<name>/...           → /Users/<redacted>/...
 *   - Windows C:\Users\<name>\...        → C:\Users\<redacted>\...
 *   - Linux  /home/<name>/...            → /home/<redacted>/...
 *   - macOS  /var/mobile/Containers/...  → /var/mobile/Containers/<redacted>/... (iOS install UUID)
 *   - Android /data/data/<pkg>/...       → /data/data/<redacted>/...
 *   - Android /data/user/<u>/<pkg>/...   → /data/user/<u>/<redacted>/...
 *
 * Username terminators omit `\s` so usernames containing spaces (common on
 * macOS / Windows: "John Doe") don't half-leak via the trailing segment.
 *
 * Also caps total length at 240 chars so a runaway stack trace cannot
 * inflate event payloads.
 */
const MAX_ERROR_MESSAGE_LENGTH = 240;
export function sanitizeUpdateErrorMessage(error: unknown): string | undefined {
  const raw =
    typeof error === 'string'
      ? error
      : (error as { message?: string } | null)?.message;
  if (!raw) return undefined;
  let cleaned = raw
    // Strip URL query / fragment (signed-download tokens, oauth state, etc.).
    // Keep the path so the host + filename stay useful for debugging.
    .replace(/\bhttps?:\/\/[^\s'")]+/gi, (url) =>
      url.replace(/([?#]).*$/, '$1<redacted>'),
    )
    .replace(/(\/Users\/)([^/'"]+)/g, '$1<redacted>')
    .replace(/(\\Users\\)([^\\'"]+)/g, '$1<redacted>')
    .replace(/(\/home\/)([^/'"]+)/g, '$1<redacted>')
    .replace(
      /(\/var\/mobile\/Containers\/(?:Data|Bundle)\/Application\/)([^/'"\s]+)/g,
      '$1<redacted>',
    )
    // iOS App Group containers (per-install UUID); same risk surface
    // as Data/Bundle/Application UUIDs above.
    .replace(
      /(\/var\/mobile\/Containers\/Shared\/AppGroup\/)([^/'"\s]+)/g,
      '$1<redacted>',
    )
    // Android per-app internal storage paths. FileOutputStream / fs IO
    // exceptions on Android embed these, including the package name.
    // /data/user/<id>/<pkg>/ is checked before /data/data/<pkg>/ so the
    // longer-prefix match wins.
    .replace(/(\/data\/user\/\d+\/)([^/'"\s]+)/g, '$1<redacted>')
    .replace(/(\/data\/data\/)([^/'"\s]+)/g, '$1<redacted>');
  if (cleaned.length > MAX_ERROR_MESSAGE_LENGTH) {
    cleaned = `${cleaned.slice(0, MAX_ERROR_MESSAGE_LENGTH)}…`;
  }
  return cleaned;
}

/**
 * Maps a thrown bundle-update error into a stable, low-cardinality code so
 * Mixpanel can aggregate failures by category instead of unique message
 * strings. Recognized payloads (in priority order):
 *
 *   - Native SHA256 subtypes:
 *       iOS/Android throw "Bundle SHA256 verification failed: <REASON>"
 *       Desktop throws    "Downloaded file is not valid: SHA256_<REASON>"
 *     Both normalize to "SHA256_<REASON>".
 *   - HTTP failures:        "HTTP 416", "HTTP error 504"      → "HTTP_<code>"
 *   - iOS URLSession errors: "NSURLErrorDomain -1005"          → "NSURL_-1005"
 *   - Generic IO bubble:    "IO_FileNotFoundException", etc.   → "IO_<class>"
 *
 * Falls back to undefined so the analytics event simply lacks errorCode
 * rather than carrying a noisy free-text string.
 */
export function extractUpdateErrorCode(error: unknown): string | undefined {
  const msg =
    typeof error === 'string'
      ? error
      : ((error as { message?: string } | null)?.message ?? '');
  if (!msg) return undefined;

  // SHA reasons can include native error class names mixed with digits
  // and dashes (e.g. iOS "IO_NSCocoaErrorDomain_257" or Android
  // "IO_FileNotFoundException"). Widen char class beyond A-Z so the
  // payload survives intact end-to-end.
  const sha256 = msg.match(
    /(?:Bundle\s+SHA256\s+verification\s+failed:\s+|SHA256_)([A-Za-z][A-Za-z0-9_-]*)/,
  );
  if (sha256) return `SHA256_${sha256[1].toUpperCase()}`;

  // Match the canonical "HTTP <code>" / "HTTP error <code>" shape AND
  // the legacy "Download failed with status: <code>" / "status: <code>"
  // form that older Desktop reject sites used. The status: branch is
  // here for back-compat with rejected promises that pre-date the
  // canonical shape; new throws should use "HTTP <code>".
  const http = msg.match(/HTTP\s+(?:error\s+)?(\d{3})|status:\s*(\d{3})/i);
  if (http) return `HTTP_${http[1] ?? http[2]}`;

  const nsUrl = msg.match(/NSURLErrorDomain[^-\d]*(-?\d+)/);
  if (nsUrl) return `NSURL_${nsUrl[1]}`;

  const io = msg.match(/\b(IO_[A-Za-z][A-Za-z0-9_]*)/);
  if (io) return io[1];

  return undefined;
}

/**
 * Codes that mean a retry will deterministically fail the same way — either
 * the server actively rejects us (auth, gone, malformed), or the bytes we
 * have on disk are already verified-bad (SHA256 mismatch — partial gets
 * wiped, retrying just re-downloads the same bad payload). Bail immediately
 * for these so we don't burn three round-trips on a known-dead state.
 */
export const UNRECOVERABLE_DOWNLOAD_ERROR_CODES = new Set<string>([
  'SHA256_MISMATCH',
  'HTTP_403',
  'HTTP_404',
  'HTTP_410',
]);

export function isUnrecoverableDownloadError(error: unknown): boolean {
  const code = extractUpdateErrorCode(error);
  if (code && UNRECOVERABLE_DOWNLOAD_ERROR_CODES.has(code)) return true;
  // Programmer/config-error throws — extractUpdateErrorCode returns undefined
  // for these because the messages are plain English. Match the canonical
  // set thrown by the native modules.
  const msg = (error as { message?: string } | null)?.message ?? '';
  return (
    msg.includes('Bundle download URL must use HTTPS') ||
    msg.includes('Invalid version string format') ||
    msg.includes('Already downloading') ||
    msg.includes('Invalid URL')
  );
}
