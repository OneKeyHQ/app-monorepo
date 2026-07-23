import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';
import type { IAccountToken } from '@onekeyhq/shared/types/token';

import {
  buildTokenActionSwapFromToken,
  findTokenActionAggregateKey,
  getResolvedTokenActionToken,
  getTokenActionSameNetworkSwapToToken,
  getTokenActionSwapToToken,
  isResolvedTokenActionReady,
} from './TokenActionsView.utils';

function buildAccountToken(
  overrides: Partial<IAccountToken> = {},
): IAccountToken {
  return {
    $key: 'btc-token',
    address: '',
    decimals: 8,
    isNative: true,
    name: 'Bitcoin',
    networkId: 'btc--0',
    symbol: 'BTC',
    ...overrides,
  };
}

function buildSwapToken(overrides: Partial<ISwapToken> = {}): ISwapToken {
  return {
    contractAddress: '',
    decimals: 8,
    isNative: true,
    name: 'Bitcoin',
    networkId: 'btc--0',
    symbol: 'BTC',
    ...overrides,
  };
}

describe('getResolvedTokenActionToken', () => {
  it('keeps an aggregate action disabled until a concrete member is resolved', () => {
    const aggregateToken = buildAccountToken({
      $key: 'aggregate_BTC_',
      address: 'aggregate_BTC_',
      isAggregateToken: true,
      networkId: 'aggregate--0',
    });

    expect(
      getResolvedTokenActionToken({
        token: aggregateToken,
        activeToken: aggregateToken,
        aggregateTokens: [buildAccountToken()],
      }),
    ).toBeUndefined();
  });

  it('returns the concrete member selected for the current aggregate row', () => {
    const aggregateToken = buildAccountToken({
      $key: 'aggregate_BTC_',
      address: 'aggregate_BTC_',
      isAggregateToken: true,
      networkId: 'aggregate--0',
    });
    const resolvedToken = buildAccountToken();

    expect(
      getResolvedTokenActionToken({
        token: aggregateToken,
        activeToken: resolvedToken,
        aggregateTokens: [resolvedToken],
      }),
    ).toBe(resolvedToken);
  });

  it('rejects a stale member from another aggregate row', () => {
    const aggregateToken = buildAccountToken({
      $key: 'aggregate_BTC_',
      address: 'aggregate_BTC_',
      isAggregateToken: true,
      networkId: 'aggregate--0',
    });

    expect(
      getResolvedTokenActionToken({
        token: aggregateToken,
        activeToken: buildAccountToken({ $key: 'stale-token' }),
        aggregateTokens: [buildAccountToken()],
      }),
    ).toBeUndefined();
  });

  it('returns fresh metadata when the current aggregate member keeps the same key', () => {
    const aggregateToken = buildAccountToken({
      $key: 'aggregate_BTC_',
      address: 'aggregate_BTC_',
      isAggregateToken: true,
      networkId: 'aggregate--0',
    });
    const staleToken = buildAccountToken({
      accountId: 'stale-account',
    });
    const currentToken = buildAccountToken({
      accountId: 'current-account',
    });

    expect(
      getResolvedTokenActionToken({
        token: aggregateToken,
        activeToken: staleToken,
        aggregateTokens: [currentToken],
      }),
    ).toBe(currentToken);
  });
});

describe('isResolvedTokenActionReady', () => {
  const aggregateToken = buildAccountToken({
    $key: 'aggregate_BTC_',
    address: 'aggregate_BTC_',
    isAggregateToken: true,
    networkId: 'aggregate--0',
  });
  const resolvedToken = buildAccountToken({
    accountId: 'btc-account',
  });

  it('waits for account metadata from the resolved aggregate member', () => {
    expect(
      isResolvedTokenActionReady({
        token: aggregateToken,
        resolvedToken,
        resolvedAccountId: 'stale-account',
        resolvedNetworkId: resolvedToken.networkId,
      }),
    ).toBe(false);
  });

  it('waits for network metadata from the resolved aggregate member', () => {
    expect(
      isResolvedTokenActionReady({
        token: aggregateToken,
        resolvedToken,
        resolvedAccountId: resolvedToken.accountId,
        resolvedNetworkId: 'evm--1',
      }),
    ).toBe(false);
  });

  it('enables an aggregate action after token and account metadata match', () => {
    expect(
      isResolvedTokenActionReady({
        token: aggregateToken,
        resolvedToken,
        resolvedAccountId: resolvedToken.accountId,
        resolvedNetworkId: resolvedToken.networkId,
      }),
    ).toBe(true);
  });

  it('preserves the existing readiness behavior for a concrete token', () => {
    expect(
      isResolvedTokenActionReady({
        token: resolvedToken,
        resolvedToken,
      }),
    ).toBe(true);
  });
});

