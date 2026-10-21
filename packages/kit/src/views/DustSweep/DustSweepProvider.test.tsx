/** @jest-environment jsdom */

import { useState } from 'react';
import type { PropsWithChildren } from 'react';

import { act, renderHook, waitFor } from '@testing-library/react';

import type {
  IDustSweepItem,
  IDustSweepNetwork,
  IDustSweepRouteParams,
  IDustSweepSnapshot,
  IDustSweepThreshold,
  IDustSweepToken,
} from '@onekeyhq/shared/types/swap/dustSweep';
import type { ISwapProviderInfo } from '@onekeyhq/shared/types/swap/SwapProvider.constants';
import { EProtocolOfExchange } from '@onekeyhq/shared/types/swap/types';

import { DustSweepProvider, useDustSweep } from './DustSweepProvider';
import {
  getDustSweepNetworkOwner,
  useDustSweepReconciliation,
} from './hooks/useDustSweepReconciliation';
import { useDustSweepSession } from './hooks/useDustSweepSession';
import { dustSweepReducer, initialDustSweepState } from './stateMachine';
import {
  loadDustSweepNetworks,
  refreshDustSweepNetwork,
} from './utils/loadNetworks';

import type { IDustSweepState } from './stateMachine';

function useMockPreferences() {
  return useState<{ threshold: IDustSweepThreshold }>({
    threshold: 10,
  });
}

let mockFocused = true;
jest.mock('@onekeyhq/kit/src/hooks/useRouteIsFocused', () => ({
  useRouteIsFocused: () => mockFocused,
}));

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  useDustSweepPreferencesPersistAtom: () => useMockPreferences(),
}));
jest.mock('@onekeyhq/shared/src/errors', () => ({
  OneKeyLocalError: Error,
}));
jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    dex: {
      dustSweep: {
        dustSweepPageVisited: jest.fn(),
        dustSweepAddHidden: jest.fn(),
      },
    },
  },
}));
jest.mock('./utils/loadNetworks', () => ({
  loadDustSweepNetworks: jest.fn(),
  refreshDustSweepNetwork: jest.fn(),
}));
jest.mock('./hooks/useDustSweepSession', () => ({
  useDustSweepSession: jest.fn(),
}));

const mockLoadNetworks = jest.mocked(loadDustSweepNetworks);
const mockRefreshNetwork = jest.mocked(refreshDustSweepNetwork);
let mockComplete: (items?: Partial<IDustSweepItem>[]) => void;
let mockBatchSequence = 0;
const mockUseSession = jest.mocked(useDustSweepSession);

function useMockSession(): ReturnType<typeof useDustSweepSession> {
  const [state, setState] = useState<IDustSweepState>(initialDustSweepState);
  mockComplete = (items) =>
    setState((value) => ({
      ...value,
      phase: 'completed',
      items: value.items.map((item, index) => ({
        ...item,
        status: 'success',
        txId: `tx-${index}`,
        receivedAmount: '0.01',
        ...items?.[index],
      })),
    }));
  return {
    state,
    start: (snapshot) => {
      mockBatchSequence += 1;
      setState((value) =>
        dustSweepReducer(value, {
          type: 'start',
          snapshot: {
            ...snapshot,
            id: `${snapshot.id}:${mockBatchSequence}`,
          },
        }),
      );
      return snapshot.id;
    },
    pause: () => setState((value) => ({ ...value, phase: 'paused' })),
    resume: () => setState((value) => ({ ...value, phase: 'running' })),
    reset: () => setState(initialDustSweepState),
    stop: async (onStopped) => {
      onStopped?.(state);
      setState((value) => dustSweepReducer(value, { type: 'stop' }));
      return true;
    },
    stopping: false,
    leave: async () => true,
    leaving: false,
  };
}

function network(
  networkId: string,
  values: string[],
  suspiciousIndexes: number[] = [],
): IDustSweepNetwork {
  const tokens: IDustSweepToken[] = values.map((valueUsd, index) => ({
    key: `${networkId}:${index}`,
    networkId,
    contractAddress: `0x${index}`,
    symbol: `TOKEN${index}`,
    decimals: 18,
    amount: '1',
    valueUsd,
    suspicious: suspiciousIndexes.includes(index),
  }));
  return {
    network: { networkId, name: networkId, symbol: 'ETH' },
    accountId: `account:${networkId}`,
    address: `address:${networkId}`,
    nativeToken: {
      networkId,
      contractAddress: '',
      isNative: true,
      symbol: 'ETH',
      decimals: 18,
    },
    tokens,
    balanceUsd: values
      .reduce((sum, value) => sum + Number(value), 0)
      .toString(),
  };
}

const ethereum = network('evm--1', ['8']);
const ethereumWithHidden = network('evm--1', ['8', '0.05']);
const ethereumWithRiskAndHidden = network(
  'evm--1',
  ['8', '0.5', '0.05', '0.01'],
  [1, 2],
);
const base = network('evm--8453', ['2', '50']);
const routeParams: IDustSweepRouteParams = {
  walletId: 'hd-test',
  accountId: 'hd-test--0',
  indexedAccountId: 'hd-test--0',
  entry: 'lowValueRow',
};
const providerInfo: ISwapProviderInfo = {
  provider: 'SwapOKX',
  protocol: EProtocolOfExchange.SWAP,
  providerName: 'OKX from provider list',
  logo: 'https://example.com/provider-from-list.png',
};

function renderController(params = routeParams) {
  function Wrapper({ children }: PropsWithChildren) {
    return <DustSweepProvider params={params}>{children}</DustSweepProvider>;
  }
  return renderHook(() => useDustSweep(), { wrapper: Wrapper });
}

