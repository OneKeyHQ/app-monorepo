/** @jest-environment jsdom */
/* eslint-disable import/first */
import type { ReactNode } from 'react';

const mockStateStore = (() => {
  let value: {
    isRefreshing: boolean;
    initialized: boolean;
    confirmedEmptyOwnerKey?: string;
    confirmedSnapshotOwnerKey?: string;
    loadedOwnerKey?: string;
    hasError?: boolean;
  } = { isRefreshing: true, initialized: false };
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    update: (next: Partial<typeof value>) => {
      value = { ...value, ...next };
      listeners.forEach((listener) => listener());
    },
    reset: () => {
      value = { isRefreshing: true, initialized: false };
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
})();
type IMockProtocol = {
  networkId: string;
  protocol: string;
  accountId: string;
  positions: [];
};
type IMockNetworkResult = {
  settlementAccountId: string;
  networkId: string;
  overviewRequestRevision: number;
};
const mockProtocolStore = (() => {
  let value: { protocols: IMockProtocol[] } = { protocols: [] };
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    update: ({
      protocols,
      merge,
    }: {
      protocols: IMockProtocol[];
      merge?: boolean;
    }) => {
      value = {
        protocols: merge ? [...value.protocols, ...protocols] : protocols,
      };
      listeners.forEach((listener) => listener());
    },
    reset: () => {
      value = { protocols: [] };
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
})();
const mockAccountStore = (() => {
  let value = {
    account: { id: 'account-1' },
    network: { id: 'onekeyall--0', isAllNetworks: true },
    wallet: { id: 'wallet-1' },
  };
  const listeners = new Set<() => void>();
  return {
    get: () => value,
    set: (network: { id: string; isAllNetworks: boolean }) => {
      value = { ...value, network };
      listeners.forEach((listener) => listener());
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
})();
const mockFocusStore = (() => {
  let focused = true;
  const listeners = new Set<() => void>();
  return {
    get: () => focused,
    set: (value: boolean) => {
      focused = value;
      listeners.forEach((listener) => listener());
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
})();
const mockAllNetworkRun = jest.fn(async () => undefined);
const mockEventHandlers = new Map<string, Set<(payload: unknown) => void>>();
const mockEmit = (name: string, payload?: unknown) => {
  mockEventHandlers.get(name)?.forEach((listener) => listener(payload));
};
let mockAllNetworkOptions: {
  onStarted: (args: {
    accountId: string;
    networkId: string;
    generation: number;
    isRunCurrent: () => boolean;
  }) => Promise<void>;
  onFinished: (args: {
    accountId: string;
    networkId: string;
    generation: number;
    runResult: {
      didComplete: boolean;
      requestCount: number;
      resultCount: number;
    };
  }) => Promise<void>;
  onResultPublished: (
    result: IMockNetworkResult[] | null,
    generation: number,
    runResult: {
      didComplete: boolean;
      requestCount: number;
      resultCount: number;
    },
  ) => void;
  clearAllNetworkData: () => void;
  allNetworkAccountsData: (args: {
    accounts: { networkId: string; accountId: string }[];
  }) => void;
};
const mockActions = {
  updateDeFiListProtocols: mockProtocolStore.update,
  updateDeFiListProtocolMap: jest.fn(),
  updateDeFiListState: mockStateStore.update,
  updateDeFiListSupportedActions: jest.fn(),
};
const mockOverviewActions = {
  updateAccountDeFiOverview: jest.fn(),
  updateOverviewDeFiDataState: jest.fn(),
};
const mockIntl = { formatMessage: ({ id }: { id: string }) => id };
jest.mock('react-intl', () => ({ useIntl: () => mockIntl }));

jest.mock('@onekeyhq/components', () => {
  const Wrapper = ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  );
  return {
    Alert: ({ title }: { title: string }) => (
      <div data-testid="partial-error">{title}</div>
    ),
    Button: Wrapper,
    Divider: Wrapper,
    SizableText: Wrapper,
    XStack: Wrapper,
    YStack: Wrapper,
    Empty: ({
      title,
      buttonProps,
    }: {
      title: string;
      buttonProps: { onPress: () => void; children: ReactNode };
    }) => (
      <div data-testid="error">
        {title}
        <button type="button" onClick={buttonProps.onPress}>
          {buttonProps.children}
        </button>
      </div>
    ),
    Skeleton: { HeadingXl: () => <div data-testid="heading-skeleton" /> },
    Toast: { error: jest.fn() },
    useMedia: () => ({}),
  };
});
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceDeFi: {
      updateCurrentAccount: jest.fn(async () => undefined),
      getAccountsLocalDeFiOverview: jest.fn(async () => []),
      getDeFiEnabledNetworksMapState: jest.fn(async () => ({
        isReady: true,
        enabledNetworksMap: {},
      })),
    },
  },
}));
jest.mock('@onekeyhq/kit/src/hooks/useAllNetwork', () => ({
  useAllNetworkRequests: (options: typeof mockAllNetworkOptions) => {
    mockAllNetworkOptions = options;
    return { run: mockAllNetworkRun, supersedeActiveRun: jest.fn() };
  },
}));
jest.mock('@onekeyhq/kit/src/utils/defiPositionUtils', () => ({
  buildProtocolDisplayInfo: () => ({ netWorth: '1' }),
}));
jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => ({
  usePromiseResult: () => ({ run: jest.fn() }),
}));
jest.mock('@onekeyhq/kit/src/hooks/useRunAfterTokensDone', () => ({
  runAfterTokensDone: ({ onRun }: { onRun: () => void }) => {
    onRun();
    return () => undefined;
  },
}));
jest.mock('@onekeyhq/kit/src/states/jotai/contexts/accountSelector', () => {
  const { useSyncExternalStore } = require('react') as typeof import('react');
  return {
    useActiveAccount: () => ({
      activeAccount: useSyncExternalStore(
        mockAccountStore.subscribe,
        mockAccountStore.get,
      ),
    }),
  };
});
jest.mock('@onekeyhq/kit/src/states/jotai/contexts/accountOverview', () => ({
  buildOverviewOwnerKey: (a: string, n: string) => `${a}__${n}`,
  useAccountOverviewActions: () => ({ current: mockOverviewActions }),
  useAccountDeFiOverviewAtom: () => [{ netWorth: 0 }],
  useOverviewDeFiDataStateAtom: () => [
    { ownerKey: 'account-1__onekeyall--0', isReady: true },
  ],
}));
jest.mock('@onekeyhq/kit/src/states/jotai/contexts/deFiList', () => {
  const { useSyncExternalStore } = require('react') as typeof import('react');
  return {
    useDeFiListActions: () => ({ current: mockActions }),
    useDeFiListStateAtom: () => [
      useSyncExternalStore(mockStateStore.subscribe, mockStateStore.get),
    ],
    useDeFiListProtocolsAtom: () => [
      useSyncExternalStore(mockProtocolStore.subscribe, mockProtocolStore.get),
    ],
    useDeFiListProtocolMapAtom: () => [{ protocolMap: {} }],
    useDeFiListSlicedAtom: () => [false, jest.fn()],
  };
});
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  useSettingsPersistAtom: () => [{ currencyInfo: { id: 'usd', symbol: '$' } }],
  useSettingsValuePersistAtom: () => [{ hideValue: false }],
  useCurrencyPersistAtom: () => [{ currencyMap: { usd: { value: '1' } } }],
}));
jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({
  EAppEventBusNames: new Proxy({}, { get: (_, name) => String(name) }),
  appEventBus: {
    on: (name: string, listener: (payload: unknown) => void) => {
      const listeners = mockEventHandlers.get(name) ?? new Set();
      listeners.add(listener);
      mockEventHandlers.set(name, listeners);
    },
    off: (name: string, listener: (payload: unknown) => void) => {
      mockEventHandlers.get(name)?.delete(listener);
    },
    emit: (name: string, payload?: unknown) => mockEmit(name, payload),
  },
}));
jest.mock('@onekeyhq/shared/src/utils/networkUtils', () => ({
  __esModule: true,
  default: {
    isAllNetwork: ({ networkId }: { networkId: string }) =>
      networkId === 'onekeyall--0',
  },
}));
jest.mock('../../hooks/useHomeTab', () => {
  const { useSyncExternalStore } = require('react') as typeof import('react');
  return {
    useTabIsRefreshingFocused: () => ({
      isFocused: useSyncExternalStore(
        mockFocusStore.subscribe,
        mockFocusStore.get,
      ),
      isHeaderRefreshing: false,
      setIsHeaderRefreshing: jest.fn(),
    }),
  };
});
jest.mock('@onekeyhq/kit/src/components/Empty', () => ({
  EmptyDeFi: () => <div data-testid="empty-defi" />,
}));
jest.mock('../RichBlock/RichBlock', () => ({
  RichBlock: ({ content }: { content: ReactNode }) => <div>{content}</div>,
}));
jest.mock('./DeFiListSkeleton', () => ({
  DeFiListSkeleton: () => <div data-testid="defi-skeleton" />,
}));
jest.mock('./Protocol', () => ({ Protocol: () => null }));
jest.mock('./useIsDeFiEnabled', () => ({ useIsDeFiEnabled: () => true }));

