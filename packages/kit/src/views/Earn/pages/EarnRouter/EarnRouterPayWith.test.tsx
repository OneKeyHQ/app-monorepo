/** @jest-environment jsdom */

import { act, renderHook, waitFor } from '@testing-library/react';

import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

import { toPickedPayToken } from './earnRouter.utils';
import {
  refreshPickedPayToken,
  rememberPickedPayToken,
  usePayTokens,
} from './EarnRouterPayWith';

const networkId = 'evm--1';
const contractAddress = '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48';
const mockFetchSwapTokenDetails = jest.fn<Promise<ISwapToken[]>, [unknown]>();

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceAccount: {
      getAccountAddressForApi: async ({ accountId }: { accountId: string }) =>
        `address-${accountId}`,
    },
    serviceSwap: {
      fetchSwapTokenDetails: (params: unknown) =>
        mockFetchSwapTokenDetails(params),
    },
  },
}));

jest.mock('@onekeyhq/kit/src/states/jotai/contexts/earn', () => ({
  useEarnAtom: () => [{}],
}));

jest.mock('../../components/desktopHome/useEarnDesktopHomeData', () => ({
  useEarnDesktopWalletHoldings: () => ({ networkGroups: [], isLoaded: true }),
}));

function token(balanceParsed: string): ISwapToken {
  return {
    networkId,
    contractAddress,
    decimals: 6,
    symbol: 'USDC',
    balanceParsed,
  };
}

function pick(accountId: string, balance: string) {
  return toPickedPayToken({
    token: token(balance),
    tokens: [],
    accountId,
    depositSymbol: 'ETH',
    depositNetworkId: networkId,
  });
}

beforeEach(() => {
  mockFetchSwapTokenDetails.mockReset();
});

it('keeps a replacement wallet pick when the previous wallet balance arrives late', async () => {
  const previousPick = pick('wallet-a', '10');
  const newPick = pick('wallet-b', '20');
  const previousDetails = Promise.withResolvers<ISwapToken[]>();
  mockFetchSwapTokenDetails.mockReturnValueOnce(previousDetails.promise);
  rememberPickedPayToken(networkId, previousPick);
  const { result } = renderHook(() =>
    usePayTokens({ accountId: 'wallet-b', networkId, depositSymbol: 'ETH' }),
  );

  const refresh = refreshPickedPayToken({
    accountId: 'wallet-a',
    networkId,
    item: previousPick,
  });
  await waitFor(() =>
    expect(mockFetchSwapTokenDetails).toHaveBeenCalledTimes(1),
  );
  act(() => {
    rememberPickedPayToken(networkId, newPick);
  });
  await act(async () => {
    previousDetails.resolve([token('99')]);
    await refresh;
  });

  expect(result.current.tokens).toEqual([newPick]);
});

it('publishes only the latest request for the same cached pick', async () => {
  const item = pick('wallet-a', '10');
  const earlier = Promise.withResolvers<ISwapToken[]>();
  const later = Promise.withResolvers<ISwapToken[]>();
  mockFetchSwapTokenDetails
    .mockReturnValueOnce(earlier.promise)
    .mockReturnValueOnce(later.promise);
  rememberPickedPayToken(networkId, item);
  const { result } = renderHook(() =>
    usePayTokens({ accountId: 'wallet-a', networkId, depositSymbol: 'ETH' }),
  );

  const params = { accountId: 'wallet-a', networkId, item };
  const earlierRefresh = refreshPickedPayToken(params);
  const laterRefresh = refreshPickedPayToken(params);
  await waitFor(() =>
    expect(mockFetchSwapTokenDetails).toHaveBeenCalledTimes(2),
  );
  await act(async () => {
    earlier.resolve([token('90')]);
    await earlierRefresh;
  });
  expect(result.current.tokens).toEqual([item]);

  await act(async () => {
    later.resolve([token('30')]);
    await laterRefresh;
  });
  expect(result.current.tokens).toEqual([{ ...item, amount: '30' }]);
});
