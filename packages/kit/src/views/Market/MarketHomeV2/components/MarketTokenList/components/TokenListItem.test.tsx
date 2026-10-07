/** @jest-environment jsdom */
import type { PropsWithChildren } from 'react';

import { render, screen } from '@testing-library/react';

import { TokenListItem } from './TokenListItem';

import type { IMarketToken } from '../MarketTokenData';

jest.mock('@onekeyhq/components', () => ({
  NumberSizeableText: ({ children }: PropsWithChildren) => (
    <span>{children}</span>
  ),
  XStack: ({
    children,
    height,
    gap,
    testID,
  }: PropsWithChildren<{ height?: number; gap?: string; testID?: string }>) => (
    <div data-testid={testID} data-height={height} data-gap={gap}>
      {children}
    </div>
  ),
  useMedia: () => ({ gtLg: false }),
  useThemeName: () => 'light',
}));

jest.mock(
  '@onekeyhq/kit/src/views/Market/MarketDetailV2/utils/marketDetailImagePreload',
  () => ({ prewarmMarketTokenImages: jest.fn() }),
);

jest.mock(
  '@onekeyhq/kit/src/views/Market/MarketDetailV2/utils/marketDetailPagePreload',
  () => ({ preloadMarketDetailV2Page: jest.fn() }),
);

jest.mock('../../PriceChangeBadge', () => ({
  PriceChangeBadge: () => null,
}));

const mockIdentityProps = jest.fn<null, [{ stockListingName?: string }]>(
  () => null,
);
jest.mock('./TokenIdentityItem', () => ({
  TokenIdentityItem: (props: { stockListingName?: string }) =>
    mockIdentityProps(props),
}));

const listing: IMarketToken = {
  id: 'stock:AAPL',
  stockId: 'AAPL',
  name: 'Apple',
  symbol: 'AAPL',
  address: '',
  decimals: 0,
  price: Number.NaN,
  change24h: Number.NaN,
  priceChangeRaw: '-',
  marketCap: Number.NaN,
  liquidity: 0,
  transactions: 0,
  uniqueTraders: 0,
  holders: 0,
  turnover: Number.NaN,
  tokenImageUri: '',
  networkLogoUri: '',
  networkId: '',
};

describe('TokenListItem', () => {
  test('keeps a fixed row height while a listing quote is still loading', () => {
    render(<TokenListItem item={listing} onPress={jest.fn()} />);

    expect(
      screen.getByTestId('market-token-item-AAPL').getAttribute('data-height'),
    ).toBe('72');
  });

  test('keeps 8px between the name block and the price', () => {
    render(<TokenListItem item={listing} onPress={jest.fn()} />);

    expect(
      screen.getByTestId('market-token-item-AAPL').getAttribute('data-gap'),
    ).toBe('$2');
  });

  test('names a stock listing by its company on the second line', () => {
    render(<TokenListItem item={listing} onPress={jest.fn()} />);

    expect(mockIdentityProps).toHaveBeenLastCalledWith(
      expect.objectContaining({ stockListingName: 'Apple' }),
    );
  });

  test.each<[string, IMarketToken]>([
    [
      'an asset listing',
      {
        ...listing,
        id: 'asset:bitcoin',
        stockId: undefined,
        assetId: 'bitcoin',
      },
    ],
    [
      'an on-chain token',
      { ...listing, id: 'evm--1:0x1', stockId: undefined, networkId: 'evm--1' },
    ],
  ])('adds no company name to %s', (_label, item) => {
    render(<TokenListItem item={item} onPress={jest.fn()} />);

    expect(mockIdentityProps).toHaveBeenLastCalledWith(
      expect.objectContaining({ stockListingName: undefined }),
    );
  });
});
