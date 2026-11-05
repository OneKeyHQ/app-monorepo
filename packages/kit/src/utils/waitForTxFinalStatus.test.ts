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
