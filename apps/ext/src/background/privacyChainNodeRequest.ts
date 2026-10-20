import { PRIVACY_CHAIN_NODE_REQUEST_MESSAGE } from '@onekeyhq/core/src/chains/xmr/sdkXmrRuntime/sdk/hostFetch.ext-pages-v3';
import { relayPrivacyChainNodeRequest } from '@onekeyhq/kit-bg/src/utils/privacyChainNodeRelay';
import type { IPrivacyChainRelayTargetSource } from '@onekeyhq/kit-bg/src/utils/privacyChainRelayTargets';

import { backgroundPrivacyChainRelayTargets } from './privacyChainRelayTargets';

/**
 * Perform privacy-chain node requests on behalf of the offscreen document.
 *
 * The chain runtime is wasm inside a Worker in the offscreen document, so its
 * own fetch obeys CORS and mixed content. A Monero node sends no CORS headers
 * unless someone put a proxy in front of it -- of twelve public nodes measured
 * on 2026-09-22 exactly one was reachable that way. Making every user of a
 * privacy chain share one operator hands that operator their IP, the block
 * ranges they sync, and the moment they broadcast.
 *
 * The background service worker is the context an extension's
 * `host_permissions` cover, so it is the one that can reach the rest.
 */
export function installPrivacyChainNodeRequestListener(
  targets: IPrivacyChainRelayTargetSource = backgroundPrivacyChainRelayTargets,
) {
  chrome.runtime.onMessage.addListener(
    (
      message: {
        type?: string;
        url?: string;
        contentType?: string;
        body?: number[];
      },
      sender,
      sendResponse: (response?: unknown) => void,
    ) => {
      if (message?.type !== PRIVACY_CHAIN_NODE_REQUEST_MESSAGE) {
        return undefined;
      }
      // Only this extension's own documents (the offscreen one has no tab). A
      // content script runs inside a web page and must not get a relay that
      // POSTs anywhere.
      if (sender.id !== chrome.runtime.id || sender.tab) {
        sendResponse({ ok: false, error: 'not allowed' });
        return undefined;
      }

      void relayPrivacyChainNodeRequest({
        url: message.url ?? '',
        contentType: message.contentType ?? 'application/json',
        body: new Uint8Array(message.body ?? []),
        targets,
      }).then(sendResponse);

      // Keep the channel open for the async reply.
      return true;
    },
  );
}
