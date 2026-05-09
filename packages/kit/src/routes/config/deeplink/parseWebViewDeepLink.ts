import type {
  EOneKeyDeepLinkPath,
  IEOneKeyDeepLinkParams,
} from '@onekeyhq/shared/src/consts/deeplinkConsts';

import type { IOpenWebViewParams } from '../../../views/WebView/utils/webViewNavigation';

const HTTPS_REGEX = /^https:\/\//i;
const MAX_URL_LENGTH = 2048;

/**
 * Parse and validate the query params of an `onekey-wallet://webview?...`
 * deeplink. Returns `null` if any safety check fails (silent rejection — never
 * throws). Extracted from the deeplink switch so the validation logic can be
 * unit-tested as a pure function.
 *
 * Safety checks (in order):
 *   1. `query.url` must be a string (expo-linking can return string[] for
 *      duplicated `?url=a&url=b` query keys).
 *   2. `decodeURIComponent` must succeed.
 *   3. Decoded URL must be non-empty, ≤ 2048 chars, and start with `https://`
 *      (rejects http, javascript, file, data, about, intent, custom schemes).
 *   4. URL must parse via the standard URL constructor.
 *   5. URL must NOT embed userinfo (`https://user@host` or
 *      `https://user:pass@host`) — these confuse users about the real host.
 *
 * `title` defends against the same string[] coercion. Boolean params are
 * decoded from the `'0' | '1'` URL-query convention.
 */
export function parseWebViewDeepLink(
  query: IEOneKeyDeepLinkParams[EOneKeyDeepLinkPath.webview],
): IOpenWebViewParams | null {
  const rawUrl = query.url;
  if (typeof rawUrl !== 'string') return null;

  let decoded = '';
  try {
    decoded = decodeURIComponent(rawUrl);
  } catch {
    return null;
  }

  if (
    !decoded ||
    decoded.length > MAX_URL_LENGTH ||
    !HTTPS_REGEX.test(decoded)
  ) {
    return null;
  }

  let parsed: URL;
  try {
    parsed = new URL(decoded);
  } catch {
    return null;
  }
  if (parsed.username || parsed.password) {
    return null;
  }

  return {
    url: decoded,
    title: typeof query.title === 'string' ? query.title : undefined,
    hideHeader: query.hideHeader === '1',
    showAddressBar: query.showAddressBar === '1',
    source: 'deeplink',
  };
}
