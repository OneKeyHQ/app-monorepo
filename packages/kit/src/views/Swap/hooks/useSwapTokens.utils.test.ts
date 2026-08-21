import type { IFuseResult } from '@onekeyhq/shared/src/modules3rdParty/fuse';
import type { ISwapToken } from '@onekeyhq/shared/types/swap/types';

import {
  buildServerAuthoritativeSearchResults,
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

describe('buildServerAuthoritativeSearchResults', () => {
  it('keeps server-only alias matches while preserving local highlights', () => {
    const symbolMatchedToken = {
      networkId: 'evm--1',
      contractAddress: '0xnvda',
      symbol: 'NVDA',
      decimals: 18,
    } satisfies ISwapToken;
    const aliasMatchedToken = {
      networkId: 'evm--56',
      contractAddress: '0xaapl',
      symbol: 'AAPLx',
      decimals: 18,
      subtitles: ['Apple', '苹果'],
    } satisfies ISwapToken;
    const matches: NonNullable<IFuseResult<ISwapToken>['matches']> = [
      { indices: [[0, 3]], key: 'symbol', value: 'NVDA' },
    ];

    expect(
      buildServerAuthoritativeSearchResults(
        [symbolMatchedToken, aliasMatchedToken],
        new Map([[symbolMatchedToken, matches]]),
      ),
    ).toEqual([
      { item: symbolMatchedToken, refIndex: 0, matches },
      { item: aliasMatchedToken, refIndex: 1 },
    ]);
  });

  it('returns an empty list for empty server results', () => {
    expect(buildServerAuthoritativeSearchResults([])).toEqual([]);
  });
});
