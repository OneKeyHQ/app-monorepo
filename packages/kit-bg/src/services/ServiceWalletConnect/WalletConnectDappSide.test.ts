import { EventEmitter } from 'events';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';
import systemTimeUtils from '@onekeyhq/shared/src/utils/systemTimeUtils';
import type { IWalletConnectSignClient } from '@onekeyhq/shared/src/walletConnect/types';

import walletConnectClient from './walletConnectClient';
import { WalletConnectDappSide } from './WalletConnectDappSide';

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

describe('WalletConnect local clock validation', () => {
  const mockSystemTimeUtils = jest.mocked(systemTimeUtils);
  const serverTime = 1_800_000_000_000;
  const nextStep = new Error('continue to chain lookup');
  let localTime: number;
  let dapp: WalletConnectDappSide;
  const getAllChains = jest.fn();

  beforeEach(() => {
    localTime = serverTime;
    jest.spyOn(Date, 'now').mockImplementation(() => localTime);
    mockSystemTimeUtils.refreshServerTime.mockResolvedValue(true);
    mockSystemTimeUtils.getEstimatedServerTime.mockReturnValue(serverTime);
    getAllChains.mockReset().mockRejectedValue(nextStep);
    dapp = new WalletConnectDappSide({
      backgroundApi: { serviceWalletConnect: { getAllChains } },
    });
    jest.spyOn(dapp, 'closeModal').mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each([
    100_000, -100_000, 100_001, -100_001, 120_000, -120_000, 86_400_000,
    -172_800_000,
  ])(
    'reports a clock offset of %i ms before initializing the provider',
    async (offset) => {
      localTime += offset;
      await expect(dapp.connectToWallet({})).rejects.toMatchObject({
        key: ETranslations.global_network_doctor_action_check_datetime,
      });
      expect(getAllChains).not.toHaveBeenCalled();
      expect(dapp.activeConnectAttempt).toBeUndefined();
    },
  );

  it.each([0, 99_999, -99_999])(
    'continues for a clock offset within tolerance: %i ms',
    async (offset) => {
      localTime += offset;
      await expect(dapp.connectToWallet({})).rejects.toBe(nextStep);
      expect(getAllChains).toHaveBeenCalledTimes(1);
    },
  );

  it.each(['offline', 'missing-date', 'stale-response', 'clock-change'])(
    'does not misreport a clock error after %s',
    async (scenario) => {
      localTime += 86_400_000;
      mockSystemTimeUtils.refreshServerTime.mockImplementation(async () => {
        if (scenario === 'offline') throw new OneKeyLocalError('offline');
        if (scenario === 'missing-date') return false;
        localTime += scenario === 'clock-change' ? -60_000 : 20_000;
        return true;
      });
      await expect(dapp.connectToWallet({})).rejects.toBe(nextStep);
      expect(getAllChains).toHaveBeenCalledTimes(1);
    },
  );

  it('preserves cancellation while the time request is pending', async () => {
    localTime += 86_400_000;
    let finishCheck: ((result: boolean) => void) | undefined;
    mockSystemTimeUtils.refreshServerTime.mockReturnValue(
      new Promise<boolean>((resolve) => {
        finishCheck = resolve;
      }),
    );
    const connecting = dapp
      .connectToWallet({})
      .catch((error: unknown) => error);
    await dapp.abortConnectPairing({ uri: '' });
    finishCheck?.(true);
    await expect(connecting).resolves.toMatchObject({ autoToast: false });
    expect(getAllChains).not.toHaveBeenCalled();
  });
});
