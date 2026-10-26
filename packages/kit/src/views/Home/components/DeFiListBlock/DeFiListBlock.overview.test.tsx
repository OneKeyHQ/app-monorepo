/** @jest-environment jsdom */
import { act, render } from '@testing-library/react';

import type backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { useAllNetworkRequests } from '@onekeyhq/kit/src/hooks/useAllNetwork';
import type { IAllNetworkAccountInfo } from '@onekeyhq/kit-bg/src/services/ServiceAllNetwork/ServiceAllNetwork';

const mockNoop = jest.fn();
const mockAsyncNoop = jest.fn(async () => undefined);
const mockUpdateOverview = jest.fn();
const mockUpdateReadiness = jest.fn();
const mockFetch = jest.fn<
  ReturnType<typeof backgroundApiProxy.serviceDeFi.fetchAccountDeFiPositions>,
  unknown[]
>();
const mockFetchBatch = jest.fn<
  ReturnType<
    typeof backgroundApiProxy.serviceDeFi.fetchAccountDeFiPositionsBatch
  >,
  unknown[]
>();
const mockCurrencyMap = { usd: { value: '1' } };
const mockSettings = { currencyInfo: { id: 'usd', symbol: '$' } };
const mockAccount = {
  id: 'hw-1',
  indexedAccountId: 'hw-indexed-1',
  address: '0x1',
};
let mockNetwork = { id: 'evm--1', isAllNetworks: false };
let mockAllNetworksOptions: Parameters<typeof useAllNetworkRequests>[0];
let mockResult: unknown;
const mockRunners: Array<() => Promise<unknown>> = [];
const mockDeFiActions = {
  updateDeFiListProtocols: mockNoop,
  updateDeFiListProtocolMap: mockNoop,
  updateDeFiListState: mockNoop,
  updateDeFiListSupportedActions: mockNoop,
};
const mockOverviewActions = {
  updateAccountDeFiOverview: mockUpdateOverview,
  updateOverviewDeFiDataState: mockUpdateReadiness,
};

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: mockNoop }),
}));
jest.mock('@onekeyhq/components', () => ({ useMedia: () => ({}) }));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceDeFi: {
      updateCurrentAccount: mockAsyncNoop,
      abortFetchAccountDeFiPositions: mockAsyncNoop,
      getDeFiEnabledNetworksMap: async () => ({ 'evm--1': true }),
      fetchAccountDeFiPositions: (...args: unknown[]) => mockFetch(...args),
      fetchAccountDeFiPositionsBatch: (...args: unknown[]) =>
        mockFetchBatch(...args),
    },
  },
}));
jest.mock('@onekeyhq/kit/src/components/Empty', () => ({}));
jest.mock('@onekeyhq/kit/src/utils/defiPositionUtils', () => ({}));
jest.mock('../RichBlock/RichBlock', () => ({}));
jest.mock('./Protocol', () => ({}));
jest.mock('./DeFiListSkeleton', () => ({}));
jest.mock('./useIsDeFiEnabled', () => ({ useIsDeFiEnabled: () => true }));
jest.mock('../../hooks/useHomeTab', () => ({
  useTabIsRefreshingFocused: () => ({
    isFocused: true,
    isHeaderRefreshing: false,
    setIsHeaderRefreshing: mockNoop,
  }),
}));
jest.mock('@onekeyhq/kit/src/hooks/useRunAfterTokensDone', () => ({
  runAfterTokensDone: ({ onRun }: { onRun: () => void }) => {
    onRun();
    return () => undefined;
  },
}));
jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => ({
  usePromiseResult: (callback: () => Promise<unknown>) => {
    mockRunners.push(callback);
    return { run: mockAsyncNoop };
  },
}));
jest.mock('@onekeyhq/kit/src/hooks/useAllNetwork', () => ({
  useAllNetworkRequests: (options: typeof mockAllNetworksOptions) => {
    mockAllNetworksOptions = options;
    return { run: mockAsyncNoop, result: mockResult, isEmptyAccount: false };
  },
}));
jest.mock('@onekeyhq/kit/src/states/jotai/contexts/accountSelector', () => ({
  useActiveAccount: () => ({
    activeAccount: { account: mockAccount, network: mockNetwork },
  }),
}));
jest.mock('@onekeyhq/kit/src/states/jotai/contexts/accountOverview', () => ({
  buildOverviewOwnerKey: (accountId: string, networkId: string) =>
    `${accountId}__${networkId}`,
  useAccountOverviewActions: () => ({ current: mockOverviewActions }),
  useAccountDeFiOverviewAtom: () => [
    { accountId: mockAccount.id, networkId: mockNetwork.id, netWorth: 40 },
  ],
  useOverviewDeFiDataStateAtom: () => [
    { ownerKey: `${mockAccount.id}__${mockNetwork.id}`, isReady: true },
  ],
}));
jest.mock('@onekeyhq/kit/src/states/jotai/contexts/deFiList', () => ({
  useDeFiListActions: () => ({ current: mockDeFiActions }),
  useDeFiListStateAtom: () => [{ isRefreshing: false, initialized: true }],
  useDeFiListProtocolsAtom: () => [{ protocols: [] }],
  useDeFiListProtocolMapAtom: () => [{ protocolMap: {} }],
  useDeFiListSlicedAtom: () => [true, mockNoop],
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  useSettingsPersistAtom: () => [mockSettings],
  useCurrencyPersistAtom: () => [{ currencyMap: mockCurrencyMap }],
  useSettingsValuePersistAtom: () => [{}],
}));

