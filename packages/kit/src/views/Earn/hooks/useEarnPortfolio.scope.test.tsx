/** @jest-environment jsdom */

import { act, renderHook, waitFor } from '@testing-library/react';

import type {
  IEarnAccountTokenResponse,
  IEarnInvestmentItemV2,
  IEarnPortfolioInvestment,
} from '@onekeyhq/shared/types/staking';

import { useEarnPortfolio } from './useEarnPortfolio';

let mockAccount = { id: 'a', address: 'address-a' };
const mockListeners = new Map<string, Set<() => void>>();
const mockStaking = {
  getAvailableAssetsV2: jest.fn(),
  getEarnAvailableAccountsParams: jest.fn(),
  fetchInvestmentBatchDetail: jest.fn(),
  fetchInvestmentDetailV2: jest.fn(),
};
const mockSetCache = jest.fn();
let mockEarnAccounts: Record<string, IEarnAccountTokenResponse> = {};
let mockCache: Record<
  string,
  { accountScope: string; investments: IEarnPortfolioInvestment[] }
> = {};
const mockActions = {
  current: { getEarnAccount: jest.fn(), updateEarnAccounts: jest.fn() },
};

jest.mock('@onekeyhq/components', () => {
  const { useDeferredPromise } = jest.requireActual<
    typeof import('../../../../../components/src/hooks/useDeferredPromise')
  >('../../../../../components/src/hooks/useDeferredPromise');
  return {
    getCurrentVisibilityState: () => true,
    onVisibilityStateChange: () => () => undefined,
    useDeferredPromise,
    useNetInfo: () => ({ isRawInternetReachable: true }),
  };
});
jest.mock('@onekeyhq/kit/src/hooks/useRouteIsFocused', () => ({
  useRouteIsFocusedWhenEnabled: () => true,
}));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    get serviceStaking() {
      return mockStaking;
    },
  },
}));
jest.mock('@onekeyhq/shared/src/config/networkIds', () => ({
  getNetworkIdsMap: () => ({ onekeyall: 'onekeyall' }),
}));
jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({
  EAppEventBusNames: {
    AccountDataUpdate: 'AccountDataUpdate',
    AccountUpdate: 'AccountUpdate',
  },
  appEventBus: {
    on: (name: string, listener: () => void) => {
      const listeners = mockListeners.get(name) ?? new Set();
      listeners.add(listener);
      mockListeners.set(name, listeners);
    },
    off: (name: string, listener: () => void) =>
      mockListeners.get(name)?.delete(listener),
  },
}));
jest.mock('@onekeyhq/shared/types/earn/earnProvider.constants', () => ({
  earnTestnetNetworkIds: [],
}));
jest.mock('../../../states/jotai/contexts/accountSelector', () => ({
  useActiveAccount: () => ({ activeAccount: { account: mockAccount } }),
}));
jest.mock('../../../states/jotai/contexts/earn', () => ({
  useEarnActions: () => mockActions,
  useEarnAtom: () => [{ earnAccount: mockEarnAccounts }],
  useEarnPortfolioInvestmentsAtom: () => [mockCache, mockSetCache],
}));
jest.mock('./useEarnAccountKey', () => ({
  useEarnAccountKey: () => mockAccount.id,
}));

function investment(value: string): IEarnInvestmentItemV2 {
  return {
    protocol: {
      symbol: 'ETH',
      vault: 'vault',
      providerDetail: { code: 'pendle', name: 'Pendle', logoURI: '' },
    },
    network: { networkId: 'evm--1', name: 'Ethereum', logoURI: '' },
    totalFiatValue: value,
    earnings24hFiatValue: '0',
    assets: [
      {
        token: { info: { symbol: 'ETH', logoURI: '' } },
        deposit: { title: { text: 'Deposit' }, description: { text: value } },
        earnings24h: { title: { text: 'Earnings' } },
        rewardAssets: [],
        assetsStatus: [],
        buttons: [],
      },
    ],
  };
}

