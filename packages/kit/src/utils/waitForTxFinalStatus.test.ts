/* eslint-disable import/first */
const mockFetch = jest.fn<Promise<unknown>, [unknown]>();
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceHistory: { fetchTxDetails: (params: unknown) => mockFetch(params) },
  },
}));

import { EOnChainHistoryTxStatus } from '@onekeyhq/shared/types/history';

import { waitForTxFinalStatus } from './waitForTxFinalStatus';

it('passes an expected address to each status lookup and preserves legacy calls', async () => {
  mockFetch.mockResolvedValue({
    data: { status: EOnChainHistoryTxStatus.Success },
  });
  await waitForTxFinalStatus({
    accountId: 'account',
    networkId: 'evm--1',
    txid: 'tx',
    expectedAccountAddress: 'owner',
  });
  expect(mockFetch).toHaveBeenCalledWith({
    accountId: 'account',
    networkId: 'evm--1',
    txid: 'tx',
    expectedAccountAddress: 'owner',
  });
  mockFetch.mockClear();
  await waitForTxFinalStatus({
    accountId: 'account',
    networkId: 'evm--1',
    txid: 'tx',
  });
  expect(mockFetch).toHaveBeenCalledWith({
    accountId: 'account',
    networkId: 'evm--1',
    txid: 'tx',
  });
});

it('removes the abort listener after each polling delay', async () => {
  jest.useFakeTimers();
  try {
    const controller = new AbortController();
    const removeListener = jest.spyOn(controller.signal, 'removeEventListener');
    mockFetch.mockReset().mockResolvedValue(undefined);
    const result = waitForTxFinalStatus({
      accountId: 'account',
      networkId: 'evm--1',
      txid: 'tx',
      signal: controller.signal,
      maxAttempts: 2,
      intervalMs: 10,
    });
    await jest.advanceTimersByTimeAsync(10);
    await expect(result).resolves.toBeUndefined();
    expect(removeListener).toHaveBeenCalledWith('abort', expect.any(Function));
  } finally {
    jest.useRealTimers();
  }
});

it('ignores a final status that arrives after cancellation', async () => {
  const controller = new AbortController();
  let finishFetch: (value: unknown) => void = () => undefined;
  mockFetch.mockReset().mockImplementation(
    () =>
      new Promise((resolve) => {
        finishFetch = resolve;
      }),
  );
  const result = waitForTxFinalStatus({
    accountId: 'account',
    networkId: 'evm--1',
    txid: 'tx',
    signal: controller.signal,
  });
  controller.abort();
  finishFetch({ data: { status: EOnChainHistoryTxStatus.Success } });
  await expect(result).resolves.toBeUndefined();
});
