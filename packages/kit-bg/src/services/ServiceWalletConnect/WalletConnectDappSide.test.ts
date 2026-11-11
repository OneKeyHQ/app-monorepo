import { EventEmitter } from 'events';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import systemTimeUtils from '@onekeyhq/shared/src/utils/systemTimeUtils';
import type {
  IWalletConnectSession,
  IWalletConnectSignClient,
} from '@onekeyhq/shared/src/walletConnect/types';

import walletConnectClient from './walletConnectClient';
import { WalletConnectDappSide } from './WalletConnectDappSide';

import type { WalletConnectDappSideProvider } from './WalletConnectDappSideProvider';

jest.mock('./walletConnectClient', () => ({
  __esModule: true,
  default: { getDappSideClient: jest.fn() },
}));
jest.mock('../../connectors/externalWalletFactory', () => ({}));
jest.mock('../../dbs/local/localDb', () => ({}));
jest.mock('./WalletConnectDappSideProvider', () => ({
  WalletConnectDappSideProvider: jest.fn(),
}));
jest.mock('@onekeyhq/shared/src/utils/systemTimeUtils', () => ({
  __esModule: true,
  default: {
    refreshServerTime: jest.fn(),
    getEstimatedServerTime: jest.fn(),
  },
}));

it('registers one set of session handlers for concurrent cold-start callers', async () => {
  const events = new EventEmitter();
  // Only the session event interface is exercised here.
  const client = events as unknown as IWalletConnectSignClient;
  jest.mocked(walletConnectClient.getDappSideClient).mockResolvedValue(client);
  const dapp = new WalletConnectDappSide({ backgroundApi: {} });
  const update = jest
    .spyOn(dapp, 'updateAccountByNamespaces')
    .mockResolvedValue();
  const event = jest.spyOn(dapp, 'updateAccountByEvents').mockResolvedValue();
  const remove = jest.spyOn(dapp, 'removeAccount').mockResolvedValue();
  const disconnect = jest.spyOn(dapp, 'disconnectProvider').mockResolvedValue();

  expect(
    await Promise.all([dapp.getSharedClient(), dapp.getSharedClient()]),
  ).toEqual([client, client]);
  await dapp.getSharedClient();
  for (const name of ['session_update', 'session_event', 'session_delete']) {
    const listeners = events.listeners(name) as Array<
      (args: unknown) => Promise<void>
    >;
    await Promise.all(
      listeners.map((listener) =>
        listener({ topic: 'test-topic', params: { namespaces: {} } }),
      ),
    );
  }
  expect(update).toHaveBeenCalledTimes(1);
  expect(event).toHaveBeenCalledTimes(1);
  expect(remove).toHaveBeenCalledTimes(1);
  expect(disconnect).toHaveBeenCalledTimes(1);
});

it('allows shared client initialization to retry after failure', async () => {
  const error = new Error('client initialization failed');
  const events = new EventEmitter();
  const client = events as unknown as IWalletConnectSignClient;
  jest
    .mocked(walletConnectClient.getDappSideClient)
    .mockRejectedValueOnce(error)
    .mockResolvedValue(client);
  const dapp = new WalletConnectDappSide({ backgroundApi: {} });
  await expect(dapp.getSharedClient()).rejects.toBe(error);
  await expect(dapp.getSharedClient()).resolves.toBe(client);
  expect(events.listenerCount('session_update')).toBe(1);
});

function createProviderFixture() {
  const metadata = {
    name: 'Test wallet',
    description: 'WalletConnect connection test',
    url: 'https://example.com',
    icons: [],
  };
  const session: IWalletConnectSession = {
    topic: 'test-session',
    pairingTopic: 'test-pairing',
    relay: { protocol: 'irn' },
    expiry: 1_900_000_000,
    acknowledged: true,
    controller: 'test-controller',
    namespaces: {},
    requiredNamespaces: {},
    optionalNamespaces: {},
    self: { publicKey: 'test-self', metadata },
    peer: { publicKey: 'test-peer', metadata },
  };
  const connect = jest.fn<
    ReturnType<WalletConnectDappSideProvider['connect']>,
    Parameters<WalletConnectDappSideProvider['connect']>
  >();
  const abort = jest.fn<Promise<void>, []>().mockResolvedValue();
  const events = new EventEmitter();
  // Model only the SDK provider surface consumed by connectToWallet.
  const provider = Object.assign(events, {
    session,
    isWalletConnect: true,
    connect,
    abortConnectPairing: abort,
  }) as unknown as WalletConnectDappSideProvider;
  return { session, provider, connect, abort, events };
}

