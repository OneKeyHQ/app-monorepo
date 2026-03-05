import type { ICrossDomainRedirectResult } from './crossDomainRedirectUtils';

/**
 * Cross-domain redirect hook — web/extension default (noop).
 * Web and extension platforms open fiat crypto URLs externally,
 * so cross-domain interception is not applicable.
 */
export function useCrossDomainRedirect(
  _initialUrl: string,
  _enabled = true,
): ICrossDomainRedirectResult {
  return {
    onShouldStartLoadWithRequest: undefined,
    onOpenWindow: undefined,
  };
}
