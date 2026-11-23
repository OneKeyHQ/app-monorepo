import type { ILightningSparkNetwork } from '@onekeyhq/core/src/secret';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { decodeSparkValue, encodeSparkValue } from './sparkSdkCodec';

import type { IBreezSdkSparkModule, ISparkSdk, ISparkSdkConfig } from './types';

// The extension runs the Breez SDK in its offscreen document, a page where the
// wasm, its network streams and its IndexedDB storage work as on Web. kit-bg
// stays in the MV3 service worker and drives the SDK through the offscreen
// API (breezSdkOffscreenClient.ts); this host runs those calls.

/** SDK methods the service worker calls on a connected SDK. */
export type ISparkSdkCallMethod = Exclude<
  keyof ISparkSdk,
  'addEventListener' | 'disconnect'
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

  async connect(request: unknown): Promise<string> {
    const breez = await this.options.loadSdk();
    const sdk = await breez.connect(
      decodeSparkValue<Parameters<IBreezSdkSparkModule['connect']>[0]>(request),
    );
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
