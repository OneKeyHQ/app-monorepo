import type {
  EOneKeyDeepLinkPath,
  IEOneKeyDeepLinkParams,
} from '@onekeyhq/shared/src/consts/deeplinkConsts';

import { isAllowedWebViewUrl } from '../../../views/WebView/utils/urlSafety';

import type { IOpenWebViewParams } from '../../../views/WebView/utils/webViewNavigation';

/**
 * Parse and validate the query params of an `onekey-wallet://webview?...`
 * deeplink. Returns `null` if any safety check fails (silent rejection — never
 * throws). Extracted from the deeplink switch so the validation logic can be
 * unit-tested as a pure function.
 *
 * Decoding-specific checks:
 *   1. `query.url` must be a string (expo-linking can return string[] for
 *      duplicated `?url=a&url=b` query keys).
 *   2. `decodeURIComponent` must succeed (rejects malformed escapes).
 *
 * URL-safety policy delegated to `isAllowedWebViewUrl` — see that helper for
 * the full list (https-only, length cap, no userinfo, no local addresses,
 * etc.).
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

  if (!isAllowedWebViewUrl(decoded)) {
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
