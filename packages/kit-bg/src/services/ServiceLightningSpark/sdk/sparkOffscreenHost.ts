import type { ILightningSparkNetwork } from '@onekeyhq/core/src/secret/lightningSpark';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { decodeSparkValue, encodeSparkValue } from './sparkSdkCodec';

import type { IBreezSdkSparkModule, ISparkSdk, ISparkSdkConfig } from './types';

// The order of a connect among the connects of one service worker.
export type ISparkConnectOrder = { workerId: string; seq: number };

const CONNECT_SUPERSEDED_MESSAGE = 'Lightning connect was superseded';

// The extension runs the Breez SDK in its offscreen document, a page where the
// wasm, its network streams and its IndexedDB storage work as on Web. kit-bg
// stays in the MV3 service worker and drives the SDK through the offscreen
// API (breezSdkOffscreenClient.ts); this host runs those calls.

/** SDK methods the service worker calls on a connected SDK. */
export type ISparkSdkCallMethod = Exclude<
  keyof ISparkSdk,
  'addEventListener' | 'disconnect' | 'onSessionLost'
>;

type ISparkSdkCalls = {
  [M in ISparkSdkCallMethod]: (
    sdk: ISparkSdk,
    request: Parameters<ISparkSdk[M]>[0],
  ) => ReturnType<ISparkSdk[M]>;
};

// One entry per method, so the check of SDK input call sites
// (sdkInputCallSites.test.ts) sees every call the host makes.
const SPARK_SDK_CALLS: ISparkSdkCalls = {
  getInfo: (sdk, request) => sdk.getInfo(request),
  getUserSettings: (sdk) => sdk.getUserSettings(),
  updateUserSettings: (sdk, request) => sdk.updateUserSettings(request),
  syncWallet: (sdk, request) => sdk.syncWallet(request),
  receivePayment: (sdk, request) => sdk.receivePayment(request),
  parse: (sdk, input) => sdk.parse(input),
  listPayments: (sdk, request) => sdk.listPayments(request),
  getPayment: (sdk, request) => sdk.getPayment(request),
  prepareSendPayment: (sdk, request) => sdk.prepareSendPayment(request),
  sendPayment: (sdk, request) => sdk.sendPayment(request),
};

export class SparkSdkOffscreenHost {
  constructor(
    private readonly options: {
      loadSdk: () => Promise<IBreezSdkSparkModule>;
      // Passes an event of a session's SDK on to the service worker.
      emitEvent: (payload: { sessionId: string; event: unknown }) => void;
      createSessionId: () => string;
    },
  ) {}

  // Connected SDKs by session. Session ids are random, so a service worker
  // still holding the id of a session this page no longer has cannot reach
  // a session opened later.
  private sessions = new Map<string, ISparkSdk>();

  // The newest connect this page started.
  private latestConnect: ISparkConnectOrder | undefined;

  private getSession(sessionId: string): ISparkSdk {
    const sdk = this.sessions.get(sessionId);
    if (!sdk) {
      throw new OneKeyLocalError('Lightning SDK session not found');
    }
    return sdk;
  }

  /**
   * Loads the wasm and returns the SDK's default config of each network,
   * which the service worker reads synchronously before it connects.
   */
  async load(): Promise<unknown> {
    const breez = await this.options.loadSdk();
    const configs: Record<ILightningSparkNetwork, ISparkSdkConfig> = {
      mainnet: breez.defaultConfig('mainnet'),
      regtest: breez.defaultConfig('regtest'),
    };
    return encodeSparkValue(configs);
  }

  async connect(request: unknown, order: ISparkConnectOrder): Promise<string> {
    // A connect that waited for this page while the previous one reloaded can
    // arrive after a newer connect of the same service worker. It is stale,
    // and running it would end the newer session.
    const latest = this.latestConnect;
    if (latest?.workerId === order.workerId && order.seq < latest.seq) {
      throw new OneKeyLocalError(CONNECT_SUPERSEDED_MESSAGE);
    }
    this.latestConnect = order;
    const breez = await this.options.loadSdk();
    // The service worker connects one wallet at a time, so a session still
    // open here was left by a service worker that restarted. It holds a seed
    // and a storage, so it goes first.
    const leftovers = [...this.sessions.values()];
    this.sessions.clear();
    await Promise.all(
      leftovers.map((leftover) => leftover.disconnect().catch(() => undefined)),
    );
    const sdk = await breez.connect(
      decodeSparkValue<Parameters<IBreezSdkSparkModule['connect']>[0]>(request),
    );
    // A newer connect started while this one ran, and the page is its now.
    if (this.latestConnect !== order) {
      await sdk.disconnect().catch(() => undefined);
      throw new OneKeyLocalError(CONNECT_SUPERSEDED_MESSAGE);
    }
    const sessionId = this.options.createSessionId();
    this.sessions.set(sessionId, sdk);
    return sessionId;
  }

  async call({
    sessionId,
    method,
    request,
  }: {
    sessionId: string;
    method: ISparkSdkCallMethod;
    request: unknown;
  }): Promise<unknown> {
    const sdk = this.getSession(sessionId);
    if (!Object.hasOwn(SPARK_SDK_CALLS, method)) {
      throw new OneKeyLocalError(`Unknown Lightning SDK method: ${method}`);
    }
    const call = SPARK_SDK_CALLS[method] as (
      sdk: ISparkSdk,
      request: unknown,
    ) => Promise<unknown>;
    return encodeSparkValue(await call(sdk, decodeSparkValue(request)));
  }

  async addEventListener({ sessionId }: { sessionId: string }) {
    const sdk = this.getSession(sessionId);
    return sdk.addEventListener({
      onEvent: (event) =>
        this.options.emitEvent({ sessionId, event: encodeSparkValue(event) }),
    });
  }

  // A session this page does not have needs nothing: its SDK is gone.
  async disconnect({ sessionId }: { sessionId: string }) {
    const sdk = this.sessions.get(sessionId);
    this.sessions.delete(sessionId);
    await sdk?.disconnect();
  }
}
