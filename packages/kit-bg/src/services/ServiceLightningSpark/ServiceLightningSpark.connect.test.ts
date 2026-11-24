/*
yarn jest packages/kit-bg/src/services/ServiceLightningSpark/ServiceLightningSpark.connect.test.ts

Connects of the Breez SDK run one at a time and hand each caller the SDK of
its own wallet. A lock that lands while the password is checked or the key
derived cancels the connect, and a screen that closes during its connect
still lets the SDK go after the idle period.
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
  defaultLogger: { lightning: { spark: { autoConnectFailed: jest.fn() } } },
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
  default: {
    getWalletIdFromAccountId: ({ accountId }: { accountId: string }) =>
      accountId.split('--')[0],
    isHdWallet: () => true,
    isBotWallet: () => false,
  },
}));

jest.mock('@onekeyhq/shared/src/utils/networkUtils', () => ({
  __esModule: true,
  default: { getNetworkImpl: () => 'lightningspark' },
}));

jest.mock('@onekeyhq/core/src/chains/spark/utils', () => ({
  getSparkNetworkFromImpl: () => 'mainnet',
}));

jest.mock('../../vaults/factory', () => ({
  vaultFactory: { getVault: jest.fn() },
}));

jest.mock('./sdk/breezSdk', () => ({
  loadBreezSdk: jest.fn(),
}));

/* eslint-disable import/first, import/order */
import { vaultFactory } from '../../vaults/factory';

import { loadBreezSdk } from './sdk/breezSdk';
import ServiceLightningSpark from './ServiceLightningSpark';

import type { ISparkSdk } from './sdk/types';
/* eslint-enable import/first, import/order */

const NETWORK_ID = 'lightningspark--0';
const IDLE_DISCONNECT_MS = 60_000;
const accountOf = (walletId: string) => `${walletId}--m/0'`;

type ISparkInternals = {
  ensureConnected: (params: {
    accountId: string;
    networkId: string;
  }) => Promise<ISparkSdk>;
  sdk: unknown;
};

function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

function makeSdk(walletId: string) {
  return {
    walletId,
    addEventListener: jest.fn(async () => 'listener-1'),
    getUserSettings: jest.fn(async () => ({ sparkPrivateModeEnabled: false })),
    updateUserSettings: jest.fn(async () => undefined),
    getInfo: jest.fn(async () => ({ identityPubkey: '02ab', balanceSats: 0 })),
    disconnect: jest.fn(async () => undefined),
  };
}

type IFakeSdk = ReturnType<typeof makeSdk>;

const services: ServiceLightningSpark[] = [];

function setup() {
  const sdks = new Map<string, IFakeSdk>();
  const sdkOf = (walletId: string) => {
    if (!sdks.has(walletId)) {
      sdks.set(walletId, makeSdk(walletId));
    }
    return sdks.get(walletId) as IFakeSdk;
  };
  let inFlight = 0;
  let maxInFlight = 0;
  const breez = {
    defaultConfig: jest.fn(() => ({})),
    connect: jest.fn(async ({ storageDir }: { storageDir: string }) => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await Promise.resolve();
      inFlight -= 1;
      // The storage dir ends with the wallet id.
      return sdkOf(storageDir.split('-').slice(-2).join('-'));
    }),
  };
  jest.mocked(loadBreezSdk).mockResolvedValue(breez as never);
  const getChildMnemonicForConnect = jest.fn(async () => 'child mnemonic');
  jest
    .mocked(vaultFactory.getVault)
    .mockResolvedValue({ keyring: { getChildMnemonicForConnect } } as never);
  const backgroundApi = {
    servicePassword: {
      promptPasswordVerifyByWallet: jest.fn(async () => ({ password: 'pw' })),
      hasCachedPassword: jest.fn(async () => true),
    },
  };
  const service = new ServiceLightningSpark({ backgroundApi });
  services.push(service);
  const internals = service as unknown as ISparkInternals;
  const ensureConnected = (walletId: string) =>
    internals.ensureConnected({
      accountId: accountOf(walletId),
      networkId: NETWORK_ID,
    });
  return {
    service,
    internals,
    breez,
    backgroundApi,
    getChildMnemonicForConnect,
    sdkOf,
    ensureConnected,
    getMaxInFlight: () => maxInFlight,
  };
}

