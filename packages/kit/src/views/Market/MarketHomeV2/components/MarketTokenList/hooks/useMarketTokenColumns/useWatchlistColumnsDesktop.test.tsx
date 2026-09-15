/** @jest-environment jsdom */

import type { ReactElement } from 'react';

import { renderHook } from '@testing-library/react';

import {
  MarketPerpsStarV2,
  MarketStarV2,
} from '@onekeyhq/kit/src/views/Market/components/MarketStarV2';
import { MarketHoverRevealLine } from '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketHoverRevealLine';
import { TokenContractAddressLine } from '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketTokenAgeAddressLine';
import { MARKET_FIXED_24H_RANGE } from '@onekeyhq/kit/src/views/Market/MarketHomeV2/utils';
import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import { ETranslations } from '@onekeyhq/shared/src/locale';

import {
  WatchlistAssetIdentity,
  WatchlistPerpsIdentity,
  WatchlistStockIdentity,
  WatchlistTokenIdentity,
  WatchlistTokenSubtitle,
  getMarketWatchlistRowKind,
  useWatchlistColumnsDesktop,
} from './useWatchlistColumnsDesktop';

import type { IMarketToken } from '../../MarketTokenData';

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }, values?: Record<string, unknown>) =>
      values ? `${id}:${Object.values(values).join(',')}` : id,
  }),
}));

jest.mock('@onekeyhq/kit/src/components/Token', () => ({
  Token: () => null,
}));

jest.mock(
  '@onekeyhq/kit/src/views/Market/components/CommunityRecognizedBadge',
  () => ({ CommunityRecognizedBadge: () => null }),
);

jest.mock('@onekeyhq/kit/src/views/Market/components/MarketStarV2', () => ({
  MarketStarV2: () => null,
  MarketPerpsStarV2: () => null,
}));

jest.mock('@onekeyhq/kit/src/views/Market/components/PerpsBadges', () => ({
  LeverageBadge: () => null,
  PerpDexBadge: () => null,
  StockSourceLogo: () => null,
  SubtitleText: () => null,
}));

jest.mock(
  '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketVariantLogoGroup',
  () => ({ MarketVariantLogoGroup: () => null }),
);

const spotToken: IMarketToken = {
  id: 'token',
  name: 'Cash Cat',
  symbol: 'CASHCAT',
  address: '0x1234567890abcdef',
  decimals: 18,
  price: 0.126_55,
  change24h: 1.57,
  priceChangeRaw: '1.57',
  marketCap: 125_160_000,
  liquidity: 1,
  transactions: 1,
  uniqueTraders: 1,
  holders: 1,
  turnover: 18_760_000,
  tokenImageUri: '',
  networkLogoUri: '',
  networkId: 'evm--1',
  chainId: 'evm--1',
};

const stockListing: IMarketToken = {
  ...spotToken,
  id: 'stock:AAPL',
  stockId: 'AAPL',
  symbol: 'AAPL',
  name: 'Apple Inc.',
  address: '',
  networkId: '',
  chainId: '',
  marketCap: Number.NaN,
  stockVariants: [
    { tokenId: 'sol-aaplx', issuer: 'xStocks', logoUrl: '' },
    { tokenId: 'eth-aapl', issuer: 'Ondo', logoUrl: '' },
  ],
};

const assetListing: IMarketToken = {
  ...spotToken,
  id: 'asset:ethereum',
  assetId: 'ethereum',
  symbol: 'eth',
  name: 'Ethereum',
  address: '',
  networkId: '',
  chainId: '',
};

const perpsRow: IMarketToken = {
  ...spotToken,
  id: 'perps_ETH',
  symbol: 'ETH',
  address: '',
  networkId: '',
  chainId: '',
  perpsCoin: 'ETH',
  maxLeverage: 20,
  perpsSubtitle: 'Ethereum',
  marketCap: 0,
};

type IColumnOptions = Parameters<typeof useWatchlistColumnsDesktop>[0];

