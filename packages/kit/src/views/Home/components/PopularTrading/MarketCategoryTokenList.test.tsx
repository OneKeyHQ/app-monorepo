/** @jest-environment jsdom */
import type { PropsWithChildren, ReactNode } from 'react';

import { fireEvent, render, screen } from '@testing-library/react';

import { MarketCategoryTokenList } from './MarketCategoryTokenList';

import type { IFavoriteTokenDisplay } from './types';

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('@onekeyhq/components', () => {
  const Stack = ({ children }: PropsWithChildren) => <div>{children}</div>;
  return {
    Stack,
    XStack: Stack,
    YStack: Stack,
    SizableText: Stack,
    useMedia: () => ({ md: false }),
    Button: ({
      children,
      onPress,
      disabled,
    }: PropsWithChildren<{ onPress?: () => void; disabled?: boolean }>) => (
      <button type="button" onClick={onPress} disabled={disabled}>
        {children}
      </button>
    ),
    IconButton: ({
      title,
      onPress,
    }: {
      title: string;
      onPress: () => void;
    }) => (
      <button type="button" onClick={onPress}>
        {title}
      </button>
    ),
  };
});
jest.mock('@onekeyhq/kit/src/components/Loading', () => ({
  ListLoading: () => null,
}));
jest.mock('./metricColumns', () => ({
  HOME_MARKET_TABLE_HEADER_MIN_HEIGHT: 0,
  HOME_MARKET_TABLE_ROW_MIN_HEIGHT: 68,
  getPopularTradingColumns: ({
    renderStarButton,
  }: {
    renderStarButton: (record: IFavoriteTokenDisplay) => ReactNode;
  }) => [{ render: renderStarButton }],
}));
const mockRichTableProps = jest.fn();
jest.mock('../RichTable', () => ({
  RichTable: (props: {
    dataSource: IFavoriteTokenDisplay[];
    columns: { render: (record: IFavoriteTokenDisplay) => ReactNode }[];
    rowProps?: { minHeight?: number };
    headerRowProps?: { minHeight?: number };
  }) => {
    mockRichTableProps(props);
    return (
      <div data-testid="category-table">
        {props.dataSource.map((record) => (
          <div key={record.symbol}>{props.columns[0].render(record)}</div>
        ))}
      </div>
    );
  },
}));

it.each([true, false])(
  'renders and toggles Home Top Coins with stable rows in table layout %p',
  (tableLayout) => {
    const record: IFavoriteTokenDisplay = {
      assetId: 'bitcoin',
      chainId: '',
      contractAddress: '',
      isNative: false,
      symbol: 'BTC',
      name: 'Bitcoin',
      logoUrl: '',
      price: 1,
      priceChange24h: 0,
      marketCap: 1,
      volume24h: 1,
      marketAsset: {
        assetId: 'bitcoin',
        symbol: 'BTC',
        logoUrl: '',
        price: '1',
        priceChange24hPercent: '0',
        priceChange7dPercent: '0',
        marketCap: '1',
        volume24h: '1',
        sparkline24h: [],
      },
    };
    const isTokenInWatchList = jest.fn(() => true);
    const onStarPress = jest.fn();
    render(
      <MarketCategoryTokenList
        tokens={[record]}
        tableLayout={tableLayout}
        isLoading={false}
        isTokenInWatchList={isTokenInWatchList}
        onStarPress={onStarPress}
        onTokenPress={jest.fn()}
        onViewMore={jest.fn()}
      />,
    );
    const star = screen.getByRole('button', {
      name: 'market.remove_from_favorites',
    });
    expect(isTokenInWatchList).toHaveBeenCalledWith(record);
    fireEvent.click(star);
    expect(onStarPress).toHaveBeenCalledWith(record);
    expect(mockRichTableProps).toHaveBeenCalledWith(
      expect.objectContaining({
        rowProps: expect.objectContaining({ minHeight: 68 }),
        ...(tableLayout
          ? { headerRowProps: expect.objectContaining({ minHeight: 0 }) }
          : {}),
      }),
    );
  },
);

it.each([true, false])(
  'keeps the footer mounted and disabled while category data loads in table layout %p',
  (tableLayout) => {
    const onViewMore = jest.fn();
    const props = {
      tableLayout,
      isTokenInWatchList: () => false,
      onStarPress: jest.fn(),
      onTokenPress: jest.fn(),
      onViewMore,
    };
    const view = render(
      <MarketCategoryTokenList {...props} tokens={[]} isLoading />,
    );
    const table = screen.getByTestId('category-table');
    const button = screen.getByRole('button', {
      name: 'global.view_more',
    }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    fireEvent.click(button);
    expect(onViewMore).not.toHaveBeenCalled();
    const token: IFavoriteTokenDisplay = {
      chainId: 'btc--0',
      contractAddress: '',
      isNative: true,
      symbol: 'BTC',
      name: 'Bitcoin',
      logoUrl: '',
      price: 1,
      priceChange24h: 0,
      marketCap: 1,
      volume24h: 1,
    };
    view.rerender(
      <MarketCategoryTokenList {...props} tokens={[token]} isLoading={false} />,
    );
    expect(screen.getByRole('button', { name: 'global.view_more' })).toBe(
      button,
    );
    expect(screen.getByTestId('category-table')).toBe(table);
    expect(button.disabled).toBe(false);
    fireEvent.click(button);
    expect(onViewMore).toHaveBeenCalledTimes(1);
  },
);
