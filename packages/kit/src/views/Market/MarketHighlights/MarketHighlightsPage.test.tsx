/** @jest-environment jsdom */
import type { PropsWithChildren } from 'react';

import { fireEvent, render } from '@testing-library/react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IMarketHighlight } from '@onekeyhq/shared/types/marketV2';

import { MarketHighlightsPage } from './MarketHighlightsPage';
import { useInitialHighlightScroll } from './useInitialHighlightScroll';

let mockWide = false;
const mockFinish = jest.fn();
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
    opacity,
  }: PropsWithChildren<{
    testID?: string;
    onTouchStart?: React.TouchEventHandler<HTMLDivElement>;
    opacity?: number;
  }>) => (
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
    IconButton: () => null,
    HeaderIconButton: () => null,
    Icon: () => null,
    Spinner: () => null,
    Popover: ({ renderTrigger }: { renderTrigger: React.ReactNode }) =>
      renderTrigger,
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
  EWatchlistFrom: { Others: 'others' },
}));
jest.mock('@onekeyhq/shared/src/utils/openUrlUtils', () => ({
  openUrlExternal: jest.fn(),
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
  usePerpsNavigation: () => ({ navigateToPerps: jest.fn() }),
}));
jest.mock('../MarketDetailV2/utils/marketDetailImagePreload', () => ({
  prewarmMarketTokenImages: jest.fn(),
}));
jest.mock(
  '../MarketHomeV2/components/MarketTokenList/hooks/useToMarketDetailPage',
  () => ({ useToDetailPage: () => jest.fn() }),
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
