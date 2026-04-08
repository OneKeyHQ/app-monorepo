/** @jest-environment jsdom */

import { renderHook, waitFor } from '@testing-library/react';

import type { IRecommendAsset } from '@onekeyhq/shared/types/staking';

import { useRecommendedRefreshScope } from './useRecommendedRefreshScope';

type IGetEarnAvailableAccounts = (params: {
  accountId: string;
  networkId: string;
  indexedAccountId?: string;
}) => Promise<
  Array<{
    accountId: string;
    networkId: string;
  }>
>;

const mockGetEarnAvailableAccounts: jest.MockedFunction<IGetEarnAvailableAccounts> =
  jest.fn();

jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    serviceStaking: {
      getEarnAvailableAccounts: (params: {
        accountId: string;
        networkId: string;
        indexedAccountId?: string;
      }) => mockGetEarnAvailableAccounts(params),
    },
  },
}));

jest.mock('@onekeyhq/kit/src/hooks/usePromiseResult', () => {
  const React = jest.requireActual<typeof import('react')>('react');

  return {
    usePromiseResult: <T,>(method: () => Promise<T>) => {
      const [result, setResult] = React.useState<T | undefined>(undefined);

      React.useEffect(() => {
        let mounted = true;

        void method().then((value) => {
          if (mounted) {
            setResult(value);
          }
        });

        return () => {
          mounted = false;
        };
      }, [method]);

      return {
        isLoading: false,
        result,
        run: jest.fn(),
        setResult: jest.fn(),
      };
    },
  };
});

function buildRecommendAsset(
  overrides: Partial<IRecommendAsset> = {},
): IRecommendAsset {
  return {
    name: 'Tether USD',
    symbol: 'USDT',
    logoURI: 'https://assets.onekey.so/usdt.png',
    protocols: [
      {
        networkId: 'evm--1',
        provider: 'lido',
      },
    ],
    aprWithoutFee: '0',
    aprInfo: {
      normal: {
        text: '0%',
        color: '$textSuccess',
      },
    },
    bgColor: '$bgSuccess',
    available: {
      text: 'Available',
      color: '$textSuccess',
    },
    isRecommended: true,
    isPinedRecommend: false,
    badges: [],
    ...overrides,
  };
}

describe('useRecommendedRefreshScope', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('limits history refresh accounts to the networks used by current recommendations', async () => {
    mockGetEarnAvailableAccounts.mockResolvedValue([
      {
        accountId: 'acc-eth',
        networkId: 'evm--1',
      },
      {
        accountId: 'acc-azero',
        networkId: 'evm--41455',
      },
    ]);

    const { result } = renderHook(() =>
      useRecommendedRefreshScope({
        accountId: 'hd-1',
        indexedAccountId: 'hd-indexed-1',
        networkId: 'onekeyall--0',
        enableFetch: true,
        recommendedTokens: [buildRecommendAsset()],
      }),
    );

    await waitFor(() => {
      expect(result.current.historyRefreshAccounts).toEqual([
        {
          accountId: 'acc-eth',
          networkId: 'evm--1',
        },
      ]);
    });

    expect(
      result.current.shouldRefreshByAccounts([
        {
          accountId: 'acc-azero',
          networkId: 'evm--41455',
        },
      ]),
    ).toBe(false);

    expect(
      result.current.shouldRefreshByAccounts([
        {
          accountId: 'acc-eth',
          networkId: 'evm--1',
        },
      ]),
    ).toBe(true);
  });

  it('falls back to the all-network account when scope loading fails', async () => {
    mockGetEarnAvailableAccounts.mockRejectedValue(new Error('network error'));

    const { result } = renderHook(() =>
      useRecommendedRefreshScope({
        accountId: 'hd-1',
        indexedAccountId: 'hd-indexed-1',
        networkId: 'onekeyall--0',
        enableFetch: true,
        recommendedTokens: [buildRecommendAsset()],
      }),
    );

    await waitFor(() => {
      expect(mockGetEarnAvailableAccounts).toHaveBeenCalledWith({
        accountId: 'hd-1',
        indexedAccountId: 'hd-indexed-1',
        networkId: 'onekeyall--0',
      });
    });

    expect(result.current.historyRefreshAccounts).toEqual([
      {
        accountId: 'hd-1',
        networkId: 'onekeyall--0',
      },
    ]);

    expect(
      result.current.shouldRefreshByAccounts([
        {
          accountId: 'acc-eth',
          networkId: 'evm--1',
        },
      ]),
    ).toBe(true);
  });
});
