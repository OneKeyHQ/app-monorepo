/** @jest-environment jsdom */

import type { PropsWithChildren, ReactElement } from 'react';

import { act, fireEvent, render, screen } from '@testing-library/react';

import {
  MobileMarketNativeStockList,
  MobileMarketNativeTokenList,
  MobileMarketNativeTopCoinsList,
  MobileMarketNativeWatchlist,
} from './MobileMarketNativeLists';

import type { IMarketToken } from '../MarketTokenList/MarketTokenData';
import type {
  NativeListRef,
  NativeListSnapshot,
  RowActionEvent,
} from '@onekeyfe/react-native-native-list';

const mockPortalRender = jest.fn(
  (_name: unknown, _element: unknown): undefined => undefined,
);
const mockSetAnchorState = jest.fn();
const mockActions = {
  current: {
    refreshWatchListV2: jest.fn().mockResolvedValue(undefined),
    moveToTopV2: jest.fn(),
    removeFromWatchListV2: jest.fn().mockResolvedValue(undefined),
  },
};
const mockListingActions = {
  addIntoWatchListV2: jest.fn().mockResolvedValue(true),
  removeFromWatchListV2: jest.fn().mockResolvedValue(true),
};
const mockStockDetail = jest.fn();
const mockTopCoinDetail = jest.fn();
const mockStockItems = [
  {
    stockId: 'AAPL',
    symbol: 'AAPL',
    name: 'Apple',
    logoUrl: 'https://example.com/aapl.png',
    assetType: 'stock',
    currency: 'USD',
    price: '200',
    priceChange24hPercent: '1',
  },
];
const mockTopCoins = [
  {
    assetId: 'bitcoin',
    symbol: 'btc',
    logoUrl: 'https://example.com/btc.png',
    price: '100',
    priceChange24hPercent: '1',
    priceChange7dPercent: '2',
    marketCap: '1000',
    volume24h: '100',
    sparkline24h: [],
  },
];
const mockWatchlistData: IMarketToken[] = [
  {
    id: 'tiny',
    name: 'Tiny Token',
    symbol: 'TINY',
    address: '0x1234',
    decimals: 18,
    price: 1,
    change24h: 2,
    marketCap: 100,
    liquidity: 10,
    transactions: 3,
    uniqueTraders: 2,
    holders: 2,
    turnover: 50,
    tokenImageUri: '',
    networkLogoUri: '',
    networkId: 'evm--1',
  },
];
let mockRowAction: ((event: RowActionEvent) => void) | undefined;
let mockNativeSnapshot: NativeListSnapshot | undefined;
const mockRefetch = jest.fn();
const mockRefresh = jest.fn();
let mockPullToRefresh: () => void;
let mockIsNativeAndroid = false;
const mockData: IMarketToken[] = [];
const mockIntl = { formatMessage: ({ id }: { id: string }) => id };
const mockTheme = Object.fromEntries(
  [
    'bgApp',
    'bgActive',
    'bgSubdued',
    'bgStrong',
    'text',
    'textSubdued',
    'textDisabled',
    'icon',
    'iconSubdued',
    'borderSubdued',
    'iconActive',
    'textSuccess',
    'textCritical',
    'bgCritical',
    'bgInverse',
    'textInverse',
    'textInfo',
    'textCaution',
    'bgSuccessStrong',
    'bgCriticalStrong',
    'neutral9',
    'neutral6',
    'neutral2',
    'bgInfo',
  ].map((key) => [key, { val: '#000000' }]),
);

