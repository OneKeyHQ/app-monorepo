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
    Button: Stack,
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
jest.mock(
  '@onekeyhq/kit/src/views/Market/components/MarketListingStar',
  () => ({
    MarketListingStar: ({
      renderButton,
    }: {
      renderButton: (identity: {
        chainId: string;
        contractAddress: string;
        isNative: boolean;
        tokenSymbol: string;
      }) => ReactNode;
    }) =>
      renderButton({
        chainId: 'btc--0',
        contractAddress: '',
        isNative: true,
        tokenSymbol: 'BTC',
      }),
  }),
);
jest.mock('./metricColumns', () => ({
  getPopularTradingColumns: ({
    renderStarButton,
  }: {
    renderStarButton: (record: IFavoriteTokenDisplay) => ReactNode;
  }) => [{ render: renderStarButton }],
}));
jest.mock('../RichTable', () => ({
  RichTable: ({
    dataSource,
    columns,
  }: {
    dataSource: IFavoriteTokenDisplay[];
    columns: { render: (record: IFavoriteTokenDisplay) => ReactNode }[];
  }) => (
    <div>
      {dataSource.map((record) => (
        <div key={record.symbol}>{columns[0].render(record)}</div>
      ))}
    </div>
  ),
}));

it('checks and toggles Home Top Coins with the resolved native token identity', () => {
  const record: IFavoriteTokenDisplay = {
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
      tableLayout
      isLoading={false}
      isTokenInWatchList={isTokenInWatchList}
      onStarPress={onStarPress}
      onTokenPress={jest.fn()}
      onViewMore={jest.fn()}
    />,
  );
  const resolvedRecord = {
    ...record,
    marketAsset: undefined,
    chainId: 'btc--0',
    isNative: true,
  };
  expect(isTokenInWatchList).toHaveBeenCalledWith(resolvedRecord);
  fireEvent.click(
    screen.getByRole('button', { name: 'market.remove_from_favorites' }),
  );
  expect(onStarPress).toHaveBeenCalledWith(resolvedRecord);
});
