/** @jest-environment jsdom */
import { useState } from 'react';
import type { PropsWithChildren } from 'react';

import { act, renderHook, waitFor } from '@testing-library/react';

import type {
  IDustSweepNetwork,
  IDustSweepThreshold,
} from '@onekeyhq/shared/types/swap/dustSweep';

import { DustSweepProvider, useDustSweep } from './DustSweepProvider';
import { DustSweepError } from './utils/DustSweepError';
import { DustSweepPaused, executeDustSweepItem } from './utils/execution';
import {
  loadDustSweepNetworks,
  refreshDustSweepNetwork,
} from './utils/loadNetworks';
import { invalidateDustSweepNetworksCache } from './utils/networkCache';

function useMockPreferences() {
  return useState<{ threshold: IDustSweepThreshold }>({ threshold: 10 });
}
jest.mock('@onekeyhq/kit/src/hooks/useRouteIsFocused', () => ({
  useRouteIsFocused: () => true,
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  useDustSweepPreferencesPersistAtom: () => useMockPreferences(),
}));
jest.mock('@onekeyhq/shared/src/errors', () => ({ OneKeyLocalError: Error }));
jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    dex: {
      dustSweep: {
        dustSweepPageVisited: jest.fn(),
        dustSweepAddHidden: jest.fn(),
        dustSweepStart: jest.fn(),
        dustSweepResult: jest.fn(),
        dustSweepItemResult: jest.fn(),
      },
    },
  },
}));
jest.mock('@onekeyhq/kit/src/views/Swap/hooks/useSwapTxHistory', () => ({
  generateSwapHistoryItemForContext: jest.fn(),
}));
jest.mock('./utils/loadNetworks', () => ({
  loadDustSweepNetworks: jest.fn(),
  refreshDustSweepNetwork: jest.fn(),
}));
jest.mock('./utils/execution', () => ({
  executeDustSweepItem: jest.fn(),
  DustSweepUnknownSubmission: jest.fn(),
  DustSweepUserCanceled: jest.fn(),
  DustSweepRetryableError: jest.fn(),
  DustSweepPaused: jest.fn(),
}));

const bnb: IDustSweepNetwork = {
  network: { networkId: 'evm--56', name: 'BNB', symbol: 'BNB' },
  accountId: 'account',
  address: 'address',
  nativeToken: {
    networkId: 'evm--56',
    contractAddress: '',
    isNative: true,
    symbol: 'BNB',
    decimals: 18,
  },
  tokens: [
    {
      key: 'evm--56:arx',
      networkId: 'evm--56',
      contractAddress: '0xarx',
      symbol: 'ARX',
      decimals: 18,
      amount: '1',
      valueUsd: '5',
      suspicious: false,
    },
  ],
  balanceUsd: '5',
};

beforeEach(() => {
  invalidateDustSweepNetworksCache('w');
  jest.resetAllMocks();
});

it('skips a token that gets no quote on submit and settles the sweep', async () => {
  jest.mocked(loadDustSweepNetworks).mockResolvedValue({
    networks: [bnb],
    partialError: false,
  });
  jest
    .mocked(executeDustSweepItem)
    .mockRejectedValue(new DustSweepError('noQuote'));
  function Wrapper({ children }: PropsWithChildren) {
    return (
      <DustSweepProvider
        params={{ walletId: 'w', accountId: 'a', entry: 'tokenListHeader' }}
      >
        {children}
      </DustSweepProvider>
    );
  }
  const { result } = renderHook(() => useDustSweep(), { wrapper: Wrapper });
  await waitFor(() => expect(result.current.canStart).toBe(true));

  let sessionId: string | undefined;
  await act(async () => {
    sessionId = result.current.start();
  });

  expect(sessionId).toBeDefined();
  // An instant failure still reads as submitted for the minimum run time.
  expect(result.current.session.state.phase).toBe('running');
  const startedAt = Date.now();
  await waitFor(
    () => expect(result.current.session.state.phase).toBe('completed'),
    { timeout: 3000 },
  );
  expect(Date.now() - startedAt).toBeGreaterThanOrEqual(1000);
  expect(result.current.session.state.items).toEqual([
    expect.objectContaining({ status: 'skipped', reason: 'noQuote' }),
  ]);
  expect(executeDustSweepItem).toHaveBeenCalledTimes(1);
});

it.each(['success', 'approval'] as const)(
  'reconciles a settled Stop after %s before reset without reselecting spent tokens',
  async (outcome) => {
    const source = {
      ...bnb,
      tokens: [
        bnb.tokens[0],
        { ...bnb.tokens[0], key: 'evm--56:next', contractAddress: '0xnext' },
      ],
    };
    let settle!: () => void;
    const confirmation = new Promise<void>((resolve) => {
      settle = resolve;
    });
    let refresh!: (value: IDustSweepNetwork) => void;
    jest
      .mocked(loadDustSweepNetworks)
      .mockResolvedValue({ networks: [source], partialError: false });
    jest.mocked(refreshDustSweepNetwork).mockReturnValue(
      new Promise((resolve) => {
        refresh = resolve;
      }),
    );
    jest
      .mocked(executeDustSweepItem)
      .mockImplementationOnce(
        async ({ onSigning, onBroadcast, onApprovalBroadcast, onPrepared }) => {
          onSigning();
          if (outcome === 'success') onBroadcast('tx-confirming');
          else {
            onApprovalBroadcast?.(['approval-confirming']);
            onPrepared();
          }
          await confirmation;
          if (outcome === 'approval') throw new DustSweepPaused();
          return {
            status: 'success',
            receivedAmount: '0.01',
            receiptUnavailable: false,
          };
        },
      );
    function Wrapper({ children }: PropsWithChildren) {
      return (
        <DustSweepProvider
          params={{ walletId: 'w', accountId: 'a', entry: 'tokenListHeader' }}
        >
          {children}
        </DustSweepProvider>
      );
    }
    const { result } = renderHook(() => useDustSweep(), { wrapper: Wrapper });
    await waitFor(() => expect(result.current.canStart).toBe(true));
    act(() => {
      result.current.start();
    });
    act(() => result.current.session.pause());
    let stopping!: Promise<void>;
    act(() => {
      stopping = result.current.stop();
    });
    expect(refreshDustSweepNetwork).not.toHaveBeenCalled();
    expect(result.current.session.state.items[0].status).toBe(
      outcome === 'success' ? 'broadcasted' : 'preparing',
    );
    await act(async () => {
      settle();
      await stopping;
    });
    expect(result.current.session.state.phase).toBe('selecting');
    expect(result.current.assetStatus).toBe('refreshing');
    expect(result.current.canStart).toBe(false);
    expect(result.current.selected).toEqual(
      outcome === 'success' ? [source.tokens[1]] : source.tokens,
    );
    expect(refreshDustSweepNetwork).toHaveBeenCalledWith(
      { entry: source, indexedAccountId: undefined },
      expect.any(AbortSignal),
    );
    expect(executeDustSweepItem).toHaveBeenCalledTimes(1);
    // The index still has the spent balance. It must not be selected again.
    await act(async () => refresh(source));
    expect(result.current.canStart).toBe(true);
    expect(result.current.selected).toEqual(
      outcome === 'success' ? [source.tokens[1]] : source.tokens,
    );
    expect(loadDustSweepNetworks).toHaveBeenCalledTimes(1);
    if (outcome === 'success') {
      act(() => result.current.toggle(source.tokens[0].key));
      expect(result.current.selected).toEqual(source.tokens);
    }
  },
);
