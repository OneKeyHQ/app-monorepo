/**
 * Shared URL-safety policy for the WebView overlay route.
 *
 * Single source of truth used by:
 *   - `openWebView()` (in-app entry function)
 *   - `parseWebViewDeepLink()` (deeplink decoder)
 *   - `WebViewPage`'s `onShouldStartLoadWithRequest` (per-navigation guard)
 *   - `notificationsUtils.parseNotificationPayload`'s `openInApp` branch
 *     (including the extension-background `openUrlExternal` fallback, so the
 *     notification entry stays platform-independent — see PR #11542 review).
 *
 * Lives in `@onekeyhq/shared` so background runtimes (extension service worker,
 * shared notification handlers) can import it without violating the
 * shared → kit import-hierarchy rule.
 *
 * All checks fail closed (silent reject; never throws).
 */

import { containsPunycode } from './uriUtils';

const HTTPS_REGEX = /^https:\/\//i;
const MAX_URL_LENGTH = 2048;
const IPV4_REGEX = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/;

// Only the default https port (443) is allowed. Custom ports may indicate
// dev/internal services or SSRF-via-public-host attempts (e.g. an attacker
// pointing the deeplink at `https://attacker.com:8443/exfil`).
const ALLOWED_PORTS = new Set(['', '443']);

// Direct-download URL extensions that should never auto-load in this overlay.
// Limited to binary/archive/installer extensions where there's no legitimate
// inline-rendering use case. Documents (.pdf/.docx) and media (.mp4/.mp3) are
// intentionally NOT in this list because mobile webviews render them inline.
const DOWNLOAD_EXTENSIONS = [
  '.zip',
  '.7z',
  '.rar',
  '.tar',
  '.tar.gz',
  '.tgz',
  '.gz',
  '.bz2',
  '.exe',
  '.msi',
  '.dmg',
  '.pkg',
  '.apk',
  '.ipa',
  '.deb',
  '.rpm',
  '.iso',
  '.img',
  '.bin',
];

function isLikelyDownloadPath(pathname: string): boolean {
  // URL.pathname keeps percent-encoded sequences verbatim, so a raw suffix
  // match misses paths that percent-encode the dot or the extension. Decode
  // once before matching, and fail closed if the path contains a malformed
  // escape (decodeURIComponent throws on lone `%` or `%X` with a non-hex
  // follower): treat such a pathname as suspicious rather than allow it.
  let decoded: string;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return true;
  }
  const lower = decoded.toLowerCase();
  return DOWNLOAD_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

/**
 * True when `host` is a loopback / private / link-local / multicast / reserved
 * address. Defends against SSRF-style deeplinks pointing at services on the
 * device or a local network the device can reach.
 */
