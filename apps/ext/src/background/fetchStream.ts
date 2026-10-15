import { createFetchStreamHandler } from '@onekeyhq/shared/src/utils/fetchStream';
import { FETCH_STREAM_MESSAGE } from '@onekeyhq/shared/types/fetchStream';
import type { IFetchStreamRequest } from '@onekeyhq/shared/types/fetchStream';

export function installFetchStreamListener() {
  const fetchStreamRequest = createFetchStreamHandler();
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
