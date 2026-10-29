import { PRIVACY_CHAIN_NODE_REQUEST_MESSAGE } from '@onekeyhq/core/src/chains/xmr/sdkXmrRuntime/sdk/hostFetch.ext-pages-v3';
import { relayPrivacyChainNodeRequest } from '@onekeyhq/kit-bg/src/utils/privacyChainNodeRelay';
import type { IPrivacyChainRelayTargetSource } from '@onekeyhq/kit-bg/src/utils/privacyChainRelayTargets';

import { backgroundPrivacyChainRelayTargets } from './privacyChainRelayTargets';

/**
 * Performs privacy-chain node requests for the offscreen document, whose
 * Worker fetch obeys CORS (most Monero nodes send no CORS headers). The
 * service worker is the context `host_permissions` cover.
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
      // Only this extension's own documents (offscreen has no tab); content
      // scripts must not get a POST-anywhere relay.
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

      return true;
    },
  );
}
