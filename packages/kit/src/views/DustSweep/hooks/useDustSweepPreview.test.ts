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
  });
});
