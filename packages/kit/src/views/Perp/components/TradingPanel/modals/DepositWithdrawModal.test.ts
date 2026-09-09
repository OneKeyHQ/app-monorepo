import type { IPerpsDepositToken } from '@onekeyhq/kit-bg/src/states/jotai/atoms';

import {
  arePerpsDepositSelectedTokenRefreshFieldsEqual,
  getPerpsDepositMinimumCheck,
  getPerpsDepositTokenDisplayList,
  getPerpsDepositTokensIdentityKey,
  getPerpsDepositTokensWithDefaultFallback,
  mergePerpsDepositTokensPreservingOrder,
  shouldPreservePerpsDepositSelectedToken,
  shouldShowPerpsDepositTokenSkeleton,
} from './depositTokenDisplayUtils';

describe('getPerpsDepositMinimumCheck', () => {
  it('compares USD input directly with the fixed minimum', () => {
    expect(
      getPerpsDepositMinimumCheck({
        inputAmount: '2',
        isUsdInput: true,
        tokenPrice: '0.999',
        tokenDecimals: 6,
      }),
    ).toEqual({
      value: false,
      minFromTokenAmount: '5.005006',
    });

    expect(
      getPerpsDepositMinimumCheck({
        inputAmount: '5',
        isUsdInput: true,
        tokenPrice: '0.999',
        tokenDecimals: 6,
      }),
    ).toEqual({ value: true });
  });

  it('converts token input to fiat before checking the minimum', () => {
    expect(
      getPerpsDepositMinimumCheck({
        inputAmount: '0.002',
        isUsdInput: false,
        tokenPrice: '2000',
        tokenDecimals: 8,
      }),
    ).toEqual({
      value: false,
      minFromTokenAmount: '0.0025',
    });

    expect(
      getPerpsDepositMinimumCheck({
        inputAmount: '0.003',
        isUsdInput: false,
        tokenPrice: '2000',
        tokenDecimals: 8,
      }),
    ).toEqual({ value: true });
  });

  it('rejects inputs when the selected token price is unavailable', () => {
    expect(
      getPerpsDepositMinimumCheck({
        inputAmount: '5',
        isUsdInput: true,
        tokenPrice: undefined,
        tokenDecimals: 6,
      }),
    ).toEqual({
      value: false,
      minFromTokenAmount: '-',
    });
  });
});

const makeDepositToken = ({
  networkId,
  contractAddress,
  symbol,
  fiatValue,
}: {
  networkId: string;
  contractAddress: string;
  symbol: string;
  fiatValue?: string;
}): IPerpsDepositToken => ({
  networkId,
  contractAddress,
  symbol,
  name: symbol,
  decimals: 18,
  networkLogoURI: `${networkId}.png`,
  fiatValue,
});

describe('getPerpsDepositTokenDisplayList', () => {
  it('sorts flattened token maps by fiat value instead of network insertion order', () => {
    const eth = makeDepositToken({
      networkId: 'evm--1',
      contractAddress: '',
      symbol: 'ETH',
      fiatValue: '0',
    });
    const pol = makeDepositToken({
      networkId: 'evm--137',
      contractAddress: '',
      symbol: 'POL',
      fiatValue: '0.07',
    });
    const usdc = makeDepositToken({
      networkId: 'evm--42161',
      contractAddress: '0xaf88d065e77c8cc2239327c5edb3a432268e5831',
      symbol: 'USDC',
      fiatValue: '0.01',
    });

    const result = getPerpsDepositTokenDisplayList({
      'evm--1': [eth],
      'evm--137': [pol],
      'evm--42161': [usdc],
    });

    expect(result.map((token) => token.symbol)).toEqual(['POL', 'USDC', 'ETH']);
  });
});

describe('getPerpsDepositTokensWithDefaultFallback', () => {
  it('keeps a server default token selectable for an empty wallet', () => {
    const defaultToken = makeDepositToken({
      networkId: 'evm--42161',
      contractAddress: '0xaf88d065e77c8cc2239327c5edb3a432268e5831',
      symbol: 'USDC',
    });

    expect(
      getPerpsDepositTokensWithDefaultFallback({
        walletTokens: [],
        defaultTokens: [defaultToken],
      }),
    ).toEqual([defaultToken]);
  });
});

describe('getPerpsDepositTokensIdentityKey', () => {
  it('keeps the balance-fetch dependency stable across cloned atom values', () => {
    const defaultTokens = [
      makeDepositToken({
        networkId: 'evm--42161',
        contractAddress: '0xAF88D065E77C8CC2239327C5EDB3A432268E5831',
        symbol: 'USDC',
      }),
      makeDepositToken({
        networkId: 'evm--1',
        contractAddress: '',
        symbol: 'ETH',
      }),
    ];

    expect(getPerpsDepositTokensIdentityKey(defaultTokens)).toBe(
      getPerpsDepositTokensIdentityKey(
        defaultTokens.map((token) => ({ ...token })),
      ),
    );
  });

  it('changes when the fallback token identities change', () => {
    const usdc = makeDepositToken({
      networkId: 'evm--42161',
      contractAddress: '0xaf88d065e77c8cc2239327c5edb3a432268e5831',
      symbol: 'USDC',
    });

    expect(getPerpsDepositTokensIdentityKey([usdc])).not.toBe(
      getPerpsDepositTokensIdentityKey([
        {
          ...usdc,
          contractAddress: '0xff970a61a04b1ca14834a43f5de4533ebddb5cc8',
        },
      ]),
    );
  });
});

