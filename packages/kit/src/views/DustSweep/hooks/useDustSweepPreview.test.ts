/** @jest-environment jsdom */
import { act, renderHook } from '@testing-library/react';

import type {
  IDustSweepSnapshot,
  IDustSweepToken,
} from '@onekeyhq/shared/types/swap/dustSweep';
import {
  SWAP_QUOTE_INPUT_DEBOUNCE_MS,
  swapQuoteIntervalMaxCount,
  swapRefreshInterval,
} from '@onekeyhq/shared/types/swap/SwapProvider.constants';

import { DustSweepSkip, fetchDustSweepQuote } from '../utils/quote';

import { useDustSweepPreview } from './useDustSweepPreview';

jest.mock('../utils/quote', () => ({
  fetchDustSweepQuote: jest.fn(),
  DustSweepSkip: class extends Error {
    reason: string;
    constructor(reason: string) {
      super(reason);
      this.reason = reason;
    }
  },
}));

const mockFetchQuote = jest.mocked(fetchDustSweepQuote);

const token: IDustSweepToken = {
  key: 'evm--1_0xtoken',
  networkId: 'evm--1',
  contractAddress: '0xtoken',
  symbol: 'DUST',
  decimals: 18,
  amount: '10',
  valueUsd: '10',
  price: '1',
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
    jest.advanceTimersByTime(SWAP_QUOTE_INPUT_DEBOUNCE_MS - 1);
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
  const providerFailure = new DustSweepSkip('noQuote');
  providerFailure.providerErrorMessage = '请增加金额后重试';
  mockFetchQuote
    .mockRejectedValueOnce(new Error('Transport failed'))
    .mockRejectedValueOnce(new DustSweepSkip('priceImpact'))
    .mockRejectedValueOnce(providerFailure);
  const source = {
    ...snapshot('partial'),
    tokens: [
      token,
      { ...token, key: 'second' },
      { ...token, key: 'third' },
      { ...token, key: 'fourth' },
    ],
  };
  const { result } = renderHook(() => useDustSweepPreview(source));
  await act(async () => {
    await jest.advanceTimersByTimeAsync(SWAP_QUOTE_INPUT_DEBOUNCE_MS);
  });
  expect(result.current).toMatchObject({
    status: 'partial',
    quotedCount: 1,
    amount: '0.01',
    availableKeys: ['fourth'],
  });
  expect(result.current.unavailable).toEqual({
    [token.key]: { reason: 'noQuote' },
    second: { reason: 'priceImpact' },
    third: {
      reason: 'noQuote',
      providerErrorMessage: '请增加金额后重试',
    },
  });
  await act(async () => {
    await jest.advanceTimersByTimeAsync(swapRefreshInterval);
  });
  expect(result.current).toMatchObject({ status: 'ready', unavailable: {} });
});

it('uses the Swap refresh budget and requires a fresh manual quote when it expires', async () => {
  const source = snapshot('refresh-budget');
  const { result, rerender } = renderHook(
    ({ revision }) => useDustSweepPreview(source, { revision }),
    { initialProps: { revision: 0 } },
  );
  await act(async () => {
    await jest.advanceTimersByTimeAsync(SWAP_QUOTE_INPUT_DEBOUNCE_MS);
  });
  expect(result.current.autoRefreshTimerActive).toBe(true);
  for (let index = 0; index < swapQuoteIntervalMaxCount; index += 1) {
    await act(async () => {
      await jest.advanceTimersByTimeAsync(swapRefreshInterval);
    });
  }
  expect(mockFetchQuote).toHaveBeenCalledTimes(swapQuoteIntervalMaxCount + 1);
  expect(result.current).toMatchObject({
    status: 'expired',
    amount: '0.01',
    autoRefreshTimerActive: false,
  });
  await act(async () => {
    await jest.advanceTimersByTimeAsync(swapRefreshInterval * 2);
  });
  expect(mockFetchQuote).toHaveBeenCalledTimes(swapQuoteIntervalMaxCount + 1);
  rerender({ revision: 1 });
  expect(result.current.status).toBe('refreshing');
  await act(async () => {
    await jest.advanceTimersByTimeAsync(SWAP_QUOTE_INPUT_DEBOUNCE_MS);
  });
  expect(result.current).toMatchObject({
    status: 'ready',
    autoRefreshTimerActive: true,
  });
  await act(async () => {
    await jest.advanceTimersByTimeAsync(swapRefreshInterval);
  });
  expect(mockFetchQuote).toHaveBeenCalledTimes(swapQuoteIntervalMaxCount + 3);
  expect(result.current.status).toBe('ready');
});

