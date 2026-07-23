import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

import {
  EMPTY_SWAP_PRO_POSITIONS_CACHE,
  type ISwapProPositionsCache,
  SWAP_PRO_POSITIONS_CACHE_MAX_BYTES,
  SWAP_PRO_POSITIONS_CACHE_MAX_TOKENS_PER_OWNER,
  SWAP_PRO_POSITIONS_CACHE_MAX_TOTAL_TOKENS,
  SWAP_PRO_POSITIONS_CACHE_TTL_MS,
  SWAP_PRO_POSITIONS_CACHE_VERSION,
  getValidSwapProPositionsCache,
  shouldReuseSwapProPositionsCache,
  upsertSwapProPositionsCacheEntry,
} from './swapProPositionsCacheUtils';

const cacheEntry = {
  ownerKey: 'account-1__evm--1__usd',
  networkIdsKey: 'evm--1',
  currencyId: 'usd',
  tokens: [],
  updatedAt: 1000,
};

function buildToken(index: number, owner = 'owner'): ISwapToken {
  return {
    networkId: 'evm--1',
    contractAddress: `0x${owner}-${index}`,
    symbol: `TOKEN-${index}`,
    decimals: 18,
    balanceParsed: `${index}`,
    fiatValue: `${index}`,
  };
}

