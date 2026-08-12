import type { INativeHomePortfolioItemViewModel } from '@onekeyhq/native-components';

import { buildNativeHomePortfolioViewModel } from './nativeHomePortfolioViewModel';

const item: INativeHomePortfolioItemViewModel = {
  id: 'eth',
  symbol: 'ETH',
  iconUrl: 'https://example.com/eth.png',
  networkIconUrl: '',
  enabled: true,
};

const copy = {
  title: 'Tokens',
  emptyText: 'No tokens',
};

describe('Native Home Portfolio ViewModel', () => {
  it('drops rows immediately when the structure belongs to another owner', () => {
    expect(
      buildNativeHomePortfolioViewModel({
        ...copy,
        ownerMatches: false,
        generation: 1,
        sourceItemCount: 1,
        items: [item],
      }),
    ).toMatchObject({ state: 'initialLoading', items: [] });
  });

  it('publishes resolved metadata and preserves stable item identifiers', () => {
    expect(
      buildNativeHomePortfolioViewModel({
        ...copy,
        ownerMatches: true,
        generation: 2,
        sourceItemCount: 1,
        items: [item],
      }),
    ).toMatchObject({
      state: 'ready',
      items: [{ id: 'eth' }],
    });
  });

  it('publishes an empty state only after the current structure resolves', () => {
    expect(
      buildNativeHomePortfolioViewModel({
        ...copy,
        ownerMatches: true,
        generation: 0,
        sourceItemCount: 0,
        items: [],
      }),
    ).toMatchObject({ state: 'empty', items: [] });
  });
});