it('expires after the last automatic request settles, including a failed result', async () => {
  const source = snapshot('last-refresh');
  const { result } = renderHook(() => useDustSweepPreview(source));
  await act(async () => {
    await jest.advanceTimersByTimeAsync(SWAP_QUOTE_INPUT_DEBOUNCE_MS);
    await jest.advanceTimersByTimeAsync(
      swapRefreshInterval * (swapQuoteIntervalMaxCount - 1),
    );
  });
  let rejectLast!: (reason: Error) => void;
  mockFetchQuote.mockImplementationOnce(
    () =>
      new Promise((_resolve, reject) => {
        rejectLast = reject;
      }),
  );
  await act(async () => {
    await jest.advanceTimersByTimeAsync(swapRefreshInterval * 2);
  });
  expect(result.current).toMatchObject({
    status: 'refreshing',
    amount: '0.01',
    autoRefreshTimerActive: false,
  });
  expect(mockFetchQuote).toHaveBeenCalledTimes(swapQuoteIntervalMaxCount + 1);
  await act(async () => {
    rejectLast(new Error('Unavailable'));
  });
  expect(result.current).toMatchObject({
    status: 'expired',
    amount: '0',
    quotedCount: 0,
    autoRefreshTimerActive: false,
  });
  await act(async () => {
    await jest.advanceTimersByTimeAsync(swapRefreshInterval * 2);
  });
  expect(mockFetchQuote).toHaveBeenCalledTimes(swapQuoteIntervalMaxCount + 1);
});

it('does not overlap automatic requests and stops the timer when hidden', async () => {
  const source = snapshot('automatic-refresh');
  const { result, rerender } = renderHook(
    ({ enabled }) => useDustSweepPreview(source, { enabled }),
    { initialProps: { enabled: true } },
  );
  await act(async () => {
    await jest.advanceTimersByTimeAsync(SWAP_QUOTE_INPUT_DEBOUNCE_MS);
  });
  mockFetchQuote.mockImplementationOnce(() => new Promise(() => {}));
  await act(async () => {
    await jest.advanceTimersByTimeAsync(swapRefreshInterval * 3);
  });
  expect(mockFetchQuote).toHaveBeenCalledTimes(2);
  expect(result.current).toMatchObject({
    status: 'refreshing',
    amount: '0.01',
    autoRefreshTimerActive: false,
  });
  const signal = mockFetchQuote.mock.calls[1][2];
  rerender({ enabled: false });
  expect(signal.aborted).toBe(true);
  await act(async () => {
    await jest.advanceTimersByTimeAsync(swapRefreshInterval * 2);
  });
  expect(mockFetchQuote).toHaveBeenCalledTimes(2);
  expect(result.current.status).toBe('idle');
});

it('retains display during manual refresh but revokes the old quote after failure', async () => {
  const source = snapshot('refresh');
  const { result, rerender } = renderHook(
    ({ revision }) => useDustSweepPreview(source, { revision }),
    { initialProps: { revision: 0 } },
  );
  await act(async () => {
    await jest.advanceTimersByTimeAsync(SWAP_QUOTE_INPUT_DEBOUNCE_MS);
  });
  mockFetchQuote.mockRejectedValueOnce(new Error('Unavailable'));
  rerender({ revision: 1 });
  expect(result.current).toMatchObject({
    status: 'refreshing',
    amount: '0.01',
  });
  await act(async () => {
    await jest.advanceTimersByTimeAsync(SWAP_QUOTE_INPUT_DEBOUNCE_MS);
  });
  expect(result.current).toMatchObject({
    status: 'error',
    amount: '0',
    quotedCount: 0,
    availableKeys: [],
  });
});

it('cancels hidden requests and ignores a late provider error after the scope changes', async () => {
  let rejectOld!: (error: DustSweepSkip) => void;
  mockFetchQuote.mockImplementationOnce(
    () =>
      new Promise((_resolve, reject) => {
        rejectOld = reject;
      }),
  );
  const { result, rerender } = renderHook(
    ({ source, enabled }) => useDustSweepPreview(source, { enabled }),
    { initialProps: { source: snapshot('old'), enabled: true } },
  );
  await act(async () => {
    await jest.advanceTimersByTimeAsync(SWAP_QUOTE_INPUT_DEBOUNCE_MS);
  });
  const signal = mockFetchQuote.mock.calls[0][2];
  rerender({ source: snapshot('new'), enabled: false });
  expect(signal.aborted).toBe(true);
  expect(result.current.status).toBe('idle');
  rerender({ source: snapshot('new'), enabled: true });
  await act(async () => {
    await jest.advanceTimersByTimeAsync(SWAP_QUOTE_INPUT_DEBOUNCE_MS);
  });
  await act(async () => {
    const error = new DustSweepSkip('noQuote');
    error.providerErrorMessage = 'Old provider error';
    rejectOld(error);
  });
  expect(result.current).toMatchObject({
    status: 'ready',
    amount: '0.01',
    providers: [{ provider: 'SwapOKX' }],
    unavailable: {},
  });
});