function renderColumns(options: IColumnOptions = {}) {
  return renderHook(() => useWatchlistColumnsDesktop(options)).result.current;
}

function renderCell(
  dataIndex: string,
  record: IMarketToken,
): ReactElement<{ children?: ReactElement }> {
  const column = renderColumns().find((item) => item.dataIndex === dataIndex);
  if (!column?.render) {
    throw new OneKeyLocalError(`missing column ${dataIndex}`);
  }
  return column.render(undefined as never, record, 0) as ReactElement<{
    children?: ReactElement;
  }>;
}

// Column renders are plain functions and the identity cells carry no hooks,
// so an element can be expanded in place to inspect what it would render.
function expand<T>(element: ReactElement): ReactElement<T> {
  return (element.type as (props: unknown) => ReactElement<T>)(element.props);
}

describe('getMarketWatchlistRowKind', () => {
  test.each<[string, IMarketToken]>([
    ['perps', perpsRow],
    ['token', spotToken],
    ['stock', stockListing],
    ['asset', assetListing],
    // A legacy chain favorite keeps its stored stockId next to its address.
    ['token', { ...spotToken, stockId: 'AAPL' }],
  ])('resolves %s (%#)', (kind, record) => {
    expect(getMarketWatchlistRowKind(record)).toBe(kind);
  });
});

