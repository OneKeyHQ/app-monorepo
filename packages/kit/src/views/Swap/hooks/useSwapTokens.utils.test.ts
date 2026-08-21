import type { IFuseResult } from '@onekeyhq/shared/src/modules3rdParty/fuse';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

import {
  buildSwapFuseResultList,
  releaseSwapTokenListFetchEffectKey,
} from './useSwapTokens.utils';

describe('releaseSwapTokenListFetchEffectKey', () => {
  it('releases the active key so a cancelled request can restart', () => {
    expect(
      releaseSwapTokenListFetchEffectKey({
        effectKey: 'request-1',
        latestEffectKey: 'request-1',
      }),
    ).toBe('');
  });

  it('does not release a newer request', () => {
    expect(
      releaseSwapTokenListFetchEffectKey({
        effectKey: 'request-1',
        latestEffectKey: 'request-2',
      }),
    ).toBe('request-2');
  });
});

describe('buildSwapFuseResultList', () => {
  it('wraps raw tokens in the FuseResult shape preserving order', () => {
    expect(
      buildSwapFuseResultList([{ symbol: 'NVDA' }, { symbol: 'AAPL' }]),
    ).toEqual([
      { item: { symbol: 'NVDA' }, refIndex: 0 },
      { item: { symbol: 'AAPL' }, refIndex: 1 },
    ]);
  });

  it('preserves the server subtitle-array contract for tag-only results', () => {
    const tagMatchedToken = {
      networkId: 'evm--56',
      contractAddress: '0xaapl',
      symbol: 'AAPLx',
      decimals: 18,
      subtitles: ['Apple', '苹果'],
    } satisfies ISwapToken;

    expect(buildSwapFuseResultList([tagMatchedToken])).toEqual([
      { item: tagMatchedToken, refIndex: 0 },
    ]);
  });

  it('returns an empty list for empty input', () => {
    expect(buildSwapFuseResultList([])).toEqual([]);
  });

  it('attaches symbol-keyword highlights from the fuse matches map', () => {
    const matched = { symbol: 'NVDA' };
    const tagMatched = { symbol: 'AAPLx', name: 'Apple xStock' };
    const matches: NonNullable<IFuseResult<{ symbol: string }>['matches']> = [
      { indices: [[0, 3]], key: 'symbol', value: 'NVDA' },
    ];
    expect(
      buildSwapFuseResultList(
        [matched, tagMatched],
        new Map([[matched, matches]]),
      ),
    ).toEqual([
      { item: matched, refIndex: 0, matches },
      // Tag-matched tokens (OK-60609) keep no highlight — the keyword never
      // appears verbatim in their symbol/name fields.
      { item: tagMatched, refIndex: 1 },
    ]);
  });
});
