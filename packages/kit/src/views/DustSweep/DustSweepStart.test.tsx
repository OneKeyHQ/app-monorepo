/** @jest-environment jsdom */
import { useState } from 'react';
import type { PropsWithChildren } from 'react';

import { act, renderHook, waitFor } from '@testing-library/react';

import type {
  IDustSweepNetwork,
  IDustSweepThreshold,
} from '@onekeyhq/shared/types/swap/dustSweep';

import { DustSweepProvider, useDustSweep } from './DustSweepProvider';
import { executeDustSweepItem } from './utils/execution';
import { loadDustSweepNetworks } from './utils/loadNetworks';
import { DustSweepSkip } from './utils/quote';

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
jest.mock('./utils/loadNetworks', () => ({ loadDustSweepNetworks: jest.fn() }));
jest.mock('./utils/quote', () => ({
  DustSweepSkip: class extends Error {
    reason: string;

    constructor(reason: string) {
      super(reason);
      this.reason = reason;
    }
  },
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

it('skips a token that gets no quote on submit and settles the sweep', async () => {
  jest.mocked(loadDustSweepNetworks).mockResolvedValue({
    networks: [bnb],
    partialError: false,
  });
  jest
    .mocked(executeDustSweepItem)
    .mockRejectedValue(new DustSweepSkip('noQuote'));
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
