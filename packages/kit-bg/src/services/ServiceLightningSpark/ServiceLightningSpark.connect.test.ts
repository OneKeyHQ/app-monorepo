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

jest.mock('./sdk/sparkStorage', () => ({
  removeSparkStorage: jest.fn(async () => undefined),
}));

/* eslint-disable import/first, import/order */
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';

import { vaultFactory } from '../../vaults/factory';

import { loadBreezSdk } from './sdk/breezSdk';
import { removeSparkStorage } from './sdk/sparkStorage';
import ServiceLightningSpark from './ServiceLightningSpark';

import type { ISparkSdk } from './sdk/types';
/* eslint-enable import/first, import/order */

const NETWORK_ID = 'lightningspark--0';
const IDLE_DISCONNECT_MS = 60_000;
const CONNECT_TIMEOUT_MS = 30_000;
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
    syncWallet: jest.fn(async (): Promise<unknown> => ({})),
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
  // Holds the native connect of a wallet until the test releases it.
  const connectGates = new Map<string, Promise<void>>();
  const breez = {
    defaultConfig: jest.fn(() => ({})),
    connect: jest.fn(async ({ storageDir }: { storageDir: string }) => {
      // The storage dir ends with the wallet id.
      const walletId = storageDir.split('-').slice(-2).join('-');
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await Promise.resolve();
      await connectGates.get(walletId);
      inFlight -= 1;
      return sdkOf(walletId);
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
    connectGates,
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
    const { breez, sdkOf, connectGates, ensureConnected, getMaxInFlight } =
      setup();
    const secondConnect = deferred<void>();
    connectGates.set('hd-2', secondConnect.promise);

    const first = ensureConnected('hd-1');
    const second = ensureConnected('hd-2');
    const third = ensureConnected('hd-3');
    await expect(first).resolves.toBe(sdkOf('hd-1'));

    // hd-3 must not start while the native connect of hd-2 runs.
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });
    expect(breez.connect).toHaveBeenCalledTimes(2);
    secondConnect.resolve();

    await expect(second).resolves.toBe(sdkOf('hd-2'));
    await expect(third).resolves.toBe(sdkOf('hd-3'));
    expect(breez.connect).toHaveBeenCalledTimes(3);
    expect(getMaxInFlight()).toBe(1);
  });

  it('fails instead of handing out another wallet once its SDK was replaced', async () => {
    const { service, internals, ensureConnected } = setup();
    const connectAccount = service.connectAccount.bind(service);
    // A lock lands after the connect finished, before its caller resumes.
    jest
      .spyOn(service, 'connectAccount')
      .mockImplementationOnce(async (params) => {
        const connected = await connectAccount(params);
        await service.disconnect();
        return connected;
      });

    await expect(ensureConnected('hd-1')).rejects.toThrow(
      'Lightning wallet changed while connecting',
    );
    expect(internals.sdk).toBeUndefined();
  });

  it('lets queued callers go once the SDK is ready, without reading the wallet', async () => {
    const { sdkOf, ensureConnected } = setup();
    // A wallet read that never answers must not hold the queue.
    sdkOf('hd-1').getInfo.mockReturnValue(new Promise(() => undefined));

    await expect(ensureConnected('hd-1')).resolves.toBe(sdkOf('hd-1'));
    await expect(ensureConnected('hd-2')).resolves.toBe(sdkOf('hd-2'));
    expect(sdkOf('hd-1').getInfo).not.toHaveBeenCalled();
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

  it('does not let a wallet removed during its connect create its storage again', async () => {
    const { service, breez, ensureConnected } = setup();
    // The key is derived; the SDK module is still loading.
    const loaded = deferred<void>();
    jest.mocked(loadBreezSdk).mockImplementationOnce(async () => {
      await loaded.promise;
      return breez as never;
    });
    const connecting = ensureConnected('hd-1').catch(
      (error: Error) => error.message,
    );
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });

    const removing = service.removeWalletStorage({ walletId: 'hd-1' });
    loaded.resolve();

    await expect(connecting).resolves.toBe('Lightning connect was superseded');
    await removing;
    expect(breez.connect).not.toHaveBeenCalled();
    expect(removeSparkStorage).toHaveBeenCalledTimes(1);
  });

  it('does not hold App Reset on a connect still asking for its password', async () => {
    const { service, breez, backgroundApi, ensureConnected } = setup();
    const password = deferred<void>();
    backgroundApi.servicePassword.promptPasswordVerifyByWallet.mockImplementationOnce(
      async () => {
        await password.promise;
        return { password: 'pw' };
      },
    );
    const connecting = ensureConnected('hd-1').catch(
      (error: Error) => error.message,
    );
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });

    await service.removeAllStorage();
    expect(removeSparkStorage).toHaveBeenCalledTimes(1);

    password.resolve();
    await expect(connecting).resolves.toBe('Lightning connect was superseded');
    expect(breez.connect).not.toHaveBeenCalled();
  });

  it('does not connect the next wallet when the app locks while the previous one shuts down', async () => {
    const { service, internals, breez, sdkOf, ensureConnected } = setup();
    await ensureConnected('hd-1');
    const shutdown = deferred<undefined>();
    sdkOf('hd-1').disconnect.mockImplementationOnce(() => shutdown.promise);

    const switching = ensureConnected('hd-2').catch(
      (error: Error) => error.message,
    );
    await new Promise((resolve) => {
      setTimeout(resolve, 0);
    });
    // The LockApp handler.
    await service.disconnect();
    shutdown.resolve(undefined);

    await expect(switching).resolves.toBe('Lightning connect was superseded');
    expect(breez.connect).toHaveBeenCalledTimes(1);
    expect(internals.sdk).toBeUndefined();
  });

  it('gives up a connect whose SDK setup stalls, so the next connect can run', async () => {
    jest.useFakeTimers();
    const { sdkOf, ensureConnected } = setup();
    sdkOf('hd-1').addEventListener.mockReturnValueOnce(
      new Promise(() => undefined),
    );

    const stalled = ensureConnected('hd-1').catch(
      (error: Error) => error.message,
    );
    await jest.advanceTimersByTimeAsync(CONNECT_TIMEOUT_MS);

    await expect(stalled).resolves.toBe('Lightning connect timed out');
    expect(sdkOf('hd-1').disconnect).toHaveBeenCalledTimes(1);
    await expect(ensureConnected('hd-2')).resolves.toBe(sdkOf('hd-2'));
  });

  it('does not let an idle expiry cancel a connect started since', async () => {
    jest.useFakeTimers();
    const { service, internals, backgroundApi, sdkOf, ensureConnected } =
      setup();
    await service.holdSession({
      holderId: 'home',
      accountId: accountOf('hd-1'),
      networkId: NETWORK_ID,
    });
    await service.releaseSession({ holderId: 'home' });
    const password = deferred<void>();
    backgroundApi.servicePassword.promptPasswordVerifyByWallet.mockImplementationOnce(
      async () => {
        await password.promise;
        return { password: 'pw' };
      },
    );

    // A send connects another wallet just before the idle timer expires.
    await jest.advanceTimersByTimeAsync(IDLE_DISCONNECT_MS - 1000);
    const sending = ensureConnected('hd-2');
    await jest.advanceTimersByTimeAsync(1000);
    password.resolve();

    await expect(sending).resolves.toBe(sdkOf('hd-2'));
    expect(internals.sdk).toBe(sdkOf('hd-2'));
  });

  it('ends the idle SDK once a connect that waited past its expiry fails', async () => {
    jest.useFakeTimers();
    const { service, internals, backgroundApi, sdkOf, ensureConnected } =
      setup();
    await service.holdSession({
      holderId: 'home',
      accountId: accountOf('hd-1'),
      networkId: NETWORK_ID,
    });
    await service.releaseSession({ holderId: 'home' });
    const password = deferred<void>();
    backgroundApi.servicePassword.promptPasswordVerifyByWallet.mockImplementationOnce(
      async () => {
        await password.promise;
        throw new OneKeyLocalError('Password prompt cancelled');
      },
    );

    // A send of another wallet asks for its password across the expiry, and
    // the user cancels the prompt.
    await jest.advanceTimersByTimeAsync(IDLE_DISCONNECT_MS - 1000);
    const sending = ensureConnected('hd-2').catch(
      (error: Error) => error.message,
    );
    await jest.advanceTimersByTimeAsync(1000);
    expect(sdkOf('hd-1').disconnect).not.toHaveBeenCalled();
    password.resolve();

    await expect(sending).resolves.toBe('Password prompt cancelled');
    await jest.advanceTimersByTimeAsync(0);
    expect(sdkOf('hd-1').disconnect).toHaveBeenCalledTimes(1);
    expect(internals.sdk).toBeUndefined();
  });

  it('keeps the SDK for a call queued behind another connect until the call settles', async () => {
    jest.useFakeTimers();
    const { service, internals, backgroundApi, sdkOf, ensureConnected } =
      setup();
    await service.holdSession({
      holderId: 'home',
      accountId: accountOf('hd-1'),
      networkId: NETWORK_ID,
    });
    await service.releaseSession({ holderId: 'home' });
    const password = deferred<void>();
    backgroundApi.servicePassword.promptPasswordVerifyByWallet.mockImplementationOnce(
      async () => {
        await password.promise;
        throw new OneKeyLocalError('Password prompt cancelled');
      },
    );
    const sync = deferred<void>();
    sdkOf('hd-1').syncWallet.mockImplementationOnce(() => sync.promise);

    // Wallet B asks for its password, and a claim of wallet A queues behind
    // it before A's idle expiry. The user cancels B.
    await jest.advanceTimersByTimeAsync(IDLE_DISCONNECT_MS - 1000);
    const switching = ensureConnected('hd-2').catch(() => undefined);
    const claiming = service.claimPendingReceive({
      accountId: accountOf('hd-1'),
      networkId: NETWORK_ID,
    });
    await jest.advanceTimersByTimeAsync(1000);
    password.resolve();
    await switching;
    await jest.advanceTimersByTimeAsync(0);

    // The claim runs on A's SDK, which the expiry leaves connected.
    expect(sdkOf('hd-1').syncWallet).toHaveBeenCalledTimes(1);
    expect(sdkOf('hd-1').disconnect).not.toHaveBeenCalled();

    sync.resolve();
    await claiming;
    await jest.advanceTimersByTimeAsync(IDLE_DISCONNECT_MS - 1);
    expect(sdkOf('hd-1').disconnect).not.toHaveBeenCalled();
    await jest.advanceTimersByTimeAsync(1);
    expect(sdkOf('hd-1').disconnect).toHaveBeenCalledTimes(1);
    expect(internals.sdk).toBeUndefined();
  });

  it('does not let a call on a replaced SDK keep the next wallet connected', async () => {
    jest.useFakeTimers();
    const { service, internals, sdkOf, ensureConnected } = setup();
    const sync = deferred<void>();
    sdkOf('hd-1').syncWallet.mockImplementationOnce(() => sync.promise);

    // A claim on wallet A waits for an answer from A's session.
    const claiming = service.claimPendingReceive({
      accountId: accountOf('hd-1'),
      networkId: NETWORK_ID,
    });
    for (
      let i = 0;
      i < 20 && !sdkOf('hd-1').syncWallet.mock.calls.length;
      i += 1
    ) {
      await jest.advanceTimersByTimeAsync(0);
    }
    expect(sdkOf('hd-1').syncWallet).toHaveBeenCalledTimes(1);

    // The user switches to wallet B, whose last Spark screen then closes.
    await ensureConnected('hd-2');
    await service.holdSession({
      holderId: 'home',
      accountId: accountOf('hd-2'),
      networkId: NETWORK_ID,
    });
    await service.releaseSession({ holderId: 'home' });
    await jest.advanceTimersByTimeAsync(IDLE_DISCONNECT_MS);

    expect(sdkOf('hd-2').disconnect).toHaveBeenCalledTimes(1);
    expect(internals.sdk).toBeUndefined();
    sync.resolve();
    await claiming;
  });

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