describe('desktop Earn portfolio account ownership', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockListeners.clear();
    mockAccount = { id: 'a', address: 'address-a' };
    mockEarnAccounts = {};
    mockCache = {};
    mockActions.current.getEarnAccount.mockImplementation(
      (key: string) => mockEarnAccounts[key],
    );
    mockActions.current.updateEarnAccounts.mockImplementation(
      ({
        key,
        earnAccount,
      }: {
        key: string;
        earnAccount: IEarnAccountTokenResponse;
      }) => {
        mockEarnAccounts = { ...mockEarnAccounts, [key]: earnAccount };
      },
    );
    mockSetCache.mockImplementation(
      (update: (previous: typeof mockCache) => typeof mockCache) => {
        mockCache = update(mockCache);
      },
    );
    mockStaking.getAvailableAssetsV2.mockResolvedValue([
      {
        type: 'normal',
        networkId: 'evm--1',
        provider: 'pendle',
        symbol: 'ETH',
        vault: 'vault',
        enableBatch: true,
      },
    ]);
    mockStaking.getEarnAvailableAccountsParams.mockImplementation(
      async ({ accountId }: { accountId: string }) => {
        let accountAddress = 'address-b';
        if (accountId === 'a') {
          accountAddress =
            mockAccount.id === 'a' ? mockAccount.address : 'address-a';
        }
        return [{ networkId: 'evm--1', accountAddress }];
      },
    );
    mockStaking.fetchInvestmentBatchDetail.mockImplementation(
      async ({ accountAddress }: { accountAddress: string }) => ({
        items: [investment(accountAddress === 'address-a' ? '10' : '20')],
        errors: [],
      }),
    );
  });

  it('starts one automatic request when Earn becomes active', async () => {
    let resolveAssets = () => {};
    mockStaking.getAvailableAssetsV2.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveAssets = () => resolve([]);
      }),
    );
    const view = renderHook(({ isActive }) => useEarnPortfolio({ isActive }), {
      initialProps: { isActive: false },
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 0));
    });
    expect(mockStaking.getAvailableAssetsV2).not.toHaveBeenCalled();

    view.rerender({ isActive: true });
    await waitFor(() =>
      expect(mockStaking.getAvailableAssetsV2).toHaveBeenCalledTimes(1),
    );
    expect(mockStaking.getEarnAvailableAccountsParams).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveAssets();
    });
    view.unmount();
  });

  it('keeps manual refresh independent of an in-flight automatic request', async () => {
    let resolveAssets = () => {};
    mockStaking.getAvailableAssetsV2.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveAssets = () => resolve([]);
      }),
    );
    const view = renderHook(() => useEarnPortfolio());
    await waitFor(() =>
      expect(mockStaking.getAvailableAssetsV2).toHaveBeenCalledTimes(1),
    );
    await act(async () => {
      await view.result.current.refresh({ provider: 'pendle' });
    });
    expect(mockStaking.getAvailableAssetsV2).toHaveBeenCalledTimes(2);
    expect(view.result.current.earnTotalFiatValue.toFixed()).toBe('10');
    await act(async () => resolveAssets());
    view.unmount();
  });

  it('keeps account event refresh independent of an in-flight automatic request', async () => {
    let resolveAssets = () => {};
    mockStaking.getAvailableAssetsV2.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveAssets = () => resolve([]);
      }),
    );
    const view = renderHook(() => useEarnPortfolio());
    await waitFor(() =>
      expect(mockStaking.getAvailableAssetsV2).toHaveBeenCalledTimes(1),
    );
    act(() => {
      mockListeners.get('AccountUpdate')?.forEach((listener) => listener());
    });
    await waitFor(() =>
      expect(mockStaking.getAvailableAssetsV2).toHaveBeenCalledTimes(2),
    );
    await act(async () => resolveAssets());
    view.unmount();
  });

  it('continues one polling chain after activation', async () => {
    jest.useFakeTimers();
    const tick = async (ms: number) => {
      await act(async () => {
        jest.advanceTimersByTime(ms);
        for (let i = 0; i < 20; i += 1) {
          await Promise.resolve();
        }
      });
    };
    try {
      const view = renderHook(
        ({ isActive }) => useEarnPortfolio({ isActive }),
        {
          initialProps: { isActive: false },
        },
      );
      await tick(0);
      view.rerender({ isActive: true });
      await tick(0);
      expect(mockStaking.getAvailableAssetsV2).toHaveBeenCalledTimes(1);
      await tick(180_000);
      expect(mockStaking.getAvailableAssetsV2).toHaveBeenCalledTimes(2);
      await tick(180_000);
      expect(mockStaking.getAvailableAssetsV2).toHaveBeenCalledTimes(3);
      view.unmount();
    } finally {
      jest.useRealTimers();
    }
  });

  it('starts a new automatic request when the account changes in flight', async () => {
    let resolveAssets = () => {};
    mockStaking.getAvailableAssetsV2.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveAssets = () => resolve([]);
      }),
    );
    const view = renderHook(() => useEarnPortfolio());
    await waitFor(() =>
      expect(mockStaking.getAvailableAssetsV2).toHaveBeenCalledTimes(1),
    );
    mockAccount = { id: 'b', address: 'address-b' };
    view.rerender();
    await waitFor(() =>
      expect(view.result.current.earnTotalFiatValue.toFixed()).toBe('20'),
    );
    expect(mockStaking.getAvailableAssetsV2).toHaveBeenCalledTimes(2);
    await act(async () => resolveAssets());
    expect(view.result.current.earnTotalFiatValue.toFixed()).toBe('20');
    view.unmount();
  });

  it('starts a fresh automatic request after leaving and returning to Earn', async () => {
    let resolveAssets = () => {};
    mockStaking.getAvailableAssetsV2.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveAssets = () => resolve([]);
      }),
    );
    const view = renderHook(({ isActive }) => useEarnPortfolio({ isActive }), {
      initialProps: { isActive: true },
    });
    await waitFor(() =>
      expect(mockStaking.getAvailableAssetsV2).toHaveBeenCalledTimes(1),
    );
    view.rerender({ isActive: false });
    view.rerender({ isActive: true });
    await waitFor(() =>
      expect(mockStaking.getAvailableAssetsV2).toHaveBeenCalledTimes(2),
    );
    await act(async () => resolveAssets());
    view.unmount();
  });

  it('reloads the portfolio when an external account keeps its ID but changes address', async () => {
    const view = renderHook(() => useEarnPortfolio());
    await waitFor(() =>
      expect(view.result.current.earnTotalFiatValue.toFixed()).toBe('10'),
    );
    mockStaking.getEarnAvailableAccountsParams.mockClear();
    mockAccount = { id: 'a', address: 'address-b' };
    view.rerender();
    await act(async () => {
      mockListeners.get('AccountUpdate')?.forEach((listener) => listener());
    });
    await waitFor(() =>
      expect(view.result.current.earnTotalFiatValue.toFixed()).toBe('20'),
    );
    expect(mockStaking.getEarnAvailableAccountsParams).toHaveBeenCalled();
    view.unmount();
  });

  it('does not allow an old account refresh callback to replace the active account portfolio', async () => {
    const view = renderHook(() => useEarnPortfolio());
    await waitFor(() =>
      expect(view.result.current.earnTotalFiatValue.toFixed()).toBe('10'),
    );
    const refreshA = view.result.current.refresh;
    mockAccount = { id: 'b', address: 'address-b' };
    view.rerender();
    await waitFor(() =>
      expect(view.result.current.earnTotalFiatValue.toFixed()).toBe('20'),
    );
    await act(async () => {
      await refreshA();
    });
    expect(view.result.current.earnTotalFiatValue.toFixed()).toBe('20');
    view.unmount();
  });

  it('rejects unscoped persisted totals and preserves preferences when writing the new scope', async () => {
    mockEarnAccounts = {
      a: {
        accounts: [],
        totalFiatValue: '999',
        earnings24h: '12',
        hideSmallAssets: true,
      },
    };
    let resolveAccounts = (
      _value: Array<{ networkId: string; accountAddress: string }>,
    ) => {};
    mockStaking.getEarnAvailableAccountsParams.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveAccounts = resolve;
      }),
    );
    const view = renderHook(() => useEarnPortfolio());
    expect(view.result.current.cachedOverviewTotalFiatValue).toBeUndefined();
    expect(view.result.current.cachedOverviewEarnings24h).toBeUndefined();
    await act(async () => {
      resolveAccounts([{ networkId: 'evm--1', accountAddress: 'address-a' }]);
    });
    await waitFor(() =>
      expect(view.result.current.earnTotalFiatValue.toFixed()).toBe('10'),
    );
    expect(mockEarnAccounts.a.hideSmallAssets).toBe(true);
    expect(mockEarnAccounts.a.portfolioAccountScope).toBeDefined();
    expect(mockEarnAccounts.a.totalFiatValue).not.toBe('999');
    view.unmount();
  });

  it('finishes a full refresh without overwriting a newer partial result', async () => {
    const view = renderHook(() => useEarnPortfolio());
    await waitFor(() =>
      expect(view.result.current.earnTotalFiatValue.toFixed()).toBe('10'),
    );
    let resolveFull = (_value: {
      items: IEarnInvestmentItemV2[];
      errors: [];
    }) => {};
    mockStaking.fetchInvestmentBatchDetail.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveFull = resolve;
      }),
    );
    let full: Promise<void> | undefined;
    act(() => {
      full = view.result.current.refresh();
    });
    await waitFor(() =>
      expect(mockStaking.fetchInvestmentBatchDetail).toHaveBeenCalledTimes(2),
    );
    mockStaking.fetchInvestmentBatchDetail.mockResolvedValueOnce({
      items: [investment('20')],
      errors: [],
    });
    await act(async () => {
      await view.result.current.refresh({ provider: 'pendle' });
    });
    await act(async () => {
      resolveFull({ items: [investment('99')], errors: [] });
      await full;
    });
    expect(view.result.current.earnTotalFiatValue.toFixed()).toBe('20');
    expect(view.result.current.isLoading).toBe(false);
    view.unmount();
  });

  it('retains independent provider results during overlapping full and partial refreshes', async () => {
    const protocolInvestment = (provider: string, value: string) => {
      const item = investment(value);
      return {
        ...item,
        protocol: {
          ...item.protocol,
          vault: `vault-${provider}`,
          providerDetail: { ...item.protocol.providerDetail, code: provider },
        },
      };
    };
    mockStaking.getAvailableAssetsV2.mockResolvedValue(
      ['pendle', 'morpho'].map((provider) => ({
        type: 'normal',
        networkId: 'evm--1',
        provider,
        symbol: 'ETH',
        vault: `vault-${provider}`,
        enableBatch: true,
      })),
    );
    mockStaking.fetchInvestmentBatchDetail.mockImplementation(
      async ({ provider }: { provider: string }) => ({
        items: [
          protocolInvestment(provider, provider === 'pendle' ? '10' : '30'),
        ],
        errors: [],
      }),
    );
    const view = renderHook(() => useEarnPortfolio());
    await waitFor(() =>
      expect(view.result.current.earnTotalFiatValue.toFixed()).toBe('40'),
    );

    let resolvePendle = (_value: {
      items: IEarnInvestmentItemV2[];
      errors: [];
    }) => {};
    let resolveMorpho = (_value: {
      items: IEarnInvestmentItemV2[];
      errors: [];
    }) => {};
    let pendleCalls = 0;
    mockStaking.fetchInvestmentBatchDetail.mockImplementation(
      ({ provider }: { provider: string }) => {
        if (provider === 'morpho') {
          return new Promise((resolve) => {
            resolveMorpho = resolve;
          });
        }
        pendleCalls += 1;
        if (pendleCalls === 1) {
          return new Promise((resolve) => {
            resolvePendle = resolve;
          });
        }
        return Promise.resolve({
          items: [protocolInvestment(provider, '20')],
          errors: [],
        });
      },
    );
    let full: Promise<void> | undefined;
    act(() => {
      full = view.result.current.refresh();
    });
    await waitFor(() => expect(pendleCalls).toBe(1));
    await act(async () => {
      await view.result.current.refresh({ provider: 'pendle' });
    });
    await act(async () => {
      resolvePendle({
        items: [protocolInvestment('pendle', '99')],
        errors: [],
      });
      resolveMorpho({
        items: [protocolInvestment('morpho', '50')],
        errors: [],
      });
      await full;
    });
    expect(view.result.current.earnTotalFiatValue.toFixed()).toBe('70');
    expect(view.result.current.isLoading).toBe(false);
    view.unmount();
  });

  it('does not resurrect a position removed by a newer partial refresh', async () => {
    const view = renderHook(() => useEarnPortfolio());
    await waitFor(() =>
      expect(view.result.current.earnTotalFiatValue.toFixed()).toBe('10'),
    );
    let resolveFull = (_value: {
      items: IEarnInvestmentItemV2[];
      errors: [];
    }) => {};
    mockStaking.fetchInvestmentBatchDetail.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveFull = resolve;
      }),
    );
    let full: Promise<void> | undefined;
    act(() => {
      full = view.result.current.refresh();
    });
    await waitFor(() =>
      expect(mockStaking.fetchInvestmentBatchDetail).toHaveBeenCalledTimes(2),
    );
    mockStaking.fetchInvestmentBatchDetail.mockResolvedValueOnce({
      items: [investment('0')],
      errors: [],
    });
    await act(async () => {
      await view.result.current.refresh({ provider: 'pendle' });
    });
    await act(async () => {
      resolveFull({ items: [investment('99')], errors: [] });
      await full;
    });
    expect(view.result.current.earnTotalFiatValue.toFixed()).toBe('0');
    expect(view.result.current.investments).toEqual([]);
    view.unmount();
  });

  it('keeps an older successful full result when a newer partial refresh fails', async () => {
    const view = renderHook(() => useEarnPortfolio());
    await waitFor(() =>
      expect(view.result.current.earnTotalFiatValue.toFixed()).toBe('10'),
    );
    let resolveFull = (_value: {
      items: IEarnInvestmentItemV2[];
      errors: [];
    }) => {};
    mockStaking.fetchInvestmentBatchDetail.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveFull = resolve;
      }),
    );
    let full: Promise<void> | undefined;
    act(() => {
      full = view.result.current.refresh();
    });
    await waitFor(() =>
      expect(mockStaking.fetchInvestmentBatchDetail).toHaveBeenCalledTimes(2),
    );
    mockStaking.fetchInvestmentBatchDetail.mockRejectedValueOnce(
      new Error('unavailable'),
    );
    await act(async () => {
      await view.result.current.refresh({ provider: 'pendle' });
    });
    await act(async () => {
      resolveFull({ items: [investment('30')], errors: [] });
      await full;
    });
    expect(view.result.current.earnTotalFiatValue.toFixed()).toBe('30');
    expect(view.result.current.isLoading).toBe(false);
    view.unmount();
  });

  it('does not restore a removed key from an older full refresh', async () => {
    mockStaking.fetchInvestmentBatchDetail.mockResolvedValueOnce({
      items: [investment('0')],
      errors: [],
    });
    const view = renderHook(() => useEarnPortfolio());
    await waitFor(() => expect(view.result.current.isLoading).toBe(false));
    let resolveOld = (_value: {
      items: IEarnInvestmentItemV2[];
      errors: [];
    }) => {};
    mockStaking.fetchInvestmentBatchDetail.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveOld = resolve;
      }),
    );
    let old: Promise<void> | undefined;
    act(() => {
      old = view.result.current.refresh();
    });
    await waitFor(() =>
      expect(mockStaking.fetchInvestmentBatchDetail).toHaveBeenCalledTimes(2),
    );
    mockStaking.getAvailableAssetsV2.mockResolvedValueOnce([]);
    await act(async () => {
      await view.result.current.refresh();
    });
    await act(async () => {
      resolveOld({ items: [investment('99')], errors: [] });
      await old;
    });
    expect(view.result.current.investments).toEqual([]);
    expect(view.result.current.earnTotalFiatValue.toFixed()).toBe('0');
    view.unmount();
  });

  it('does not cache a partial snapshot before the initial full refresh finishes', async () => {
    let resolveFull = (_value: {
      items: IEarnInvestmentItemV2[];
      errors: [];
    }) => {};
    mockStaking.fetchInvestmentBatchDetail.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveFull = resolve;
      }),
    );
    const view = renderHook(() => useEarnPortfolio());
    await waitFor(() =>
      expect(mockStaking.fetchInvestmentBatchDetail).toHaveBeenCalledTimes(1),
    );
    mockStaking.fetchInvestmentBatchDetail.mockResolvedValueOnce({
      items: [investment('20')],
      errors: [],
    });
    await act(async () => {
      await view.result.current.refresh({ provider: 'pendle' });
    });
    expect(mockSetCache).not.toHaveBeenCalled();
    await act(async () => {
      resolveFull({ items: [investment('10')], errors: [] });
    });
    await waitFor(() => expect(mockSetCache).toHaveBeenCalled());
    expect(mockCache.a.investments[0].totalFiatValue).toBe('20');
    view.unmount();
  });

  it('updates a cached overview after a failed full and successful partial refresh', async () => {
    const first = renderHook(() => useEarnPortfolio());
    await waitFor(() =>
      expect(mockCache.a?.investments[0]?.totalFiatValue).toBe('10'),
    );
    first.unmount();
    mockStaking.getAvailableAssetsV2.mockRejectedValueOnce(
      new Error('unavailable'),
    );
    const view = renderHook(() => useEarnPortfolio());
    await waitFor(() => expect(view.result.current.isLoading).toBe(false));
    mockStaking.fetchInvestmentBatchDetail.mockResolvedValueOnce({
      items: [investment('20')],
      errors: [],
    });
    await act(async () => {
      await view.result.current.refresh({ provider: 'pendle' });
    });
    await waitFor(() => expect(mockEarnAccounts.a?.totalFiatValue).toBe('20'), {
      timeout: 2000,
    });
    view.unmount();
  });

  it('publishes a cached partial update when an overlapping full refresh fails', async () => {
    const first = renderHook(() => useEarnPortfolio());
    await waitFor(() =>
      expect(mockCache.a?.investments[0]?.totalFiatValue).toBe('10'),
    );
    first.unmount();
    let rejectFull = (_error: Error) => {};
    mockStaking.getAvailableAssetsV2.mockReturnValueOnce(
      new Promise((_resolve, reject) => {
        rejectFull = reject;
      }),
    );
    const view = renderHook(() => useEarnPortfolio());
    await waitFor(() => expect(view.result.current.isLoading).toBe(true));
    mockStaking.fetchInvestmentBatchDetail.mockResolvedValueOnce({
      items: [investment('20')],
      errors: [],
    });
    await act(async () => {
      await view.result.current.refresh({ provider: 'pendle' });
    });
    expect(view.result.current.earnTotalFiatValue.toFixed()).toBe('20');
    await act(async () => {
      rejectFull(new Error('unavailable'));
    });
    await waitFor(() => expect(mockEarnAccounts.a?.totalFiatValue).toBe('20'), {
      timeout: 2000,
    });
    view.unmount();
  });

  it('settles an initial full refresh when an empty provider is omitted', async () => {
    mockStaking.getAvailableAssetsV2.mockResolvedValue([
      {
        type: 'normal',
        networkId: 'evm--1',
        provider: 'pendle',
        symbol: 'ETH',
        vault: 'vault',
        enableBatch: true,
      },
      {
        type: 'normal',
        networkId: 'evm--1',
        provider: 'empty',
        symbol: 'USDC',
        vault: 'empty-vault',
        enableBatch: true,
      },
    ]);
    mockStaking.fetchInvestmentBatchDetail.mockImplementation(
      async ({ provider }: { provider: string }) => ({
        items: provider === 'pendle' ? [investment('10')] : [],
        errors: [],
      }),
    );
    const view = renderHook(() => useEarnPortfolio());
    await waitFor(() => expect(view.result.current.isLoading).toBe(false));
    expect(mockCache.a?.investments[0]?.totalFiatValue).toBe('10');
    view.unmount();
  });

  it('does not accept an old A response after switching A to B and back', async () => {
    const view = renderHook(() => useEarnPortfolio());
    await waitFor(() =>
      expect(view.result.current.earnTotalFiatValue.toFixed()).toBe('10'),
    );
    let resolveOld = (_value: {
      items: IEarnInvestmentItemV2[];
      errors: [];
    }) => {};
    mockStaking.fetchInvestmentBatchDetail.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveOld = resolve;
      }),
    );
    let old: Promise<void> | undefined;
    act(() => {
      old = view.result.current.refresh();
    });
    await waitFor(() =>
      expect(mockStaking.fetchInvestmentBatchDetail).toHaveBeenCalledTimes(2),
    );
    mockAccount = { id: 'b', address: 'address-b' };
    view.rerender();
    await waitFor(() =>
      expect(view.result.current.earnTotalFiatValue.toFixed()).toBe('20'),
    );
    mockAccount = { id: 'a', address: 'address-a' };
    view.rerender();
    await waitFor(() =>
      expect(view.result.current.earnTotalFiatValue.toFixed()).toBe('10'),
    );
    await act(async () => {
      resolveOld({ items: [investment('99')], errors: [] });
      await old;
    });
    expect(view.result.current.earnTotalFiatValue.toFixed()).toBe('10');
    view.unmount();
  });

  it('rejects an old cache updater after the account returns to the same scope', async () => {
    const view = renderHook(() => useEarnPortfolio());
    await waitFor(() => expect(mockSetCache).toHaveBeenCalled());
    const oldUpdater = mockSetCache.mock.calls[0][0] as (
      previous: typeof mockCache,
    ) => typeof mockCache;
    mockAccount = { id: 'b', address: 'address-b' };
    view.rerender();
    await waitFor(() =>
      expect(view.result.current.earnTotalFiatValue.toFixed()).toBe('20'),
    );
    mockAccount = { id: 'a', address: 'address-a' };
    view.rerender();
    await waitFor(() =>
      expect(view.result.current.earnTotalFiatValue.toFixed()).toBe('10'),
    );
    expect(oldUpdater({})).toEqual({});
    view.unmount();
  });

  it('ignores a late account A batch after B has settled', async () => {
    const view = renderHook(() => useEarnPortfolio());
    await waitFor(() =>
      expect(view.result.current.earnTotalFiatValue.toFixed()).toBe('10'),
    );
    let resolveA = (_value: {
      items: IEarnInvestmentItemV2[];
      errors: [];
    }) => {};
    mockStaking.fetchInvestmentBatchDetail.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveA = resolve;
      }),
    );
    const oldRefresh = view.result.current.refresh();
    await waitFor(() =>
      expect(mockStaking.fetchInvestmentBatchDetail).toHaveBeenCalledTimes(2),
    );
    mockAccount = { id: 'b', address: 'address-b' };
    view.rerender();
    await waitFor(() =>
      expect(view.result.current.earnTotalFiatValue.toFixed()).toBe('20'),
    );
    await act(async () => {
      resolveA({ items: [investment('99')], errors: [] });
      await oldRefresh;
    });
    expect(view.result.current.earnTotalFiatValue.toFixed()).toBe('20');
    expect(mockCache.b.investments[0].totalFiatValue).toBe('20');
    view.unmount();
  });
});