jest.mock('@onekeyfe/react-native-native-list', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    NativeList: React.forwardRef<
      Pick<
        NativeListRef,
        'setRefreshing' | 'applyPatches' | 'setActionAnchorState'
      >,
      {
        snapshot: NativeListSnapshot;
        onRefresh?: () => void;
        onRowAction?: (event: RowActionEvent) => void;
      }
    >(({ snapshot, onRefresh, onRowAction }, ref) => {
      mockRowAction = onRowAction;
      mockNativeSnapshot = snapshot;
      const [nativeRefreshing, setNativeRefreshing] = React.useState(false);
      React.useEffect(() => {
        setNativeRefreshing(Boolean(snapshot.capabilities?.refreshing));
      }, [snapshot.capabilities?.refreshing]);
      React.useImperativeHandle(ref, () => ({
        setRefreshing: setNativeRefreshing,
        applyPatches: jest.fn(),
        setActionAnchorState: mockSetAnchorState,
      }));
      mockPullToRefresh = () => {
        setNativeRefreshing(true);
        onRefresh?.();
      };
      return (
        <button type="button" onClick={mockPullToRefresh}>
          {nativeRefreshing ? 'Refreshing' : 'Refresh'}
        </button>
      );
    }),
  };
});
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  get isNativeAndroid() {
    return mockIsNativeAndroid;
  },
  get isNativeIOS() {
    return !mockIsNativeAndroid;
  },
}));
jest.mock('react-intl', () => ({ useIntl: () => mockIntl }));
jest.mock('@onekeyhq/kit/src/hooks/useThemeVariant', () => ({
  useThemeVariant: () => 'dark',
}));
jest.mock('react-native', () => ({
  Dimensions: { get: () => ({ width: 402, height: 874 }) },
  PixelRatio: { get: () => 3 },
  StyleSheet: { create: (styles: Record<string, unknown>) => styles },
}));
jest.mock('@onekeyhq/components', () => ({
  Stack: ({ children }: PropsWithChildren) => <div>{children}</div>,
  useTheme: () => mockTheme,
  Portal: {
    Render: (name: unknown, element: unknown) =>
      mockPortalRender(name, element),
    Constant: { FULL_WINDOW_OVERLAY_PORTAL: 'window' },
  },
  Haptics: { impact: jest.fn() },
  ImpactFeedbackStyle: { Medium: 1 },
  Toast: { success: jest.fn() },
}));
jest.mock('../MarketTokenList/hooks/useMarketTokenList', () => ({
  useMarketTokenList: () => ({
    data: mockData,
    isLoading: false,
    isLoadingMore: false,
    canLoadMore: false,
    refresh: mockRefresh,
    refetch: mockRefetch,
  }),
}));
jest.mock('../MarketTokenList/hooks/useToMarketDetailPage', () => ({
  useToDetailPage: () => jest.fn(),
}));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  serviceMarketV2: {
    reconcilePerpsFavorites: jest.fn().mockResolvedValue(undefined),
  },
}));
jest.mock('@onekeyhq/kit/src/states/jotai/contexts/marketV2', () => ({
  useMarketWatchListV2Atom: () => [
    { isMounted: true, data: mockWatchlistData },
  ],
  useWatchListV2Actions: () => mockActions,
}));
jest.mock('@onekeyhq/kit/src/views/Market/components/watchListHooksV2', () => ({
  useWatchListV2Action: () => mockListingActions,
}));
jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    dex: {
      watchlist: {
        dexAddToWatchlist: jest.fn(),
        dexRemoveFromWatchlist: jest.fn(),
      },
    },
  },
}));
jest.mock('@onekeyhq/shared/src/logger/scopes/dex', () => ({
  EWatchlistFrom: { Homepage: 'Homepage' },
}));
jest.mock('@onekeyhq/kit/src/views/Market/components/PerpsBadges', () => ({}));
jest.mock('@onekeyhq/kit/src/views/Market/hooks', () => ({
  useMarketBasicConfig: () => ({ recommendedTokens: [] }),
}));
jest.mock(
  '@onekeyhq/kit/src/views/Market/MarketDetailV2/utils/marketDetailImagePreload',
  () => ({}),
);
jest.mock(
  '@onekeyhq/kit/src/views/Market/MarketDetailV2/utils/marketDetailPagePreload',
  () => ({}),
);
jest.mock(
  '@onekeyhq/kit/src/views/Market/MarketDetailV2/utils/resolveIsStockToken',
  () => ({}),
);
jest.mock('../../../hooks/usePerpsNavigation', () => ({
  usePerpsNavigation: () => ({ navigateToPerps: jest.fn() }),
}));
jest.mock('../MarketPerpsList/hooks/useMarketPerpsTokenList', () => ({}));
jest.mock('../MarketRecommendList', () => ({}));
jest.mock('../MarketStockList/hooks/useMarketStockList', () => ({
  useMarketStockList: () => ({
    items: mockStockItems,
    isLoading: false,
    isLoadingMore: false,
    isLoadMoreError: false,
    isError: false,
    canLoadMore: false,
    loadMore: jest.fn(),
    refresh: jest.fn(),
  }),
}));
jest.mock('../MarketStockList/hooks/useToMarketStockDetailPage', () => ({
  useToMarketStockDetailPage: () => mockStockDetail,
}));
jest.mock('../MarketTokenList/components/InlineActionBar', () => ({
  InlineActionBar: () => null,
}));
jest.mock('../MarketTokenList/hooks/useMarketWatchlistTokenList', () => ({
  useMarketWatchlistTokenList: () => ({
    data: mockWatchlistData,
    refetch: mockRefetch,
  }),
}));
jest.mock('../MarketTokenList/hooks/useWatchlistFilteredGroups', () => ({
  useWatchlistFilteredGroups: () => ({
    all: mockWatchlistData,
    spot: mockWatchlistData,
    perps: [],
  }),
}));
jest.mock('../MarketTopCoinsList/hooks/useMarketTopCoins', () => ({
  useMarketTopCoins: () => ({
    data: mockTopCoins,
    handleItemPress: mockTopCoinDetail,
    isLoading: false,
    isError: false,
    refresh: jest.fn(),
  }),
}));

