import { appEventBus } from '@onekeyhq/shared/src/eventBus/appEventBus';
import type { IDeFiPosition } from '@onekeyhq/shared/types/defi';
import { EOnChainHistoryTxStatus } from '@onekeyhq/shared/types/history';

import ServiceDeFi from './ServiceDeFi';

jest.mock('@onekeyhq/shared/src/background/backgroundDecorators', () => ({
  backgroundClass: () => () => undefined,
  backgroundMethod: () => (_t: unknown, _k: unknown, d: PropertyDescriptor) =>
    d,
  toastIfError: () => (_t: unknown, _k: unknown, d: PropertyDescriptor) => d,
}));

jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({
  EAppEventBusNames: {
    LocalPendingTxConfirmed: 'LocalPendingTxConfirmed',
    RefreshTokenList: 'RefreshTokenList',
    HistoryTxStatusChanged: 'HistoryTxStatusChanged',
    DeFiPositionRefreshed: 'DeFiPositionRefreshed',
  },
  appEventBus: { emit: jest.fn(), on: jest.fn() },
}));

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  settingsPersistAtom: { get: async () => ({ currencyInfo: { id: 'usd' } }) },
}));

jest.mock('./ServiceBase', () => ({
  __esModule: true,
  default: class ServiceBase {
    backgroundApi: unknown;

    constructor({ backgroundApi }: { backgroundApi: unknown }) {
      this.backgroundApi = backgroundApi;
    }
  },
}));

const tx = { accountId: 'account-a', networkId: 'network-a', txid: 'tx-a' };
const mockAppEventBus = appEventBus as unknown as { emit: jest.Mock };

function createService() {
  const fetchTxDetails = jest.fn();
  const fetchAccountHistory = jest.fn().mockResolvedValue(undefined);
  const post = jest.fn(async (_url: string, body: { networkId: string }) =>
    positionsResponse(body.networkId, 10),
  );
  const updateAccountDeFiOverview = jest.fn().mockResolvedValue(undefined);
  const getDBAccountSafe = jest.fn(
    async ({ accountId }: { accountId: string }) => ({
      indexedAccountId: `indexed-${accountId}`,
    }),
  );
  const service = new ServiceDeFi({
    backgroundApi: {
      serviceHistory: { fetchTxDetails, fetchAccountHistory },
      serviceAccount: {
        getDBAccountSafe,
        getAccountAddressForApi: async ({ accountId }: { accountId: string }) =>
          `address-${accountId}`,
        getAccountXpub: async () => undefined,
      },
      serviceAccountProfile: {
        _getWalletTypeHeader: async () => ({}),
      },
      serviceSetting: {
        getCurrencyMap: async () => ({ usd: { id: 'usd', value: 1 } }),
      },
      simpleDb: { deFi: { updateAccountDeFiOverview } },
    },
  });
  (
    service as unknown as { getClient: () => Promise<{ post: typeof post }> }
  ).getClient = async () => ({ post });
  jest.spyOn(service, 'isNetworkDeFiEnabled').mockResolvedValue(true);
  const refresh = jest
    .spyOn(service, 'refreshAccountDeFiPositionsAfterAction')
    .mockResolvedValue(undefined);
  return {
    service,
    fetchTxDetails,
    fetchAccountHistory,
    refresh,
    post,
    getDBAccountSafe,
  };
}

function positionsResponse(networkId: string, amount: number) {
  const position: IDeFiPosition = {
    networkId,
    owner: 'test-owner',
    protocol: 'test-protocol',
    protocolName: 'Test Protocol',
    protocolLogo: '',
    chain: 'test',
    category: 'lending',
    assets: [
      {
        symbol: 'USDC',
        address: 'test-address',
        amount: String(amount),
        value: amount,
        price: 1,
        category: 'supplied',
        meta: { decimals: 6, isVerified: true },
      },
    ],
    debts: [],
    rewards: [],
    metrics: { healthFactor: null },
    source: { provider: 'test', fetchedAt: '', ttl: 0, cached: false },
    groupId: 'test-group',
    name: 'Test position',
  };
  return {
    data: {
      data: {
        data: {
          positions: { [networkId]: [position] },
          totals: {
            totalValue: amount,
            totalDebt: 0,
            totalReward: 0,
            netWorth: amount,
            chains: ['test'],
            protocolCount: 1,
            positionCount: 1,
          },
          protocolSummaries: [
            {
              protocol: 'test-protocol',
              protocolName: 'Test Protocol',
              totalValue: amount,
              totalDebt: 0,
              totalReward: 0,
              netWorth: amount,
              networkIds: [networkId],
              positionCount: 1,
              positionIndices: [],
              protocolLogo: '',
              protocolUrl: '',
            },
          ],
        },
        meta: { queriedNetworkIds: [networkId] },
      },
    },
  };
}

