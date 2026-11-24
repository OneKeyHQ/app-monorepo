import type { ILightningSparkNetwork } from '@onekeyhq/core/src/secret/lightningSpark';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { onOffscreenPortDisconnected } from '../../../offscreens/offscreenDocument';

import { decodeSparkValue, encodeSparkValue } from './sparkSdkCodec';

import type {
  ISparkSdkCallMethod,
  SparkSdkOffscreenHost,
} from './sparkOffscreenHost';
import type {
  IBreezSdkSparkModule,
  ISparkSdk,
  ISparkSdkConfig,
  ISparkSdkEvent,
} from './types';

/** The offscreen API of the SDK, as the extension's service worker sees it. */
export type ISparkSdkOffscreenApi = Pick<
  SparkSdkOffscreenHost,
  'load' | 'connect' | 'call' | 'addEventListener' | 'disconnect'
>;

const DISCONNECTED_MESSAGE = 'Lightning wallet was disconnected';

type ISparkOffscreenSession = {
  state: 'open' | 'closed' | 'lost';
  onEvent?: (event: ISparkSdkEvent) => void;
  onLost?: () => void;
};

// Open sessions of the SDK in the offscreen document.
const sessions = new Map<string, ISparkOffscreenSession>();
// Rejects the requests still waiting for the offscreen document.
const pendingRejects = new Set<(error: Error) => void>();
let watching = false;

function markLost(sessionId: string, session: ISparkOffscreenSession) {
  sessions.delete(sessionId);
  session.state = 'lost';
  session.onEvent = undefined;
  session.onLost?.();
}

// Once the offscreen port is gone, the offscreen document reloads and its
// SDK sessions end. Requests in flight would get no answer before the
// bridge's 10-minute expiry, so they fail at once.
function watchOffscreenPort() {
  if (watching) {
    return;
  }
  watching = true;
  onOffscreenPortDisconnected(() => {
    const rejects = [...pendingRejects];
    pendingRejects.clear();
    rejects.forEach((reject) =>
      reject(new OneKeyLocalError(DISCONNECTED_MESSAGE)),
    );
    [...sessions].forEach(([sessionId, session]) =>
      markLost(sessionId, session),
    );
  });
}

function untilDisconnected<T>(request: Promise<T>): Promise<T> {
  watchOffscreenPort();
  return new Promise<T>((resolve, reject) => {
    pendingRejects.add(reject);
    void request
      .then(resolve, reject)
      .finally(() => pendingRejects.delete(reject));
  });
}

function isDisconnectedError(error: unknown) {
  return error instanceof Error && error.message === DISCONNECTED_MESSAGE;
}

/**
 * Hands an event the offscreen document passed on to its session's listener.
 * Events of a session that ended are dropped.
 */
export function dispatchOffscreenSdkEvent({
  sessionId,
  event,
}: {
  sessionId: string;
  event: unknown;
}) {
  sessions.get(sessionId)?.onEvent?.(decodeSparkValue<ISparkSdkEvent>(event));
}

function createOffscreenSparkSdk(
  api: ISparkSdkOffscreenApi,
  sessionId: string,
): ISparkSdk {
  const session: ISparkOffscreenSession = { state: 'open' };
  sessions.set(sessionId, session);
  const call = <M extends ISparkSdkCallMethod>(
    method: M,
    request?: Parameters<ISparkSdk[M]>[0],
  ): ReturnType<ISparkSdk[M]> =>
    (session.state === 'open'
      ? untilDisconnected(
          api.call({ sessionId, method, request: encodeSparkValue(request) }),
        ).then((result) => decodeSparkValue(result))
      : Promise.reject(
          new OneKeyLocalError(DISCONNECTED_MESSAGE),
        )) as ReturnType<ISparkSdk[M]>;
  return {
    getInfo: (request) => call('getInfo', request),
    getUserSettings: () => call('getUserSettings'),
    updateUserSettings: (request) => call('updateUserSettings', request),
    syncWallet: (request) => call('syncWallet', request),
    receivePayment: (request) => call('receivePayment', request),
    parse: (input) => call('parse', input),
    listPayments: (request) => call('listPayments', request),
    prepareSendPayment: (request) => call('prepareSendPayment', request),
    sendPayment: (request) => call('sendPayment', request),
    addEventListener: async ({ onEvent }) => {
      if (session.state !== 'open') {
        throw new OneKeyLocalError(DISCONNECTED_MESSAGE);
      }
      session.onEvent = onEvent;
      return untilDisconnected(api.addEventListener({ sessionId }));
    },
    disconnect: async () => {
      if (session.state !== 'open') {
        return;
      }
      sessions.delete(sessionId);
      session.state = 'closed';
      session.onEvent = undefined;
      try {
        await untilDisconnected(api.disconnect({ sessionId }));
      } catch (error) {
        // The port went away on the way, which ends the SDK as well.
        if (!isDisconnectedError(error)) {
          throw error;
        }
      }
    },
    onSessionLost: (listener) => {
      session.onLost = listener;
      if (session.state === 'lost') {
        listener();
      }
    },
  };
}

/**
 * The SDK module of the extension's service worker. Every call runs on the
 * SDK in the offscreen document; the child mnemonic of a connect goes there
 * over the extension's runtime port.
 */
export async function createOffscreenBreezSdk(
  api: ISparkSdkOffscreenApi,
): Promise<IBreezSdkSparkModule> {
  const configs = await untilDisconnected(api.load());
  return {
    // Decoded on every call, so each caller gets its own copy.
    defaultConfig: (network) =>
      decodeSparkValue<Record<ILightningSparkNetwork, ISparkSdkConfig>>(
        configs,
      )[network],
    connect: async (request) => {
      const connecting = api.connect(encodeSparkValue(request));
      let sessionId: string;
      try {
        sessionId = await untilDisconnected(connecting);
      } catch (error) {
        // The port went away first. A connect still waiting for the offscreen
        // document reaches the next one, which opens a session no one here
        // knows of: close it once it answers.
        if (isDisconnectedError(error)) {
          void connecting
            .then((orphanId) => api.disconnect({ sessionId: orphanId }))
            .catch(() => undefined);
        }
        throw error;
      }
      return createOffscreenSparkSdk(api, sessionId);
    },
  };
}
