/** @jest-environment jsdom */
import type { PropsWithChildren } from 'react';

import { fireEvent, render } from '@testing-library/react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IMarketHighlight } from '@onekeyhq/shared/types/marketV2';

import { MarketHighlightsPage } from './MarketHighlightsPage';
import { useInitialHighlightScroll } from './useInitialHighlightScroll';

let mockWide = false;
const mockFinish = jest.fn();
const mockToDetailPage = jest.fn();
const mockUseToDetailPage = jest.fn((_options: unknown) => mockToDetailPage);
const mockNavigateToPerps = jest.fn();
const mockOpenUrlExternal = jest.fn();
const mockHighlightAssetClick = jest.fn();
const mockHighlightLinkClick = jest.fn();
const mockInitialScroll = {
  scrollRef: { current: null },
  viewportRef: { current: null },
  contentRef: { current: null },
  targetRef: { current: null },
  visible: true,
  onPageMounted: jest.fn(),
  finish: mockFinish,
  onViewportLayout: jest.fn(),
  onContentLayout: jest.fn(),
  onTargetLayout: jest.fn(),
  onDescriptionMeasured: jest.fn(),
  onScroll: jest.fn(),
};
jest.mock('./useInitialHighlightScroll', () => ({
  useInitialHighlightScroll: jest.fn(() => mockInitialScroll),
}));
const mockItems: IMarketHighlight[] = ['first', 'selected', 'last'].map(
  (id) => ({
    highlightId: id,
    title: id,
    description: id,
    publishedAt: '2026-11-17T00:00:00Z',
    assets: [],
    links: [],
  }),
);

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: false },
}));

jest.mock('@react-navigation/core', () => ({
  useRoute: () => ({ params: { initialHighlightId: 'selected' } }),
}));
jest.mock('react-intl', () => ({
  useIntl: () => ({
    locale: 'en-US',
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));
jest.mock('@onekeyhq/components', () => {
  const Stack = ({
    children,
    testID,
    onTouchStart,
    onPress,
    opacity,
  }: PropsWithChildren<{
    testID?: string;
    onTouchStart?: React.TouchEventHandler<HTMLDivElement>;
    onPress?: () => void;
    opacity?: number;
  }>) =>
    onPress ? (
      <button type="button" data-testid={testID} onClick={onPress}>
        {children}
      </button>
    ) : (
      <div data-testid={testID} onTouchStart={onTouchStart} style={{ opacity }}>
        {children}
      </div>
    );
  return {
    s: (value: number) => value,
    Page: Object.assign(Stack, { Header: () => null, Body: Stack }),
    XStack: Stack,
    YStack: Stack,
    Stack,
    ScrollView: Stack,
    SizableText: Stack,
    NumberSizeableText: () => null,
    Button: () => null,
    IconButton: () => null,
    HeaderIconButton: () => null,
    Icon: () => null,
    Spinner: () => null,
    Popover: ({
      renderTrigger,
      renderContent,
    }: {
      renderTrigger: React.ReactNode;
      renderContent: React.ReactNode;
    }) => (
      <>
        {renderTrigger}
        {renderContent}
      </>
    ),
    useMedia: () => ({ gtMd: mockWide }),
  };
});
jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => ({
  __esModule: true,
  default: () => ({ popStack: jest.fn() }),
}));
jest.mock('@onekeyhq/kit/src/components/Token', () => ({ Token: () => null }));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  EJotaiContextStoreNames: { marketWatchListV2: 'market' },
}));
jest.mock('@onekeyhq/shared/src/logger/scopes/dex', () => ({
  EEnterWay: { Highlights: 'Highlights' },
  EWatchlistFrom: { Others: 'others' },
}));
jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    market: {
      home: {
        marketHighlightAssetClick: (payload: unknown) => {
          mockHighlightAssetClick(payload);
        },
        marketHighlightLinkClick: (payload: unknown) => {
          mockHighlightLinkClick(payload);
        },
      },
    },
  },
}));
jest.mock('@onekeyhq/shared/src/utils/openUrlUtils', () => ({
  openUrlExternal: (url: string) => {
    mockOpenUrlExternal(url);
  },
}));
jest.mock('../components/MarketStarV2', () => ({
  MarketPerpsStarV2: () => null,
  MarketStarV2: () => null,
}));
jest.mock('../components/PerpsBadges', () => ({
  LeverageBadge: () => null,
  USStockMarketStatusIcon: () => null,
}));
jest.mock('../components/PriceChangePercentage', () => ({
  PriceChangePercentage: () => null,
}));
jest.mock('../hooks/usePerpsNavigation', () => ({
  usePerpsNavigation: () => ({ navigateToPerps: mockNavigateToPerps }),
}));
jest.mock('../MarketDetailV2/utils/marketDetailImagePreload', () => ({
  prewarmMarketTokenImages: jest.fn(),
}));
jest.mock(
  '../MarketHomeV2/components/MarketTokenList/hooks/useToMarketDetailPage',
  () => ({
    useToDetailPage: (options: unknown) => mockUseToDetailPage(options),
  }),
);
jest.mock('../MarketWatchListProviderMirrorV2', () => ({
  MarketWatchListProviderMirrorV2: ({ children }: PropsWithChildren) =>
    children,
}));
jest.mock('./useMarketHighlights', () => ({
  useMarketHighlights: () => ({ items: mockItems, isLoading: false }),
}));
jest.mock('./useMarketHighlightQuotes', () => ({
  useMarketHighlightQuotes: () => undefined,
}));