describe('DeFi transaction settlement tracking', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('refreshes the real portfolio request and event while transaction details remain unavailable', async () => {
    const { service, fetchTxDetails, fetchAccountHistory, post, refresh } =
      createService();
    fetchTxDetails.mockResolvedValue(null);
    post
      .mockResolvedValueOnce(positionsResponse(tx.networkId, 10))
      .mockResolvedValue(positionsResponse(tx.networkId, 9));

    service.trackSubmittedDeFiTransaction(tx);
    await jest.advanceTimersByTimeAsync(0);
    expect(post).toHaveBeenCalledWith(
      '/wallet/v1/portfolio/positions',
      expect.objectContaining({
        networkId: tx.networkId,
        isForceRefresh: true,
      }),
      expect.anything(),
    );
    expect(mockAppEventBus.emit).toHaveBeenCalledWith(
      'DeFiPositionRefreshed',
      expect.objectContaining({
        accountId: tx.accountId,
        networkId: tx.networkId,
        overview: expect.objectContaining({ netWorth: 10 }),
      }),
    );

    await jest.advanceTimersByTimeAsync(10_000);
    expect(mockAppEventBus.emit).toHaveBeenCalledWith(
      'DeFiPositionRefreshed',
      expect.objectContaining({
        accountId: tx.accountId,
        networkId: tx.networkId,
        overview: expect.objectContaining({ netWorth: 9 }),
      }),
    );
    expect(fetchTxDetails.mock.calls.length).toBeGreaterThan(1);
    expect(refresh).not.toHaveBeenCalled();
    expect(fetchAccountHistory).not.toHaveBeenCalled();
    expect(mockAppEventBus.emit).not.toHaveBeenCalledWith(
      'HistoryTxStatusChanged',
      undefined,
    );

    // A provider may continue returning the old portfolio after the first
    // refresh; a later independent retry must still publish its new value.
    post.mockResolvedValue(positionsResponse(tx.networkId, 8));
    await jest.advanceTimersByTimeAsync(110_000);
    expect(mockAppEventBus.emit).toHaveBeenCalledWith(
      'DeFiPositionRefreshed',
      expect.objectContaining({
        accountId: tx.accountId,
        networkId: tx.networkId,
        overview: expect.objectContaining({ netWorth: 8 }),
      }),
    );
    expect(refresh).not.toHaveBeenCalled();
  });

  it('deduplicates the same submitted transaction and keeps other accounts independent', async () => {
    const { service, fetchTxDetails, post } = createService();
    fetchTxDetails.mockResolvedValue(null);
    const otherTx = { ...tx, accountId: 'account-b', txid: 'tx-b' };

    service.trackSubmittedDeFiTransaction(tx);
    service.trackSubmittedDeFiTransaction(tx);
    service.trackSubmittedDeFiTransaction(otherTx);
    await jest.advanceTimersByTimeAsync(0);
    expect(fetchTxDetails).toHaveBeenCalledTimes(2);
    expect(post).toHaveBeenCalledTimes(2);
    for (const accountId of [tx.accountId, otherTx.accountId]) {
      expect(mockAppEventBus.emit).toHaveBeenCalledWith(
        'DeFiPositionRefreshed',
        expect.objectContaining({ accountId, networkId: tx.networkId }),
      );
    }

    await jest.advanceTimersByTimeAsync(10_000);
    expect(post).toHaveBeenCalledTimes(4);
  });

  it('recovers the indexed account for the event after the initial account lookup fails', async () => {
    const { service, fetchTxDetails, getDBAccountSafe } = createService();
    fetchTxDetails.mockResolvedValue(null);
    getDBAccountSafe.mockRejectedValueOnce(new Error('account lookup failed'));

    service.trackSubmittedDeFiTransaction(tx);
    await jest.advanceTimersByTimeAsync(0);

    expect(getDBAccountSafe.mock.calls.length).toBeGreaterThan(1);
    expect(mockAppEventBus.emit).toHaveBeenCalledWith(
      'DeFiPositionRefreshed',
      expect.objectContaining({
        accountId: tx.accountId,
        networkId: tx.networkId,
        indexedAccountId: `indexed-${tx.accountId}`,
      }),
    );
  });

  it('keeps tracking after submission and refreshes the submitted scope only on success', async () => {
    const { service, fetchTxDetails, fetchAccountHistory, refresh } =
      createService();
    fetchTxDetails
      .mockResolvedValueOnce({
        data: { status: EOnChainHistoryTxStatus.Pending },
      })
      .mockResolvedValueOnce({
        data: { status: EOnChainHistoryTxStatus.Success },
      });

    service.trackSubmittedDeFiTransaction(tx);
    service.trackSubmittedDeFiTransaction(tx);
    await jest.advanceTimersByTimeAsync(5000);

    expect(fetchTxDetails).toHaveBeenCalledTimes(2);
    expect(refresh).toHaveBeenCalledTimes(1);
    expect(refresh).toHaveBeenCalledWith({
      accountId: tx.accountId,
      networkId: tx.networkId,
    });
    expect(fetchAccountHistory).toHaveBeenCalledWith({
      accountId: tx.accountId,
      networkId: tx.networkId,
    });
    expect(mockAppEventBus.emit).toHaveBeenCalledWith('RefreshTokenList', {
      accounts: [{ accountId: tx.accountId, networkId: tx.networkId }],
    });
  });

  it('does not report a failed transaction as successful and can track it again', async () => {
    const { service, fetchTxDetails, fetchAccountHistory, refresh } =
      createService();
    fetchTxDetails.mockResolvedValue({
      data: { status: EOnChainHistoryTxStatus.Failed },
    });
    service.trackSubmittedDeFiTransaction(tx);
    await jest.advanceTimersByTimeAsync(0);
    service.trackSubmittedDeFiTransaction(tx);
    await jest.advanceTimersByTimeAsync(0);
    expect(fetchTxDetails).toHaveBeenCalledTimes(2);
    expect(refresh).not.toHaveBeenCalled();
    expect(fetchAccountHistory).toHaveBeenCalledTimes(2);
    expect(mockAppEventBus.emit).toHaveBeenCalledWith('RefreshTokenList', {
      accounts: [{ accountId: tx.accountId, networkId: tx.networkId }],
    });
  });

  it('tracks different transactions independently through transient errors', async () => {
    const { service, fetchTxDetails, refresh } = createService();
    fetchTxDetails
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue({ data: { status: EOnChainHistoryTxStatus.Success } });
    service.trackSubmittedDeFiTransaction(tx);
    service.trackSubmittedDeFiTransaction({ ...tx, txid: 'tx-b' });
    await jest.advanceTimersByTimeAsync(5000);
    expect(refresh).toHaveBeenCalledTimes(2);
  });

  it('keeps settlement invalidation until the matching revision is acknowledged', async () => {
    const { service } = createService();
    const scoped = { accountId: tx.accountId, networkId: tx.networkId };
    const mark = service as unknown as {
      _markRecentDeFiSettlement: (accountId: string, networkId: string) => void;
    };
    mark._markRecentDeFiSettlement(scoped.accountId, scoped.networkId);
    const first = await service.getDeFiSettlementRevision(scoped);
    expect(first).toBeDefined();
    if (first === undefined) return;
    await jest.advanceTimersByTimeAsync(180_000);
    expect(await service.getDeFiSettlementRevision(scoped)).toBe(first);
    mark._markRecentDeFiSettlement(scoped.accountId, scoped.networkId);
    const second = await service.getDeFiSettlementRevision(scoped);
    expect(second).toBeDefined();
    if (second === undefined) return;
    expect(second).not.toBe(first);
    await service.acknowledgeDeFiSettlement({ ...scoped, revision: first });
    expect(await service.getDeFiSettlementRevision(scoped)).toBe(second);
    await service.acknowledgeDeFiSettlement({ ...scoped, revision: second });
    expect(await service.getDeFiSettlementRevision(scoped)).toBeUndefined();
  });
});