describe('ServiceLightningSpark connects', () => {
  const apiKey = process.env.BREEZ_API_KEY;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.BREEZ_API_KEY = 'test-key';
  });

  afterEach(async () => {
    jest.useRealTimers();
    process.env.BREEZ_API_KEY = apiKey;
    // Each connected wallet holds a Web Locks lock until it disconnects.
    await Promise.all(
      services.splice(0).map((service) => service.disconnect()),
    );
  });

  it('hands each waiting caller the SDK of its own wallet', async () => {
    const { breez, sdkOf, ensureConnected, getMaxInFlight } = setup();
    const firstInfo = deferred<{
      identityPubkey: string;
      balanceSats: number;
    }>();
    sdkOf('hd-2').getInfo.mockReturnValueOnce(firstInfo.promise);

    const first = ensureConnected('hd-1');
    const second = ensureConnected('hd-2');
    const third = ensureConnected('hd-3');
    await expect(first).resolves.toBe(sdkOf('hd-1'));

    // hd-2 finishes its connect with getInfo; hd-3 must not start meanwhile.
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });
    expect(breez.connect).toHaveBeenCalledTimes(2);
    firstInfo.resolve({ identityPubkey: '02cd', balanceSats: 0 });

    await expect(second).resolves.toBe(sdkOf('hd-2'));
    await expect(third).resolves.toBe(sdkOf('hd-3'));
    expect(breez.connect).toHaveBeenCalledTimes(3);
    expect(getMaxInFlight()).toBe(1);
  });

  it('fails instead of handing out another wallet once its SDK was replaced', async () => {
    const { service, sdkOf, ensureConnected } = setup();
    const info = deferred<{ identityPubkey: string; balanceSats: number }>();
    sdkOf('hd-1').getInfo.mockReturnValueOnce(info.promise);

    const connecting = ensureConnected('hd-1');
    const result = connecting.catch((error: Error) => error.message);
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });
    // A lock lands while the connect reads the wallet info.
    await service.disconnect();
    info.resolve({ identityPubkey: '02ab', balanceSats: 0 });

    await expect(result).resolves.toBe(
      'Lightning wallet changed while connecting',
    );
  });

  it.each(['password', 'key derivation'])(
    'does not connect when the app locks during the %s',
    async (step) => {
      const {
        service,
        internals,
        breez,
        backgroundApi,
        getChildMnemonicForConnect,
        ensureConnected,
      } = setup();
      const pending = deferred<void>();
      if (step === 'password') {
        backgroundApi.servicePassword.promptPasswordVerifyByWallet.mockImplementationOnce(
          async () => {
            await pending.promise;
            return { password: 'pw' };
          },
        );
      } else {
        getChildMnemonicForConnect.mockImplementationOnce(async () => {
          await pending.promise;
          return 'child mnemonic';
        });
      }

      const result = ensureConnected('hd-1').catch(
        (error: Error) => error.message,
      );
      await new Promise((resolve) => {
        setTimeout(resolve, 0);
      });
      // The LockApp handler.
      await service.disconnect();
      pending.resolve();

      await expect(result).resolves.toBe('Lightning connect was superseded');
      expect(breez.connect).not.toHaveBeenCalled();
      expect(internals.sdk).toBeUndefined();
    },
  );

  it('disconnects after the idle period when the screen closed during its connect', async () => {
    jest.useFakeTimers();
    const { service, internals, backgroundApi, sdkOf } = setup();
    const password = deferred<void>();
    backgroundApi.servicePassword.promptPasswordVerifyByWallet.mockImplementationOnce(
      async () => {
        await password.promise;
        return { password: 'pw' };
      },
    );

    const holding = service.holdSession({
      holderId: 'home',
      accountId: accountOf('hd-1'),
      networkId: NETWORK_ID,
    });
    await jest.advanceTimersByTimeAsync(0);
    await service.releaseSession({ holderId: 'home' });
    password.resolve();
    await holding;
    expect(internals.sdk).toBe(sdkOf('hd-1'));

    await jest.advanceTimersByTimeAsync(IDLE_DISCONNECT_MS);
    expect(sdkOf('hd-1').disconnect).toHaveBeenCalledTimes(1);
    expect(internals.sdk).toBeUndefined();
  });
});
