/** @jest-environment jsdom */
import type { PropsWithChildren, ReactNode } from 'react';

import { act, fireEvent, render, screen } from '@testing-library/react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';

import { MarketCategoryTokenList } from './MarketCategoryTokenList';

import type { IFavoriteTokenDisplay } from './types';
import type { GestureResponderEvent, PressableProps } from 'react-native';

type IHomeTokenNavigationEvent = { stage: string; symbol?: string };
const mockHomeTokenNavigation = jest.fn<void, [IHomeTokenNavigationEvent]>();
const mockPressableProps = jest.fn<void, [PressableProps]>();

jest.mock('react-native', () => ({
  Pressable: (props: PropsWithChildren<PressableProps>) => {
    mockPressableProps(props);
    return <div data-testid="native-pressable">{props.children}</div>;
  },
}));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: true },
}));
jest.mock('@onekeyhq/shared/src/style', () => ({
  listItemPressStyle: {},
}));
jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    market: {
      navigation: {
        homeTokenNavigation: (params: IHomeTokenNavigationEvent) => {
          mockHomeTokenNavigation(params);
        },
      },
    },
  },
}));
jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));
jest.mock('@onekeyhq/components', () => {
  const Stack = ({
    children,
    testID,
    minHeight,
    bg,
  }: PropsWithChildren<{
    testID?: string;
    minHeight?: number;
    bg?: string;
  }>) => (
    <div data-testid={testID} data-min-height={minHeight} data-bg={bg}>
      {children}
    </div>
  );
  return {
    Stack,
    XStack: Stack,
    YStack: Stack,
    SizableText: Stack,
    Skeleton: () => <div data-testid="skeleton" />,
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
jest.mock('./metricColumns', () => ({
  HOME_MARKET_TABLE_HEADER_MIN_HEIGHT: 0,
  HOME_MARKET_TABLE_ROW_MIN_HEIGHT: 68,
  getPopularTradingColumns: ({
    renderStarButton,
  }: {
    renderStarButton: (record: IFavoriteTokenDisplay) => ReactNode;
  }) => [
    {
      dataIndex: 'symbol',
      title: 'global.name',
      render: (_: unknown, record: IFavoriteTokenDisplay) =>
        renderStarButton(record),
      renderSkeleton: () => <div data-testid="skeleton" />,
    },
  ],
  renderPopularTradingTokenIdentity: (record: IFavoriteTokenDisplay) => (
    <span>{record.symbol}</span>
  ),
  renderPopularTradingPriceWithChange: (record: IFavoriteTokenDisplay) => (
    <span>{record.price}</span>
  ),
}));

const event = {} as GestureResponderEvent;

beforeEach(() => {
  jest.clearAllMocks();
  jest.replaceProperty(platformEnv, 'isNative', true);
});

afterEach(() => {
  jest.useRealTimers();
});

it('logs press notifications without registering a business long press or navigating early', () => {
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
  const onTokenPress = jest.fn();
  render(
    <MarketCategoryTokenList
      tokens={[token]}
      isLoading={false}
      isTokenInWatchList={() => false}
      onStarPress={jest.fn()}
      onTokenPress={onTokenPress}
      onViewMore={jest.fn()}
    />,
  );
  const row = mockPressableProps.mock.calls.at(-1)?.[0];
  expect(row?.onLongPress).toBeUndefined();
  act(() => {
    row?.onPressIn?.(event);
  });
  expect(
    screen.getByTestId('category-table').querySelector('[data-bg="$bgActive"]'),
  ).toBeTruthy();
  act(() => {
    row?.onPressOut?.(event);
  });
  expect(
    screen.getByTestId('category-table').querySelector('[data-bg="$bgActive"]'),
  ).toBeNull();
  expect(mockHomeTokenNavigation.mock.calls.map(([params]) => params)).toEqual([
    { stage: 'pressIn', symbol: 'BTC' },
    { stage: 'pressOut', symbol: 'BTC' },
  ]);
  expect(onTokenPress).not.toHaveBeenCalled();
  act(() => {
    row?.onPress?.(event);
  });
  expect(onTokenPress).toHaveBeenCalledTimes(1);
  expect(onTokenPress).toHaveBeenCalledWith(token);
});

it('clears a pressed highlight when a follow-up scroll touch or category change occurs before pressOut (OK-67475)', () => {
  jest.useFakeTimers();
  const solToken: IFavoriteTokenDisplay = {
    chainId: 'sol--101',
    contractAddress: '',
    isNative: true,
    symbol: 'SOL',
    name: 'Solana',
    logoUrl: '',
    price: 1,
    priceChange24h: 0,
    marketCap: 1,
    volume24h: 1,
  };
  const bnbToken: IFavoriteTokenDisplay = {
    chainId: 'bsc--56',
    contractAddress: '',
    isNative: true,
    symbol: 'BNB',
    name: 'BNB',
    logoUrl: '',
    price: 1,
    priceChange24h: 0,
    marketCap: 1,
    volume24h: 1,
  };
  const view = render(
    <MarketCategoryTokenList
      tokens={[solToken]}
      isLoading={false}
      isTokenInWatchList={() => false}
      onStarPress={jest.fn()}
      onTokenPress={jest.fn()}
      onViewMore={jest.fn()}
    />,
  );

  // Simulate Pressable activating onPressIn and then cancelling its delayed
  // onPressOut when a second scroll touch begins within 130ms.
  act(() => {
    mockPressableProps.mock.calls.at(-1)?.[0].onPressIn?.(event);
  });
  expect(
    screen.getByTestId('category-table').querySelector('[data-bg="$bgActive"]'),
  ).toBeTruthy();

  act(() => {
    mockPressableProps.mock.calls.at(-1)?.[0].onTouchStart?.(event);
  });
  expect(
    screen.getByTestId('category-table').querySelector('[data-bg="$bgActive"]'),
  ).toBeNull();

  // Simulate a pressIn whose touch ends without Pressable firing onPressOut.
  act(() => {
    mockPressableProps.mock.calls.at(-1)?.[0].onPressIn?.(event);
    mockPressableProps.mock.calls.at(-1)?.[0].onTouchEnd?.(event);
  });
  act(() => {
    jest.advanceTimersByTime(200);
  });
  expect(
    screen.getByTestId('category-table').querySelector('[data-bg="$bgActive"]'),
  ).toBeNull();

  // Switching tokens mounts a fresh flat row rather than recycling a pressed cell.
  act(() => {
    mockPressableProps.mock.calls.at(-1)?.[0].onPressIn?.(event);
  });
  view.rerender(
    <MarketCategoryTokenList
      tokens={[bnbToken]}
      isLoading={false}
      isTokenInWatchList={() => false}
      onStarPress={jest.fn()}
      onTokenPress={jest.fn()}
      onViewMore={jest.fn()}
    />,
  );
  expect(
    screen.getByTestId('category-table').querySelector('[data-bg="$bgActive"]'),
  ).toBeNull();
});

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
    const table = screen.getByTestId('category-table');
    expect(table.querySelector('[data-min-height="68"]')).toBeTruthy();
    expect(Boolean(table.querySelector('[data-min-height="0"]'))).toBe(
      tableLayout,
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