function createDeferred<T>() {
  let resolvePromise: ((value: T) => void) | undefined;
  const promise = new Promise<T>((resolve) => {
    resolvePromise = resolve;
  });
  return { promise, resolve: (value: T) => resolvePromise?.(value) };
}

describe('WalletConnect clock diagnosis after connection failure', () => {
  const serverTime = 1_800_000_000_000;
  const connectionError = new OneKeyLocalError('Relay connection failed');
  let refreshTime: jest.SpyInstance<Promise<boolean>, []>;
  let getEstimatedTime: jest.SpyInstance<number | undefined, []>;
  let localTime: number;
  let dapp: WalletConnectDappSide;
  let fixture: ReturnType<typeof createProviderFixture>;
  const getAllChains = jest.fn();

  beforeEach(() => {
    localTime = serverTime;
    jest.spyOn(Date, 'now').mockImplementation(() => localTime);
    refreshTime = jest
      .spyOn(systemTimeUtils, 'refreshServerTime')
      .mockReset()
      .mockResolvedValue(true);
    getEstimatedTime = jest
      .spyOn(systemTimeUtils, 'getEstimatedServerTime')
      .mockReset()
      .mockReturnValue(serverTime);
    getAllChains.mockReset().mockResolvedValue([]);
    fixture = createProviderFixture();
    fixture.connect.mockRejectedValue(connectionError);
    dapp = new WalletConnectDappSide({
      backgroundApi: {
        serviceWalletConnect: { getAllChains },
        serviceAccount: {
          getWalletConnectDBAccounts: jest
            .fn()
            .mockResolvedValue({ accounts: [] }),
        },
      },
    });
    jest.spyOn(dapp, 'closeModal').mockImplementation(() => undefined);
    jest.spyOn(dapp, 'getOrCreateProvider').mockResolvedValue(fixture.provider);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each([
    100_000, -100_000, 100_001, -100_001, 120_000, -120_000, 86_400_000,
    -172_800_000,
  ])(
    'reports a clock offset of %i ms only after the SDK connection fails',
    async (offset) => {
      localTime += offset;
      const emit = jest.spyOn(appEventBus, 'emit');
      await expect(dapp.connectToWallet({})).rejects.toMatchObject({
        key: ETranslations.global_network_doctor_action_check_datetime,
      });
      expect(fixture.connect).toHaveBeenCalledTimes(1);
      expect(refreshTime.mock.invocationCallOrder[0] ?? 0).toBeGreaterThan(
        fixture.connect.mock.invocationCallOrder[0] ?? 0,
      );
      expect(emit).toHaveBeenCalledWith(
        EAppEventBusNames.WalletConnectConnectError,
        expect.objectContaining({
          error: expect.objectContaining({
            key: ETranslations.global_network_doctor_action_check_datetime,
          }),
        }),
      );
      expect(dapp.activeConnectAttempt).toBeUndefined();
    },
  );

  it.each([0, 99_999, -99_999])(
    'preserves the connection error for a clock offset within tolerance: %i ms',
    async (offset) => {
      localTime += offset;
      await expect(dapp.connectToWallet({})).rejects.toBe(connectionError);
      expect(fixture.connect).toHaveBeenCalledTimes(1);
    },
  );

  it.each([0, 100_000, -100_000, 86_400_000, -172_800_000])(
    'allows a successful connection with offset %i ms without checking the clock',
    async (offset) => {
      localTime += offset;
      fixture.connect.mockResolvedValue(fixture.session);
      await expect(dapp.connectToWallet({})).resolves.toBe(fixture.session);
      expect(refreshTime).not.toHaveBeenCalled();
      expect(getEstimatedTime).not.toHaveBeenCalled();
    },
  );

  it.each([
    'offline',
    'missing-date',
    'stale-response',
    'clock-change',
    'missing-estimate',
  ])(
    'preserves the connection error when time diagnosis encounters %s',
    async (scenario) => {
      localTime += 86_400_000;
      refreshTime.mockImplementation(async () => {
        if (scenario === 'offline') throw new OneKeyLocalError('offline');
        if (scenario === 'missing-date') return false;
        if (scenario === 'missing-estimate') {
          getEstimatedTime.mockReturnValue(undefined);
        } else {
          localTime += scenario === 'clock-change' ? -60_000 : 20_000;
        }
        return true;
      });
      await expect(dapp.connectToWallet({})).rejects.toBe(connectionError);
    },
  );

  it('diagnoses a failed SDK initialization before a provider is available', async () => {
    localTime += 86_400_000;
    jest.spyOn(dapp, 'getOrCreateProvider').mockImplementation(async () => {
      expect(refreshTime).not.toHaveBeenCalled();
      throw connectionError;
    });
    await expect(dapp.connectToWallet({})).rejects.toMatchObject({
      key: ETranslations.global_network_doctor_action_check_datetime,
    });
    expect(fixture.connect).not.toHaveBeenCalled();
  });

  it('does not diagnose clock skew for a chain-configuration failure', async () => {
    localTime += 86_400_000;
    const setupError = new OneKeyLocalError('Chain configuration unavailable');
    getAllChains.mockRejectedValueOnce(setupError);
    await expect(dapp.connectToWallet({})).rejects.toBe(setupError);
    expect(refreshTime).not.toHaveBeenCalled();
  });

  it('preserves explicit pairing cancellation without checking the clock', async () => {
    localTime += 86_400_000;
    const started = createDeferred<void>();
    const pending = createDeferred<IWalletConnectSession | undefined>();
    fixture.connect.mockImplementation(() => {
      started.resolve();
      return pending.promise;
    });
    const connecting = dapp
      .connectToWallet({})
      .catch((error: unknown) => error);
    await started.promise;
    await dapp.abortConnectPairing({ uri: '' });
    await expect(connecting).resolves.toMatchObject({ autoToast: false });
    expect(refreshTime).not.toHaveBeenCalled();
  });

  it('preserves cancellation while diagnosing a failed connection', async () => {
    localTime += 86_400_000;
    const started = createDeferred<void>();
    const checking = createDeferred<boolean>();
    refreshTime.mockImplementation(() => {
      started.resolve();
      return checking.promise;
    });
    const connecting = dapp
      .connectToWallet({})
      .catch((error: unknown) => error);
    await started.promise;
    await dapp.abortConnectPairing({ uri: '' });
    checking.resolve(true);
    await expect(connecting).resolves.toMatchObject({ autoToast: false });
  });

  it('ignores a late pairing URI while diagnosing a failed connection', async () => {
    localTime += 86_400_000;
    const openModal = jest.spyOn(dapp, 'openModal').mockImplementation();
    const started = createDeferred<void>();
    const checking = createDeferred<boolean>();
    refreshTime.mockImplementation(() => {
      started.resolve();
      return checking.promise;
    });
    const connecting = dapp
      .connectToWallet({})
      .catch((error: unknown) => error);
    await started.promise;
    fixture.events.emit('display_uri', 'wc:test-pairing@2');
    checking.resolve(true);
    await connecting;
    expect(openModal).not.toHaveBeenCalled();
  });

  it('does not surface a stale time error or close a successful retry', async () => {
    localTime += 86_400_000;
    const closeModal = jest.spyOn(dapp, 'closeModal');
    const started = createDeferred<void>();
    const checking = createDeferred<boolean>();
    refreshTime.mockImplementation(() => {
      started.resolve();
      return checking.promise;
    });
    const first = dapp.connectToWallet({}).catch((error: unknown) => error);
    await started.promise;
    const retry = createProviderFixture();
    retry.connect.mockResolvedValue(retry.session);
    jest.spyOn(dapp, 'getOrCreateProvider').mockResolvedValue(retry.provider);
    await expect(dapp.connectToWallet({})).resolves.toBe(retry.session);
    const closeCount = closeModal.mock.calls.length;
    checking.resolve(true);
    await expect(first).resolves.toMatchObject({ autoToast: false });
    expect(closeModal).toHaveBeenCalledTimes(closeCount);
    expect(refreshTime).toHaveBeenCalledTimes(1);
  });
});