beforeEach(() => {
  mockFinish.mockClear();
  mockInitialScroll.visible = true;
  platformEnv.isNative = false;
  mockWide = true;
});

it('passes the clicked headline to initial positioning and hides content until it is ready', () => {
  mockInitialScroll.visible = false;
  const view = render(<MarketHighlightsPage />);
  expect(useInitialHighlightScroll).toHaveBeenLastCalledWith(
    mockItems,
    'selected',
  );
  expect(view.getByTestId('market-highlights-scroll').style.opacity).toBe('0');
});

it.each(['wheel', 'pointerDown', 'keyDown', 'click'] as const)(
  'stops pending positioning on web %s',
  (event) => {
    const view = render(<MarketHighlightsPage />);
    fireEvent[event](view.getByTestId('market-highlights-list'));
    expect(mockFinish).toHaveBeenCalledTimes(1);
  },
);

it('stops pending positioning on native touch', () => {
  platformEnv.isNative = true;
  mockWide = false;
  const view = render(<MarketHighlightsPage />);
  fireEvent.touchStart(view.getByTestId('market-highlights-list'));
  expect(mockFinish).toHaveBeenCalledTimes(1);
});

it.each([
  [true, ''],
  [false, ''],
  [true, 'not-a-date'],
  [false, 'not-a-date'],
])(
  'keeps every card usable with an invalid date (wide=%s, date=%s)',
  (wide, date) => {
    mockWide = wide;
    const previous = mockItems[0].publishedAt;
    mockItems[0].publishedAt = date;
    try {
      const view = render(<MarketHighlightsPage />);
      expect(view.getAllByTestId('market-highlights-card')).toHaveLength(3);
      expect(view.getAllByText('selected').length).toBeGreaterThan(0);
    } finally {
      mockItems[0].publishedAt = previous;
    }
  },
);

describe('analytics', () => {
  const assets: IMarketHighlight['assets'] = [
    {
      type: 'token',
      symbol: 'ETH',
      chainId: 'evm--1',
      contractAddress: '',
      isNative: true,
      favorite: { chainId: 'evm--1', contractAddress: '', isNative: true },
    },
    {
      type: 'stock',
      symbol: 'AAPL',
      stockId: 'AAPL',
      favorite: { stockId: 'AAPL', chainId: '', contractAddress: '' },
    },
    {
      type: 'perp',
      symbol: 'BTC',
      perpsCoin: 'BTC',
      favorite: { perpsCoin: 'BTC', chainId: '', contractAddress: '' },
    },
  ];
  const links = [{ title: 'Secret title', url: 'https://example.com/news' }];

  beforeEach(() => {
    mockItems[1].assets = assets;
    mockItems[1].links = links;
    mockToDetailPage.mockClear();
    mockNavigateToPerps.mockClear();
    mockOpenUrlExternal.mockClear();
    mockHighlightAssetClick.mockClear();
    mockHighlightLinkClick.mockClear();
  });
  afterEach(() => {
    mockItems[1].assets = [];
    mockItems[1].links = [];
  });

  it('attributes detail entries from the page to Highlights', () => {
    render(<MarketHighlightsPage />);
    expect(mockUseToDetailPage).toHaveBeenLastCalledWith({
      switchToMarketTabFirst: true,
      from: 'Highlights',
    });
  });

  it.each([
    ['evm--1:', 'token'],
    ['stock:AAPL', 'stock'],
  ])('reports a %s asset press with its highlight', (identity, assetType) => {
    const view = render(<MarketHighlightsPage />);
    fireEvent.click(view.getByTestId(`market-highlights-asset-${identity}`));
    expect(mockHighlightAssetClick).toHaveBeenCalledTimes(1);
    expect(mockHighlightAssetClick).toHaveBeenCalledWith({
      highlightId: 'selected',
      assetType,
    });
    expect(mockToDetailPage).toHaveBeenCalledTimes(1);
  });

  it('reports a perp asset press before navigating to Perps', () => {
    const view = render(<MarketHighlightsPage />);
    fireEvent.click(view.getByTestId('market-highlights-asset-perps:BTC'));
    expect(mockHighlightAssetClick).toHaveBeenCalledWith({
      highlightId: 'selected',
      assetType: 'perp',
    });
    expect(mockNavigateToPerps).toHaveBeenCalledWith('BTC', {
      dismissOverlays: true,
    });
    expect(mockToDetailPage).not.toHaveBeenCalled();
  });

  it('reports a source link press without its URL or title', () => {
    const view = render(<MarketHighlightsPage />);
    fireEvent.click(view.getByText('Secret title'));
    expect(mockHighlightLinkClick).toHaveBeenCalledTimes(1);
    expect(mockHighlightLinkClick).toHaveBeenCalledWith({
      highlightId: 'selected',
    });
    expect(mockOpenUrlExternal).toHaveBeenCalledWith(
      'https://example.com/news',
    );
  });
});