describe('MobileMarketNativeTokenList refresh', () => {
  beforeEach(() => {
    mockIsNativeAndroid = false;
    jest.clearAllMocks();
  });

  it('keeps pull-to-refresh disabled on Android Market lists', async () => {
    mockIsNativeAndroid = true;
    render(
      <MobileMarketNativeTokenList
        networkId="evm--1"
        listContainerProps={{ paddingBottom: 20 }}
      />,
    );

    expect(mockNativeSnapshot?.capabilities?.pullToRefresh).toBe(false);
    await act(async () => mockPullToRefresh());
    expect(mockRefetch).not.toHaveBeenCalled();
  });

  it('retries an error row through the uncached native request', async () => {
    mockRefetch.mockResolvedValue(undefined);
    render(
      <MobileMarketNativeTokenList
        networkId="evm--1"
        listContainerProps={{ paddingBottom: 20 }}
      />,
    );

    await act(async () => {
      mockRowAction?.({ actionKey: 'retry', rowKey: 'market-retry' });
    });

    expect(mockRefetch).toHaveBeenCalledTimes(1);
    expect(mockRefresh).not.toHaveBeenCalled();
  });

  it.each([false, true])(
    'keeps the native indicator active until the request settles (rejects: %s)',
    async (rejects) => {
      let settle: () => void = () => undefined;
      mockRefetch.mockImplementation(
        () =>
          new Promise<void>((resolve, reject) => {
            settle = rejects ? () => reject(new Error('offline')) : resolve;
          }),
      );
      render(
        <MobileMarketNativeTokenList
          networkId="evm--1"
          listContainerProps={{ paddingBottom: 20 }}
        />,
      );

      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
      });
      expect(screen.getByRole('button', { name: 'Refreshing' })).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: 'Refreshing' }));
      expect(mockRefetch).toHaveBeenCalledTimes(1);
      expect(mockRefresh).not.toHaveBeenCalled();

      await act(async () => settle());
      expect(screen.getByRole('button', { name: 'Refresh' })).toBeTruthy();
      fireEvent.click(screen.getByRole('button', { name: 'Refresh' }));
      expect(mockRefetch).toHaveBeenCalledTimes(2);
      await act(async () => settle());
    },
  );

  it.each([false, true])(
    'ends batched native refreshes (rejects: %s)',
    async (rejects) => {
      if (rejects) mockRefetch.mockRejectedValue(new Error('offline'));
      else mockRefetch.mockResolvedValue(undefined);
      render(
        <MobileMarketNativeTokenList
          networkId="evm--1"
          listContainerProps={{ paddingBottom: 20 }}
        />,
      );
      await act(async () => {
        mockPullToRefresh();
      });
      expect(screen.getByRole('button', { name: 'Refresh' })).toBeTruthy();
    },
  );
});

describe('MobileMarketNativeWatchlist action anchor', () => {
  beforeEach(() => jest.clearAllMocks());

  it.each([296, 316])(
    'places the menu above touch y=%s while retaining its row binding',
    async (touchY) => {
      render(
        <MobileMarketNativeWatchlist
          listContainerProps={{ paddingBottom: 20 }}
        />,
      );
      await act(async () => {
        mockRowAction?.({
          rowKey: 'evm--1:0x1234:0',
          actionKey: 'watchlist-menu',
          anchor: {
            token: 'binding-3',
            windowRect: { x: 0, y: 272, width: 402, height: 72 },
            windowPoint: { x: 180, y: touchY },
            source: 'row',
            generation: 2,
            layoutDirection: 'ltr',
          },
        });
      });
      expect(mockSetAnchorState).toHaveBeenCalledWith({
        token: 'binding-3',
        open: true,
      });
      const element = mockPortalRender.mock.calls[0][1] as ReactElement<{
        anchor: { x: number; y: number };
        isFirstItem: boolean;
        onToggleWatchlist: () => Promise<void>;
      }>;
      expect(element.props.anchor.x).toBeCloseTo(192.96);
      expect(element.props.anchor.y).toBe(touchY - 4);
      expect(element.props.isFirstItem).toBe(true);
      await act(async () => element.props.onToggleWatchlist());
      expect(mockActions.current.removeFromWatchListV2).toHaveBeenCalledWith(
        'evm--1',
        '0x1234',
        { assetId: undefined, stockId: undefined },
      );
      expect(mockSetAnchorState).toHaveBeenLastCalledWith({
        token: 'binding-3',
        open: false,
        restoreFocus: true,
      });
    },
  );
});

