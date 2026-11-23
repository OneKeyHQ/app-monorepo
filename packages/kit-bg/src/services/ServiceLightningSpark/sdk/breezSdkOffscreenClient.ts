import type { ILightningSparkNetwork } from '@onekeyhq/core/src/secret';

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

// The event listener of each SDK session in the offscreen document.
const sessionListeners = new Map<string, (event: ISparkSdkEvent) => void>();

/**
 * Hands an event the offscreen document passed on to its session's listener.
 * Events of a session that was disconnected are dropped.
 */
export function dispatchOffscreenSdkEvent({
  sessionId,
  event,
}: {
  sessionId: string;
  event: unknown;
}) {
  sessionListeners.get(sessionId)?.(decodeSparkValue<ISparkSdkEvent>(event));
}

function createOffscreenSparkSdk(
  api: ISparkSdkOffscreenApi,
  sessionId: string,
): ISparkSdk {
  const call = <M extends ISparkSdkCallMethod>(
    method: M,
    request?: Parameters<ISparkSdk[M]>[0],
  ): ReturnType<ISparkSdk[M]> =>
    api
      .call({ sessionId, method, request: encodeSparkValue(request) })
      .then((result) => decodeSparkValue(result)) as ReturnType<ISparkSdk[M]>;
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
      sessionListeners.set(sessionId, onEvent);
      return api.addEventListener({ sessionId });
    },
    disconnect: async () => {
      sessionListeners.delete(sessionId);
      await api.disconnect({ sessionId });
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
  const configs = await api.load();
  return {
    // Decoded on every call, so each caller gets its own copy.
    defaultConfig: (network) =>
      decodeSparkValue<Record<ILightningSparkNetwork, ISparkSdkConfig>>(
        configs,
      )[network],
    connect: async (request) => {
      const sessionId = await api.connect(encodeSparkValue(request));
      return createOffscreenSparkSdk(api, sessionId);
    },
  };
}
