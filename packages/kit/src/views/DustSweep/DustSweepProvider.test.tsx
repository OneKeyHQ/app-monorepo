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

import { DustSweepProvider, useDustSweep } from './DustSweepProvider';
import { useDustSweepSession } from './hooks/useDustSweepSession';
import { initialDustSweepState } from './stateMachine';
import { loadDustSweepNetworks } from './utils/loadNetworks';

import type { IDustSweepState } from './stateMachine';

function useMockPreferences() {
  return useState<{ threshold: IDustSweepThreshold; entrySeen: boolean }>({
    threshold: 10,
    entrySeen: false,
  });
}

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
  useDustSweepPreview: () => ({
    status: 'ready',
    amount: '0.01',
    quotedCount: 1,
  }),
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
    start: (snapshot: IDustSweepSnapshot) =>
      setState({
        phase: 'running',
        snapshot,
        items: snapshot.tokens.map((token) => ({ token, status: 'waiting' })),
      }),
    pause: () => setState((value) => ({ ...value, phase: 'paused' })),
    resume: () => setState((value) => ({ ...value, phase: 'running' })),
    reset: () => setState(initialDustSweepState),
    leave: async () => undefined,
    leaving: false,
  };
}

function network(networkId: string, values: string[]): IDustSweepNetwork {
  const tokens: IDustSweepToken[] = values.map((valueUsd, index) => ({
    key: `${networkId}:${index}`,
    networkId,
    contractAddress: `0x${index}`,
    symbol: `TOKEN${index}`,
    decimals: 18,
    amount: '1',
    valueUsd,
    suspicious: false,
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
    valueUsd: '0',
  };
}

const ethereum = network('evm--1', ['8']);
const base = network('evm--8453', ['2', '50']);
const routeParams: IDustSweepRouteParams = {
  walletId: 'hd-test',
  accountId: 'hd-test--0',
  indexedAccountId: 'hd-test--0',
  entry: 'walletMore',
};

function renderController() {
  function Wrapper({ children }: PropsWithChildren) {
    return (
      <DustSweepProvider params={routeParams}>{children}</DustSweepProvider>
    );
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
    mockUseSession.mockImplementation(useMockSession);
    mockLoadNetworks.mockResolvedValue({
      networks: [base, ethereum],
      partialError: false,
    });
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
    act(() => result.current.start());
    expect(result.current.session.state.snapshot).toMatchObject({
      accountId: ethereum.accountId,
      address: ethereum.address,
      networkId: 'evm--1',
      tokens: ethereum.tokens,
    });
  });

  it('preserves the initially selected network when a new threshold changes network ranking', async () => {
    const { result } = renderController();
    await waitFor(() => expect(result.current.loadStatus).toBe('ready'));
    expect(
      result.current.networks.map((entry) => entry.network.networkId),
    ).toEqual(['evm--1', 'evm--8453']);

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
        second.resolve({ networks: [base], partialError: false });
        await second.promise;
      });
      expect(result.current.current?.network.networkId).toBe('evm--8453');

      await act(async () => {
        if (outcome === 'resolve') {
          first.resolve({ networks: [ethereum], partialError: true });
        } else {
          first.reject(new Error('Obsolete balance request failed'));
        }
        await first.promise.catch(() => undefined);
      });
      expect(result.current.loadStatus).toBe('ready');
      expect(result.current.partialError).toBe(false);
      expect(result.current.current?.network.networkId).toBe('evm--8453');
      expect(result.current.selected).toEqual([base.tokens[0]]);
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

    act(() => result.current.start());
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
});
