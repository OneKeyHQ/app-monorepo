import { createPrivacyChainFetchStreamRelay } from '@onekeyhq/kit-bg/src/utils/privacyChainNodeRelay';
import type { IPrivacyChainRelayTargetSource } from '@onekeyhq/kit-bg/src/utils/privacyChainRelayTargets';
import { FETCH_STREAM_MESSAGE } from '@onekeyhq/shared/types/fetchStream';
import type { IFetchStreamRequest } from '@onekeyhq/shared/types/fetchStream';

import { backgroundPrivacyChainRelayTargets } from './privacyChainRelayTargets';

export function installFetchStreamListener(
  targets: IPrivacyChainRelayTargetSource = backgroundPrivacyChainRelayTargets,
) {
  // Only privacy-chain node calls use this relay.
  const fetchStreamRequest = createPrivacyChainFetchStreamRelay(targets);
  chrome.runtime.onMessage.addListener(
    (
      message: { type?: string; request?: IFetchStreamRequest },
      sender,
      sendResponse: (response?: unknown) => void,
    ) => {
      if (message?.type !== FETCH_STREAM_MESSAGE) return undefined;
      // Host networking is restricted to this extension's own app documents.
      if (sender.id !== chrome.runtime.id || sender.tab) {
        sendResponse({ ok: false, error: 'not allowed' });
        return undefined;
      }
      if (!message.request) {
        sendResponse({ ok: false, error: 'missing fetch stream request' });
        return undefined;
      }
      void fetchStreamRequest(message.request).then(sendResponse);
      return true;
    },
  );
}
