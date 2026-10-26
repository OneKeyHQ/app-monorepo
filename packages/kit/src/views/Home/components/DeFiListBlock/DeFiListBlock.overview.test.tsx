/** @jest-environment jsdom */
import { act, render } from '@testing-library/react';

import type backgroundApiProxy from '@onekeyhq/kit/src/background/instance/backgroundApiProxy';
import type { useAllNetworkRequests } from '@onekeyhq/kit/src/hooks/useAllNetwork';
import {
  EAppEventBusNames,
  appEventBus,
} from '@onekeyhq/shared/src/eventBus/appEventBus';

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
      getAccountsLocalDeFiOverview: async () => [
        {
          overview: {
            'evm--1': {
              totalValue: 40,
              totalDebt: 0,
              totalReward: 0,
              netWorth: 40,
              currency: 'usd',
            },
          },
        },
      ],
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
describe('Home DeFi overview uses cache without starting live requests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRunners.length = 0;
    mockNetwork = { id: 'evm--1', isAllNetworks: false };
    mockResult = undefined;
  });

  it('hydrates the single-network overview from cache without fetching positions', async () => {
    const { container } = render(<DeFiListBlock refreshCacheOnly />);
    await act(async () => {
      await mockRunners[1]();
    });
    expect(container.innerHTML).toBe('');
    expect(mockUpdateOverview).toHaveBeenCalledWith(
      expect.objectContaining({
        overview: expect.objectContaining({ netWorth: 40 }),
        isReady: true,
      }),
    );
    expect(mockFetch).not.toHaveBeenCalled();
    expect(mockFetchBatch).not.toHaveBeenCalled();
  });

  it('does not turn Home refresh events into additional live DeFi requests', async () => {
    render(<DeFiListBlock refreshCacheOnly />);
    await act(async () => {
      appEventBus.emit(EAppEventBusNames.AccountDataUpdate, {
        isManualRefresh: true,
        refreshSource: 'home-header',
      });
      await mockRunners[1]();
    });
    expect(mockFetch).not.toHaveBeenCalled();
    expect(mockFetchBatch).not.toHaveBeenCalled();
  });

  it('keeps all-network request callbacks cache-only as well', async () => {
    mockNetwork = { id: 'onekeyall--0', isAllNetworks: true };
    render(<DeFiListBlock refreshCacheOnly />);
    await act(async () => {
      await mockAllNetworksOptions.allNetworkRequests({
        accountId: mockAccount.id,
        networkId: 'evm--1',
      });
      await mockAllNetworksOptions.allNetworkRequestsBatch?.({
        batch: {
          accountId: mockAccount.id,
          apiAddress: mockAccount.address,
          accountXpub: undefined,
          items: [],
        },
      });
    });
    expect(mockFetch).not.toHaveBeenCalled();
    expect(mockFetchBatch).not.toHaveBeenCalled();
  });
});
