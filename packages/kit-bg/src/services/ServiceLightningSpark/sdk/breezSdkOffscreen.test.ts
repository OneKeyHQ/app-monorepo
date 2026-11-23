// cspell:ignore Msat
import {
  createOffscreenBreezSdk,
  dispatchOffscreenSdkEvent,
} from './breezSdkOffscreenClient';
import { SparkSdkOffscreenHost } from './sparkOffscreenHost';

import type { ISparkSdkOffscreenApi } from './breezSdkOffscreenClient';
import type {
  IBreezSdkSparkModule,
  ISparkPayment,
  ISparkPreparedPayment,
  ISparkSdk,
  ISparkSdkConfig,
  ISparkSdkEvent,
} from './types';

// The extension's runtime port carries JSON only.
const throughPort = <T>(value: T): T =>
  JSON.parse(JSON.stringify(value) ?? 'null') as T;

const PREPARED: ISparkPreparedPayment = {
  paymentMethod: {
    type: 'bolt11Invoice',
    invoiceDetails: {
      invoice: { bolt11: 'lnbc1' },
      paymentHash: 'hash',
      amountMsat: 1_000_000,
    },
    lightningFeeSats: 2,
  },
  amount: 1000n,
  feePolicy: 'feesExcluded',
};

const PAYMENT: ISparkPayment = {
  id: 'payment-1',
  paymentType: 'send',
  status: 'completed',
  amount: 1000n,
  fees: 2n,
  timestamp: 1,
  method: 'lightning',
};

function createFakeSdk() {
  let onEvent: ((event: ISparkSdkEvent) => void) | undefined;
  const sdk = {
    getInfo: jest.fn(async () => ({
      identityPubkey: 'pubkey',
      balanceSats: 21,
      tokenBalances: new Map(),
    })),
    getUserSettings: jest.fn(async () => ({ sparkPrivateModeEnabled: false })),
    updateUserSettings: jest.fn(async () => undefined),
    syncWallet: jest.fn(async () => ({})),
    receivePayment: jest.fn(async () => ({ paymentRequest: 'lnbc1' })),
    parse: jest.fn(async () => ({
      type: 'bolt11Invoice' as const,
      paymentHash: 'hash',
      timestamp: 1,
      expiry: 2,
    })),
    listPayments: jest.fn(async () => ({ payments: [PAYMENT] })),
    prepareSendPayment: jest.fn(async () => PREPARED),
    sendPayment: jest.fn(async () => ({ payment: PAYMENT })),
    addEventListener: jest.fn(
      async (listener: { onEvent: (event: ISparkSdkEvent) => void }) => {
        onEvent = listener.onEvent;
        return 'listener-1';
      },
    ),
    disconnect: jest.fn(async () => undefined),
  };
  return {
    sdk,
    emit: (event: ISparkSdkEvent) => onEvent?.(event),
  };
}

function setup() {
  const fake = createFakeSdk();
  const breez = {
    defaultConfig: jest.fn(
      (network: string) =>
        ({
          network,
          privateEnabledDefault: true,
          useDefaultExternalInputParsers: true,
          lnurlDomain: 'breez.tips',
          maxDepositClaimFee: { type: 'fixed', amount: 1n },
        }) as unknown as ISparkSdkConfig,
    ),
    connect: jest.fn(async () => fake.sdk as ISparkSdk),
  };
  let sessions = 0;
  const createHost = () =>
    new SparkSdkOffscreenHost({
      loadSdk: async () => breez as IBreezSdkSparkModule,
      emitEvent: (payload) => dispatchOffscreenSdkEvent(throughPort(payload)),
      createSessionId: () => {
        sessions += 1;
        return `session-${sessions}`;
      },
    });
  let host = createHost();
  // The service worker's side: every argument and result crosses the port.
  const api: ISparkSdkOffscreenApi = {
    load: async () => throughPort(await host.load()),
    connect: async (request) =>
      throughPort(await host.connect(throughPort(request))),
    call: async (request) => throughPort(await host.call(throughPort(request))),
    addEventListener: async (request) =>
      host.addEventListener(throughPort(request)),
    disconnect: async (request) => host.disconnect(throughPort(request)),
  };
  return {
    fake,
    breez,
    api,
    reloadOffscreen: () => {
      host = createHost();
    },
  };
}

