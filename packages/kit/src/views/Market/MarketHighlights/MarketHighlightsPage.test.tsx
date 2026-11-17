/** @jest-environment jsdom */
import type { PropsWithChildren } from 'react';

import { act, render } from '@testing-library/react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { IMarketHighlight } from '@onekeyhq/shared/types/marketV2';

import { MarketHighlightsPage } from './MarketHighlightsPage';

const mockScrollToIndex = jest.fn(() => Promise.resolve());
const mockScrollToOffset = jest.fn();
let mockWide = false;
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
  const { forwardRef, useImperativeHandle, useEffect } =
    jest.requireActual<typeof import('react')>('react');
  const Stack = ({
    children,
    testID,
    onLayout,
    height,
  }: PropsWithChildren<{
    height?: number;
    testID?: string;
    onLayout?: (event: { nativeEvent: { layout: { height: number } } }) => void;
  }>) => {
    useEffect(() => {
      if (testID === 'market-highlights-list')
        onLayout?.({ nativeEvent: { layout: { height: 600 } } });
      if (testID === 'market-highlights-list-footer' && height !== undefined)
        onLayout?.({ nativeEvent: { layout: { height } } });
    }, [testID, onLayout, height]);
    return <div>{children}</div>;
  };
  return {
    s: (value: number) => value,
    Page: Object.assign(Stack, { Header: () => null, Body: Stack }),
    XStack: Stack,
    YStack: Stack,
    Stack,
    IconButton: () => null,
    HeaderIconButton: () => null,
    Popover: () => null,
    SizableText: Stack,
    ListView: forwardRef(function MockList(
      { ListFooterComponent }: { ListFooterComponent: React.ReactNode },
      ref,
    ) {
      useImperativeHandle(ref, () => ({
        scrollToIndex: mockScrollToIndex,
        scrollToOffset: mockScrollToOffset,
        getLayout: (index: number) => ({ y: index * 200 }),
        getFirstItemOffset: () => 10,
      }));
      return <div>{ListFooterComponent}</div>;
    }),
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

it.each([
  { wide: false, native: false, offset: 10 },
  { wide: true, native: false, offset: 48 },
  { wide: false, native: true, offset: -10 },
  { wide: true, native: true, offset: -10 },
])(
  'positions the selected headline with the correct spacing (wide=$wide, native=$native)',
  async ({ wide, native, offset }) => {
    jest.useFakeTimers();
    mockWide = wide;
    platformEnv.isNative = native;
    mockScrollToIndex.mockClear();
    mockScrollToOffset.mockClear();
    const view = render(<MarketHighlightsPage />);
    try {
      await act(async () => jest.advanceTimersByTimeAsync(50));
      expect(mockScrollToIndex).toHaveBeenCalledTimes(1);
      expect(mockScrollToIndex).toHaveBeenCalledWith({
        index: 1,
        animated: false,
        viewOffset: offset,
      });
      if (native)
        expect(mockScrollToOffset).toHaveBeenCalledWith({
          offset: 200,
          animated: false,
        });
      else expect(mockScrollToOffset).not.toHaveBeenCalled();
      view.rerender(<MarketHighlightsPage />);
      act(() => jest.advanceTimersByTime(1000));
      expect(mockScrollToIndex).toHaveBeenCalledTimes(1);
    } finally {
      view.unmount();
      jest.useRealTimers();
    }
  },
);
