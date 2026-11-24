import { createFetchStreamHandler } from '@onekeyhq/shared/src/utils/fetchStream';
import type {
  IFetchStreamRequest,
  IFetchStreamRequester,
  IFetchStreamResult,
} from '@onekeyhq/shared/types/fetchStream';

import type {
  IIsTrustedMainWindowSender,
  ITrustedMainWindowSenderFrame,
} from './mainWindowShellTrust';

type INetLike = {
  fetch: (input: string, init?: RequestInit) => Promise<Response>;
};

export type IFetchStreamIpcEvent = {
  sender: {
    id: number;
    mainFrame: ITrustedMainWindowSenderFrame;
    isDestroyed: () => boolean;
  };
  senderFrame: ITrustedMainWindowSenderFrame;
};

export type IFetchStreamIpcHandler = (
  event: IFetchStreamIpcEvent,
  request: IFetchStreamRequest,
) => Promise<IFetchStreamResult>;

// The renderer's fetch obeys CORS and mixed content; the main process does not.
// `net.fetch` follows the system proxy; Node's fetch would bypass it and expose the user's IP.
export function createFetchStreamRequest(params: {
  net: INetLike;
}): IFetchStreamRequester {
  return createFetchStreamHandler((input, init) =>
    params.net.fetch(String(input), init),
  );
}

// Only the main renderer may drive the relay: child frames and guest webviews
// share the preload but must never proxy their own requests through the app.
export function createFetchStreamIpcHandler(params: {
  fetchStreamRequest: IFetchStreamRequester;
  getIsTrustedMainWindowSender: () => IIsTrustedMainWindowSender | undefined;
}): IFetchStreamIpcHandler {
  return async (event, request) => {
    let isTrustedSender = false;
    try {
      if (!event.sender.isDestroyed()) {
        isTrustedSender = Boolean(
          params.getIsTrustedMainWindowSender()?.(
            event.sender.id,
            event.senderFrame,
            event.sender.mainFrame,
          ),
        );
      }
    } catch {
      isTrustedSender = false;
    }
    if (!isTrustedSender) return { ok: false, error: 'not allowed' };
    return params.fetchStreamRequest(request);
  };
}

export function createFetchStreamRelay(params: {
  net: INetLike;
  getIsTrustedMainWindowSender: () => IIsTrustedMainWindowSender | undefined;
}): {
  fetchStreamRequest: IFetchStreamRequester;
  handleFetchStreamRequest: IFetchStreamIpcHandler;
} {
  const fetchStreamRequest = createFetchStreamRequest({ net: params.net });
  return {
    fetchStreamRequest,
    handleFetchStreamRequest: createFetchStreamIpcHandler({
      fetchStreamRequest,
      getIsTrustedMainWindowSender: params.getIsTrustedMainWindowSender,
    }),
  };
}