function isLocalAddress(host: string): boolean {
  if (!host) return true;
  // Strip trailing dot(s) so that `localhost.` / `api.localhost.` / `127.0.0.1.`
  // are normalized to the same form the hostname/IP checks below expect. DNS
  // resolvers treat a trailing dot as the absolute (FQDN) form and resolve it
  // to the same address as the version without a trailing dot, so without this
  // normalization a deeplink with `https://localhost./` would slip past every
  // check below.
  const lower = host.toLowerCase().replace(/\.+$/, '');
  if (!lower) return true;

  // Hostname-based blocks
  if (lower === 'localhost' || lower.endsWith('.localhost')) return true;
  if (lower === 'broadcasthost') return true;
  if (lower === 'ip6-localhost' || lower === 'ip6-loopback') return true;

  // IPv4 ranges
  const ipv4 = lower.match(IPV4_REGEX);
  if (ipv4) {
    const a = Number(ipv4[1]);
    const b = Number(ipv4[2]);
    if ([a, b, Number(ipv4[3]), Number(ipv4[4])].some((n) => n > 255)) {
      return true; // malformed octet — treat as suspicious
    }
    if (a === 0) return true; // 0.0.0.0/8 (this network)
    if (a === 10) return true; // 10.0.0.0/8 (private)
    if (a === 127) return true; // 127.0.0.0/8 (loopback)
    if (a === 169 && b === 254) return true; // 169.254.0.0/16 (link-local)
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12 (private)
    if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 (shared address space, RFC 6598)
    if (a === 192 && b === 0 && Number(ipv4[3]) === 0) return true; // 192.0.0.0/24 (IETF protocol assignments, RFC 6890)
    if (a === 192 && b === 168) return true; // 192.168.0.0/16 (private)
    if (a === 198 && b >= 18 && b <= 19) return true; // 198.18.0.0/15 (benchmarking, RFC 2544)
    if (a >= 224) return true; // 224.0.0.0/4 multicast + 240.0.0.0/4 reserved
    return false;
  }

  // IPv6 — URL.hostname returns [::1]; strip brackets if present.
  let v6 = '';
  if (lower.startsWith('[') && lower.endsWith(']')) {
    v6 = lower.slice(1, -1);
  } else if (lower.includes(':')) {
    v6 = lower;
  }
  if (v6) {
    if (v6 === '::1' || v6 === '::') return true;
    // IPv4-mapped IPv6 (`::ffff:a.b.c.d`) is handled via substring match because
    // the IPv4 portion lives in the trailing 16-bit groups, not the first group.
    if (v6.startsWith('::ffff:')) return true;
    // Reserved-range checks use a single bitmask against the first 16-bit
    // group so an under-padded form (e.g. `fc::1` is `00fc::`, NOT in fc/7)
    // is not over-rejected the way a `startsWith('fc')` string check would.
    // - fe80::/10 link-local (RFC 4291 §2.4): first 10 bits 1111111010 → mask 0xffc0, value 0xfe80
    // - fc00::/7  unique-local (RFC 4193):    first 7 bits  1111110    → mask 0xfe00, value 0xfc00
    // - ff00::/8  multicast (RFC 4291 §2.7):  first 8 bits  11111111   → mask 0xff00, value 0xff00
    const firstGroup = parseInt(v6.split(':')[0] ?? '0', 16);
    if (Number.isNaN(firstGroup)) return false;
    if ((firstGroup & 0xff_c0) === 0xfe_80) return true; // link-local
    if ((firstGroup & 0xfe_00) === 0xfc_00) return true; // unique-local
    if ((firstGroup & 0xff_00) === 0xff_00) return true; // multicast
  }

  return false;
}

/**
 * Apply the full WebView URL safety policy. Returns true only if the URL is
 * safe to load.
 *
 * Policy:
 *   1. Non-empty string ≤ 2048 chars.
 *   2. Scheme is `https://` (case-insensitive). Rejects http, javascript,
 *      file, data, blob, about, intent, and any other scheme.
 *   3. URL must parse via the standard URL constructor.
 *   4. No userinfo (`https://user@host` or `https://user:pass@host`) — these
 *      mislead users about the real navigation target.
 *   5. Host must NOT be a loopback (localhost, 127.x, ::1), private (10/8,
 *      172.16/12, 192.168/16, fc00::/7), link-local (169.254/16, fe80::/10),
 *      multicast, or reserved range.
 *   6. Only the default https port (443) is allowed.
 *   7. URL pathname must NOT end in a known direct-download extension
 *      (`.zip`, `.exe`, `.dmg`, `.apk`, `.ipa`, `.iso`, etc.). Documents and
 *      media files are still allowed because mobile webviews render them
 *      inline.
 *   8. Host must NOT contain punycode / Unicode IDN characters. Mixes the
 *      same defense Discovery's `validateWebviewSrc` uses, blocking visually
 *      confusable lookalike domains (raw `xn--…` punycode or any non-ASCII
 *      script that decodes to an ASCII-looking domain) that would otherwise
 *      pass every other check.
 */
export function isAllowedWebViewUrl(url: string | undefined | null): boolean {
  if (typeof url !== 'string') return false;
  if (!url || url.length > MAX_URL_LENGTH) return false;
  if (!HTTPS_REGEX.test(url)) return false;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  if (parsed.username || parsed.password) return false;
  if (!ALLOWED_PORTS.has(parsed.port)) return false;
  if (isLocalAddress(parsed.hostname)) return false;
  if (isLikelyDownloadPath(parsed.pathname)) return false;
  // Heavier check last — relies on URL parsing + IDN normalization tables.
  if (containsPunycode(url)) return false;

  return true;
}
