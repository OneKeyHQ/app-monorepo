// cspell:ignore OCDS
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
 * OCDS v1.1 §4 failure classification. The downloader's two failure classes
 * have opposite recoveries, so every HTTP status must resolve to exactly one
 * of them. This shared map is the single source of truth that each native
 * classifier (iOS / Android / Node) MUST agree with — a code marked permanent
 * here but transient natively (or vice-versa) double-handles a download.
 *
 *   Permanent → concurrency is fundamentally unusable for this object; the
 *               already-fetched bytes are unsalvageable, fall back / give up.
 *   Transient → the transfer was interrupted but is resumable; keep artifacts
 *               and retry.
 *
 * The §4 default rule (used for any status not explicitly listed):
 *   - 4xx → Permanent, EXCEPT 408 and 429 → Transient
 *   - 5xx → Transient, EXCEPT 501 and 505 → Permanent
 *   - anything else / unknown → Permanent
 *
 * 401 / 403 are Permanent *for this URL* specifically (auth / expired signed
 * URL): the caller should fetch a fresh signed URL rather than blindly retry
 * the dead one (see runDownloadWithRetry's url-refresh path).
 */
export type IHttpStatusClass = 'permanent' | 'transient';

// Explicit §4 table rows that override the default rule. Statuses absent here
// fall through to the 4xx/5xx default logic in classifyHttpStatus.
const HTTP_STATUS_TRANSIENT_OVERRIDES = new Set<number>([
  408, // request timeout → retry
  416, // range-not-satisfiable on a resume request → re-evaluate size, keep
  429, // throttling → back off + retry
]);
const HTTP_STATUS_PERMANENT_OVERRIDES = new Set<number>([
  401, // auth required / expired signed URL (permanent for THIS url)
  403, // forbidden / expired signed URL (permanent for THIS url)
  404, // not found
  410, // gone
  501, // not implemented
  505, // http version not supported
]);

/**
 * Classify a raw HTTP status code per OCDS v1.1 §4, including the catch-all
 * default rule so the "exactly one of two classes" property holds for every
 * code, listed or not. Returns `'permanent'` for non-numeric / unknown input.
 */
export function classifyHttpStatus(status: number): IHttpStatusClass {
  if (!Number.isFinite(status)) return 'permanent';
  if (HTTP_STATUS_TRANSIENT_OVERRIDES.has(status)) return 'transient';
  if (HTTP_STATUS_PERMANENT_OVERRIDES.has(status)) return 'permanent';
  // 4xx → Permanent (the transient 4xx exceptions are in the override set).
  if (status >= 400 && status <= 499) return 'permanent';
  // 5xx → Transient (the permanent 5xx exceptions are in the override set).
  if (status >= 500 && status <= 599) return 'transient';
  // Anything else / unknown → Permanent.
  return 'permanent';
}

/**
 * True when a permanent-class HTTP status means "this URL is dead, obtain a
 * fresh signed URL" rather than "give up entirely". Per §4 these are 401/403.
 * The caller may retry ONCE against a freshly-signed URL before treating the
 * download as terminal.
 */
export function isPermanentThisUrlHttpStatus(status: number): boolean {
  return status === 401 || status === 403;
}

/**
 * Codes that mean a retry will deterministically fail the same way — either
 * the server actively rejects us (auth, gone, malformed), or the bytes we
 * have on disk are already verified-bad (SHA256 mismatch — partial gets
 * wiped, retrying just re-downloads the same bad payload). Bail immediately
 * for these so we don't burn three round-trips on a known-dead state.
 *
 * Mirrors the permanent rows of HTTP_STATUS_PERMANENT_OVERRIDES (§4). Kept as
 * a code-string set because isUnrecoverableDownloadError works off the
 * normalized error code, not a raw numeric status. 401/403 are permanent for
 * THIS url (caller should refresh the signed URL) but still unrecoverable for
 * the current attempt, so they bail here too.
 */
export const UNRECOVERABLE_DOWNLOAD_ERROR_CODES = new Set<string>([
  'SHA256_MISMATCH',
  'HTTP_401',
  'HTTP_403',
  'HTTP_404',
  'HTTP_410',
  'HTTP_501',
  'HTTP_505',
]);

export function isUnrecoverableDownloadError(error: unknown): boolean {
  const code = extractUpdateErrorCode(error);
  if (code && UNRECOVERABLE_DOWNLOAD_ERROR_CODES.has(code)) return true;
  // A raw HTTP code that didn't surface as one of the known unrecoverable
  // strings above still has to obey the §4 default rule, so a code marked
  // permanent there (e.g. 451, 502→transient is fine, 555→permanent) bails
  // here instead of re-spending the retry budget on a deterministically-dead
  // status.
  const status = extractHttpStatusFromError(error);
  if (status !== undefined && classifyHttpStatus(status) === 'permanent') {
    return true;
  }
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

/**
 * Pull a numeric HTTP status out of a thrown download error, if the message
 * carries one in a recognized shape ("HTTP 416", "HTTP error 504",
 * "status: 503"). Returns undefined for non-HTTP errors. Used so the retry
 * loop can run §4 classification (classifyHttpStatus) and the 401/403
 * url-refresh check off the same error object.
 */
export function extractHttpStatusFromError(error: unknown): number | undefined {
  const code = extractUpdateErrorCode(error);
  if (code && code.startsWith('HTTP_')) {
    const parsed = Number(code.slice('HTTP_'.length));
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

/**
 * True when a download error is a permanent-this-URL (401/403) failure: the
 * URL is dead (auth / expired signed URL) but a freshly-signed URL may still
 * work, so the caller should refresh it and retry once rather than give up.
 */
export function isPermanentThisUrlDownloadError(error: unknown): boolean {
  const status = extractHttpStatusFromError(error);
  return status !== undefined && isPermanentThisUrlHttpStatus(status);
}