describe('useWatchlistColumnsDesktop', () => {
  test('exposes the design column set in order', () => {
    expect(renderColumns().map((column) => column.dataIndex)).toEqual([
      'star',
      'name',
      'price',
      'change24h',
      'marketCap',
      'turnover',
    ]);
  });

  test('titles the metric columns Price / 24h change / MCap / 24h volume', () => {
    expect(
      renderColumns()
        .slice(2)
        .map((column) => column.title),
    ).toEqual([
      ETranslations.global_price,
      `${ETranslations.market_change_in_range}:${MARKET_FIXED_24H_RANGE}`,
      ETranslations.market_mcap,
      `${ETranslations.market_volume_in_range}:${MARKET_FIXED_24H_RANGE}`,
    ]);
  });

  test('drops hidden desktop columns', () => {
    expect(
      renderColumns({ hiddenDesktopColumns: ['turnover'] }).map(
        (column) => column.dataIndex,
      ),
    ).not.toContain('turnover');
  });

  test('renders every row kind with a 16px star that targets its own entity', () => {
    const star = (record: IMarketToken) =>
      renderCell('star', record).props.children as ReactElement<{
        size?: string;
        customIconSize?: string;
        assetId?: string;
        stockId?: string;
        perpsCoin?: string;
        contractAddress?: string;
      }>;

    const perpsStar = star(perpsRow);
    expect(perpsStar.type).toBe(MarketPerpsStarV2);
    expect(perpsStar.props.size).toBe('small');
    expect(perpsStar.props.customIconSize).toBe('$4');
    expect(perpsStar.props.perpsCoin).toBe('ETH');

    const spotStar = star(spotToken);
    expect(spotStar.type).toBe(MarketStarV2);
    expect(spotStar.props.size).toBe('small');
    expect(spotStar.props.customIconSize).toBe('$4');
    expect(spotStar.props.contractAddress).toBe(spotToken.address);

    expect(star(stockListing).props.stockId).toBe('AAPL');
    expect(star(assetListing).props.assetId).toBe('ethereum');
  });

  test('routes each row kind to its sibling-list identity cell', () => {
    expect(renderCell('name', perpsRow).type).toBe(WatchlistPerpsIdentity);
    expect(renderCell('name', stockListing).type).toBe(WatchlistStockIdentity);
    expect(renderCell('name', assetListing).type).toBe(WatchlistAssetIdentity);
    expect(renderCell('name', spotToken).type).toBe(WatchlistTokenIdentity);
  });

  test('stock listings show the company name and reveal the variant count on hover', () => {
    const identity = expand<{
      subtitle: ReactElement<{
        resting: ReactElement<{ children: string }>;
        revealed?: ReactElement;
      }>;
    }>(renderCell('name', stockListing));
    const line = identity.props.subtitle;

    expect(line.type).toBe(MarketHoverRevealLine);
    expect(line.props.resting.props.children).toBe('Apple Inc.');
    expect(line.props.revealed).toBeDefined();
  });

  test('stock listings without variants keep the company name alone', () => {
    const identity = expand<{
      subtitle: ReactElement<{ revealed?: ReactElement }>;
    }>(renderCell('name', { ...stockListing, stockVariants: undefined }));

    expect(identity.props.subtitle.props.revealed).toBeUndefined();
  });

  test('asset listings upper-case the symbol over the full name', () => {
    const identity = expand<{
      primary: ReactElement<{ children: string }>;
      subtitle: ReactElement<{ children: string }>;
    }>(renderCell('name', assetListing));

    expect(identity.props.primary.props.children).toBe('ETH');
    expect(identity.props.subtitle.props.children).toBe('Ethereum');
  });

  describe('spot token subtitle', () => {
    const subtitleOf = (record: IMarketToken) =>
      expand<{ subtitle: ReactElement }>(renderCell('name', record)).props
        .subtitle;

    test('shows the full name and reveals the address on hover', () => {
      const subtitle = subtitleOf(spotToken);
      expect(subtitle.type).toBe(WatchlistTokenSubtitle);

      const line = expand<{
        resting: ReactElement<{ children: string }>;
        revealed?: ReactElement<{ address: string }>;
      }>(subtitle);
      expect(line.type).toBe(MarketHoverRevealLine);
      expect(line.props.resting.props.children).toBe('Cash Cat');
      expect(line.props.revealed?.type).toBe(TokenContractAddressLine);
      expect(line.props.revealed?.props.address).toBe(spotToken.address);
    });

    test('still shows a name that repeats the symbol', () => {
      const line = expand<{ resting: ReactElement<{ children: string }> }>(
        subtitleOf({ ...spotToken, name: 'CASHCAT' }),
      );
      expect(line.type).toBe(MarketHoverRevealLine);
      expect(line.props.resting.props.children).toBe('CASHCAT');
    });

    test('lets the address take the line when the token has no name', () => {
      const line = expand<{ address: string }>(
        subtitleOf({ ...spotToken, name: '  ' }),
      );
      expect(line.type).toBe(TokenContractAddressLine);
      expect(line.props.address).toBe(spotToken.address);
    });

    test('keeps the name alone when there is no address to reveal', () => {
      const line = expand<{
        resting: ReactElement<{ children: string }>;
        revealed?: ReactElement;
      }>(subtitleOf({ ...spotToken, address: '', isNative: true }));
      expect(line.props.resting.props.children).toBe('Cash Cat');
      expect(line.props.revealed).toBeUndefined();
    });
  });

  test('formats present metrics and colors the change', () => {
    const marketCap = expand<{ children: number; formatter: string }>(
      renderCell('marketCap', spotToken),
    );
    expect(marketCap.props.children).toBe(125_160_000);
    expect(marketCap.props.formatter).toBe('marketCap');

    const change = expand<{ color: string; formatter: string }>(
      renderCell('change24h', spotToken),
    );
    expect(change.props.color).toBe('$textSuccess');
    expect(change.props.formatter).toBe('priceChangeCapped');
  });

  test('shows -- for missing metrics', () => {
    const missing = (dataIndex: string, record: IMarketToken) =>
      expand<{ children: string }>(renderCell(dataIndex, record)).props
        .children;

    expect(missing('marketCap', stockListing)).toBe('--');
    expect(missing('marketCap', perpsRow)).toBe('--');
    expect(missing('turnover', { ...spotToken, turnover: 0 })).toBe('--');
    expect(missing('price', { ...spotToken, price: Number.NaN })).toBe('--');
    expect(missing('change24h', { ...spotToken, priceChangeRaw: '-' })).toBe(
      '--',
    );
  });
});