async function connect(api: ISparkSdkOffscreenApi) {
  const module = await createOffscreenBreezSdk(api);
  const config = {
    ...module.defaultConfig('regtest'),
    apiKey: 'key',
    privateEnabledDefault: false,
    lnurlDomain: undefined,
    useDefaultExternalInputParsers: false,
    realTimeSyncServerUrl: undefined,
  };
  const request = {
    config,
    seed: { type: 'mnemonic' as const, mnemonic: 'test mnemonic' },
    storageDir: 'onekey-breez-regtest-hd-1',
  };
  const sdk = await module.connect(request);
  return { module, request, sdk };
}

describe('Breez SDK in the extension offscreen document', () => {
  it('connects with the request the service built, unset fields included', async () => {
    const { breez, api } = setup();

    const { request } = await connect(api);

    const [received] = breez.connect.mock.calls[0] as unknown as [
      typeof request,
    ];
    expect(received).toStrictEqual(request);
    // Left out, these would turn the Breez defaults back on.
    expect(Object.keys(received.config)).toEqual(
      expect.arrayContaining(['lnurlDomain', 'realTimeSyncServerUrl']),
    );
    expect(received.config).toMatchObject({
      maxDepositClaimFee: { type: 'fixed', amount: 1n },
    });
  });

  it('gives each caller its own default config', async () => {
    const { api } = setup();
    const module = await createOffscreenBreezSdk(api);

    const config = module.defaultConfig('mainnet');
    config.apiKey = 'changed';

    expect(module.defaultConfig('mainnet')).not.toHaveProperty('apiKey');
    expect(module.defaultConfig('mainnet')).toHaveProperty(
      'network',
      'mainnet',
    );
  });

  it('runs SDK calls in the offscreen document and keeps bigint amounts', async () => {
    const { fake, api } = setup();
    const { sdk } = await connect(api);

    await expect(sdk.getInfo({})).resolves.toMatchObject({
      identityPubkey: 'pubkey',
      balanceSats: 21,
    });
    const prepared = await sdk.prepareSendPayment({
      paymentRequest: { type: 'input', input: 'lnbc1' },
      amount: 1000n,
    });
    expect(fake.sdk.prepareSendPayment).toHaveBeenCalledWith({
      paymentRequest: { type: 'input', input: 'lnbc1' },
      amount: 1000n,
    });
    expect(prepared).toStrictEqual(PREPARED);

    const { payment } = await sdk.sendPayment({
      prepareResponse: prepared,
      options: { type: 'bolt11Invoice', preferSpark: false },
    });
    // The SDK gets back the object it prepared, unchanged.
    expect(fake.sdk.sendPayment).toHaveBeenCalledWith({
      prepareResponse: PREPARED,
      options: { type: 'bolt11Invoice', preferSpark: false },
    });
    expect(payment).toStrictEqual(PAYMENT);
    await expect(sdk.listPayments({ limit: 20 })).resolves.toStrictEqual({
      payments: [PAYMENT],
    });
  });

  it('passes the session events on until the session disconnects', async () => {
    const { fake, api } = setup();
    const { sdk } = await connect(api);
    const onEvent = jest.fn();

    await sdk.addEventListener({ onEvent });
    fake.emit({ type: 'paymentSucceeded', payment: PAYMENT });

    expect(onEvent).toHaveBeenCalledWith({
      type: 'paymentSucceeded',
      payment: PAYMENT,
    });

    await sdk.disconnect();
    fake.emit({ type: 'synced' });

    expect(fake.sdk.disconnect).toHaveBeenCalledTimes(1);
    expect(onEvent).toHaveBeenCalledTimes(1);
  });

  it('fails the calls of a session the offscreen document no longer has', async () => {
    const { fake, api, reloadOffscreen } = setup();
    const { sdk } = await connect(api);

    reloadOffscreen();

    await expect(sdk.getInfo({})).rejects.toThrow(
      'Lightning SDK session not found',
    );
    // Nothing is left to disconnect.
    await expect(sdk.disconnect()).resolves.toBeUndefined();
    expect(fake.sdk.disconnect).not.toHaveBeenCalled();
  });

  it('runs no method outside the SDK calls', async () => {
    const { fake, api } = setup();
    await connect(api);

    await expect(
      api.call({
        sessionId: 'session-1',
        method: 'disconnect' as never,
        request: undefined,
      }),
    ).rejects.toThrow('Unknown Lightning SDK method: disconnect');
    expect(fake.sdk.disconnect).not.toHaveBeenCalled();
  });
});
