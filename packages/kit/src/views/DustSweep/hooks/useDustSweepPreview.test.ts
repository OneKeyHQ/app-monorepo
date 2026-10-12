/** @jest-environment jsdom */
import { act, renderHook } from '@testing-library/react';

import type {
  IDustSweepSnapshot,
  IDustSweepToken,
} from '@onekeyhq/shared/types/swap/dustSweep';

import { fetchDustSweepQuote, getDustSweepQuoteRisk } from '../utils/quote';

import { useDustSweepPreview } from './useDustSweepPreview';

jest.mock('../utils/quote', () => ({
  fetchDustSweepQuote: jest.fn(),
  getDustSweepQuoteRisk: jest.fn(),
  DustSweepSkip: class extends Error {
    reason: string;
    constructor(reason: string) {
      super(reason);
      this.reason = reason;
    }
  },
}));

const mockFetchQuote = jest.mocked(fetchDustSweepQuote);
const mockGetQuoteRisk = jest.mocked(getDustSweepQuoteRisk);

const token: IDustSweepToken = {
  key: 'evm--1_0xtoken',
  networkId: 'evm--1',
  contractAddress: '0xtoken',
  symbol: 'DUST',
  decimals: 18,
  amount: '10',
  valueUsd: '10',
  suspicious: false,
};
const nativeToken = {
  networkId: 'evm--1',
  contractAddress: '',
  symbol: 'ETH',
  decimals: 18,
  isNative: true,
  price: '1000',
};

function snapshot(id: string): IDustSweepSnapshot {
  return {
    id,
    accountId: 'account',
    address: '0xuser',
    networkId: 'evm--1',
    slippage: 5,
    tokens: [token],
    nativeToken,
  };
}

beforeEach(() => {
  jest.useFakeTimers();
  mockFetchQuote.mockResolvedValue({
    info: { provider: 'SwapOKX', providerName: 'OKX' },
    fromTokenInfo: token,
    toTokenInfo: nativeToken,
    fromAmount: token.amount,
    toAmount: '0.01',
  });
  mockGetQuoteRisk.mockReturnValue(undefined);
});

afterEach(() => {
  jest.useRealTimers();
  jest.clearAllMocks();
});

it('debounces rapid selection revisions to one current quote request', async () => {
  const { result, rerender } = renderHook(
    ({ current }: { current: IDustSweepSnapshot }) =>
      useDustSweepPreview(current),
    { initialProps: { current: snapshot('first') } },
  );

  rerender({ current: snapshot('second') });
  rerender({ current: snapshot('latest') });
  expect(mockFetchQuote).not.toHaveBeenCalled();

  await act(async () => {
    jest.advanceTimersByTime(299);
  });
  expect(mockFetchQuote).not.toHaveBeenCalled();

  await act(async () => {
    jest.advanceTimersByTime(1);
    await Promise.resolve();
    await Promise.resolve();
  });

  expect(mockFetchQuote).toHaveBeenCalledTimes(1);
  expect(mockFetchQuote).toHaveBeenCalledWith(
    token,
    expect.objectContaining({ id: 'latest' }),
    expect.any(AbortSignal),
  );
  expect(result.current).toMatchObject({
    status: 'ready',
    quotedCount: 1,
    amount: '0.01',
    providers: [{ provider: 'SwapOKX', providerName: 'OKX' }],
    availableKeys: [token.key],
  });
});

it('keeps partial availability and the reason for each unavailable token', async () => {
  mockFetchQuote.mockRejectedValueOnce(new Error('Transport failed'));
  const source = {
    ...snapshot('partial'),
    tokens: [token, { ...token, key: 'second' }],
  };
  const { result } = renderHook(() => useDustSweepPreview(source));
  await act(async () => {
    await jest.advanceTimersByTimeAsync(300);
  });
  expect(result.current).toMatchObject({
    status: 'partial',
    quotedCount: 1,
    amount: '0.01',
    availableKeys: ['second'],
    unavailable: { [token.key]: 'noQuote' },
  });
});

it('retains display during manual refresh but revokes the old quote after failure', async () => {
  const source = snapshot('refresh');
  const { result, rerender } = renderHook(
    ({ revision }) => useDustSweepPreview(source, { revision }),
    { initialProps: { revision: 0 } },
  );
  await act(async () => {
    await jest.advanceTimersByTimeAsync(300);
  });
  mockFetchQuote.mockRejectedValueOnce(new Error('Unavailable'));
  rerender({ revision: 1 });
  expect(result.current).toMatchObject({
    status: 'refreshing',
    amount: '0.01',
  });
  await act(async () => {
    await jest.advanceTimersByTimeAsync(300);
  });
  expect(result.current).toMatchObject({
    status: 'error',
    amount: '0',
    quotedCount: 0,
    availableKeys: [],
  });
});

it('cancels hidden requests and ignores a late result after the scope changes', async () => {
  let resolveOld!: (
    quote: Awaited<ReturnType<typeof fetchDustSweepQuote>>,
  ) => void;
  mockFetchQuote.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        resolveOld = resolve;
      }),
  );
  const { result, rerender } = renderHook(
    ({ source, enabled }) => useDustSweepPreview(source, { enabled }),
    { initialProps: { source: snapshot('old'), enabled: true } },
  );
  await act(async () => {
    await jest.advanceTimersByTimeAsync(300);
  });
  const signal = mockFetchQuote.mock.calls[0][2];
  rerender({ source: snapshot('new'), enabled: false });
  expect(signal.aborted).toBe(true);
  expect(result.current.status).toBe('idle');
  rerender({ source: snapshot('new'), enabled: true });
  await act(async () => {
    await jest.advanceTimersByTimeAsync(300);
  });
  await act(async () => {
    resolveOld({
      info: { provider: 'Old', providerName: 'Old' },
      toAmount: '10',
      fromTokenInfo: token,
      toTokenInfo: nativeToken,
    });
  });
  expect(result.current).toMatchObject({
    status: 'ready',
    amount: '0.01',
    providers: [{ provider: 'SwapOKX' }],
  });
});
