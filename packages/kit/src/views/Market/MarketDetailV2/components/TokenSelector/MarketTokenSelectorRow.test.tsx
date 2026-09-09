/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { render, screen } from '@testing-library/react';

import { MarketTokenSelectorRow } from './MarketTokenSelectorRow';

import type { IMarketToken } from '../../../MarketHomeV2/components/MarketTokenList/MarketTokenData';

jest.mock('@onekeyhq/components', () => {
  function StackComponent({
    children,
    testID,
  }: {
    children?: ReactNode;
    testID?: string;
  }) {
    return <div data-testid={testID}>{children}</div>;
  }

  return {
    Icon: () => null,
    IconButton: () => <button aria-label="favorite" type="button" />,
    NATIVE_HIT_SLOP: {},
    NumberSizeableText: ({ children }: { children?: ReactNode }) => (
      <span data-testid="number-value">{children}</span>
    ),
    SizableText: ({ children }: { children?: ReactNode }) => (
      <span>{children}</span>
    ),
    Stack: StackComponent,
    XStack: StackComponent,
    YStack: StackComponent,
    useClipboard: () => ({ copyText: jest.fn() }),
  };
});

jest.mock('@onekeyhq/kit/src/components/Token', () => ({
  Token: () => null,
}));

jest.mock('@onekeyhq/kit/src/hooks/useNetworkLogoUri', () => ({
  useNetworkLogoUri: () => undefined,
}));

jest.mock('@onekeyhq/kit/src/views/Market/testIDs', () => ({
  MarketTestIDs: {
    tokenSelectorRowStarBtn: 'token-selector-star',
    tokenRow: (symbol: string) => `token-row-${symbol}`,
  },
}));

jest.mock('@onekeyhq/shared/src/logger/scopes/dex', () => ({
  EWatchlistFrom: { Search: 'Search' },
}));

jest.mock('@onekeyhq/shared/src/utils/accountUtils', () => ({
  __esModule: true,
  default: { shortenAddress: () => '' },
}));

jest.mock('@onekeyhq/shared/src/utils/tokenUtils', () => ({
  getTokenPriceChangeStyle: () => ({
    changeColor: '$text',
    showPlusMinusSigns: false,
  }),
}));

jest.mock('../../../components/CommunityRecognizedBadge', () => ({
  CommunityRecognizedBadge: () => null,
}));

jest.mock('../../../components/MarketStarV2', () => ({
  usePerpsStarV2Checked: () => ({ checked: false, onPress: jest.fn() }),
  useStarV2Checked: () => ({ checked: false, onPress: jest.fn() }),
}));

jest.mock('../../../components/PerpsBadges', () => ({
  StockSourceLogo: () => null,
  SubtitleText: () => null,
}));

jest.mock('../../utils/marketDetailImagePreload', () => ({
  prewarmMarketTokenImages: jest.fn(),
}));

const baseItem: IMarketToken = {
  id: 'btc',
  name: 'Bitcoin',
  symbol: 'BTC',
  address: '',
  decimals: 8,
  price: 100,
  change24h: 0,
  marketCap: 1000,
  liquidity: 100,
  transactions: 10,
  uniqueTraders: 5,
  holders: 20,
  turnover: 500,
  tokenImageUri: '',
  networkLogoUri: '',
  networkId: 'coingecko',
};

const columns = {
  nameColumnWidth: '50%' as const,
  metricColumnWidth: '50%' as const,
  metrics: ['change'] as const,
};

describe('MarketTokenSelectorRow', () => {
  it('renders missing change data as unavailable', () => {
    render(
      <MarketTokenSelectorRow
        item={baseItem}
        columns={{ ...columns, metrics: [...columns.metrics] }}
        onPress={jest.fn()}
      />,
    );

    expect(screen.getByText('--')).toBeTruthy();
    expect(screen.queryByTestId('number-value')).toBeNull();
  });

  it('keeps a real zero change as numeric data', () => {
    render(
      <MarketTokenSelectorRow
        item={{ ...baseItem, priceChangeRaw: '0' }}
        columns={{ ...columns, metrics: [...columns.metrics] }}
        onPress={jest.fn()}
      />,
    );

    expect(screen.queryByText('--')).toBeNull();
    expect(screen.getByTestId('number-value').textContent).toBe('0');
  });
});
