import {
  SWAP_TOKEN_SELECTOR_SNAPSHOT_MAX_CHARS,
  sanitizeSwapTokenListSnapshot,
} from './swapTokenSelectorSnapshotUtils';

import type { ISwapToken } from '../../types/swap/types';

const token: ISwapToken = {
  networkId: 'evm--1',
  contractAddress: '0x1',
  name: 'Token',
  symbol: 'TOKEN',
  decimals: 18,
  balanceParsed: '1.5',
  fiatValue: '3',
  balanceMultiplier: '2',
};
const key = (networkId: string, keywords = '') =>
  JSON.stringify({ networkId, keywords });

describe('token selector persistent snapshots', () => {
  it('preserves complete token data and empty results without runtime authority', () => {
    const tokens = Array.from({ length: 201 }, () => token);
    const source = {
      version: 1,
      updatedAt: 20,
      tokenCatch: {
        [key('evm--1')]: {
          data: tokens,
          updatedAt: 10,
          identityVersion: 12,
          refreshVersion: 25,
        },
        [key('evm--2')]: { data: [], updatedAt: 20 },
      },
    };
    const result = sanitizeSwapTokenListSnapshot(source);
    expect(result.tokenCatch?.[key('evm--1')]).toEqual({
      data: tokens,
      updatedAt: 10,
      identityVersion: 0,
      persisted: true,
    });
    expect(result.tokenCatch?.[key('evm--1')].data).toHaveLength(201);
    expect(result.tokenCatch?.[key('evm--2')].data).toEqual([]);
    expect(source.tokenCatch[key('evm--1')].refreshVersion).toBe(25);
  });

  it('keeps newest complete entries and drops oversized entries without slicing tokens', () => {
    const result = sanitizeSwapTokenListSnapshot(
      {
        version: 1,
        tokenCatch: {
          [key('evm--1')]: { data: [token], updatedAt: 1 },
          [key('evm--2')]: { data: [token], updatedAt: 2 },
          [key('evm--3')]: {
            data: Array.from({ length: 100 }, () => token),
            updatedAt: 3,
          },
        },
      },
      { maxEntries: 1, maxChars: 1000 },
    );
    expect(Object.keys(result.tokenCatch ?? {})).toEqual([key('evm--2')]);
  });

  it('reuses snapshots when independent provider sources are read alternately', () => {
    const first = {
      version: 1,
      tokenCatch: { [key('evm--1')]: { data: [token], updatedAt: 1 } },
    };
    const second = {
      version: 1,
      tokenCatch: { [key('evm--2')]: { data: [token], updatedAt: 2 } },
    };
    const firstSnapshot = sanitizeSwapTokenListSnapshot(first);
    const secondSnapshot = sanitizeSwapTokenListSnapshot(second);
    expect(sanitizeSwapTokenListSnapshot(first)).toBe(firstSnapshot);
    expect(sanitizeSwapTokenListSnapshot(second)).toBe(secondSnapshot);
  });

  it('reuses unchanged entry validation and serialized sizes as chains arrive', () => {
    const firstKey = key('evm--1');
    const secondKey = key('evm--2');
    const firstEntry = { data: [{ ...token }], updatedAt: 1 };
    const secondEntry = { data: [{ ...token }], updatedAt: 2 };
    const stringify = jest.spyOn(JSON, 'stringify');
    try {
      const firstSnapshot = sanitizeSwapTokenListSnapshot({
        version: 1,
        tokenCatch: { [firstKey]: firstEntry },
      });
      const nextSnapshot = sanitizeSwapTokenListSnapshot({
        version: 1,
        tokenCatch: { [firstKey]: firstEntry, [secondKey]: secondEntry },
      });
      expect(nextSnapshot.tokenCatch?.[firstKey]).toBe(
        firstSnapshot.tokenCatch?.[firstKey],
      );
      expect(
        stringify.mock.calls.filter(
          ([value]) =>
            typeof value === 'object' &&
            value !== null &&
            'data' in value &&
            value.data === firstEntry.data,
        ),
      ).toHaveLength(1);
    } finally {
      stringify.mockRestore();
    }
  });

  it('includes the snapshot envelope in its exact serialized character budget', () => {
    const source = {
      version: 1,
      tokenCatch: {
        [key('evm--1')]: { data: [token], updatedAt: 12_345 },
        [key('evm--2')]: { data: [token], updatedAt: 23_456 },
      },
    };
    const maxChars = JSON.stringify(
      sanitizeSwapTokenListSnapshot(source, { maxEntries: 1 }),
    ).length;
    const result = sanitizeSwapTokenListSnapshot(source, { maxChars });
    expect(JSON.stringify(result)).toHaveLength(maxChars);
    expect(Object.keys(result.tokenCatch ?? {})).toEqual([key('evm--2')]);
    const tooSmall = sanitizeSwapTokenListSnapshot(source, {
      maxChars: maxChars - 1,
    });
    expect(tooSmall.tokenCatch).toEqual({});
  });

  it('retains a complete 35-chain wallet snapshot above the previous 256 KiB budget', () => {
    const tokenCatch = Object.fromEntries(
      Array.from({ length: 35 }, (_chain, chainIndex) => {
        const networkId = `evm--${chainIndex + 1}`;
        const data: ISwapToken[] = Array.from(
          { length: 15 },
          (_token, tokenIndex) => ({
            ...token,
            networkId,
            contractAddress: `0x${tokenIndex}`,
            logoURI: `https://example.com/${'a'.repeat(500)}.png`,
            freeFeeObject: {
              tag: '0 Fee',
              tokenList: Array.from({ length: 5 }, (_feeToken, index) => ({
                networkId,
                contractAddress: `0x${index}`,
                symbol: `TOKEN${index}`,
              })),
            },
          }),
        );
        return [key(networkId), { data, updatedAt: chainIndex + 1 }];
      }),
    );
    const source = { version: 1, updatedAt: 35, tokenCatch };
    expect(JSON.stringify(source).length).toBeGreaterThan(256 * 1024);
    expect(JSON.stringify(source).length).toBeLessThan(
      SWAP_TOKEN_SELECTOR_SNAPSHOT_MAX_CHARS,
    );

    const result = sanitizeSwapTokenListSnapshot(source);
    expect(Object.keys(result.tokenCatch ?? {})).toHaveLength(35);
    Object.entries(tokenCatch).forEach(([queryKey, entry]) => {
      expect(result.tokenCatch?.[queryKey]).toEqual({
        data: entry.data,
        updatedAt: entry.updatedAt,
        identityVersion: 0,
        persisted: true,
      });
    });
    expect(JSON.stringify(result).length).toBeLessThan(
      SWAP_TOKEN_SELECTOR_SNAPSHOT_MAX_CHARS,
    );
  });

  it('does not persist search, holdings-only, malformed, or unversioned lists', () => {
    const entry = { data: [token], updatedAt: 1 };
    const result = sanitizeSwapTokenListSnapshot({
      version: 1,
      tokenCatch: {
        [key('evm--1', 'eth')]: entry,
        [JSON.stringify({ networkId: 'evm--1', onlyAccountTokens: true })]:
          entry,
        invalid: entry,
        [key('evm--3')]: { data: [{}], updatedAt: 1 },
      },
    });
    expect(result.tokenCatch).toEqual({});
    expect(
      sanitizeSwapTokenListSnapshot({ tokenCatch: { [key('evm--1')]: entry } })
        .tokenCatch,
    ).toEqual({});
    expect(sanitizeSwapTokenListSnapshot(null).tokenCatch).toEqual({});
  });
});