const { DeFiListBlock } =
  jest.requireActual<typeof import('./DeFiListBlock')>('./DeFiListBlock');
const response = (netWorth: number) => ({
  overview: {
    totalValue: netWorth,
    totalDebt: 0,
    totalReward: 0,
    netWorth,
    chains: [],
    protocolCount: 0,
    positionCount: 0,
  },
  protocols: [],
  protocolMap: {},
  isSameAllNetworksAccountData: true,
});

describe('Home DeFi overview refresh without opening the DeFi tab', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRunners.length = 0;
    mockNetwork = { id: 'evm--1', isAllNetworks: false };
    mockResult = undefined;
    mockFetch.mockResolvedValue(response(50));
  });

  it('fetches the single-network overview while rendering no DeFi list', async () => {
    const { container } = render(<DeFiListBlock refreshOverviewOnly />);
    expect(container.innerHTML).toBe('');
    await act(async () => {
      await mockRunners[1]();
    });
    expect(mockFetch).toHaveBeenCalledWith(
      expect.objectContaining({ networkId: 'evm--1', saveToLocal: true }),
    );
    expect(mockUpdateOverview).toHaveBeenCalledWith(
      expect.objectContaining({
        overview: expect.objectContaining({ netWorth: 50 }),
        isReady: true,
      }),
    );
  });

  it('keeps the previous overview when the single-network request fails', async () => {
    render(<DeFiListBlock refreshOverviewOnly />);
    mockUpdateOverview.mockClear();
    mockUpdateReadiness.mockClear();
    mockFetch.mockRejectedValue(new Error('offline'));
    const consoleError = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    try {
      await act(async () => {
        await mockRunners[1]();
      });
      expect(mockUpdateOverview).not.toHaveBeenCalled();
      expect(mockUpdateReadiness).toHaveBeenLastCalledWith(
        expect.objectContaining({ isReady: undefined }),
      );
    } finally {
      consoleError.mockRestore();
    }
  });

  it('distinguishes an empty account from a failed account lookup', async () => {
    mockNetwork = { id: 'onekeyall--0', isAllNetworks: true };
    render(<DeFiListBlock refreshOverviewOnly />);
    await act(async () => {
      await mockAllNetworksOptions.onStarted?.({
        accountId: mockAccount.id,
        networkId: mockNetwork.id,
      });
      await mockAllNetworksOptions.onFinished?.({
        accountId: mockAccount.id,
        networkId: mockNetwork.id,
      });
    });
    expect(mockUpdateReadiness).toHaveBeenLastCalledWith(
      expect.objectContaining({ isReady: undefined }),
    );
    mockAllNetworksOptions.allNetworkAccountsData?.({
      accounts: [],
      allAccounts: [],
    });
    await act(async () => {
      await mockAllNetworksOptions.onFinished?.({
        accountId: mockAccount.id,
        networkId: mockNetwork.id,
      });
    });
    expect(mockUpdateReadiness).toHaveBeenLastCalledWith(
      expect.objectContaining({ isReady: true }),
    );
  });

  it('publishes only a complete all-network overview, keeping partial results out of the header', async () => {
    mockNetwork = { id: 'onekeyall--0', isAllNetworks: true };
    const { rerender } = render(<DeFiListBlock refreshOverviewOnly />);
    await act(async () => {
      await mockAllNetworksOptions.onStarted?.({
        accountId: mockAccount.id,
        networkId: mockNetwork.id,
      });
    });
    mockAllNetworksOptions.allNetworkAccountsData?.({
      accounts: [{}, {}] as IAllNetworkAccountInfo[],
      allAccounts: [],
    });
    mockUpdateOverview.mockClear();
    await act(async () => {
      await mockAllNetworksOptions.allNetworkRequests({
        accountId: mockAccount.id,
        networkId: 'evm--1',
        allNetworkDataInit: true,
      });
    });
    expect(mockUpdateOverview).not.toHaveBeenCalled();
    mockResult = [response(50)];
    rerender(<DeFiListBlock refreshOverviewOnly />);
    expect(mockUpdateOverview).not.toHaveBeenCalled();
    mockResult = [response(50), response(20)];
    rerender(<DeFiListBlock refreshOverviewOnly />);
    expect(mockUpdateOverview).toHaveBeenCalledWith(
      expect.objectContaining({
        overview: expect.objectContaining({ netWorth: 70 }),
        isReady: true,
      }),
    );
  });
});
