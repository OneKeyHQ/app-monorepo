import type { IAccountToken, ITokenFiat } from '@onekeyhq/shared/types/token';

import { mergeHomePortfolioProgressivePayload } from './homePortfolioProgressiveMerge';
import { createHomeSpotSnapshotDefaults } from './homeSpotSourceAdapter';

function createToken(
  key: string,
  symbol: string,
  networkId: string,
): IAccountToken {
  return {
    $key: key,
    accountId: 'account',
    address: key,
    decimals: 18,
    isNative: false,
    name: symbol,
    networkId,
    symbol,
  };
}

function createFiat(fiatValue: string): ITokenFiat {
  return {
    balance: '1',
    balanceParsed: '1',
    fiatValue,
    price: Number(fiatValue),
  };
}

describe('mergeHomePortfolioProgressivePayload', () => {
  it('overlays live rows while retaining cached rows outside live coverage', () => {
    const cachedToken = createToken('cached', 'CACHED', 'network-b');
    const staleCoveredToken = createToken(
      'stale-covered',
      'STALE',
      'network-a',
    );
    const updatedToken = createToken('updated', 'UPDATED', 'network-a');
    const liveToken = createToken('live', 'LIVE', 'network-a');
    const base = {
      ...createHomeSpotSnapshotDefaults(),
      accountWorthByNetwork: {
        'account_network-a': '10',
        'account_network-b': '20',
      },
      displayIds: [updatedToken.$key, staleCoveredToken.$key, cachedToken.$key],
      fundedIds: [updatedToken.$key, staleCoveredToken.$key, cachedToken.$key],
      generation: 1,
      tokenListMap: {
        [updatedToken.$key]: createFiat('10'),
        [staleCoveredToken.$key]: createFiat('5'),
        [cachedToken.$key]: createFiat('20'),
      },
      tapTokenMap: {
        [updatedToken.$key]: createFiat('10'),
        [staleCoveredToken.$key]: createFiat('5'),
        [cachedToken.$key]: createFiat('20'),
      },
      tokens: [updatedToken, staleCoveredToken, cachedToken],
    };
    const incoming = {
      ...createHomeSpotSnapshotDefaults(),
      accountWorthByNetwork: {
        'account_network-a': '31',
      },
      displayIds: [updatedToken.$key, liveToken.$key],
      fundedIds: [updatedToken.$key, liveToken.$key],
      generation: 2,
      tokenListMap: {
        [updatedToken.$key]: createFiat('30'),
        [liveToken.$key]: createFiat('1'),
      },
      tapTokenMap: {
        [updatedToken.$key]: createFiat('30'),
        [liveToken.$key]: createFiat('1'),
      },
      tokens: [updatedToken, liveToken],
    };

    const merged = mergeHomePortfolioProgressivePayload({ base, incoming });

    expect(merged.generation).toBe(2);
    expect(merged.displayIds).toEqual(['updated', 'cached', 'live']);
    expect(merged.tokens.map((token) => token.$key)).toEqual([
      'updated',
      'cached',
      'live',
    ]);
    expect(merged.tokenListMap.updated?.fiatValue).toBe('30');
    expect(merged.tokenListMap.cached?.fiatValue).toBe('20');
    expect(merged.tokenListMap['stale-covered']).toBeUndefined();
    expect(merged.accountWorthByNetwork).toEqual({
      'account_network-a': '31',
      'account_network-b': '20',
    });
  });
});
