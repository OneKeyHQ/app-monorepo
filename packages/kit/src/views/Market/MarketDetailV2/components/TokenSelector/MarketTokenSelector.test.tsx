/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { fireEvent, render, screen, waitFor } from '@testing-library/react';

import type { IMarketSpotCategory } from '@onekeyhq/shared/types/marketV2';

import { MarketTokenSelector } from './MarketTokenSelector';

const mockSetSelectorConfig = jest.fn();
const mockStockListMount = jest.fn();
let mockSpotCategories: IMarketSpotCategory[] = [];

jest.mock('@react-navigation/native', () => ({
  useRoute: () => ({ params: undefined }),
}));

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock('@onekeyhq/components', () => {
  function StackComponent({
    children,
    onPress,
    testID,
  }: {
    children?: ReactNode;
    onPress?: () => void;
    testID?: string;
  }) {
    return (
      <div data-testid={testID} onClick={onPress} role="presentation">
        {children}
      </div>
    );
  }

  return {
    Icon: () => null,
    Popover: ({
      open,
      onOpenChange,
      renderContent,
      renderTrigger,
    }: {
      open: boolean;
      onOpenChange: (open: boolean) => void;
      renderContent: (props: { isOpen: boolean }) => ReactNode;
      renderTrigger: ReactNode;
    }) => {
      const RenderContent = renderContent;
      return (
        <>
          <div onClick={() => onOpenChange(true)} role="presentation">
            {renderTrigger}
          </div>
          {open ? <RenderContent isOpen /> : null}
        </>
      );
    },
    SearchBar: () => null,
    SizableText: ({ children }: { children?: ReactNode }) => (
      <span>{children}</span>
    ),
    XStack: StackComponent,
    YStack: StackComponent,
    usePopoverContext: () => ({ closePopover: jest.fn() }),
  };
});

jest.mock('@onekeyhq/kit/src/components/Token', () => ({
  Token: () => null,
}));

jest.mock('@onekeyhq/kit/src/hooks/useDebounce', () => ({
  useDebounce: (value: string) => value,
}));

jest.mock('@onekeyhq/kit/src/hooks/useNetworkLogoUri', () => ({
  useNetworkLogoUri: () => undefined,
}));

jest.mock('@onekeyhq/kit/src/states/jotai/contexts/marketV2', () => ({
  useTokenDetailActions: () => ({ current: {} }),
}));

jest.mock('@onekeyhq/kit/src/views/Market/hooks', () => ({
  useMarketBasicConfig: () => ({ spotCategories: mockSpotCategories }),
}));

jest.mock('@onekeyhq/kit/src/views/Market/hooks/usePerpsNavigation', () => ({
  usePerpsNavigation: () => ({ navigateToPerps: jest.fn() }),
}));

jest.mock(
  '@onekeyhq/kit/src/views/Market/MarketHomeV2/components/MarketStockList/hooks/useToMarketStockDetailPage',
  () => ({
    useToMarketStockDetailPage: () => jest.fn(),
  }),
);

jest.mock('@onekeyhq/kit/src/views/Swap/hooks/useSwapPro', () => ({
  useSwapProTokenSearch: () => ({
    searchLoading: false,
    searchTokenList: [],
  }),
}));

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  useMarketTokenSelectorConfigAtom: () => [
    { isWatchlistMode: false },
    mockSetSelectorConfig,
  ],
}));

jest.mock('../../hooks/useMarketDetailDisplayData', () => ({
  useMarketDetailHeaderDisplayData: () => ({
    networkId: 'evm--1',
    tokenDetail: {
      address: '0xstock',
      logoUrl: '',
      symbol: 'AAPL',
    },
  }),
}));

jest.mock('./MarketStockSelectorList', () => {
  const { useEffect } = jest.requireActual<typeof import('react')>('react');
  return {
    MarketStockSelectorList: () => {
      useEffect(() => {
        mockStockListMount();
      }, []);
      return <div data-testid="stock-list" />;
    },
  };
});

jest.mock('./MarketTokenSelectorList', () => ({
  MarketTokenSelectorList: ({
    isWatchlistMode,
    selectedCategory,
  }: {
    isWatchlistMode: boolean;
    selectedCategory?: string;
  }) => (
    <div
      data-category={selectedCategory}
      data-testid="token-list"
      data-watchlist={String(isWatchlistMode)}
    />
  ),
}));

describe('MarketTokenSelector stock default category', () => {
  beforeEach(() => {
    mockSetSelectorConfig.mockReset();
    mockStockListMount.mockReset();
    mockSpotCategories = [
      { type: 'trending', name: 'Trending' },
      { type: 'stocks', name: 'Stocks' },
    ];
  });

  function renderOpenStockSelector() {
    render(<MarketTokenSelector defaultCategory="stocks" />);
    fireEvent.click(screen.getByTestId('market-token-selector-trigger'));
    expect(screen.getByTestId('stock-list')).toBeTruthy();
  }

  it('keeps Trending selected when category config refreshes', async () => {
    renderOpenStockSelector();
    mockSpotCategories = [
      { type: 'trending', name: 'Trending' },
      { type: 'stock', name: 'Stocks' },
    ];

    fireEvent.click(screen.getByTestId('market-token-selector-tab-trending'));

    await waitFor(() => {
      expect(screen.queryByTestId('stock-list')).toBeNull();
      expect(
        screen.getByTestId('token-list').getAttribute('data-category'),
      ).toBe('trending');
    });
  });

  it('keeps Favorites selected when category config refreshes', async () => {
    renderOpenStockSelector();
    mockSpotCategories = [
      { type: 'trending', name: 'Trending' },
      { type: 'stock', name: 'Stocks' },
    ];

    fireEvent.click(screen.getByTestId('market-token-selector-tab-favorites'));

    await waitFor(() => {
      expect(screen.queryByTestId('stock-list')).toBeNull();
      expect(
        screen.getByTestId('token-list').getAttribute('data-watchlist'),
      ).toBe('true');
    });
  });

  it('keeps the opened stock list mounted when a custom trigger updates', () => {
    const { rerender } = render(
      <MarketTokenSelector
        defaultCategory="stocks"
        renderTrigger={<div data-testid="custom-stock-trigger">AAPL</div>}
      />,
    );

    fireEvent.click(screen.getByTestId('custom-stock-trigger'));
    expect(screen.getByTestId('stock-list')).toBeTruthy();
    expect(mockStockListMount).toHaveBeenCalledTimes(1);

    rerender(
      <MarketTokenSelector
        defaultCategory="stocks"
        renderTrigger={<div data-testid="custom-stock-trigger">AAPL 2</div>}
      />,
    );

    expect(screen.getByTestId('stock-list')).toBeTruthy();
    expect(mockStockListMount).toHaveBeenCalledTimes(1);
  });
});