it.each([{ assetId: 'bitcoin' }, { stockId: 'AAPL' }])(
  'preserves listing identity through native watchlist menu actions: %j',
  async (identity) => {
    jest.clearAllMocks();
    const original = mockWatchlistData[0];
    mockWatchlistData[0] = {
      ...original,
      address: '',
      networkId: '',
      ...identity,
    };
    try {
      render(
        <MobileMarketNativeWatchlist
          listContainerProps={{ paddingBottom: 20 }}
        />,
      );
      const rowKey = identity.assetId
        ? `asset:${identity.assetId}`
        : `stock:${identity.stockId}`;
      await act(async () =>
        mockRowAction?.({ rowKey, actionKey: 'watchlist-menu' }),
      );
      const element = mockPortalRender.mock.calls[0][1] as ReactElement<{
        onMoveToTop: () => Promise<void>;
        onToggleWatchlist: () => Promise<void>;
      }>;
      await act(async () => element.props.onMoveToTop());
      expect(mockActions.current.moveToTopV2).toHaveBeenCalledWith(
        expect.objectContaining(identity),
      );
      await act(async () => element.props.onToggleWatchlist());
      expect(mockActions.current.removeFromWatchListV2).toHaveBeenCalledWith(
        '',
        '',
        expect.objectContaining(identity),
      );
    } finally {
      mockWatchlistData[0] = original;
    }
  },
);

describe('native market listing favorites', () => {
  it('adds a stock favorite without opening its detail row', async () => {
    const previous = [...mockWatchlistData];
    let resolveFavorite: (value: boolean) => void = () => undefined;
    mockListingActions.addIntoWatchListV2.mockImplementationOnce(
      () =>
        new Promise<boolean>((resolve) => {
          resolveFavorite = resolve;
        }),
    );
    mockWatchlistData.splice(0);
    try {
      render(
        <MobileMarketNativeStockList
          selectedCategoryId="all"
          listContainerProps={{ paddingBottom: 20 }}
        />,
      );
      expect(mockNativeSnapshot?.rows[0]).toMatchObject({
        key: 'AAPL',
        leadingAction: {
          name: 'StarOutline',
          disabled: false,
          actionKey: 'toggle-favorite',
        },
      });

      act(() => {
        mockRowAction?.({ rowKey: 'AAPL', actionKey: 'toggle-favorite' });
      });
      expect(mockNativeSnapshot?.rows[0]).toMatchObject({
        leadingAction: { disabled: true },
      });
      expect(mockListingActions.addIntoWatchListV2).toHaveBeenCalledWith([
        {
          chainId: '',
          contractAddress: '',
          stockId: 'AAPL',
          isNative: false,
        },
      ]);
      expect(mockStockDetail).not.toHaveBeenCalled();
      await act(async () => resolveFavorite(true));
      expect(mockNativeSnapshot?.rows[0]).toMatchObject({
        leadingAction: { disabled: false },
      });
    } finally {
      mockWatchlistData.splice(0, mockWatchlistData.length, ...previous);
    }
  });

  it('removes an active top-coin favorite without opening its detail row', async () => {
    const previous = [...mockWatchlistData];
    mockWatchlistData.splice(0, mockWatchlistData.length, {
      ...previous[0],
      id: 'bitcoin',
      address: '',
      networkId: '',
      assetId: 'bitcoin',
    });
    try {
      render(
        <MobileMarketNativeTopCoinsList
          dataCacheRef={{ current: undefined }}
          listContainerProps={{ paddingBottom: 20 }}
        />,
      );
      expect(mockNativeSnapshot?.rows[0]).toMatchObject({
        key: 'bitcoin',
        leadingAction: {
          name: 'StarSolid',
          disabled: false,
          actionKey: 'toggle-favorite',
        },
      });

      await act(async () => {
        mockRowAction?.({ rowKey: 'bitcoin', actionKey: 'toggle-favorite' });
      });
      expect(mockListingActions.removeFromWatchListV2).toHaveBeenCalledWith(
        '',
        '',
        {
          chainId: '',
          contractAddress: '',
          assetId: 'bitcoin',
        },
      );
      expect(mockTopCoinDetail).not.toHaveBeenCalled();
    } finally {
      mockWatchlistData.splice(0, mockWatchlistData.length, ...previous);
    }
  });
});
