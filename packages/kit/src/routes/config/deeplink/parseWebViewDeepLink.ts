import type {
  EOneKeyDeepLinkPath,
  IEOneKeyDeepLinkParams,
} from '@onekeyhq/shared/src/consts/deeplinkConsts';
import { isAllowedWebViewUrl } from '@onekeyhq/shared/src/utils/webViewUrlSafety';

import type { IOpenWebViewParams } from '../../../views/WebView/utils/webViewNavigation';

/**
 * Parse and validate the query params of an `onekey-wallet://webview?...`
 * deeplink. Returns `null` if any safety check fails (silent rejection — never
 * throws). Extracted from the deeplink switch so the validation logic can be
 * unit-tested as a pure function.
 *
 * `expo-linking`'s `Linking.parse` already URL-decodes each query value, so by
 * the time we see `query.url` it is the decoded target string. We deliberately
 * do NOT decode a second time: a legitimate URL may contain encoded characters
 * in its path or query (e.g. signed S3 URLs with `%2F`, base64 with `%2B`),
 * and double-decoding would rewrite them — at best changing the target, at
 * worst making `decodeURIComponent` throw on a lone `%` and rejecting a valid
 * deeplink.
 *
 * `query.url` is still checked to be a string (expo-linking returns string[]
 * for duplicated `?url=a&url=b` keys). URL-safety policy is delegated to
 * `isAllowedWebViewUrl` — see that helper for the full list (https-only,
 * length cap, no userinfo, no local addresses, etc.).
 *
 * `title` defends against the same string[] coercion. Boolean params are
 * decoded from the `'0' | '1'` URL-query convention.
 */
export function parseWebViewDeepLink(
  query: IEOneKeyDeepLinkParams[EOneKeyDeepLinkPath.webview],
): IOpenWebViewParams | null {
  const url = query.url;
  if (typeof url !== 'string') return null;

  if (!isAllowedWebViewUrl(url)) {
    return null;
  }

  return {
    url,
    title: typeof query.title === 'string' ? query.title : undefined,
    hideHeader: query.hideHeader === '1',
    showAddressBar: query.showAddressBar === '1',
    source: 'deeplink',
  };
}