describe('shouldPreservePerpsDepositSelectedToken', () => {
  it('does not preserve an empty-wallet fallback after live wallet tokens arrive', () => {
    const fallbackUsdc = makeDepositToken({
      networkId: 'evm--42161',
      contractAddress: '0xaf88d065e77c8cc2239327c5edb3a432268e5831',
      symbol: 'USDC',
    });
    const liveEth = makeDepositToken({
      networkId: 'evm--1',
      contractAddress: '',
      symbol: 'ETH',
      fiatValue: '100',
    });

    expect(
      shouldPreservePerpsDepositSelectedToken({
        depositTokenListSource: 'walletBalance',
        currentToken: fallbackUsdc,
        tokens: [liveEth],
      }),
    ).toBe(false);
  });
});

describe('mergePerpsDepositTokensPreservingOrder', () => {
  it('uses the refreshed wallet order when live tokens include fiat values', () => {
    const eth = makeDepositToken({
      networkId: 'evm--1',
      contractAddress: '',
      symbol: 'ETH',
      fiatValue: '0',
    });
    const usdt = makeDepositToken({
      networkId: 'evm--10',
      contractAddress: '0xusdt',
      symbol: 'USDT',
      fiatValue: '0',
    });
    const pol = makeDepositToken({
      networkId: 'evm--137',
      contractAddress: '',
      symbol: 'POL',
      fiatValue: '0.07',
    });

    const result = mergePerpsDepositTokensPreservingOrder({
      currentTokens: [eth, usdt, pol],
      nextTokens: [pol, eth, usdt],
    });

    expect(result.map((token) => token.symbol)).toEqual(['POL', 'ETH', 'USDT']);
  });

  it('keeps current order while refreshed tokens do not include fiat values', () => {
    const eth = makeDepositToken({
      networkId: 'evm--1',
      contractAddress: '',
      symbol: 'ETH',
    });
    const usdt = makeDepositToken({
      networkId: 'evm--10',
      contractAddress: '0xusdt',
      symbol: 'USDT',
    });
    const pol = makeDepositToken({
      networkId: 'evm--137',
      contractAddress: '',
      symbol: 'POL',
    });

    const result = mergePerpsDepositTokensPreservingOrder({
      currentTokens: [eth, usdt, pol],
      nextTokens: [pol, eth, usdt],
    });

    expect(result.map((token) => token.symbol)).toEqual(['ETH', 'USDT', 'POL']);
  });
});

describe('shouldShowPerpsDepositTokenSkeleton', () => {
  it('shows skeleton while a deposit token list has no cached wallet data yet', () => {
    expect(
      shouldShowPerpsDepositTokenSkeleton({
        selectedAction: 'deposit',
        checkAccountSupport: true,
        hasLoadedDepositTokenBalances: false,
        depositTokensWithPriceLength: 0,
        hasDisplayDepositToken: false,
      }),
    ).toBe(true);
  });

  it('does not show skeleton once there is cached wallet data to render', () => {
    expect(
      shouldShowPerpsDepositTokenSkeleton({
        selectedAction: 'deposit',
        checkAccountSupport: true,
        hasLoadedDepositTokenBalances: false,
        depositTokensWithPriceLength: 1,
        hasDisplayDepositToken: true,
      }),
    ).toBe(false);
  });

  it('does not show skeleton when a selected token can already be rendered', () => {
    expect(
      shouldShowPerpsDepositTokenSkeleton({
        selectedAction: 'deposit',
        checkAccountSupport: true,
        hasLoadedDepositTokenBalances: false,
        depositTokensWithPriceLength: 0,
        hasDisplayDepositToken: true,
      }),
    ).toBe(false);
  });

  it('does not show skeleton for unsupported accounts or non-deposit actions', () => {
    expect(
      shouldShowPerpsDepositTokenSkeleton({
        selectedAction: 'withdraw',
        checkAccountSupport: true,
        hasLoadedDepositTokenBalances: false,
        depositTokensWithPriceLength: 0,
        hasDisplayDepositToken: false,
      }),
    ).toBe(false);
    expect(
      shouldShowPerpsDepositTokenSkeleton({
        selectedAction: 'deposit',
        checkAccountSupport: false,
        hasLoadedDepositTokenBalances: false,
        depositTokensWithPriceLength: 0,
        hasDisplayDepositToken: false,
      }),
    ).toBe(false);
  });
});

describe('arePerpsDepositSelectedTokenRefreshFieldsEqual', () => {
  it('treats matching selected-token refresh fields as unchanged', () => {
    const currentToken = makeDepositToken({
      networkId: 'evm--42161',
      contractAddress: '0xAF88D065E77C8CC2239327C5EDB3A432268E5831',
      symbol: 'USDC',
      fiatValue: '50.04',
    });
    const nextToken: IPerpsDepositToken = {
      ...currentToken,
      contractAddress: '0xaf88d065e77c8cc2239327c5edb3a432268e5831',
    };

    expect(
      arePerpsDepositSelectedTokenRefreshFieldsEqual({
        currentToken,
        nextToken,
      }),
    ).toBe(true);
  });

  it('keeps balance and price refreshes observable', () => {
    const currentToken = makeDepositToken({
      networkId: 'evm--42161',
      contractAddress: '0xaf88d065e77c8cc2239327c5edb3a432268e5831',
      symbol: 'USDC',
      fiatValue: '50.04',
    });
    const nextToken: IPerpsDepositToken = {
      ...currentToken,
      balanceParsed: '50.051477',
      price: '0.999825',
    };

    expect(
      arePerpsDepositSelectedTokenRefreshFieldsEqual({
        currentToken,
        nextToken,
      }),
    ).toBe(false);
  });
});
