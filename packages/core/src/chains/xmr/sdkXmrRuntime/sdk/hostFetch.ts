import type { IPrivacyChainHostRequest } from '@onekeyhq/core/src/utils/privacyChainWorkerClient';

/**
 * The network channel the Worker's requests are handed out to.
 *
 * **This base file is deliberately empty.** The wallet ships on the extension,
 * desktop and mobile; none of them is a browser page, and each replaces this
 * through the platform-suffix resolver with a channel that is not subject to
 * CORS or mixed content. That is the whole reason the seam exists: monerod
 * sends no CORS headers unless proxied, so of twelve public nodes measured on
 * 2026-09-22 exactly one was reachable from a browser.
 *
 * Returning `undefined` here means "this build has no better channel than the
 * runtime's own fetch", which is correct for a plain web page and harmless:
 * the runtime keeps working, it just cannot reach nodes that do not serve
 * browsers.
 *
 * Never fill this in with a page `fetch`. Doing so would silently put every
 * carrier back in the browser's jail and look like it was working.
 */
export const xmrHostFetch: IPrivacyChainHostRequest | undefined = undefined;