describe('getTokenActionSwapToToken', () => {
  it('normalizes the native address used by Home before resolving BTC to ETH', () => {
    const fromToken = buildTokenActionSwapFromToken({
      token: buildAccountToken({ address: 'native' }),
      networkId: 'btc--0',
    });

    expect(fromToken.contractAddress).toBe('');
    expect(
      getTokenActionSwapToToken({
        fromToken,
        swapSupport: {
          isSupportCrossChain: true,
          isSupportSwap: true,
        },
      }),
    ).toEqual(expect.objectContaining({ networkId: 'evm--1', symbol: 'ETH' }));
  });

  it.each([
    undefined,
    { isSupportCrossChain: true, isSupportSwap: false },
    { isSupportCrossChain: true, isSupportSwap: true },
  ])(
    'keeps the BTC to ETH handoff deterministic for support %p',
    (swapSupport) => {
      expect(
        getTokenActionSwapToToken({
          fromToken: buildSwapToken(),
          swapSupport,
        }),
      ).toEqual(
        expect.objectContaining({ networkId: 'evm--1', symbol: 'ETH' }),
      );
    },
  );

  it('uses the same-network default pair for an ordinary supported token', () => {
    expect(
      getTokenActionSwapToToken({
        fromToken: buildSwapToken({
          decimals: 18,
          name: 'Ethereum',
          networkId: 'evm--1',
          symbol: 'ETH',
        }),
        swapSupport: {
          isSupportCrossChain: true,
          isSupportSwap: true,
        },
      }),
    ).toEqual(expect.objectContaining({ networkId: 'evm--1', symbol: 'USDC' }));
  });

  it('selects the native default when Home opens Swap from the default target', () => {
    expect(
      getTokenActionSameNetworkSwapToToken({
        fromToken: buildSwapToken({
          contractAddress: '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
          decimals: 18,
          isNative: false,
          name: 'USD Coin',
          networkId: 'evm--56',
          symbol: 'USDC',
        }),
      }),
    ).toEqual(
      expect.objectContaining({
        isNative: true,
        networkId: 'evm--56',
        symbol: 'BNB',
      }),
    );
  });

  it('selects the native default for another non-native same-network token', () => {
    expect(
      getTokenActionSameNetworkSwapToToken({
        fromToken: buildSwapToken({
          contractAddress: '0x55d398326f99059ff775485246999027b3197955',
          decimals: 18,
          isNative: false,
          name: 'Tether',
          networkId: 'evm--56',
          symbol: 'USDT',
        }),
      }),
    ).toEqual(
      expect.objectContaining({
        isNative: true,
        networkId: 'evm--56',
        symbol: 'BNB',
      }),
    );
  });

  it('uses the bridge default for a cross-chain-only ordinary token', () => {
    expect(
      getTokenActionSwapToToken({
        fromToken: buildSwapToken({
          decimals: 9,
          name: 'Solana',
          networkId: 'sol--101',
          symbol: 'SOL',
        }),
        swapSupport: {
          isSupportCrossChain: true,
          isSupportSwap: false,
        },
      }),
    ).toEqual(expect.objectContaining({ networkId: 'evm--1', symbol: 'ETH' }));
  });
});

describe('findTokenActionAggregateKey', () => {
  it('finds the network-scoped member behind an aggregate Home token', () => {
    expect(
      findTokenActionAggregateKey({
        ownedAggregateTokenListMap: {
          aggregate_USDC_: {
            tokens: [
              buildAccountToken({
                $key: 'bsc-usdc',
                address: '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
                isNative: false,
                networkId: 'evm--56',
                symbol: 'USDC',
              }),
            ],
          },
        },
        targetToken: buildSwapToken({
          contractAddress: '0x8AC76A51CC950D9822D68B83FE1AD97B32CD580D',
          isNative: false,
          networkId: 'evm--56',
          symbol: 'USDC',
        }),
      }),
    ).toBe('aggregate_USDC_');
  });
});
