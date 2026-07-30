/**
 * Display-policy rules for the WebView overlay route.
 *
 * Route params drive what the user sees: the header, the title, and the
 * address bar. For in-app callers those params come from trusted code, but
 * for `deeplink` and `notification` entries the params originate from an
 * external string (`onekey-wallet://webview?...` or a push payload) that an
 * attacker can craft. Without sanitization, an external entry can:
 *   - Set `hideHeader=1` to suppress the close button and the title row.
 *   - Pass `title=OneKey Wallet` so the header reads as a trusted brand
 *     while pointing at an attacker-controlled `https://` host.
 *   - Omit `showAddressBar` to hide the only built-in way for the user to
 *     read the real URL.
 *
 * The function below collapses those three params into the effective
 * display props the page should render. External entries override the
 * params; in-app entries keep them as-is.
 */

import type { IWebViewPageParams } from '@onekeyhq/shared/src/routes';

export interface IWebViewOverlayDisplay {
  hideHeader: boolean;
  showAddressBar: boolean;
  /**
   * The string Header should fall back to when the live page title is empty.
   * `undefined` means "no caller-provided fallback" — Header derives the host
   * from the URL instead.
   */
  fallbackTitle: string | undefined;
}

const EXTERNAL_SOURCES = new Set<IWebViewPageParams['source']>([
  'deeplink',
  'notification',
]);

export function isExternalEntry(
  source: IWebViewPageParams['source'] | undefined,
): boolean {
  return EXTERNAL_SOURCES.has(source);
}

export function resolveOverlayDisplay(
  params: Pick<
    IWebViewPageParams,
    'source' | 'title' | 'hideHeader' | 'showAddressBar'
  >,
): IWebViewOverlayDisplay {
  if (isExternalEntry(params.source)) {
    // Hard policy: external entries can never hide the header, never hide
    // the address bar, and never inject a fallback title. The Header
    // component will fall back to the live page title or the URL host.
    return {
      hideHeader: false,
      showAddressBar: true,
      fallbackTitle: undefined,
    };
  }

  return {
    hideHeader: Boolean(params.hideHeader),
    showAddressBar: params.showAddressBar === true,
    fallbackTitle: params.title,
  };
}