function deferredLoad() {
  let resolve!: (
    value: Awaited<ReturnType<typeof loadDustSweepNetworks>>,
  ) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<
    Awaited<ReturnType<typeof loadDustSweepNetworks>>
  >((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

describe('Dust Sweep Provider request and selection ownership', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLoadNetworks.mockReset();
    mockRefreshNetwork.mockReset();
    mockFocused = true;
    mockBatchSequence = 0;
    mockRefreshNetwork.mockImplementation(async ({ entry }) => entry);
    mockUseSession.mockImplementation(useMockSession);
    mockLoadNetworks.mockResolvedValue({
      networks: [base, ethereum],
      partialError: false,
    });
  });

  it.each([
    { description: 'partial', cached: [ethereum] },
    { description: 'fully populated', cached: [ethereum, base] },
  ])(
    'displays a $description cache without making it executable',
    async ({ cached }) => {
      const fresh = deferredLoad();
      mockLoadNetworks.mockReturnValueOnce(fresh.promise);
      const { result } = renderController();
      const onCache = mockLoadNetworks.mock.calls[0][2];

      act(() => onCache?.(cached));

      expect(result.current.loadStatus).toBe('ready');
      expect(result.current.refreshStatus).toBe('refreshing');
      expect(result.current.current).toBe(ethereum);
      expect(result.current.visible).toEqual(ethereum.tokens);
      expect(result.current.assetStatus).toBe('refreshing');
      expect(result.current.providerInfo).toBeUndefined();
      expect(result.current.canStart).toBe(false);
      act(() => {
        result.current.start();
        result.current.retryAssets();
      });
      expect(result.current.session.state.snapshot).toBeUndefined();
      expect(mockRefreshNetwork).not.toHaveBeenCalled();
      expect(mockLoadNetworks).toHaveBeenCalledTimes(1);

      await act(async () => {
        fresh.resolve({ networks: cached, partialError: false, providerInfo });
        await fresh.promise;
      });

      expect(result.current.refreshStatus).toBe('idle');
      expect(result.current.assetStatus).toBe('ready');
      expect(result.current.canStart).toBe(true);
      expect(result.current.providerInfo).toEqual(providerInfo);
    },
  );

  it('keeps an empty cache loading until the live empty result settles', async () => {
    const fresh = deferredLoad();
    mockLoadNetworks.mockReturnValueOnce(fresh.promise);
    const { result } = renderController();

    act(() => mockLoadNetworks.mock.calls[0][2]?.([]));

    expect(result.current.loadStatus).toBe('loading');
    expect(result.current.refreshStatus).toBe('refreshing');
    expect(result.current.current).toBeUndefined();
    expect(result.current.canStart).toBe(false);
    await act(async () => {
      fresh.resolve({ networks: [], partialError: false, providerInfo });
      await fresh.promise;
    });
    expect(result.current.loadStatus).toBe('ready');
    expect(result.current.refreshStatus).toBe('idle');
    expect(result.current.assetStatus).toBe('ready');
    expect(result.current.current).toBeUndefined();
    expect(result.current.canStart).toBe(false);
  });

  it('settles a live account with no picker-eligible assets without an asset error', async () => {
    mockLoadNetworks.mockResolvedValueOnce({
      networks: [network('evm--1', ['100', '200'])],
      partialError: false,
      providerInfo,
    });
    const { result } = renderController();
    await waitFor(() => expect(result.current.refreshStatus).toBe('idle'));

    expect(result.current.loadStatus).toBe('ready');
    expect(result.current.assetStatus).toBe('ready');
    expect(result.current.current).toBeUndefined();
    expect(result.current.partialError).toBe(false);
    expect(result.current.canStart).toBe(false);
  });

  it('blocks a start in the same event that claims a full refresh', async () => {
    const { result } = renderController();
    await waitFor(() => expect(result.current.canStart).toBe(true));
    const fresh = deferredLoad();
    mockLoadNetworks.mockReturnValueOnce(fresh.promise);

    act(() => {
      result.current.retry();
      result.current.start();
    });

    expect(result.current.selecting).toBe(true);
    expect(result.current.session.state.snapshot).toBeUndefined();
    expect(result.current.loadStatus).toBe('ready');
    expect(result.current.refreshStatus).toBe('refreshing');
    expect(result.current.canStart).toBe(false);
    expect(mockLoadNetworks).toHaveBeenCalledTimes(2);
    await act(async () => {
      fresh.resolve({
        networks: [ethereum],
        partialError: false,
        providerInfo,
      });
      await fresh.promise;
    });
    expect(result.current.canStart).toBe(true);
  });

  it('ignores a cache that arrives after live data, including during execution', async () => {
    const fresh = deferredLoad();
    mockLoadNetworks.mockReturnValueOnce(fresh.promise);
    const { result } = renderController();
    const onCache = mockLoadNetworks.mock.calls[0][2];
    await act(async () => {
      fresh.resolve({
        networks: [ethereum],
        partialError: false,
        providerInfo,
      });
      await fresh.promise;
    });

    act(() => onCache?.([base]));
    expect(result.current.current).toBe(ethereum);
    expect(result.current.selected).toEqual(ethereum.tokens);
    expect(result.current.canStart).toBe(true);
    act(() => {
      result.current.start();
    });
    const snapshot = result.current.session.state.snapshot;
    expect(result.current.session.state.phase).toBe('running');

    act(() => onCache?.([base]));
    expect(result.current.current).toBe(ethereum);
    expect(result.current.session.state.snapshot).toBe(snapshot);
    expect(result.current.session.state.items[0].token).toBe(
      ethereum.tokens[0],
    );
    act(() => result.current.session.pause());
    act(() => onCache?.([base]));
    expect(result.current.session.state.phase).toBe('paused');
    expect(result.current.session.state.snapshot).toBe(snapshot);
    expect(result.current.current).toBe(ethereum);
  });

  it('retains cached choices on failure and retry, then uses fresh amounts without selecting new tokens', async () => {
    const cached = network('evm--1', ['8', '2']);
    const fresh = deferredLoad();
    const retried = deferredLoad();
    mockLoadNetworks
      .mockReturnValueOnce(fresh.promise)
      .mockReturnValueOnce(retried.promise);
    const { result } = renderController();
    act(() => mockLoadNetworks.mock.calls[0][2]?.([cached]));
    act(() => {
      result.current.toggle(cached.tokens[1].key);
      result.current.setSlippage(2);
    });
    expect(result.current.selected).toEqual([cached.tokens[0]]);
    await act(async () => {
      fresh.reject(new Error('Balances unavailable'));
      await fresh.promise.catch(() => undefined);
    });

    expect(result.current.loadStatus).toBe('ready');
    expect(result.current.refreshStatus).toBe('error');
    expect(result.current.partialError).toBe(true);
    expect(result.current.current).toBe(cached);
    expect(result.current.selected).toEqual([cached.tokens[0]]);
    expect(result.current.canStart).toBe(false);
    act(() => result.current.retryAssets());
    expect(mockLoadNetworks).toHaveBeenCalledTimes(2);
    expect(mockRefreshNetwork).not.toHaveBeenCalled();
    expect(result.current.loadStatus).toBe('ready');
    expect(result.current.refreshStatus).toBe('refreshing');
    expect(result.current.current).toBe(cached);
    expect(result.current.selected).toEqual([cached.tokens[0]]);
    act(() => mockLoadNetworks.mock.calls[1][2]?.([ethereum]));
    expect(result.current.current).toBe(cached);

    const added = network('evm--1', ['4', '3', '2']);
    const updated = {
      ...cached,
      tokens: [{ ...added.tokens[0], amount: '0.5' }, added.tokens[2]],
      balanceUsd: '6',
    };
    await act(async () => {
      retried.resolve({
        networks: [updated],
        partialError: false,
        providerInfo,
      });
      await retried.promise;
    });

    expect(result.current.current).toBe(updated);
    expect(result.current.selected).toEqual([updated.tokens[0]]);
    expect(result.current.slippage).toBe(2);
    expect(result.current.canStart).toBe(true);
    act(() => {
      result.current.start();
    });
    expect(result.current.session.state.snapshot?.tokens).toEqual([
      updated.tokens[0],
    ]);
    expect(result.current.session.state.snapshot?.tokens[0].amount).toBe('0.5');
  });

  it.each(['resolve', 'reject'] as const)(
    'rejects stale cache and live data that later %ss through an A → B → A scope change',
    async (outcome) => {
      const first = deferredLoad();
      const second = deferredLoad();
      const third = deferredLoad();
      mockLoadNetworks
        .mockReturnValueOnce(first.promise)
        .mockReturnValueOnce(second.promise)
        .mockReturnValueOnce(third.promise);
      let changeScope!: (params: IDustSweepRouteParams) => void;
      function Wrapper({ children }: PropsWithChildren) {
        const [params, setParams] = useState(routeParams);
        changeScope = setParams;
        return (
          <DustSweepProvider params={params}>{children}</DustSweepProvider>
        );
      }
      const { result } = renderHook(() => useDustSweep(), { wrapper: Wrapper });
      const firstCache = mockLoadNetworks.mock.calls[0][2];
      act(() => firstCache?.([ethereum]));
      act(() => changeScope({ ...routeParams, accountId: 'account-b' }));
      expect(mockLoadNetworks.mock.calls[0][1].aborted).toBe(true);
      expect(result.current.current).toBeUndefined();
      expect(result.current.loadStatus).toBe('loading');
      act(() => mockLoadNetworks.mock.calls[1][2]?.([base]));
      expect(result.current.current).toBe(base);
      const secondCache = mockLoadNetworks.mock.calls[1][2];
      act(() => changeScope(routeParams));
      expect(result.current.current).toBeUndefined();
      expect(result.current.canStart).toBe(false);

      const latest = {
        ...ethereum,
        tokens: ethereum.tokens.map((token) => ({ ...token, amount: '0.3' })),
      };
      await act(async () => {
        third.resolve({
          networks: [latest],
          partialError: false,
          providerInfo,
        });
        await third.promise;
      });
      await act(async () => {
        firstCache?.([ethereum]);
        secondCache?.([base]);
        if (outcome === 'resolve') {
          first.resolve({ networks: [ethereum], partialError: true });
        } else {
          first.reject(new Error('Obsolete account load'));
        }
        second.resolve({ networks: [base], partialError: true });
        await Promise.allSettled([first.promise, second.promise]);
      });

      expect(result.current.current).toBe(latest);
      expect(result.current.selected).toEqual(latest.tokens);
      expect(result.current.refreshStatus).toBe('idle');
      expect(result.current.partialError).toBe(false);
      expect(result.current.providerInfo).toEqual(providerInfo);
      expect(result.current.canStart).toBe(true);
    },
  );

  it('retains a failed network preview while allowing only fresh networks to start', async () => {
    const fresh = deferredLoad();
    const retry = deferredLoad();
    mockLoadNetworks
      .mockReturnValueOnce(fresh.promise)
      .mockReturnValueOnce(retry.promise);
    const { result } = renderController();
    act(() => mockLoadNetworks.mock.calls[0][2]?.([ethereum, base]));
    act(() => result.current.selectNetwork(base.network.networkId));
    await act(async () => {
      fresh.resolve({
        networks: [ethereum],
        partialError: true,
        providerInfo,
        failedNetworkIds: [base.network.networkId],
      });
      await fresh.promise;
    });

    expect(result.current.current).toBe(base);
    expect(result.current.networks).toContain(ethereum);
    expect(result.current.networks).toContain(base);
    expect(result.current.loadStatus).toBe('ready');
    expect(result.current.refreshStatus).toBe('idle');
    expect(result.current.assetStatus).toBe('error');
    expect(result.current.canStart).toBe(false);
    act(() => result.current.selectNetwork(ethereum.network.networkId));
    expect(result.current.canStart).toBe(true);
    act(() => result.current.selectNetwork(base.network.networkId));
    act(() => result.current.retryAssets());
    expect(mockRefreshNetwork).not.toHaveBeenCalled();
    expect(mockLoadNetworks).toHaveBeenCalledTimes(2);
    expect(result.current.current).toBe(base);
    await act(async () => {
      retry.resolve({
        networks: [ethereum, base],
        partialError: false,
        providerInfo,
      });
      await retry.promise;
    });
    expect(result.current.current).toBe(base);
    expect(result.current.canStart).toBe(true);
  });

  it('does not let a late entry cache settle post-transaction refresh or restore swept selection', async () => {
    const fresh = deferredLoad();
    let resolveAssets!: (entry: IDustSweepNetwork) => void;
    mockLoadNetworks.mockReturnValueOnce(fresh.promise);
    mockRefreshNetwork.mockReturnValueOnce(
      new Promise((resolve) => {
        resolveAssets = resolve;
      }),
    );
    const { result } = renderController();
    const onCache = mockLoadNetworks.mock.calls[0][2];
    act(() => onCache?.([ethereum]));
    await act(async () => {
      fresh.resolve({
        networks: [ethereum],
        partialError: false,
        providerInfo,
      });
      await fresh.promise;
    });
    act(() => {
      result.current.start();
    });
    act(() => mockComplete());
    expect(result.current.assetStatus).toBe('refreshing');
    act(() => result.current.sweepAgain());
    act(() => {
      onCache?.([base, ethereum]);
      result.current.retry();
      result.current.start();
    });

    expect(result.current.current).toBe(ethereum);
    expect(result.current.assetStatus).toBe('refreshing');
    expect(result.current.selected).toEqual([]);
    expect(result.current.canStart).toBe(false);
    expect(mockLoadNetworks).toHaveBeenCalledTimes(1);
    expect(mockRefreshNetwork).toHaveBeenCalledTimes(1);
    await act(async () => resolveAssets(ethereum));
    expect(result.current.assetStatus).toBe('ready');
    expect(result.current.selected).toEqual([]);
    expect(result.current.canStart).toBe(false);
    act(() => result.current.selectNetwork(ethereum.network.networkId));
    expect(result.current.selected).toEqual([]);
  });

  it.each(['automatic', 'network', 'selection'] as const)(
    'reconciles a cached default against live eligibility after an %s choice',
    async (choice) => {
      const fresh = deferredLoad();
      mockLoadNetworks.mockReturnValueOnce(fresh.promise);
      const { result } = renderController();
      act(() => mockLoadNetworks.mock.calls[0][2]?.([ethereum, base]));
      expect(result.current.current).toBe(ethereum);
      if (choice === 'network') {
        act(() => result.current.selectNetwork(ethereum.network.networkId));
      } else if (choice === 'selection') {
        act(() => result.current.toggle(ethereum.tokens[0].key));
      }
      const updatedEthereum = network('evm--1', ['100']);
      await act(async () => {
        fresh.resolve({
          networks: [updatedEthereum, base],
          partialError: false,
          providerInfo,
        });
        await fresh.promise;
      });

      expect(result.current.current).toBe(
        choice === 'automatic' ? base : updatedEthereum,
      );
      expect(result.current.selected).toEqual(
        choice === 'automatic' ? [base.tokens[0]] : [],
      );
      expect(result.current.canStart).toBe(choice === 'automatic');
    },
  );

  it('retries the full load when a failed cached preview has no current network', async () => {
    const fresh = deferredLoad();
    const retry = deferredLoad();
    mockLoadNetworks
      .mockReturnValueOnce(fresh.promise)
      .mockReturnValueOnce(retry.promise);
    const { result } = renderController();
    act(() =>
      mockLoadNetworks.mock.calls[0][2]?.([network('evm--1', ['100'])]),
    );
    await act(async () => {
      fresh.reject(new Error('Balances unavailable'));
      await fresh.promise.catch(() => undefined);
    });

    expect(result.current.loadStatus).toBe('ready');
    expect(result.current.refreshStatus).toBe('error');
    expect(result.current.current).toBeUndefined();
    expect(result.current.assetStatus).toBe('error');
    act(() => result.current.retryAssets());
    expect(mockLoadNetworks).toHaveBeenCalledTimes(2);
    expect(mockRefreshNetwork).not.toHaveBeenCalled();
    await act(async () => {
      retry.resolve({ networks: [base], partialError: false, providerInfo });
      await retry.promise;
    });
    expect(result.current.current).toBe(base);
    expect(result.current.canStart).toBe(true);
  });

  it('recovers only refreshed owners and preserves swept tokens after a partial full load', async () => {
    mockRefreshNetwork.mockRejectedValueOnce(new Error('Refresh failed'));
    const onRefreshed = jest.fn();
    const { result } = renderHook(() => {
      const [networks, setNetworks] = useState([ethereum, base]);
      return useDustSweepReconciliation({
        params: routeParams,
        networks,
        setNetworks,
        onRefreshed,
      });
    });
    const owner = getDustSweepNetworkOwner(ethereum);
    const sweptKey = ethereum.tokens[0].key;
    act(() => result.current.refresh(ethereum, [sweptKey]));
    await waitFor(() =>
      expect(result.current.entries[owner].status).toBe('error'),
    );

    act(() => result.current.markFullLoadReady([base]));
    expect(result.current.entries[owner].status).toBe('error');
    act(() => result.current.markFullLoadReady([ethereum]));
    expect(result.current.entries[owner].status).toBe('ready');
    expect(result.current.entries[owner].sweptKeys).toEqual(
      new Set([sweptKey]),
    );
  });

  it('refreshes only the completed network without clearing results or preferences on Again', async () => {
    mockLoadNetworks.mockResolvedValue({
      networks: [base, ethereumWithHidden],
      partialError: false,
      providerInfo,
    });
    let resolve!: (entry: IDustSweepNetwork) => void;
    mockRefreshNetwork.mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const { result } = renderController();
    await waitFor(() => expect(result.current.canStart).toBe(true));
    act(() => {
      result.current.addHidden();
      result.current.setSlippage(2);
      result.current.selectThreshold(100);
    });
    act(() => result.current.toggle(ethereumWithHidden.tokens[1].key));
    act(() => {
      result.current.start();
    });
    act(() => mockComplete([{ status: 'success' }, { status: 'failed' }]));
    const completed = result.current.session.state;
    expect(result.current.assetStatus).toBe('refreshing');
    expect(result.current.loadStatus).toBe('ready');
    expect(result.current.session.state).toBe(completed);
    expect(mockRefreshNetwork).toHaveBeenCalledTimes(1);
    expect(mockRefreshNetwork.mock.calls[0][0]).toEqual({
      entry: ethereumWithHidden,
      indexedAccountId: routeParams.indexedAccountId,
    });
    const signal = mockRefreshNetwork.mock.calls[0][1];
    act(() => {
      result.current.sweepAgain();
    });
    act(() => {
      result.current.sweepAgain();
      result.current.start();
      result.current.retry();
    });
    expect(signal.aborted).toBe(false);
    expect(result.current.selecting).toBe(true);
    expect(result.current.current).toBe(ethereumWithHidden);
    expect(result.current.networks).toContain(base);
    expect(result.current.providerInfo).toBe(providerInfo);
    expect(result.current.threshold).toBe(100);
    expect(result.current.slippage).toBe(2);
    expect(result.current.includeHidden).toBe(true);
    expect(result.current.canStart).toBe(false);
    expect(mockLoadNetworks).toHaveBeenCalledTimes(1);
    expect(mockRefreshNetwork).toHaveBeenCalledTimes(1);
    const updated = {
      ...ethereumWithHidden,
      tokens: ethereumWithHidden.tokens.map((token, index) =>
        index ? { ...token, amount: '0.4' } : token,
      ),
    };
    await act(async () => resolve(updated));
    expect(result.current.assetStatus).toBe('ready');
    expect(result.current.networks).toContain(base);
    expect(result.current.current).toBe(updated);
    expect(result.current.selected).toEqual([updated.tokens[1]]);
    act(() => result.current.selectNetwork(base.network.networkId));
    expect(result.current.canStart).toBe(true);
    act(() => result.current.selectNetwork(ethereum.network.networkId));
    expect(result.current.selected).toEqual([]);
    // Explicitly selecting a previously swept token is quoted on its own turn.
    act(() => result.current.toggle(updated.tokens[0].key));
    expect(result.current.selected).toEqual([updated.tokens[0]]);
  });

  it('retains data on a failed refresh and gates only that network until retry succeeds', async () => {
    mockRefreshNetwork.mockRejectedValueOnce(new Error('offline'));
    const { result } = renderController();
    await waitFor(() => expect(result.current.canStart).toBe(true));
    act(() => {
      result.current.start();
    });
    act(() => mockComplete([{ status: 'failed' }]));
    await waitFor(() => expect(result.current.assetStatus).toBe('error'));
    act(() => result.current.sweepAgain());
    expect(result.current.current).toBe(ethereum);
    expect(result.current.canStart).toBe(false);
    act(() => {
      result.current.start();
    });
    expect(result.current.selecting).toBe(true);
    act(() => result.current.selectNetwork(base.network.networkId));
    expect(result.current.canStart).toBe(true);
    act(() => result.current.selectNetwork(ethereum.network.networkId));
    act(() => result.current.retryAssets());
    await waitFor(() => expect(result.current.assetStatus).toBe('ready'));
    expect(result.current.canStart).toBe(true);
    expect(mockRefreshNetwork).toHaveBeenCalledTimes(2);
    expect(mockLoadNetworks).toHaveBeenCalledTimes(1);
  });

  it('does not change another network selection after a stale refresh completes', async () => {
    let resolve!: (entry: IDustSweepNetwork) => void;
    mockRefreshNetwork.mockReturnValueOnce(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const { result } = renderController();
    await waitFor(() => expect(result.current.canStart).toBe(true));
    act(() => {
      void result.current.start();
    });
    act(() => mockComplete([{ status: 'failed' }]));
    await waitFor(() => expect(result.current.assetStatus).toBe('refreshing'));
    act(() => result.current.sweepAgain());
    act(() => result.current.selectNetwork(base.network.networkId));
    expect(result.current.current).toBe(base);
    const activeSelection = result.current.selected;
    expect(result.current.canStart).toBe(true);
    await act(async () =>
      resolve({ ...ethereum, tokens: [], balanceUsd: '0' }),
    );
    expect(result.current.current).toBe(base);
    expect(result.current.selected).toEqual(activeSelection);
    expect(result.current.canStart).toBe(true);
  });

  it.each(['resolve', 'reject'] as const)(
    'switches from completed while the previous network refresh later %ss',
    async (outcome) => {
      const source = network('evm--1', ['8', '2']);
      mockLoadNetworks.mockResolvedValue({
        networks: [source, base],
        partialError: false,
      });
      let resolve!: (entry: IDustSweepNetwork) => void;
      let reject!: (error: Error) => void;
      mockRefreshNetwork.mockReturnValueOnce(
        new Promise((done, fail) => {
          resolve = done;
          reject = fail;
        }),
      );
      const { result } = renderController();
      await waitFor(() => expect(result.current.canStart).toBe(true));
      act(() => result.current.toggle(source.tokens[0].key));
      expect(result.current.selected).toEqual([source.tokens[1]]);
      act(() => {
        result.current.start();
      });
      act(() => mockComplete());
      expect(result.current.session.state.phase).toBe('completed');
      expect(result.current.canSelectNetwork).toBe(true);
      expect(result.current.assetStatus).toBe('refreshing');
      const refreshSignal = mockRefreshNetwork.mock.calls[0][1];

      act(() => result.current.selectNetwork(base.network.networkId));
      expect(result.current.session.state).toEqual(initialDustSweepState);
      expect(result.current.current).toBe(base);
      expect(result.current.selected).toEqual([base.tokens[0]]);
      expect(result.current.canStart).toBe(true);
      expect(refreshSignal.aborted).toBe(false);

      await act(async () => {
        if (outcome === 'resolve') {
          resolve({ ...source, tokens: [source.tokens[0]], balanceUsd: '8' });
        } else {
          reject(new Error('Previous network refresh failed'));
        }
      });
      expect(result.current.current).toBe(base);
      expect(result.current.selected).toEqual([base.tokens[0]]);
      expect(result.current.assetStatus).toBe('ready');
      expect(result.current.canStart).toBe(true);
      expect(mockLoadNetworks).toHaveBeenCalledTimes(1);
      expect(mockRefreshNetwork).toHaveBeenCalledTimes(1);

      act(() => result.current.selectNetwork(source.network.networkId));
      expect(result.current.assetStatus).toBe(
        outcome === 'resolve' ? 'ready' : 'error',
      );
      expect(result.current.selected).toEqual([source.tokens[0]]);
    },
  );

  it.each([
    { item: { status: 'skipped', txId: undefined }, refreshes: 0 },
    {
      item: { status: 'skipped', txId: undefined, approvalTxIds: ['approval'] },
      refreshes: 1,
    },
    { item: { status: 'failed' }, refreshes: 1 },
  ] as { item: Partial<IDustSweepItem>; refreshes: number }[])(
    'refreshes when a terminal item may have spent gas: %j',
    async ({ item, refreshes }) => {
      const { result } = renderController();
      await waitFor(() => expect(result.current.canStart).toBe(true));
      act(() => {
        result.current.start();
      });
      await act(async () => mockComplete([item]));
      expect(mockRefreshNetwork).toHaveBeenCalledTimes(refreshes);
      act(() => result.current.sweepAgain());
      expect(mockLoadNetworks).toHaveBeenCalledTimes(1);
    },
  );

  it('keeps an emptied completed network selected while retaining other networks', async () => {
    const empty = { ...ethereum, tokens: [], balanceUsd: '0' };
    mockRefreshNetwork.mockResolvedValueOnce(empty);
    const { result } = renderController();
    await waitFor(() => expect(result.current.canStart).toBe(true));
    act(() => {
      result.current.start();
    });
    await act(async () => mockComplete());
    act(() => result.current.sweepAgain());
    expect(result.current.current).toBe(empty);
    expect(result.current.networks).toContain(base);
    expect(result.current.selected).toEqual([]);
    expect(result.current.canStart).toBe(false);
  });

  it.each(['full-first', 'local-first'] as const)(
    'serializes full and local retries even in the same event: %s',
    async (order) => {
      mockLoadNetworks.mockResolvedValue({
        networks: [ethereum],
        partialError: true,
      });
      mockRefreshNetwork.mockRejectedValueOnce(new Error('offline'));
      const { result } = renderController();
      await waitFor(() => expect(result.current.canStart).toBe(true));
      act(() => {
        result.current.start();
      });
      await act(async () => mockComplete([{ status: 'failed' }]));
      act(() => result.current.sweepAgain());
      expect(result.current.assetStatus).toBe('error');
      const full = deferredLoad();
      let resolveLocal!: (entry: IDustSweepNetwork) => void;
      mockLoadNetworks.mockReturnValueOnce(full.promise);
      mockRefreshNetwork.mockReturnValueOnce(
        new Promise((resolve) => {
          resolveLocal = resolve;
        }),
      );
      act(() => {
        if (order === 'full-first') {
          result.current.retry();
          result.current.retryAssets();
        } else {
          result.current.retryAssets();
          result.current.retry();
        }
      });
      if (order === 'full-first') {
        expect(mockLoadNetworks).toHaveBeenCalledTimes(2);
        expect(mockRefreshNetwork).toHaveBeenCalledTimes(1);
        await act(async () =>
          full.resolve({ networks: [ethereum], partialError: false }),
        );
        await waitFor(() => expect(result.current.assetStatus).toBe('ready'));
        expect(result.current.canStart).toBe(true);
        expect(mockRefreshNetwork).toHaveBeenCalledTimes(1);
      } else {
        expect(mockLoadNetworks).toHaveBeenCalledTimes(1);
        expect(mockRefreshNetwork).toHaveBeenCalledTimes(2);
      }
      if (order === 'local-first') {
        const fresh = {
          ...ethereum,
          tokens: ethereum.tokens.map((token) => ({ ...token, amount: '0.5' })),
        };
        await act(async () => resolveLocal(fresh));
        expect(result.current.current).toBe(fresh);
        expect(result.current.assetStatus).toBe('ready');
      }
    },
  );

  it.each(['resolve', 'reject'] as const)(
    'ignores an old reconciliation that %ss after an A → B → A account change',
    async (outcome) => {
      let resolve!: (entry: IDustSweepNetwork) => void;
      let reject!: (error: Error) => void;
      mockRefreshNetwork.mockReturnValueOnce(
        new Promise((done, fail) => {
          resolve = done;
          reject = fail;
        }),
      );
      let changeScope!: (params: IDustSweepRouteParams) => void;
      function Wrapper({ children }: PropsWithChildren) {
        const [params, setParams] = useState(routeParams);
        changeScope = setParams;
        return (
          <DustSweepProvider params={params}>{children}</DustSweepProvider>
        );
      }
      const { result } = renderHook(() => useDustSweep(), { wrapper: Wrapper });
      await waitFor(() => expect(result.current.canStart).toBe(true));
      act(() => {
        result.current.start();
      });
      act(() => mockComplete());
      act(() => result.current.sweepAgain());
      expect(result.current.selected).toEqual([]);
      const signal = mockRefreshNetwork.mock.calls[0][1];
      await act(async () =>
        changeScope({ ...routeParams, accountId: 'account-b' }),
      );
      expect(signal.aborted).toBe(true);
      await act(async () => changeScope(routeParams));
      await act(async () => {
        if (outcome === 'resolve')
          resolve({ ...ethereum, tokens: [], balanceUsd: '0' });
        else reject(new Error('obsolete failure'));
      });
      expect(result.current.current).toBe(ethereum);
      expect(result.current.assetStatus).toBe('ready');
      expect(result.current.selected).toEqual(ethereum.tokens);
      expect(mockRefreshNetwork).toHaveBeenCalledTimes(1);
    },
  );

  it('does not retain a completed account selection after switching accounts before Done', async () => {
    let changeScope!: (params: IDustSweepRouteParams) => void;
    function Wrapper({ children }: PropsWithChildren) {
      const [params, setParams] = useState(routeParams);
      changeScope = setParams;
      return <DustSweepProvider params={params}>{children}</DustSweepProvider>;
    }
    const { result } = renderHook(() => useDustSweep(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.canStart).toBe(true));
    act(() => {
      result.current.start();
    });
    await act(async () => mockComplete([{ status: 'failed' }]));
    const accountB = {
      ...ethereum,
      accountId: 'account-b',
      address: 'address-b',
      tokens: [{ ...ethereum.tokens[0], key: 'evm--1:account-b-token' }],
    };
    mockLoadNetworks.mockResolvedValue({
      networks: [accountB],
      partialError: false,
    });
    await act(async () =>
      changeScope({ ...routeParams, accountId: 'account-b' }),
    );
    expect(result.current.session.state.phase).toBe('completed');
    act(() => result.current.sweepAgain());
    expect(result.current.selecting).toBe(true);
    expect(result.current.current).toBe(accountB);
    expect(result.current.selected).toEqual(accountB.tokens);
    expect(result.current.canStart).toBe(true);
  });

  it('does not let an earlier reconciliation overwrite a newer retry', async () => {
    mockRefreshNetwork.mockRejectedValueOnce(new Error('offline'));
    const { result } = renderController();
    await waitFor(() => expect(result.current.canStart).toBe(true));
    act(() => {
      result.current.start();
    });
    await act(async () => mockComplete([{ status: 'failed' }]));
    act(() => result.current.sweepAgain());
    let first!: (entry: IDustSweepNetwork) => void;
    let second!: (entry: IDustSweepNetwork) => void;
    mockRefreshNetwork
      .mockReturnValueOnce(
        new Promise((resolve) => {
          first = resolve;
        }),
      )
      .mockReturnValueOnce(
        new Promise((resolve) => {
          second = resolve;
        }),
      );
    act(() => {
      result.current.retryAssets();
      result.current.retryAssets();
    });
    expect(mockRefreshNetwork.mock.calls[1][1].aborted).toBe(true);
    const fresh = {
      ...ethereum,
      tokens: ethereum.tokens.map((token) => ({ ...token, amount: '0.2' })),
    };
    await act(async () => second(fresh));
    await act(async () => first(ethereum));
    expect(result.current.current).toBe(fresh);
    expect(result.current.assetStatus).toBe('ready');
  });

  it('exposes provider metadata independently of empty token and quote lists', async () => {
    mockLoadNetworks.mockResolvedValue({
      networks: [network('evm--1', [])],
      partialError: false,
      providerInfo,
    });
    const { result } = renderController();
    await waitFor(() => expect(result.current.loadStatus).toBe('ready'));

    expect(result.current.providerInfo).toEqual(providerInfo);
    expect(result.current.selected).toEqual([]);
    expect(result.current.canStart).toBe(false);
  });

  it('clears metadata on scope change before the replacement request settles', async () => {
    const replacement = deferredLoad();
    mockLoadNetworks
      .mockResolvedValueOnce({
        networks: [],
        partialError: false,
        providerInfo,
      })
      .mockReturnValueOnce(replacement.promise);
    let changeScope!: (params: IDustSweepRouteParams) => void;
    function Wrapper({ children }: PropsWithChildren) {
      const [params, setParams] = useState(routeParams);
      changeScope = setParams;
      return <DustSweepProvider params={params}>{children}</DustSweepProvider>;
    }
    const observed: {
      accountId?: string;
      providerInfo?: ISwapProviderInfo;
    }[] = [];
    const { result } = renderHook(
      () => {
        const controller = useDustSweep();
        observed.push({
          accountId: controller.params.accountId,
          providerInfo: controller.providerInfo,
        });
        return controller;
      },
      { wrapper: Wrapper },
    );
    await waitFor(() =>
      expect(result.current.providerInfo).toEqual(providerInfo),
    );

    act(() => changeScope({ ...routeParams, accountId: 'hd-test--1' }));

    expect(result.current.loadStatus).toBe('loading');
    expect(result.current.providerInfo).toBeUndefined();
    expect(
      observed.filter((value) => value.accountId === 'hd-test--1'),
    ).not.toHaveLength(0);
    expect(
      observed
        .filter((value) => value.accountId === 'hd-test--1')
        .every((value) => value.providerInfo === undefined),
    ).toBe(true);
    await act(async () => {
      replacement.reject(new Error('Provider list failed'));
      await replacement.promise.catch(() => undefined);
    });
    expect(result.current.loadStatus).toBe('error');
    expect(result.current.providerInfo).toBeUndefined();
  });

  it('clears metadata during retry and does not reuse it when the provider disappears', async () => {
    const replacement = deferredLoad();
    mockLoadNetworks
      .mockResolvedValueOnce({
        networks: [],
        partialError: false,
        providerInfo,
      })
      .mockReturnValueOnce(replacement.promise);
    const { result } = renderController();
    await waitFor(() =>
      expect(result.current.providerInfo).toEqual(providerInfo),
    );

    act(() => result.current.retry());
    expect(result.current.providerInfo).toBeUndefined();
    await act(async () => {
      replacement.resolve({ networks: [], partialError: false });
      await replacement.promise;
    });
    expect(result.current.loadStatus).toBe('ready');
    expect(result.current.providerInfo).toBeUndefined();
  });

  it('keeps network, account, and default selection aligned through A → B → A', async () => {
    const { result } = renderController();
    await waitFor(() => expect(result.current.loadStatus).toBe('ready'));
    expect(result.current.current?.network.networkId).toBe('evm--1');

    act(() => result.current.toggle(ethereum.tokens[0].key));
    expect(result.current.selected).toEqual([]);

    act(() => result.current.selectNetwork('evm--8453'));
    expect(result.current.current?.accountId).toBe(base.accountId);
    expect(result.current.visible.map((token) => token.key)).toEqual([
      base.tokens[0].key,
    ]);
    expect(result.current.selected.map((token) => token.key)).toEqual([
      base.tokens[0].key,
    ]);

    act(() => result.current.selectNetwork('evm--1'));
    expect(result.current.current?.accountId).toBe(ethereum.accountId);
    expect(result.current.selected.map((token) => token.key)).toEqual([
      ethereum.tokens[0].key,
    ]);
    act(() => {
      result.current.start();
    });
    expect(result.current.session.state.snapshot).toMatchObject({
      accountId: ethereum.accountId,
      address: ethereum.address,
      networkId: 'evm--1',
      tokens: ethereum.tokens,
    });
  });

  it('lists networks by balance, defaults to the most dust, and keeps the selection across thresholds', async () => {
    const { result } = renderController();
    await waitFor(() => expect(result.current.loadStatus).toBe('ready'));
    // Base holds the larger balance ($52) but Ethereum has more dust under $10.
    expect(
      result.current.networks.map((entry) => entry.network.networkId),
    ).toEqual(['evm--8453', 'evm--1']);
    expect(result.current.current?.network.networkId).toBe('evm--1');

    act(() => result.current.selectThreshold(100));
    expect(result.current.threshold).toBe(100);
    expect(
      result.current.networks.map((entry) => entry.network.networkId),
    ).toEqual(['evm--8453', 'evm--1']);
    expect(result.current.current?.network.networkId).toBe('evm--1');
    expect(result.current.selected).toEqual(ethereum.tokens);

    act(() => result.current.selectNetwork('evm--8453'));
    act(() => result.current.selectThreshold(10));
    expect(result.current.current?.network.networkId).toBe('evm--8453');
    expect(result.current.selected).toEqual([base.tokens[0]]);
  });

  it('hides networks with nothing to sweep or a $0.00 balance from the picker', async () => {
    const empty = network('evm--10', []);
    const dust = network('evm--56', ['0.004']);
    // Every token is at or above the largest $100 preset, so none can be swept.
    const large = network('evm--137', ['100', '250']);
    mockLoadNetworks.mockResolvedValue({
      networks: [base, empty, dust, large],
      partialError: false,
    });
    const { result } = renderController();
    await waitFor(() => expect(result.current.loadStatus).toBe('ready'));

    expect(
      result.current.networks.map((entry) => entry.network.networkId),
    ).toEqual(['evm--8453']);
    expect(result.current.current?.network.networkId).toBe('evm--8453');
  });

  it('selects no network when every loaded network is excluded from the picker', async () => {
    mockLoadNetworks.mockResolvedValue({
      networks: [network('evm--10', []), network('evm--137', ['100', '250'])],
      partialError: false,
    });
    const { result } = renderController();
    await waitFor(() => expect(result.current.loadStatus).toBe('ready'));

    expect(result.current.networks).toEqual([]);
    expect(result.current.current).toBeUndefined();
    expect(result.current.visible).toEqual([]);
  });

  it('keeps the picker list unchanged when the threshold changes', async () => {
    // Not selected, and nothing under $1, but has dust under $10 and $100.
    const small = network('evm--42161', ['1.5']);
    mockLoadNetworks.mockResolvedValue({
      networks: [base, small],
      partialError: false,
    });
    const { result } = renderController();
    await waitFor(() => expect(result.current.loadStatus).toBe('ready'));
    expect(result.current.current?.network.networkId).toBe('evm--8453');

    act(() => result.current.selectThreshold(1));
    expect(
      result.current.networks.map((entry) => entry.network.networkId),
    ).toEqual(['evm--8453', 'evm--42161']);
  });

  it('keeps an explicitly requested hidden network selected and visible in the picker', async () => {
    mockLoadNetworks.mockResolvedValue({
      networks: [base, network('evm--10', [])],
      partialError: false,
    });
    const { result } = renderController({
      ...routeParams,
      networkId: 'evm--10',
    });
    await waitFor(() => expect(result.current.loadStatus).toBe('ready'));

    expect(
      result.current.networks.map((entry) => entry.network.networkId),
    ).toEqual(['evm--10', 'evm--8453']);
    expect(result.current.current?.network.networkId).toBe('evm--10');
  });

  it('falls back to an available network after reload removes the selected network', async () => {
    const remainingNetwork = network('evm--8453', ['2', '0.001']);
    mockLoadNetworks
      .mockResolvedValueOnce({
        networks: [remainingNetwork, ethereumWithHidden],
        partialError: false,
      })
      .mockResolvedValueOnce({
        networks: [remainingNetwork],
        partialError: true,
      });
    const { result } = renderController();
    await waitFor(() => expect(result.current.refreshStatus).toBe('idle'));
    expect(result.current.current?.network.networkId).toBe('evm--1');
    act(() => result.current.addHidden());
    expect(result.current.includeHidden).toBe(true);

    act(() => result.current.retry());
    await waitFor(() => expect(result.current.refreshStatus).toBe('idle'));

    expect(result.current.current?.network.networkId).toBe('evm--8453');
    expect(result.current.current?.accountId).toBe(remainingNetwork.accountId);
    // Add anyway survives the reload and applies to the new network as well.
    expect(result.current.includeHidden).toBe(true);
    expect(result.current.visible).toEqual(remainingNetwork.tokens);
    expect(result.current.selected).toEqual([remainingNetwork.tokens[0]]);
    expect(result.current.hidden).toEqual([]);
    expect(result.current.partialError).toBe(true);
  });

  it('recovers an available network after a reload returns no networks', async () => {
    mockLoadNetworks
      .mockResolvedValueOnce({ networks: [ethereum], partialError: false })
      .mockResolvedValueOnce({ networks: [], partialError: false })
      .mockResolvedValueOnce({ networks: [base], partialError: false });
    const { result } = renderController();
    await waitFor(() => expect(result.current.refreshStatus).toBe('idle'));
    act(() => result.current.toggle(ethereum.tokens[0].key));
    expect(result.current.selected).toEqual([]);

    act(() => result.current.retry());
    await waitFor(() => expect(result.current.refreshStatus).toBe('idle'));
    expect(result.current.current).toBeUndefined();
    act(() => {
      result.current.start();
    });
    expect(result.current.session.state.snapshot).toBeUndefined();

    act(() => result.current.retry());
    await waitFor(() => expect(result.current.refreshStatus).toBe('idle'));
    expect(result.current.current?.network.networkId).toBe('evm--8453');
    expect(result.current.selected).toEqual([base.tokens[0]]);
  });

  it.each(['running', 'paused', 'blocked', 'leaving', 'left'] as const)(
    'retains the %s execution snapshot when its network is unavailable',
    async (phase) => {
      const snapshot: IDustSweepSnapshot = {
        id: 'running-session',
        accountId: ethereum.accountId,
        address: ethereum.address,
        networkId: ethereum.network.networkId,
        nativeToken: ethereum.nativeToken,
        slippage: 5,
        tokens: ethereum.tokens,
      };
      mockUseSession.mockReturnValue({
        state: { phase, snapshot, items: [] },
        start: jest.fn(),
        pause: jest.fn(),
        resume: jest.fn(),
        reset: jest.fn(),
        stop: jest.fn().mockResolvedValue(false),
        stopping: false,
        leave: jest.fn().mockResolvedValue(undefined),
        leaving: false,
      });
      mockLoadNetworks.mockResolvedValue({
        networks: [base],
        partialError: false,
      });
      const { result } = renderController({
        ...routeParams,
        networkId: ethereum.network.networkId,
      });
      await waitFor(() => expect(result.current.loadStatus).toBe('ready'));

      expect(result.current.canSelectNetwork).toBe(false);
      act(() => result.current.selectNetwork(base.network.networkId));
      expect(result.current.current).toBeUndefined();
      expect(result.current.selecting).toBe(false);
      expect(result.current.session.state.snapshot).toBe(snapshot);
      expect(result.current.session.state.phase).toBe(phase);
    },
  );

  it('keeps Add anyway on every network and threshold for the page', async () => {
    mockLoadNetworks.mockResolvedValue({
      networks: [base, ethereumWithHidden],
      partialError: false,
    });
    const { result } = renderController();
    await waitFor(() => expect(result.current.loadStatus).toBe('ready'));
    expect(result.current.hidden).toHaveLength(1);

    act(() => result.current.addHidden());
    expect(result.current.includeHidden).toBe(true);
    expect(result.current.hidden).toHaveLength(0);

    act(() => result.current.selectNetwork(base.network.networkId));
    expect(result.current.includeHidden).toBe(true);
    expect(result.current.hidden).toHaveLength(0);

    act(() =>
      result.current.selectNetwork(ethereumWithHidden.network.networkId),
    );
    expect(result.current.includeHidden).toBe(true);
    expect(result.current.hidden).toHaveLength(0);
    act(() => result.current.selectThreshold(1));
    expect(result.current.includeHidden).toBe(true);
    act(() => result.current.selectNetwork('evm--1'));
    expect(result.current.includeHidden).toBe(true);

    act(() => result.current.sweepAgain());
    await waitFor(() => expect(result.current.loadStatus).toBe('ready'));
    expect(result.current.includeHidden).toBe(true);
  });

  it('keeps suspicious tokens out of bulk selection while allowing explicit selection', async () => {
    mockLoadNetworks.mockResolvedValue({
      networks: [ethereumWithRiskAndHidden],
      partialError: false,
    });
    const { result } = renderController();
    await waitFor(() => expect(result.current.loadStatus).toBe('ready'));

    const safeVisibleKey = ethereumWithRiskAndHidden.tokens[0].key;
    const suspiciousVisibleKey = ethereumWithRiskAndHidden.tokens[1].key;
    const safeHiddenKey = ethereumWithRiskAndHidden.tokens[3].key;
    const suspiciousHiddenKey = ethereumWithRiskAndHidden.tokens[2].key;

    expect(result.current.selected.map((token) => token.key)).toEqual([
      safeVisibleKey,
    ]);
    expect(result.current.hidden.map((token) => token.key)).toEqual([
      suspiciousHiddenKey,
      safeHiddenKey,
    ]);

    act(() => result.current.toggleAll());
    expect(result.current.selected).toEqual([]);

    act(() => result.current.toggle(suspiciousVisibleKey));
    act(() => result.current.toggleAll());
    expect(result.current.selected.map((token) => token.key)).toEqual([
      safeVisibleKey,
      suspiciousVisibleKey,
    ]);

    act(() => result.current.toggleAll());
    expect(result.current.selected.map((token) => token.key)).toEqual([
      suspiciousVisibleKey,
    ]);

    // Added tokens are listed but not selected; Select all still covers them.
    act(() => result.current.addHidden());
    expect(result.current.selected.map((token) => token.key)).toEqual([
      suspiciousVisibleKey,
    ]);
    act(() => result.current.toggleAll());
    expect(result.current.selected.map((token) => token.key)).toEqual([
      safeVisibleKey,
      suspiciousVisibleKey,
      safeHiddenKey,
    ]);
    expect(result.current.selected.map((token) => token.key)).not.toContain(
      suspiciousHiddenKey,
    );
  });

  it.each(['resolve', 'reject'] as const)(
    'ignores a superseded load that later %ss after the current retry succeeds',
    async (outcome) => {
      const first = deferredLoad();
      const second = deferredLoad();
      mockLoadNetworks
        .mockReturnValueOnce(first.promise)
        .mockReturnValueOnce(second.promise);
      const { result } = renderController();
      const firstSignal = mockLoadNetworks.mock.calls[0][1];

      act(() => result.current.retry());
      expect(mockLoadNetworks).toHaveBeenCalledTimes(2);
      expect(firstSignal.aborted).toBe(true);
      await act(async () => {
        second.resolve({ networks: [base], partialError: false, providerInfo });
        await second.promise;
      });
      expect(result.current.current?.network.networkId).toBe('evm--8453');

      await act(async () => {
        if (outcome === 'resolve') {
          first.resolve({
            networks: [ethereum],
            partialError: true,
            providerInfo: {
              ...providerInfo,
              providerName: 'Obsolete provider',
            },
          });
        } else {
          first.reject(new Error('Obsolete balance request failed'));
        }
        await first.promise.catch(() => undefined);
      });
      expect(result.current.loadStatus).toBe('ready');
      expect(result.current.partialError).toBe(false);
      expect(result.current.current?.network.networkId).toBe('evm--8453');
      expect(result.current.selected).toEqual([base.tokens[0]]);
      expect(result.current.providerInfo).toEqual(providerInfo);
    },
  );

  it('does not reload or replace selection while execution is running or paused', async () => {
    mockLoadNetworks.mockResolvedValue({
      networks: [ethereum],
      partialError: true,
    });
    const { result } = renderController();
    await waitFor(() => expect(result.current.loadStatus).toBe('ready'));
    expect(result.current.partialError).toBe(true);

    act(() => {
      result.current.start();
    });
    const snapshot = result.current.session.state.snapshot;
    expect(result.current.session.state.phase).toBe('running');
    act(() => {
      result.current.retry();
      result.current.selectNetwork('evm--8453');
      result.current.selectThreshold(100);
      result.current.toggle(ethereum.tokens[0].key);
    });
    expect(mockLoadNetworks).toHaveBeenCalledTimes(1);
    expect(result.current.loadStatus).toBe('ready');
    expect(result.current.threshold).toBe(10);
    expect(result.current.current?.network.networkId).toBe('evm--1');
    expect(result.current.selected).toEqual(ethereum.tokens);
    expect(result.current.session.state.snapshot).toBe(snapshot);

    act(() => result.current.session.pause());
    act(() => result.current.retry());
    expect(result.current.session.state.phase).toBe('paused');
    expect(mockLoadNetworks).toHaveBeenCalledTimes(1);
    expect(result.current.loadStatus).toBe('ready');
    expect(result.current.session.state.snapshot).toBe(snapshot);
  });

  it('stops back to refreshed selection and keeps Add anyway tokens listed', async () => {
    mockLoadNetworks.mockResolvedValue({
      networks: [ethereumWithHidden],
      partialError: false,
    });
    const { result } = renderController();
    await waitFor(() => expect(result.current.loadStatus).toBe('ready'));
    act(() => result.current.addHidden());
    expect(result.current.visible).toEqual(ethereumWithHidden.tokens);
    expect(result.current.selected).toEqual([ethereumWithHidden.tokens[0]]);

    act(() => {
      result.current.start();
    });
    act(() => result.current.session.pause());
    await act(async () => result.current.stop());

    expect(result.current.session.state.phase).toBe('selecting');
    await waitFor(() => expect(result.current.loadStatus).toBe('ready'));
    expect(mockLoadNetworks).toHaveBeenCalledTimes(1);
    expect(mockRefreshNetwork).not.toHaveBeenCalled();
    expect(result.current.includeHidden).toBe(true);
    expect(result.current.visible).toEqual(ethereumWithHidden.tokens);
    expect(result.current.selected).toEqual([ethereumWithHidden.tokens[0]]);
  });

  it('returns from Stop with the submitted selection instead of the default', async () => {
    const source = network('evm--1', ['8', '2']);
    mockLoadNetworks.mockResolvedValue({
      networks: [source],
      partialError: false,
    });
    const { result } = renderController();
    await waitFor(() => expect(result.current.loadStatus).toBe('ready'));
    act(() => result.current.toggle(source.tokens[0].key));
    expect(result.current.selected).toEqual([source.tokens[1]]);

    act(() => {
      result.current.start();
    });
    act(() => result.current.session.pause());
    await act(async () => result.current.stop());
    await waitFor(() => expect(result.current.loadStatus).toBe('ready'));

    expect(result.current.selected).toEqual([source.tokens[1]]);
  });

  it('drops submitted tokens that are no longer listed after the reload', async () => {
    const source = network('evm--1', ['8', '2']);
    const afterSweep = { ...source, tokens: [source.tokens[0]] };
    mockLoadNetworks.mockResolvedValueOnce({
      networks: [source],
      partialError: false,
    });
    mockRefreshNetwork.mockResolvedValueOnce(afterSweep);
    const { result } = renderController();
    await waitFor(() => expect(result.current.loadStatus).toBe('ready'));
    act(() => result.current.toggle(source.tokens[0].key));

    act(() => {
      result.current.start();
    });
    act(() => {
      mockComplete();
      result.current.session.pause();
    });
    await act(async () => result.current.stop());
    await waitFor(() => expect(result.current.assetStatus).toBe('ready'));
    expect(mockRefreshNetwork).toHaveBeenCalledTimes(1);
    expect(mockLoadNetworks).toHaveBeenCalledTimes(1);

    // The converted token is gone; the one left was not part of the submission.
    expect(result.current.visible).toEqual([source.tokens[0]]);
    expect(result.current.selected).toEqual([]);
  });

  it('starts every selected token without quoting first', async () => {
    const source = network('evm--1', ['1', '2']);
    mockLoadNetworks.mockResolvedValue({
      networks: [source],
      partialError: false,
    });
    const { result } = renderController();
    await waitFor(() => expect(result.current.canStart).toBe(true));
    expect(result.current.selectedValueUsd).toBe('3');
    act(() => {
      result.current.start();
    });
    // Each token is quoted on its own turn and skipped there if it can't be.
    expect(
      result.current.session.state.items.map((item) => item.status),
    ).toEqual(['waiting', 'waiting']);
  });
  it('does not start while the route is hidden', async () => {
    mockFocused = false;
    const { result } = renderController();
    await waitFor(() => expect(result.current.loadStatus).toBe('ready'));
    act(() => {
      result.current.start();
    });
    expect(result.current.session.state.phase).toBe('selecting');
  });
  it('does not start without a selection', async () => {
    mockLoadNetworks.mockResolvedValue({
      networks: [ethereum],
      partialError: false,
    });
    const { result } = renderController();
    await waitFor(() => expect(result.current.canStart).toBe(true));
    act(() => result.current.toggleAll());
    expect(result.current.canStart).toBe(false);
    act(() => {
      result.current.start();
    });
    expect(result.current.session.state.phase).toBe('selecting');
  });
});