import { act, fireEvent, render, screen } from '@testing-library/react';

import { DeFiListBlock } from './DeFiListBlock';

const owner = { accountId: 'account-1', networkId: 'onekeyall--0' };
const success = { didComplete: true, requestCount: 0, resultCount: 0 };
const failure = { didComplete: false, requestCount: 0, resultCount: 0 };

async function start() {
  await act(async () =>
    mockAllNetworkOptions.onStarted({
      ...owner,
      generation: 1,
      isRunCurrent: () => true,
    }),
  );
}
async function finish(runResult: typeof success) {
  await act(async () =>
    mockAllNetworkOptions.onFinished({ ...owner, generation: 1, runResult }),
  );
  if (runResult.didComplete)
    act(() => mockAllNetworkOptions.onResultPublished(null, 1, runResult));
}

describe('DeFi empty refresh', () => {
  beforeEach(() => {
    mockStateStore.reset();
    mockProtocolStore.reset();
    mockAccountStore.set({ id: 'onekeyall--0', isAllNetworks: true });
    mockFocusStore.set(true);
    mockAllNetworkRun.mockClear();
  });
  it('keeps confirmed empty visible while the focused tab revalidates', async () => {
    render(<DeFiListBlock isDeFiEnabled />);
    await start();
    await finish(success);
    expect(screen.getByTestId('empty-defi')).toBeTruthy();
    act(() => mockFocusStore.set(false));
    act(() => mockFocusStore.set(true));
    expect(mockAllNetworkRun).toHaveBeenCalledWith({ alwaysSetState: true });
    await start();
    expect(screen.getByTestId('empty-defi')).toBeTruthy();
    expect(screen.queryByTestId('defi-skeleton')).toBeNull();
    await finish(success);
    expect(screen.getByTestId('empty-defi')).toBeTruthy();
  });
  it('keeps a successfully discovered zero-account empty result on a cold rerun', async () => {
    render(<DeFiListBlock isDeFiEnabled />);
    await start();
    await finish(success);
    expect(screen.getByTestId('empty-defi')).toBeTruthy();
    act(() => mockFocusStore.set(false));
    act(() => mockFocusStore.set(true));
    act(() => mockAllNetworkOptions.clearAllNetworkData());
    await start();
    expect(screen.getByTestId('empty-defi')).toBeTruthy();
    expect(screen.queryByTestId('defi-skeleton')).toBeNull();
  });

  it('warns when partial positions exist but no full snapshot has succeeded', async () => {
    render(<DeFiListBlock isDeFiEnabled />);
    await start();
    act(() =>
      mockProtocolStore.update({
        protocols: [
          {
            accountId: 'account-1',
            networkId: 'evm--1',
            protocol: 'test',
            positions: [],
          },
        ],
      }),
    );
    await finish({ didComplete: true, requestCount: 2, resultCount: 1 });
    expect(screen.getByTestId('partial-error')).toBeTruthy();
    expect(screen.queryByTestId('empty-defi')).toBeNull();
  });

  it('accepts a single-network successful empty transaction refresh', () => {
    mockAccountStore.set({ id: 'evm--1', isAllNetworks: false });
    render(<DeFiListBlock isDeFiEnabled />);
    act(() =>
      mockEmit('DeFiPositionRefreshed', {
        accountId: 'account-1',
        networkId: 'evm--1',
        protocols: [],
        protocolMap: {},
        overviewRequestRevision: 1,
        overview: { totalValue: 0, totalDebt: 0, totalReward: 0, netWorth: 0 },
      }),
    );
    expect(screen.getByTestId('empty-defi')).toBeTruthy();
  });

  it('revalidates all networks when a transaction removes the last position', async () => {
    render(<DeFiListBlock isDeFiEnabled />);
    await start();
    act(() =>
      mockAllNetworkOptions.allNetworkAccountsData({
        accounts: [{ networkId: 'evm--1', accountId: 'account-1' }],
      }),
    );
    act(() =>
      mockProtocolStore.update({
        protocols: [
          {
            accountId: 'account-1',
            networkId: 'evm--1',
            protocol: 'test',
            positions: [],
          },
        ],
      }),
    );
    mockAllNetworkRun.mockClear();
    act(() =>
      mockEmit('DeFiPositionRefreshed', {
        accountId: 'account-1',
        networkId: 'evm--1',
        protocols: [],
        protocolMap: {},
        overviewRequestRevision: 1,
        overview: { totalValue: 0, totalDebt: 0, totalReward: 0, netWorth: 0 },
      }),
    );
    expect(mockAllNetworkRun).toHaveBeenCalledWith({ alwaysSetState: true });
    expect(screen.queryByTestId('empty-defi')).toBeNull();
  });
  it('shows an error for the first failure and recovers on a successful retry', async () => {
    render(<DeFiListBlock isDeFiEnabled />);
    await start();
    await finish(failure);
    expect(screen.getByTestId('error')).toBeTruthy();
    expect(screen.queryByTestId('empty-defi')).toBeNull();
    fireEvent.click(screen.getByRole('button'));
    expect(mockAllNetworkRun).toHaveBeenCalled();
    await start();
    await finish(success);
    expect(screen.getByTestId('empty-defi')).toBeTruthy();
    expect(screen.queryByTestId('error')).toBeNull();
  });

  it('retains a confirmed empty result when background refresh fails', async () => {
    render(<DeFiListBlock isDeFiEnabled />);
    await start();
    await finish(success);
    await start();
    await finish(failure);
    expect(screen.getByTestId('empty-defi')).toBeTruthy();
    expect(mockStateStore.get().hasError).toBe(true);
    expect(screen.queryByTestId('defi-skeleton')).toBeNull();
  });

  it('ignores an old generation after a wallet gains a new network account', async () => {
    render(<DeFiListBlock isDeFiEnabled />);
    await start();
    await finish(success);
    expect(screen.getByTestId('empty-defi')).toBeTruthy();
    await start();
    act(() =>
      mockEmit('AddDBAccountsToWallet', {
        walletId: 'another-wallet',
        accounts: [],
      }),
    );
    expect(screen.getByTestId('empty-defi')).toBeTruthy();
    act(() =>
      mockEmit('AddDBAccountsToWallet', { walletId: 'wallet-1', accounts: [] }),
    );
    expect(screen.queryByTestId('empty-defi')).toBeNull();
    await finish(success);
    expect(screen.queryByTestId('empty-defi')).toBeNull();
  });

  it('does not apply a published empty result when account scope changes in the same batch', async () => {
    render(<DeFiListBlock isDeFiEnabled />);
    await start();
    await finish(success);
    expect(screen.getByTestId('empty-defi')).toBeTruthy();
    await start();
    act(() => {
      mockAllNetworkOptions.onResultPublished(null, 1, success);
      mockEmit('AddDBAccountsToWallet', { walletId: 'wallet-1', accounts: [] });
    });
    expect(screen.queryByTestId('empty-defi')).toBeNull();
    expect(mockStateStore.get().confirmedEmptyOwnerKey).toBeUndefined();
  });

  it('revalidates the complete scope when a transaction supersedes a published network result', async () => {
    render(<DeFiListBlock isDeFiEnabled />);
    await start();
    act(() =>
      mockAllNetworkOptions.allNetworkAccountsData({
        accounts: [
          { networkId: 'evm--1', accountId: 'account-1' },
          { networkId: 'evm--56', accountId: 'account-1' },
        ],
      }),
    );
    const overview = {
      totalValue: 0,
      totalDebt: 0,
      totalReward: 0,
      netWorth: 0,
    };
    for (const [networkId, overviewRequestRevision] of [
      ['evm--1', 2],
      ['evm--56', 1],
    ] as const) {
      act(() =>
        mockEmit('DeFiPositionRefreshed', {
          accountId: 'account-1',
          networkId,
          overviewRequestRevision,
          overview,
          protocols: [
            {
              accountId: 'account-1',
              networkId,
              protocol: 'test',
              positions: [],
            },
          ],
          protocolMap: {},
        }),
      );
    }
    mockAllNetworkRun.mockClear();
    act(() =>
      mockAllNetworkOptions.onResultPublished(
        [
          {
            settlementAccountId: 'account-1',
            networkId: 'evm--1',
            overviewRequestRevision: 1,
          },
          {
            settlementAccountId: 'account-1',
            networkId: 'evm--56',
            overviewRequestRevision: 1,
          },
        ],
        1,
        { didComplete: true, requestCount: 2, resultCount: 2 },
      ),
    );
    expect(mockAllNetworkRun).toHaveBeenCalledWith({ alwaysSetState: true });
    expect(
      mockProtocolStore
        .get()
        .protocols.map((item) => item.networkId)
        .toSorted(),
    ).toEqual(['evm--1', 'evm--56']);
  });

  it('invalidates a zero-account snapshot when a transaction references an unknown network', async () => {
    render(<DeFiListBlock isDeFiEnabled />);
    await start();
    await finish(success);
    expect(screen.getByTestId('empty-defi')).toBeTruthy();
    mockAllNetworkRun.mockClear();
    act(() =>
      mockEmit('DeFiPositionRefreshed', {
        accountId: 'account-1',
        networkId: 'evm--1',
        overviewRequestRevision: 1,
        protocols: [],
        protocolMap: {},
        overview: { totalValue: 0, totalDebt: 0, totalReward: 0, netWorth: 0 },
      }),
    );
    expect(mockAllNetworkRun).toHaveBeenCalledWith({
      alwaysSetState: true,
      skipAccountsCache: true,
    });
    expect(screen.queryByTestId('empty-defi')).toBeNull();
    act(() => mockAllNetworkOptions.onResultPublished(null, 1, success));
    expect(screen.queryByTestId('empty-defi')).toBeNull();
  });
});
