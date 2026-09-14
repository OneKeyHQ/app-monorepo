import { devSettingsPersistAtom } from '@onekeyhq/kit-bg/src/states/jotai/atoms';
import { jotaiDefaultStore } from '@onekeyhq/kit-bg/src/states/jotai/utils/jotaiDefaultStore';
import uriUtils from '@onekeyhq/shared/src/utils/uriUtils';

/**
 * Per-navigation policy for a WebView that carries the wallet inpage provider.
 *
 * The entry URL is validated once by the caller, but a page that passed that
 * check can still drive the top frame somewhere else while keeping the bridge,
 * so every navigation has to be re-checked — the same thing the Discovery
 * browser does in its own `onShouldStartLoadWithRequest`.
 *
 * Deliberately NOT `isAllowedWebViewUrl`: that is the overlay route's policy
 * (https only, no punycode, no download extensions) and is too strict for real
 * dApps. This mirrors Discovery's `validateWebviewSrc` instead.
 *
 * Known gap: Discovery also checks its phishing LRU cache, which lives in the
 * Discovery jotai context and cannot be read from here (and this callback must
 * answer synchronously). Protocol / local-address / punycode / deeplink only.
 */
export enum EDappWebViewNavigationDecision {
  Allow = 'Allow',
  Deny = 'Deny',
  // A OneKey deeplink: the app handles it natively, the WebView must not load it.
  Deeplink = 'Deeplink',
}

function isLocalhostUrlAllowedInDAppBrowser() {
  const devSettings = jotaiDefaultStore.get(devSettingsPersistAtom.atom());
  return Boolean(
    devSettings?.enabled &&
    devSettings.settings?.allowLocalhostUrlInDAppBrowser,
  );
}

export function resolveDappWebViewNavigation({
  url,
  isTopFrame = true,
}: {
  url: string;
  isTopFrame?: boolean;
}): EDappWebViewNavigationDecision {
  if (!url) {
    return EDappWebViewNavigationDecision.Deny;
  }

  const { action } = uriUtils.parseDappRedirect(url, [], {
    isTopFrame,
    allowLocalhostUrl: isLocalhostUrlAllowedInDAppBrowser(),
  });
  if (action === uriUtils.EDAppOpenActionEnum.DENY) {
    return EDappWebViewNavigationDecision.Deny;
  }

  if (uriUtils.containsPunycode(url)) {
    return EDappWebViewNavigationDecision.Deny;
  }

  if (uriUtils.isValidDeepLink(url)) {
    return EDappWebViewNavigationDecision.Deeplink;
  }

  return EDappWebViewNavigationDecision.Allow;
}
