/*
yarn jest packages/kit-bg/src/services/ServiceLightningSpark/ServiceLightningSpark.restart.test.ts

iOS rebuilds the background runtime in place on a full restart, and the native
Breez SDK outlives it. Before the restart the service disconnects the SDK,
waits for a connect in flight to give its SDK up, and starts no new connect.
*/

// --- mocks MUST be defined before the import of ServiceLightningSpark ---

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => ({
  backgroundClass: () => () => undefined,
  backgroundMethod: () => (_t: unknown, _k: unknown, d: PropertyDescriptor) =>
    d,
  backgroundMethodForDev:
    () => (_t: unknown, _k: unknown, d: PropertyDescriptor) =>
      d,
}));

jest.mock('../ServiceBase', () => ({
  __esModule: true,
  default: class ServiceBase {
    backgroundApi: any;

    constructor({ backgroundApi }: { backgroundApi: any }) {
      this.backgroundApi = backgroundApi;
    }
  },
}));

jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({
  EAppEventBusNames: {
    LockApp: 'LockApp',
    UnlockApp: 'UnlockApp',
    AccountDataUpdate: 'AccountDataUpdate',
    HistoryTxStatusChanged: 'HistoryTxStatusChanged',
  },
  appEventBus: { on: jest.fn(), emit: jest.fn() },
}));

jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    lightning: { spark: { disconnectedBeforeRestart: jest.fn() } },
  },
}));

jest.mock(
  '@onekeyhq/shared/src/modules3rdParty/appRestart/beforeAppRestart',
  () => ({ addBeforeAppRestartHandler: jest.fn() }),
);

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: true, isExtension: false },
}));

jest.mock('@onekeyhq/shared/src/errors', () => ({
  OneKeyLocalError: Error,
  InvalidLightningPaymentRequest: Error,
}));

jest.mock('@onekeyhq/shared/types/setting', () => ({
  EReasonForNeedPassword: { Default: 'Default' },
}));

jest.mock('@onekeyhq/shared/src/utils/accountUtils', () => ({
  __esModule: true,
  default: {},
}));

jest.mock('@onekeyhq/shared/src/utils/networkUtils', () => ({
  __esModule: true,
  default: {},
}));

jest.mock('@onekeyhq/core/src/chains/spark/utils', () => ({
  getSparkNetworkFromImpl: jest.fn(),
}));

jest.mock('../../vaults/factory', () => ({
  vaultFactory: {},
}));

jest.mock('./sdk/breezSdk', () => ({
  loadBreezSdk: jest.fn(),
}));

/* eslint-disable import/first, import/order */
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';
import { addBeforeAppRestartHandler } from '@onekeyhq/shared/src/modules3rdParty/appRestart/beforeAppRestart';

import { loadBreezSdk } from './sdk/breezSdk';
import ServiceLightningSpark from './ServiceLightningSpark';

import type { ISparkSdk } from './sdk/types';
/* eslint-enable import/first, import/order */

const sparkLog = defaultLogger.lightning.spark as unknown as Record<
  'disconnectedBeforeRestart',
  jest.Mock
>;

type ISparkInternals = {
  sdk: unknown;
  connectWithChildMnemonic: (params: {
    walletId: string;
    network: string;
    apiKey: string;
    childMnemonic: string;
  }) => Promise<unknown>;
};

function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

function makeSdk() {
  return {
    addEventListener: jest.fn(async () => 'listener-1'),
    getUserSettings: jest.fn(async () => ({ sparkPrivateModeEnabled: false })),
    updateUserSettings: jest.fn(async () => undefined),
    getInfo: jest.fn(async () => ({ identityPubkey: '02ab', balanceSats: 0 })),
    disconnect: jest.fn(async () => undefined),
  };
}

type IFakeSdk = ReturnType<typeof makeSdk>;

function setup() {
  const breez = {
    defaultConfig: jest.fn(() => ({})),
    connect: jest.fn<Promise<ISparkSdk>, [unknown]>(),
  };
  jest.mocked(loadBreezSdk).mockResolvedValue(breez as never);
  const service = new ServiceLightningSpark({ backgroundApi: {} });
  const internals = service as unknown as ISparkInternals;
  const beforeRestart = jest
    .mocked(addBeforeAppRestartHandler)
    .mock.calls.at(-1)?.[0] as () => Promise<void>;
  const connect = () =>
    internals.connectWithChildMnemonic({
      walletId: 'hd-1',
      network: 'regtest',
      apiKey: 'test-key',
      childMnemonic: 'test mnemonic',
    });
  const asSdk = (sdk: IFakeSdk) => sdk as unknown as ISparkSdk;
  return { service, internals, breez, beforeRestart, connect, asSdk };
}

describe('ServiceLightningSpark before an app restart', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('disconnects the connected SDK', async () => {
    const { internals, breez, beforeRestart, connect, asSdk } = setup();
    const sdk = makeSdk();
    breez.connect.mockResolvedValue(asSdk(sdk));
    await connect();
    expect(internals.sdk).toBe(sdk);

    await beforeRestart();

    expect(sdk.disconnect).toHaveBeenCalledTimes(1);
    expect(internals.sdk).toBeUndefined();
    expect(sparkLog.disconnectedBeforeRestart).toHaveBeenCalledWith({
      durationMs: expect.any(Number),
      pendingConnects: 0,
    });
  });

  it('waits for a connect in flight and disconnects the SDK it returns', async () => {
    const { internals, breez, beforeRestart, connect, asSdk } = setup();
    const sdk = makeSdk();
    const nativeConnect = deferred<ISparkSdk>();
    breez.connect.mockReturnValue(nativeConnect.promise);
    const connecting = connect();
    const connectResult = connecting.then(
      () => 'connected',
      (error: Error) => error.message,
    );
    // Let the connect reach the SDK call.
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });
    expect(breez.connect).toHaveBeenCalledTimes(1);

    let restartReady = false;
    const preparing = beforeRestart().then(() => {
      restartReady = true;
    });
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });
    expect(restartReady).toBe(false);

    nativeConnect.resolve(asSdk(sdk));
    await preparing;

    expect(await connectResult).toBe('Lightning connect was superseded');
    expect(sdk.disconnect).toHaveBeenCalledTimes(1);
    expect(internals.sdk).toBeUndefined();
    expect(sparkLog.disconnectedBeforeRestart).toHaveBeenCalledWith({
      durationMs: expect.any(Number),
      pendingConnects: 1,
    });
  });

  it('starts no connect once the restart has begun', async () => {
    const { internals, breez, beforeRestart, connect } = setup();

    await beforeRestart();

    await expect(connect()).rejects.toThrow('The app is restarting');
    expect(breez.connect).not.toHaveBeenCalled();
    expect(internals.sdk).toBeUndefined();
  });

  it('does not keep an SDK that was disconnected while it was being set up', async () => {
    const { service, internals, breez, connect, asSdk } = setup();
    const sdk = makeSdk();
    const listenerAdded = deferred<string>();
    sdk.addEventListener.mockReturnValue(listenerAdded.promise);
    breez.connect.mockResolvedValue(asSdk(sdk));
    const connectResult = connect().then(
      () => 'connected',
      (error: Error) => error.message,
    );
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });
    expect(sdk.addEventListener).toHaveBeenCalledTimes(1);

    // The app locks here.
    await service.disconnect();
    listenerAdded.resolve('listener-1');

    expect(await connectResult).toBe('Lightning connect was superseded');
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });
    expect(sdk.disconnect).toHaveBeenCalledTimes(1);
    expect(internals.sdk).toBeUndefined();
  });
});
