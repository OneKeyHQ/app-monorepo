/** @jest-environment jsdom */

import { useState } from 'react';
import type { PropsWithChildren } from 'react';

import { act, renderHook, waitFor } from '@testing-library/react';

import type {
  IDustSweepNetwork,
  IDustSweepRouteParams,
  IDustSweepSnapshot,
  IDustSweepThreshold,
  IDustSweepToken,
} from '@onekeyhq/shared/types/swap/dustSweep';
import type { ISwapProviderInfo } from '@onekeyhq/shared/types/swap/SwapProvider.constants';
import { EProtocolOfExchange } from '@onekeyhq/shared/types/swap/types';

import { DustSweepProvider, useDustSweep } from './DustSweepProvider';
import { useDustSweepSession } from './hooks/useDustSweepSession';
import { dustSweepReducer, initialDustSweepState } from './stateMachine';
import { loadDustSweepNetworks } from './utils/loadNetworks';

import type { useDustSweepPreview } from './hooks/useDustSweepPreview';
import type { IDustSweepState } from './stateMachine';

function useMockPreferences() {
  return useState<{ threshold: IDustSweepThreshold }>({
    threshold: 10,
  });
}

const readyPreview: ReturnType<typeof useDustSweepPreview> = {
  autoRefreshTimerActive: false,
  status: 'ready',
  amount: '0.01',
  quotedCount: 1,
  availableKeys: ['evm--1:0'],
  unavailable: {},
  providers: [{ provider: 'OKX' }],
};
let mockPreview = readyPreview;
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
}));
jest.mock('./hooks/useDustSweepPreview', () => ({
  useDustSweepPreview: () => mockPreview,
}));
jest.mock('./hooks/useDustSweepSession', () => ({
  useDustSweepSession: jest.fn(),
}));

const mockLoadNetworks = jest.mocked(loadDustSweepNetworks);
const mockUseSession = jest.mocked(useDustSweepSession);