describe('swapProPositionsCacheUtils', () => {
  it('reuses a fresh cache for the same owner', () => {
    expect(
      shouldReuseSwapProPositionsCache({
        cacheEntry,
        now: 1000 + SWAP_PRO_POSITIONS_CACHE_TTL_MS - 1,
        ownerKey: cacheEntry.ownerKey,
      }),
    ).toBe(true);
  });

  it('refreshes an expired cache and an explicitly refreshed cache', () => {
    expect(
      shouldReuseSwapProPositionsCache({
        cacheEntry,
        now: 1000 + SWAP_PRO_POSITIONS_CACHE_TTL_MS,
        ownerKey: cacheEntry.ownerKey,
      }),
    ).toBe(false);
    expect(
      shouldReuseSwapProPositionsCache({
        cacheEntry,
        forceRefresh: true,
        now: 1001,
        ownerKey: cacheEntry.ownerKey,
      }),
    ).toBe(false);
  });

  it('never reuses another account owner cache', () => {
    expect(
      shouldReuseSwapProPositionsCache({
        cacheEntry,
        now: 1001,
        ownerKey: 'account-2__evm--1__usd',
      }),
    ).toBe(false);
  });

  it('persists only display fields and never carries cached Stock classification', () => {
    const token = {
      ...buildToken(1),
      accountAddress: '0xprivate-owner-address',
      isStock: true,
      supportProtocol: true,
      freeFeeObject: {
        tag: 'large-runtime-metadata',
        tokenList: [
          {
            networkId: 'evm--1',
            contractAddress: '0xfee',
            symbol: 'FEE',
          },
        ],
      },
    };
    const cache = upsertSwapProPositionsCacheEntry({
      cache: EMPTY_SWAP_PRO_POSITIONS_CACHE,
      entry: {
        ownerKey: 'owner',
        networkIdsKey: 'evm--1',
        currencyId: 'usd',
        tokens: [token],
        updatedAt: 1,
      },
    });
    const cachedToken = cache.byOwner.owner.tokens[0];

    expect(cachedToken).toMatchObject({
      networkId: token.networkId,
      contractAddress: token.contractAddress,
      symbol: token.symbol,
      decimals: token.decimals,
      balanceParsed: token.balanceParsed,
      fiatValue: token.fiatValue,
    });
    expect(cachedToken).not.toHaveProperty('isStock');
    expect(cachedToken).not.toHaveProperty('supportProtocol');
    expect(cachedToken).not.toHaveProperty('freeFeeObject');
    expect(cachedToken).not.toHaveProperty('accountAddress');
  });

  it('keeps only the highest-value tokens within each owner cap', () => {
    const tokens = Array.from(
      { length: SWAP_PRO_POSITIONS_CACHE_MAX_TOKENS_PER_OWNER + 5 },
      (_, index) => buildToken(index),
    );
    const cache = upsertSwapProPositionsCacheEntry({
      cache: EMPTY_SWAP_PRO_POSITIONS_CACHE,
      entry: {
        ownerKey: 'owner',
        networkIdsKey: 'evm--1',
        currencyId: 'usd',
        tokens,
        updatedAt: 1,
      },
    });
    const cachedTokens = cache.byOwner.owner.tokens;

    expect(cachedTokens).toHaveLength(
      SWAP_PRO_POSITIONS_CACHE_MAX_TOKENS_PER_OWNER,
    );
    expect(cachedTokens[0].fiatValue).toBe(
      `${SWAP_PRO_POSITIONS_CACHE_MAX_TOKENS_PER_OWNER + 4}`,
    );
    expect(cachedTokens.at(-1)?.fiatValue).toBe('5');
    expect(tokens).toHaveLength(
      SWAP_PRO_POSITIONS_CACHE_MAX_TOKENS_PER_OWNER + 5,
    );
  });

  it('keeps the newest owners within the total token cap', () => {
    const tokensPerOwner = SWAP_PRO_POSITIONS_CACHE_MAX_TOKENS_PER_OWNER;
    const ownerCount =
      Math.floor(SWAP_PRO_POSITIONS_CACHE_MAX_TOTAL_TOKENS / tokensPerOwner) +
      1;
    let cache: ISwapProPositionsCache = {
      ...EMPTY_SWAP_PRO_POSITIONS_CACHE,
    };

    for (let ownerIndex = 0; ownerIndex < ownerCount; ownerIndex += 1) {
      cache = upsertSwapProPositionsCacheEntry({
        cache,
        entry: {
          ownerKey: `owner-${ownerIndex}`,
          networkIdsKey: 'evm--1',
          currencyId: 'usd',
          tokens: Array.from({ length: tokensPerOwner }, (_, tokenIndex) =>
            buildToken(tokenIndex, `owner-${ownerIndex}`),
          ),
          updatedAt: ownerIndex + 1,
        },
      });
    }

    expect(cache.byOwner['owner-0']).toBeUndefined();
    expect(
      Object.values(cache.byOwner).reduce(
        (total, entry) => total + entry.tokens.length,
        0,
      ),
    ).toBeLessThanOrEqual(SWAP_PRO_POSITIONS_CACHE_MAX_TOTAL_TOKENS);
  });

  it('drops an oversized display token without mutating the runtime token', () => {
    const token = {
      ...buildToken(1),
      logoURI: `https://example.com/${'界'.repeat(
        SWAP_PRO_POSITIONS_CACHE_MAX_BYTES,
      )}`,
    };
    const cache = upsertSwapProPositionsCacheEntry({
      cache: EMPTY_SWAP_PRO_POSITIONS_CACHE,
      entry: {
        ownerKey: 'owner',
        networkIdsKey: 'evm--1',
        currencyId: 'usd',
        tokens: [token],
        updatedAt: 1,
      },
    });

    expect(cache.byOwner.owner).toBeUndefined();
    expect(new TextEncoder().encode(token.logoURI).byteLength).toBeGreaterThan(
      SWAP_PRO_POSITIONS_CACHE_MAX_BYTES,
    );
  });

  it('fails closed instead of hydrating an unsupported cache schema', () => {
    const unsupportedCache = {
      version: SWAP_PRO_POSITIONS_CACHE_VERSION + 1,
      byOwner: {
        old: {
          ...cacheEntry,
          ownerKey: 'old',
          tokens: [buildToken(1)],
        },
      },
    };

    expect(getValidSwapProPositionsCache(unsupportedCache)).toBe(
      EMPTY_SWAP_PRO_POSITIONS_CACHE,
    );

    const cache = upsertSwapProPositionsCacheEntry({
      cache: unsupportedCache,
      entry: {
        ...cacheEntry,
        ownerKey: 'current',
        tokens: [buildToken(2)],
      },
    });

    expect(cache.version).toBe(SWAP_PRO_POSITIONS_CACHE_VERSION);
    expect(cache.byOwner.old).toBeUndefined();
    expect(cache.byOwner.current.tokens).toHaveLength(1);
  });
});
