import type { INativeHomeSpotTokenItemViewModel } from '@onekeyhq/native-components';

import {
  buildNativeHomePortfolioItemViewModel,
  buildNativeHomePortfolioViewModel,
} from './nativeHomePortfolioViewModel';

const item: INativeHomeSpotTokenItemViewModel = {
  id: 'eth',
  symbol: 'ETH',
  iconUrl: 'https://example.com/eth.png',
  networkIconUrl: '',
  priceText: '$2,500.00',
  priceChangeText: '+1.00%',
  priceChangeDirection: 'positive',
  balanceText: '1',
  valueText: '$2,500.00',
  valuationState: 'ready',
  enabled: true,
};

const copy = {
  title: 'Tokens',
  emptyText: 'No tokens',
  showMoreTitle: 'Show more',
  showLessTitle: 'Show less',
  initialVisibleItemCount: 6,
  deFiTokensFilter: {
    visible: true,
    title: 'DeFi tokens',
    selected: false,
    loading: false,
    enabled: true,
  },
  lowValueAssets: {
    visible: true,
    title: '8 Low-value assets',
    valueText: '$0.00',
    enabled: true,
  },
  riskAssets: {
    visible: true,
    title: '70 Collapsed risk assets',
    enabled: true,
  },
  manageTokens: {
    visible: true,
    instruction: "Can't find your token?",
    actionTitle: 'Add token',
    enabled: true,
  },
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

  it('formats existing token cells into the same four display fields as Legacy Home', () => {
    expect(
      buildNativeHomePortfolioItemViewModel({
        id: 'eth',
        symbol: 'ETH',
        iconUrl: 'https://example.com/eth.png',
        networkIconUrl: '',
        enabled: true,
        fiat: {
          balance: '1000000000000000000',
          balanceParsed: '1.23456',
          fiatValue: '3086.4',
          price: 2500,
          price24h: -1.25,
          currency: 'usd',
        },
        valuationSettled: true,
        hideValue: false,
        currencyMap: {
          usd: {
            id: 'usd',
            unit: '$',
            name: 'US Dollar',
            type: ['fiat'],
            value: '1',
          },
        },
        targetCurrencyId: 'usd',
        targetCurrencySymbol: '$',
      }),
    ).toMatchObject({
      priceText: '$2,500.00',
      priceChangeText: '-1.25%',
      priceChangeDirection: 'negative',
      balanceText: '1.2346',
      valueText: '$3,086.40',
      valuationState: 'ready',
    });
  });

  it('uses a stable skeleton only until an absent valuation has settled', () => {
    const base = {
      id: 'eth',
      symbol: 'ETH',
      iconUrl: '',
      networkIconUrl: '',
      enabled: true,
      fiat: undefined,
      hideValue: false,
      currencyMap: {},
      targetCurrencyId: 'usd',
      targetCurrencySymbol: '$',
    };
    expect(
      buildNativeHomePortfolioItemViewModel({
        ...base,
        valuationSettled: false,
      }).valuationState,
    ).toBe('loading');
    expect(
      buildNativeHomePortfolioItemViewModel({
        ...base,
        valuationSettled: true,
      }),
    ).toMatchObject({
      valuationState: 'ready',
      priceText: '--',
      priceChangeText: '--',
      balanceText: '',
      valueText: '',
    });
  });
});
