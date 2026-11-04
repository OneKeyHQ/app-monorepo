/*
yarn jest packages/kit-bg/src/services/ServiceLightningSpark/ServiceLightningSpark.session.test.ts

Connection lifecycle of the Breez SDK behind Lightning Spark: Spark screens
hold the session, a cached password connects it silently, the last screen
closing disconnects it after a grace period, and payment events refresh the
home after the server's cache window.
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

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: false, isExtension: false },
}));

jest.mock('@onekeyhq/shared/src/errors', () => ({
  OneKeyLocalError: Error,
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
import { appEventBus } from '@onekeyhq/shared/src/eventBus/appEventBus';
import { defaultLogger } from '@onekeyhq/shared/src/logger/logger';

import ServiceLightningSpark from './ServiceLightningSpark';

import type { SdkEvent } from '@breeztech/breez-sdk-spark';
/* eslint-enable import/first, import/order */

const eventBus = appEventBus as unknown as Record<'on' | 'emit', jest.Mock>;
const sparkLog = defaultLogger.lightning.spark as unknown as Record<
  'autoConnectFailed',
  jest.Mock
>;

const ACCOUNT_ID = "hd-1--m/83696968'/1330334798'/0'/12'/0'";
const NETWORK_ID = 'lightningspark--0';
const IDLE_DISCONNECT_MS = 60_000;
const PAYMENT_REFRESH_DELAY_MS = 6000;
const PAYMENT_LATE_REFRESH_DELAY_MS = 20_000;

type ISparkInternals = {
  ensureConnected: (params: {
    accountId: string;
    networkId: string;
  }) => Promise<unknown>;
  onSdkEvent: (walletId: string, event: SdkEvent) => void;
};

function makeService({ cachedPassword = true } = {}) {
  const backgroundApi = {
    servicePassword: {
      hasCachedPassword: jest.fn(async () => cachedPassword),
    },
  };
  const service = new ServiceLightningSpark({ backgroundApi });
  const internals = service as unknown as ISparkInternals;
  const ensureConnected = jest
    .spyOn(internals, 'ensureConnected')
    .mockResolvedValue(undefined);
  const disconnect = jest
    .spyOn(service, 'disconnect')
    .mockResolvedValue(undefined);
  return { service, internals, backgroundApi, ensureConnected, disconnect };
}

const hold = (service: ServiceLightningSpark, holderId: string) =>
  service.holdSession({
    holderId,
    accountId: ACCOUNT_ID,
    networkId: NETWORK_ID,
  });