function useMockSession(): ReturnType<typeof useDustSweepSession> {
  const [state, setState] = useState<IDustSweepState>(initialDustSweepState);
  return {
    state,
    start: (snapshot, unavailable) => {
      setState((value) =>
        dustSweepReducer(value, { type: 'start', snapshot, unavailable }),
      );
      return snapshot.id;
    },
    pause: () => setState((value) => ({ ...value, phase: 'paused' })),
    resume: () => setState((value) => ({ ...value, phase: 'running' })),
    reset: () => setState(initialDustSweepState),
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
    mockPreview = readyPreview;
    mockFocused = true;
    mockUseSession.mockImplementation(useMockSession);
    mockLoadNetworks.mockResolvedValue({
      networks: [base, ethereum],
      partialError: false,
    });
  });

  it('exposes provider metadata independently of empty token and quote lists', async () => {
    mockLoadNetworks.mockResolvedValue({
      networks: [network('evm--1', [])],
      partialError: false,
      providerInfo,
    });
    mockPreview = {
      ...readyPreview,
      status: 'idle',
      quotedCount: 0,
      availableKeys: [],
      providers: [],
    };
    const { result } = renderController();
    await waitFor(() => expect(result.current.loadStatus).toBe('ready'));

    expect(result.current.providerInfo).toEqual(providerInfo);
    expect(result.current.selected).toEqual([]);
    expect(result.current.preview.providers).toEqual([]);
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
    // Every token is at or above the selected $10 threshold, so none can be swept.
    const aboveThreshold = network('evm--137', ['10', '250']);
    mockLoadNetworks.mockResolvedValue({
      networks: [base, empty, dust, aboveThreshold],
      partialError: false,
    });
    const { result } = renderController();
    await waitFor(() => expect(result.current.loadStatus).toBe('ready'));

    expect(
      result.current.networks.map((entry) => entry.network.networkId),
    ).toEqual(['evm--8453']);
    expect(result.current.current?.network.networkId).toBe('evm--8453');

    // A larger threshold covers the $10 token, so its network returns.
    act(() => result.current.selectThreshold(100));
    expect(
      result.current.networks.map((entry) => entry.network.networkId),
    ).toEqual(['evm--137', 'evm--8453']);
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
    await waitFor(() => expect(result.current.loadStatus).toBe('ready'));
    expect(result.current.current?.network.networkId).toBe('evm--1');
    act(() => result.current.addHidden());
    expect(result.current.includeHidden).toBe(true);

    act(() => result.current.retry());
    await waitFor(() => expect(result.current.loadStatus).toBe('ready'));

    expect(result.current.current?.network.networkId).toBe('evm--8453');
    expect(result.current.current?.accountId).toBe(remainingNetwork.accountId);
    expect(result.current.includeHidden).toBe(false);
    expect(result.current.selected).toEqual([remainingNetwork.tokens[0]]);
    expect(result.current.hidden).toEqual([remainingNetwork.tokens[1]]);
    expect(result.current.partialError).toBe(true);
  });

  it('recovers an available network after a reload returns no networks', async () => {
    mockLoadNetworks
      .mockResolvedValueOnce({ networks: [ethereum], partialError: false })
      .mockResolvedValueOnce({ networks: [], partialError: false })
      .mockResolvedValueOnce({ networks: [base], partialError: false });
    const { result } = renderController();
    await waitFor(() => expect(result.current.loadStatus).toBe('ready'));
    act(() => result.current.toggle(ethereum.tokens[0].key));
    expect(result.current.selected).toEqual([]);

    act(() => result.current.retry());
    await waitFor(() => expect(result.current.loadStatus).toBe('ready'));
    expect(result.current.current).toBeUndefined();
    act(() => {
      result.current.start();
    });
    expect(result.current.session.state.snapshot).toBeUndefined();

    act(() => result.current.retry());
    await waitFor(() => expect(result.current.loadStatus).toBe('ready'));
    expect(result.current.current?.network.networkId).toBe('evm--8453');
    expect(result.current.selected).toEqual([base.tokens[0]]);
  });

  it.each(['running', 'paused', 'completed'] as const)(
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

      act(() => result.current.selectNetwork(base.network.networkId));
      expect(result.current.current).toBeUndefined();
      expect(result.current.selecting).toBe(false);
      expect(result.current.session.state.snapshot).toBe(snapshot);
      expect(result.current.session.state.phase).toBe(phase);
    },
  );

  it('keeps Add anyway across visited networks and threshold changes', async () => {
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
    expect(result.current.includeHidden).toBe(false);
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

    act(() => result.current.addHidden());
    expect(result.current.selected.map((token) => token.key)).toEqual([
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

  it.each(['idle', 'loading', 'refreshing', 'error', 'expired'] as const)(
    'does not start execution when the quote is %s',
    async (status) => {
      mockPreview = { ...readyPreview, status };
      mockLoadNetworks.mockResolvedValue({
        networks: [ethereum],
        partialError: false,
      });
      const { result } = renderController();
      await waitFor(() => expect(result.current.loadStatus).toBe('ready'));

      act(() => {
        result.current.start();
      });

      expect(result.current.session.state.phase).toBe('selecting');
      expect(result.current.session.state.snapshot).toBeUndefined();
    },
  );
  it('executes a partial quote and freezes unavailable rows as skipped', async () => {
    const source = network('evm--1', ['1', '2']);
    mockPreview = {
      ...readyPreview,
      status: 'partial',
      unavailable: {
        [source.tokens[1].key]: {
          reason: 'noQuote',
          providerErrorMessage: '请增加金额后重试',
        },
      },
    };
    mockLoadNetworks.mockResolvedValue({
      networks: [source],
      partialError: false,
    });
    const { result } = renderController();
    await waitFor(() => expect(result.current.canStart).toBe(true));
    expect(result.current.quotedValueUsd).toBe('1');
    act(() => {
      result.current.start();
    });
    expect(
      result.current.session.state.items.map((item) => item.status),
    ).toEqual(['waiting', 'skipped']);
    expect(result.current.session.state.items[1]).toMatchObject({
      reason: 'noQuote',
      providerErrorMessage: '请增加金额后重试',
    });
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
  it('does not start a ready placeholder with zero available quotes', async () => {
    mockPreview = { ...readyPreview, quotedCount: 0, availableKeys: [] };
    const { result } = renderController();
    await waitFor(() => expect(result.current.loadStatus).toBe('ready'));
    act(() => {
      result.current.start();
    });
    expect(result.current.session.state.phase).toBe('selecting');
  });
});
