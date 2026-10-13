/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { render, screen } from '@testing-library/react';

import {
  MobileSelectorSearchTokenRow,
  MobileSelectorWatchlistList,
} from './MobileMarketSelectorBrowseLists';

import type { IMarketToken } from '../../../MarketHomeV2/components/MarketTokenList/MarketTokenData';

const mockRefreshWatchListV2 = jest.fn(() => Promise.resolve());
const mockEventHandlers = new Map<string, () => Promise<void>>();
const mockOn = jest.fn((name: string, handler: () => Promise<void>) => {
  mockEventHandlers.set(name, handler);
});
const mockOff = jest.fn((name: string) => {
  mockEventHandlers.delete(name);
});

jest.mock('react-intl', () => ({
  useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
}));

jest.mock('react-native', () => ({
  FlatList: ({
    data,
    renderItem,
  }: {
    data: unknown[];
    renderItem: (info: { item: unknown }) => ReactNode;
  }) => <div>{data.map((item) => renderItem({ item }))}</div>,
}));

jest.mock('@onekeyhq/components', () => {
  const Container = ({ children }: { children?: ReactNode }) => (
    <div>{children}</div>
  );
  return {
    Badge: Object.assign(Container, { Text: Container }),
    Button: Container,
    NumberSizeableText: ({ children }: { children?: ReactNode }) => (
      <span data-testid="number">{children}</span>
    ),
    SizableText: ({ children }: { children?: ReactNode }) => (
      <span>{children}</span>
    ),
    Skeleton: () => null,
    Spinner: () => null,
    Stack: Container,
    XStack: Container,
    YStack: Container,
  };
});

jest.mock('@onekeyhq/kit/src/components/Token', () => ({
  Token: () => null,
}));
jest.mock('@onekeyhq/kit/src/hooks/useNetworkLogoUri', () => ({
  useNetworkLogoUri: () => undefined,
}));
jest.mock('@onekeyhq/kit/src/states/jotai/contexts/marketV2', () => ({
  useMarketWatchListV2Atom: () => [{ data: [] }],
  useWatchListV2Actions: () => ({
    current: { refreshWatchListV2: mockRefreshWatchListV2 },
  }),
}));
jest.mock(
  '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketStockList/MarketStockStar',
  () => ({ MarketStockStar: () => null }),
);
jest.mock(
  '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketStockList/utils',
  () => ({ parseMarketStockNumber: () => undefined }),
);
jest.mock(
  '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketTokenList/hooks/useMarketHomeTokenListWebSocket',
  () => ({ applyMarketTokenListLiveOverrides: () => [] }),
);
jest.mock(
  '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketTokenList/hooks/useMarketTokenList',
  () => ({ useMarketTokenList: () => ({ data: [] }) }),
);
jest.mock(
  '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketTokenList/hooks/useMarketWatchlistTokenList',
  () => ({
    useMarketWatchlistTokenList: () => ({ data: [], isLoading: false }),
  }),
);
jest.mock('@onekeyhq/kit/src/views/Market/MarketHomeV2/utils', () => ({
  isTrendingStyleSpotCategory: () => false,
}));
jest.mock('@onekeyhq/shared/src/eventBus/appEventBus', () => ({
  EAppEventBusNames: {
    RefreshMarketWatchList: 'RefreshMarketWatchList',
    MarketWatchListV2Changed: 'MarketWatchListV2Changed',
  },
  appEventBus: {
    on: (name: string, handler: () => Promise<void>) => mockOn(name, handler),
    off: (name: string) => mockOff(name),
  },
}));
jest.mock('../../../components/CommunityRecognizedBadge', () => ({
  CommunityRecognizedBadge: () => null,
}));
jest.mock('../../../components/MarketListingStar', () => ({
  MarketListingStar: () => null,
}));
jest.mock('../../utils/marketDetailImagePreload', () => ({
  prewarmMarketTokenImages: jest.fn(),
}));
jest.mock('./selectorStar', () => ({
  SelectorTokenStar: () => null,
}));
jest.mock('./useMarketStockSelectorList', () => ({
  useMarketStockSelectorList: () => ({ items: [] }),
}));

const searchToken: IMarketToken = {
  id: 'evm--1_0xaapl',
  name: 'Apple xStock',
  symbol: 'AAPLx',
  address: '0xaapl',
  decimals: 18,
  price: 100,
  change24h: 0,
  marketCap: 0,
  liquidity: 1000,
  transactions: 0,
  uniqueTraders: 0,
  holders: 0,
  turnover: 500,
  tokenImageUri: '',
  networkLogoUri: '',
  networkId: 'evm--1',
};

describe('MobileSelectorSearchTokenRow price change', () => {
  // The price renders through NumberSizeableText too, so the change is the
  // second number when present.
  it('shows -- when the feed omits the change', () => {
    render(
      <MobileSelectorSearchTokenRow
        item={{ ...searchToken, priceChangeRaw: undefined }}
        onPress={jest.fn()}
      />,
    );
    expect(screen.getAllByTestId('number')).toHaveLength(1);
    expect(screen.getAllByText('--').length).toBeGreaterThan(0);
  });

  it("shows -- when the feed sends '-'", () => {
    render(
      <MobileSelectorSearchTokenRow
        item={{ ...searchToken, priceChangeRaw: '-' }}
        onPress={jest.fn()}
      />,
    );
    expect(screen.getAllByTestId('number')).toHaveLength(1);
  });

  it("keeps a real '0' as a number", () => {
    render(
      <MobileSelectorSearchTokenRow
        item={{ ...searchToken, priceChangeRaw: '0' }}
        onPress={jest.fn()}
      />,
    );
    const numbers = screen.getAllByTestId('number');
    expect(numbers).toHaveLength(2);
    expect(numbers[1]?.textContent).toBe('0');
  });
});

describe('MobileSelectorWatchlistList', () => {
  beforeEach(() => {
    mockRefreshWatchListV2.mockClear();
    mockOn.mockClear();
    mockOff.mockClear();
    mockEventHandlers.clear();
  });

  it('refreshes the watchlist on watchlist events until unmounted', async () => {
    const { unmount } = render(
      <MobileSelectorWatchlistList onItemPress={jest.fn()} />,
    );

    expect([...mockEventHandlers.keys()].toSorted()).toEqual([
      'MarketWatchListV2Changed',
      'RefreshMarketWatchList',
    ]);
    await mockEventHandlers.get('MarketWatchListV2Changed')?.();
    expect(mockRefreshWatchListV2).toHaveBeenCalledTimes(1);

    unmount();
    expect(mockEventHandlers.size).toBe(0);
  });
});