describe('ServiceLightningSpark session lifecycle', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('connects silently when a Spark screen opens and the password is cached', async () => {
    const { service, ensureConnected } = makeService();

    await hold(service, 'home');

    expect(ensureConnected).toHaveBeenCalledWith({
      accountId: ACCOUNT_ID,
      networkId: NETWORK_ID,
    });
  });

  it('does not connect without a cached password, so it never asks for one', async () => {
    const { service, ensureConnected } = makeService({ cachedPassword: false });

    await hold(service, 'home');

    expect(ensureConnected).not.toHaveBeenCalled();
  });

  it('disconnects 60 s after the last screen closes, unless one opens again', async () => {
    const { service, disconnect } = makeService();

    await hold(service, 'home');
    await hold(service, 'token-details');
    await service.releaseSession({ holderId: 'token-details' });
    jest.advanceTimersByTime(IDLE_DISCONNECT_MS);
    // The home still shows Spark.
    expect(disconnect).not.toHaveBeenCalled();

    await service.releaseSession({ holderId: 'home' });
    jest.advanceTimersByTime(IDLE_DISCONNECT_MS - 1);
    await hold(service, 'home');
    jest.advanceTimersByTime(IDLE_DISCONNECT_MS);
    expect(disconnect).not.toHaveBeenCalled();

    await service.releaseSession({ holderId: 'home' });
    jest.advanceTimersByTime(IDLE_DISCONNECT_MS);
    expect(disconnect).toHaveBeenCalledTimes(1);
  });

  it('logs a failed silent connect instead of throwing', async () => {
    const { service, ensureConnected } = makeService();
    ensureConnected.mockRejectedValueOnce(
      new Error('This Lightning wallet is already connected in another tab'),
    );

    await expect(hold(service, 'home')).resolves.toBeUndefined();
    expect(sparkLog.autoConnectFailed).toHaveBeenCalledWith({
      error: 'This Lightning wallet is already connected in another tab',
    });
  });

  it('reconnects the held account after the app unlocks', async () => {
    const { service, ensureConnected } = makeService();
    await hold(service, 'home');
    ensureConnected.mockClear();

    const onUnlock = eventBus.on.mock.calls.find(
      ([name]) => name === 'UnlockApp',
    )?.[1] as () => void;
    onUnlock();
    await Promise.resolve();
    await Promise.resolve();

    expect(ensureConnected).toHaveBeenCalledWith({
      accountId: ACCOUNT_ID,
      networkId: NETWORK_ID,
    });
  });

  it('claims pending receives by connecting and syncing, then refreshes the home', async () => {
    const { service, ensureConnected } = makeService();
    const syncWallet = jest.fn(async () => ({}));
    ensureConnected.mockResolvedValue({ syncWallet });

    await service.claimPendingReceive({
      accountId: ACCOUNT_ID,
      networkId: NETWORK_ID,
    });

    expect(ensureConnected).toHaveBeenCalledWith({
      accountId: ACCOUNT_ID,
      networkId: NETWORK_ID,
    });
    expect(syncWallet).toHaveBeenCalledWith({});
    jest.advanceTimersByTime(PAYMENT_REFRESH_DELAY_MS);
    expect(eventBus.emit).toHaveBeenCalledWith('AccountDataUpdate', undefined);
    expect(eventBus.emit).toHaveBeenCalledWith(
      'HistoryTxStatusChanged',
      undefined,
    );
  });

  it('refreshes balances and history twice per burst of payment events: after the server cache window and after explorer indexing', () => {
    const { internals } = makeService();
    const payment = { id: 'transfer-1' } as unknown as Extract<
      SdkEvent,
      { type: 'paymentPending' }
    >['payment'];
    const refreshPass = [
      ['AccountDataUpdate', undefined],
      ['HistoryTxStatusChanged', undefined],
    ];

    internals.onSdkEvent('hd-1', { type: 'synced' });
    internals.onSdkEvent('hd-1', { type: 'paymentPending', payment });
    internals.onSdkEvent('hd-1', { type: 'paymentSucceeded', payment });
    jest.advanceTimersByTime(PAYMENT_REFRESH_DELAY_MS - 1);
    expect(eventBus.emit).not.toHaveBeenCalled();

    jest.advanceTimersByTime(1);
    expect(eventBus.emit.mock.calls).toEqual(refreshPass);

    jest.advanceTimersByTime(
      PAYMENT_LATE_REFRESH_DELAY_MS - PAYMENT_REFRESH_DELAY_MS,
    );
    expect(eventBus.emit.mock.calls).toEqual([...refreshPass, ...refreshPass]);
  });

  it('restarts both refreshes when another payment event arrives in between', () => {
    const { internals } = makeService();
    const payment = { id: 'transfer-1' } as unknown as Extract<
      SdkEvent,
      { type: 'paymentSucceeded' }
    >['payment'];

    internals.onSdkEvent('hd-1', { type: 'paymentSucceeded', payment });
    jest.advanceTimersByTime(PAYMENT_REFRESH_DELAY_MS - 1);
    internals.onSdkEvent('hd-1', { type: 'paymentSucceeded', payment });
    jest.advanceTimersByTime(PAYMENT_REFRESH_DELAY_MS - 1);
    expect(eventBus.emit).not.toHaveBeenCalled();

    jest.advanceTimersByTime(PAYMENT_LATE_REFRESH_DELAY_MS);
    expect(eventBus.emit).toHaveBeenCalledTimes(4);
  });
});
