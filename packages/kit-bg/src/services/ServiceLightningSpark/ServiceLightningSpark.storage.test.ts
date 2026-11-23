/*
yarn jest packages/kit-bg/src/services/ServiceLightningSpark/ServiceLightningSpark.storage.test.ts

Breez keeps each wallet's payment history on the device. Removing a wallet
deletes that wallet's storage, App Reset deletes all of it, and an SDK that
holds a storage open is disconnected first.
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

jest.mock('./sdk/sparkStorage', () => ({
  removeSparkStorage: jest.fn(async () => undefined),
}));

/* eslint-disable import/first, import/order */
import { loadBreezSdk } from './sdk/breezSdk';
import { removeSparkStorage } from './sdk/sparkStorage';
import ServiceLightningSpark from './ServiceLightningSpark';

import type { ISparkSdk } from './sdk/types';
/* eslint-enable import/first, import/order */

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

function setup() {
  const breez = {
    defaultConfig: jest.fn(() => ({})),
    connect: jest.fn<Promise<ISparkSdk>, [unknown]>(),
  };
  jest.mocked(loadBreezSdk).mockResolvedValue(breez as never);
  const service = new ServiceLightningSpark({ backgroundApi: {} });
  const internals = service as unknown as ISparkInternals;
  const connect = (walletId: string) =>
    internals.connectWithChildMnemonic({
      walletId,
      network: 'mainnet',
      apiKey: 'test-key',
      childMnemonic: 'test mnemonic',
    });
  return { service, internals, breez, connect };
}

// The storage directories the last removal accepted, out of `candidates`.
function removedDirs(candidates: string[]) {
  const match = jest.mocked(removeSparkStorage).mock.calls.at(-1)?.[0];
  return candidates.filter((storageDir) => match?.(storageDir));
}

const CANDIDATES = [
  'onekey-breez-mainnet-hd-1',
  'onekey-breez-regtest-hd-1',
  'onekey-breez-mainnet-hd-10',
  'onekey-breez-mainnet-hd-2',
  'other-app-data',
];

describe('ServiceLightningSpark storage removal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("disconnects the removed wallet's SDK, then deletes its storage on every network", async () => {
    const { service, internals, breez, connect } = setup();
    const sdk = makeSdk();
    breez.connect.mockResolvedValue(sdk as unknown as ISparkSdk);
    await connect('hd-1');

    await service.removeWalletStorage({ walletId: 'hd-1' });

    expect(sdk.disconnect).toHaveBeenCalledTimes(1);
    expect(internals.sdk).toBeUndefined();
    expect(removeSparkStorage).toHaveBeenCalledTimes(1);
    expect(
      jest.mocked(removeSparkStorage).mock.invocationCallOrder[0],
    ).toBeGreaterThan(sdk.disconnect.mock.invocationCallOrder[0]);
    expect(removedDirs(CANDIDATES)).toEqual([
      'onekey-breez-mainnet-hd-1',
      'onekey-breez-regtest-hd-1',
    ]);
  });

  it('keeps the SDK of another wallet connected', async () => {
    const { service, internals, breez, connect } = setup();
    const sdk = makeSdk();
    breez.connect.mockResolvedValue(sdk as unknown as ISparkSdk);
    await connect('hd-2');

    await service.removeWalletStorage({ walletId: 'hd-1' });

    expect(sdk.disconnect).not.toHaveBeenCalled();
    expect(internals.sdk).toBe(sdk);
    expect(removedDirs(CANDIDATES)).toEqual([
      'onekey-breez-mainnet-hd-1',
      'onekey-breez-regtest-hd-1',
    ]);
  });

  it('waits for a connect in flight to give up its SDK before deleting', async () => {
    const { service, breez, connect } = setup();
    const sdk = makeSdk();
    const nativeConnect = deferred<ISparkSdk>();
    breez.connect.mockReturnValue(nativeConnect.promise);
    const connecting = connect('hd-1').catch((error: Error) => error.message);
    // Let the connect reach the SDK call.
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });

    const removing = service.removeWalletStorage({ walletId: 'hd-1' });
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });
    expect(removeSparkStorage).not.toHaveBeenCalled();

    nativeConnect.resolve(sdk as unknown as ISparkSdk);
    await removing;

    await expect(connecting).resolves.toBe('Lightning connect was superseded');
    expect(sdk.disconnect).toHaveBeenCalledTimes(1);
    expect(removeSparkStorage).toHaveBeenCalledTimes(1);
  });

  it('App Reset disconnects and deletes the storage of every wallet', async () => {
    const { service, internals, breez, connect } = setup();
    const sdk = makeSdk();
    breez.connect.mockResolvedValue(sdk as unknown as ISparkSdk);
    await connect('hd-2');

    await service.removeAllStorage();

    expect(sdk.disconnect).toHaveBeenCalledTimes(1);
    expect(internals.sdk).toBeUndefined();
    expect(removedDirs(CANDIDATES)).toEqual([
      'onekey-breez-mainnet-hd-1',
      'onekey-breez-regtest-hd-1',
      'onekey-breez-mainnet-hd-10',
      'onekey-breez-mainnet-hd-2',
    ]);
  });
});
