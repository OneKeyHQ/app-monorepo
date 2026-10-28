/** @jest-environment jsdom */

import { createContext, useContext, useMemo, useRef, useState } from 'react';
import type {
  Dispatch,
  KeyboardEvent,
  ReactElement,
  ReactNode,
  SetStateAction,
} from 'react';

import { act, fireEvent, render, screen } from '@testing-library/react';

import { OneKeyLocalError } from '@onekeyhq/shared/src/errors';
import type { ITokenSelectorFavoriteOrderEntry } from '@onekeyhq/shared/src/utils/perpsTokenSelectorFavorites';
import type { IPerpTokenSelectorConfig } from '@onekeyhq/shared/types/hyperliquid';

import { PerpTokenSelector } from './PerpTokenSelector';

import type { ITokenSelectorListItem } from './PerpTokenSelector';

type IFavorites = { favorites: string[] };
type IOrder = { sequence: ITokenSelectorFavoriteOrderEntry[] };
type ITestState = {
  query: string;
  setQuery: Dispatch<SetStateAction<string>>;
  config: IPerpTokenSelectorConfig;
  setConfig: Dispatch<SetStateAction<IPerpTokenSelectorConfig>>;
  favorites: IFavorites;
  setFavorites: Dispatch<SetStateAction<IFavorites>>;
  order: IOrder;
  setOrder: Dispatch<SetStateAction<IOrder>>;
};
const mockState = createContext<ITestState | undefined>(undefined);
function useMockState() {
  const value = useContext(mockState);
  if (!value) throw new OneKeyLocalError('Missing selector test state');
  return value;
}
const mockAssets = ['BTC', 'ETH', 'SOL'].map((name, assetId) => ({
  name,
  assetId,
  maxLeverage: 20,
}));
const mockContexts = { assetCtxsByDex: [[{ markPx: '1' }]] };
const mockEmpty = {};
const mockSpotFavorites = { favorites: [] };
const mockTabs = [{ tabId: 'stocks', name: 'Stocks', tokens: ['ETH'] }];
const mockSwitch = jest.fn().mockResolvedValue(undefined);
const mockFavorite = jest.fn().mockResolvedValue(undefined);
const mockActions = {
  current: {
    setTradeRouteViewState: jest.fn(),
    markAllAssetCtxsRequired: jest.fn(),
    markAllAssetCtxsNotRequired: jest.fn(),
    switchTradeInstrument: mockSwitch,
  },
};
const mockIntl = { formatMessage: ({ id }: { id: string }) => id };
const mockLog = jest.fn();

jest.mock('react-intl', () => ({ useIntl: () => mockIntl }));
jest.mock('@react-navigation/native', () => ({ useIsFocused: () => true }));
jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: false, isExtensionUi: false, isWeb: true },
}));
jest.mock('@onekeyhq/shared/src/logger/logger', () => ({
  defaultLogger: {
    app: {
      error: {
        log: (...args: unknown[]) => {
          mockLog(...args);
        },
      },
    },
    perp: { tokenSelector: new Proxy({}, { get: () => mockLog }) },
  },
}));
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  __esModule: true,
  default: {
    simpleDb: { perp: { getExpectMaxBuilderFee: async () => 1 } },
    serviceHyperliquid: {
      getSpotMeta: async () => ({ universes: [] }),
      refreshSpotMeta: async () => undefined,
      updateTokenSelectorFavorite: async (...args: unknown[]) => {
        mockFavorite(...args);
      },
    },
  },
}));
jest.mock('@onekeyhq/kit/src/states/jotai/contexts/hyperliquid', () => ({
  useHyperliquidActions: () => mockActions,
}));
jest.mock('@onekeyhq/kit/src/states/jotai/contexts/hyperliquid/atoms', () => ({
  usePerpsAllAssetsFilteredAtom: () => {
    const { query } = useMockState();
    return [
      {
        query,
        assetsByDex: [
          mockAssets.filter((asset) =>
            asset.name.toLowerCase().includes(query.toLowerCase()),
          ),
        ],
      },
    ];
  },
  usePerpsAllAssetCtxsAtom: () => [mockContexts],
  usePerpsTokenSearchAliasesAtom: () => [mockEmpty],
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  usePerpsActiveAccountAtom: () => [{ walletType: 'test' }],
  usePerpTokenSelectorConfigPersistAtom: () => {
    const state = useMockState();
    return [state.config, state.setConfig];
  },
  usePerpTokenSelectorTabsAtom: () => [mockTabs],
  useSpotExternalMarketCapsAtom: () => [mockEmpty],
  usePerpTokenFavoritesPersistAtom: () => {
    const state = useMockState();
    return [state.favorites, state.setFavorites];
  },
  useSpotTokenFavoritesPersistAtom: () => [mockSpotFavorites, jest.fn()],
  usePerpsFavoritesOrderPersistAtom: () => {
    const state = useMockState();
    return [state.order, state.setOrder];
  },
  spotAssetCtxsMapAtom: {
    get: async () => mockEmpty,
    sub: () => () => undefined,
  },
}));
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms/spot', () => ({
  useSpotActiveAssetCtxAtom: () => [undefined],
}));
jest.mock('../../hooks', () => ({
  usePerpTokenSelector: () => {
    const state = useMockState();
    return { searchQuery: state.query, setSearchQuery: state.setQuery };
  },
  usePerpActiveTabValidation: jest.fn(),
  usePrewarmPerpsTokenSelectorImages: () => jest.fn(),
  usePerpsFavorites: ({ mode }: { mode: string }) => {
    const { favorites } = useMockState();
    return {
      isReady: true,
      favoriteItems:
        mode === 'spot'
          ? []
          : mockAssets
              .filter((asset) => favorites.favorites.includes(asset.name))
              .map((asset) => ({
                mode: 'perp',
                coinName: asset.name,
                assetId: asset.assetId,
                dexIndex: 0,
              })),
    };
  },
}));
jest.mock('../../hooks/useActiveTradeDisplay', () => ({
  useActiveTradeDisplay: () => ({
    coin: 'BTC',
    displayName: 'BTC',
    baseName: 'BTC',
    mode: 'perp',
  }),
}));
jest.mock('../../hooks/usePerpsActiveAssetCtxDisplay', () => ({
  usePerpsActiveAssetCtxDisplay: jest.fn(),
}));
jest.mock('@onekeyhq/kit/src/hooks/useAppNavigation', () => jest.fn());
jest.mock('@onekeyhq/kit/src/hooks/useListenTabFocusState', () => jest.fn());
jest.mock('@onekeyhq/kit/src/utils/coldStartImagePreload', () => ({
  prewarmPerpsTokenSelectorImages: jest.fn(),
}));
jest.mock('@onekeyhq/kit/src/components/Token', () => ({ Token: () => null }));
jest.mock('@onekeyhq/kit/src/views/Market/components/PerpsBadges', () => ({
  PerpDexBadge: () => null,
}));
jest.mock('../../utils/preloadPerpsTokenSelector', () => ({
  preloadPerpsMobileTokenSelectorPage: jest.fn(),
}));
jest.mock('../../utils/mobileLayoutTrace', () => ({
  tracePerpsMobileLayout: jest.fn(),
}));
jest.mock('../../utils/tokenSelectorPerf', () => ({
  startTokenSelectorPerfMeasure: () => undefined,
}));
jest.mock('./SortableHeaderCell', () => ({ SortableHeaderCell: () => null }));
jest.mock('./FavoritesEmptyState', () => ({
  FavoritesEmptyState: () => <div>Empty favorites</div>,
}));
jest.mock('./PerpTokenSelectorRow', () => ({
  SPOT_TOKEN_SELECTOR_DESKTOP_COLUMN_LAYOUT: {
    asset: { flex: 1 },
    price: { flex: 1 },
    change24h: { flex: 1 },
    volume: { flex: 1 },
    marketCap: { flex: 1 },
  },
  MIXED_TOKEN_SELECTOR_DESKTOP_COLUMN_LAYOUT: {
    volume: { flex: 1 },
    marketCap: { flex: 1 },
  },
  TradingModeBadge: () => null,
  PerpTokenSelectorRow: ({
    mockedToken,
    isKeyboardSelected,
    registerKeyboardRow,
  }: {
    mockedToken: ITokenSelectorListItem;
    isKeyboardSelected: boolean;
    registerKeyboardRow: (coin: string, node: unknown) => void;
  }) => (
    <div
      ref={(node) => registerKeyboardRow(mockedToken.tokenName ?? '', node)}
      data-testid={`row-${mockedToken.tokenName ?? ''}`}
      data-selected={isKeyboardSelected}
    >
      {mockedToken.tokenName}
    </div>
  ),
}));
jest.mock('@onekeyhq/components', () => {
  const Primitive = ({
    children,
    onPress,
    role,
  }: {
    children?: ReactNode;
    onPress?: () => void;
    role?: string;
  }) =>
    onPress ? (
      <button type="button" onClick={onPress}>
        {children}
      </button>
    ) : (
      <div role={role}>{children}</div>
    );
  return {
    Badge: Object.assign(Primitive, { Text: Primitive }),
    XStack: Primitive,
    YStack: Primitive,
    ScrollView: Primitive,
    SizableText: Primitive,
    DebugRenderTracker: Primitive,
    Icon: () => null,
    Spinner: () => null,
    Popover: ({ renderContent }: { renderContent: ReactNode }) => renderContent,
    usePopoverContext: () => ({ closePopover: jest.fn() }),
    ListView: ({
      data,
      renderItem,
      ListEmptyComponent,
    }: {
      data: ITokenSelectorListItem[];
      renderItem: (props: { item: ITokenSelectorListItem }) => ReactElement;
      ListEmptyComponent: ReactNode;
    }) => (
      <div>
        {data.length
          ? data.map((item) => (
              <div key={item.tokenName}>{renderItem({ item })}</div>
            ))
          : ListEmptyComponent}
      </div>
    ),
    SearchBar: ({
      onChange,
      onChangeText,
      onKeyPress,
      onSubmitEditing,
    }: {
      onChange: (event: { nativeEvent: { text: string } }) => void;
      onChangeText: (text: string) => void;
      onKeyPress: (event: KeyboardEvent<HTMLInputElement>) => void;
      onSubmitEditing: (event: {
        nativeEvent: { text: string; isComposing: boolean };
        preventDefault: () => void;
      }) => void;
    }) => {
      const timeout = useRef<ReturnType<typeof setTimeout> | undefined>(
        undefined,
      );
      return (
        <input
          aria-label="Search asset"
          onChange={(event) => {
            const text = event.target.value;
            onChange({ nativeEvent: { text } });
            clearTimeout(timeout.current);
            timeout.current = setTimeout(() => onChangeText(text), 300);
          }}
          onKeyDown={(event) => {
            onKeyPress(event);
            if (event.key === 'Enter')
              onSubmitEditing({
                nativeEvent: {
                  text: event.currentTarget.value,
                  isComposing: event.nativeEvent.isComposing,
                },
                preventDefault: () => event.preventDefault(),
              });
          }}
        />
      );
    },
  };
});

function TestSelector({
  query = '',
  tab = 'perps',
  favorites = ['BTC', 'ETH', 'SOL'],
}: {
  query?: string;
  tab?: string;
  favorites?: string[];
}) {
  const [search, setQuery] = useState(query);
  const [config, setConfig] = useState<IPerpTokenSelectorConfig>({
    activeTab: tab,
    field: 'volume24h',
    direction: 'desc',
  });
  const [favoriteState, setFavorites] = useState<IFavorites>({ favorites });
  const [order, setOrder] = useState<IOrder>({ sequence: [] });
  const value = useMemo(
    () => ({
      query: search,
      setQuery,
      config,
      setConfig,
      favorites: favoriteState,
      setFavorites,
      order,
      setOrder,
    }),
    [search, config, favoriteState, order],
  );
  return (
    <mockState.Provider value={value}>
      <PerpTokenSelector />
    </mockState.Provider>
  );
}
async function mount(props: Parameters<typeof TestSelector>[0] = {}) {
  await act(async () => {
    render(<TestSelector {...props} />);
  });
  return screen.getByRole('textbox', { name: 'Search asset' });
}
function selected() {
  return screen.getByRole('status').textContent;
}
function key(input: HTMLElement, value: string, extra = {}) {
  fireEvent.keyDown(input, { key: value, ...extra });
}

describe('PerpTokenSelector keyboard and pointer interactions', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    HTMLElement.prototype.scrollIntoView = jest.fn();
  });
  afterEach(() => {
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it.each(['', 'BTC'])(
    'restores selection after reverting input before debounce (%s)',
    async (query) => {
      const input = await mount({ query });
      expect(selected()).toBe('BTC');
      fireEvent.change(input, { target: { value: `${query}a` } });
      expect(selected()).toBe('');
      fireEvent.change(input, { target: { value: query } });
      expect(selected()).toBe('BTC');
      await act(async () => {
        jest.advanceTimersByTime(300);
      });
      expect(selected()).toBe('BTC');
      await act(async () => {
        key(input, 'Enter');
      });
      expect(mockSwitch).toHaveBeenCalledWith({ mode: 'perp', coin: 'BTC' });
    },
  );

  it('defaults to the first category and completed search result', async () => {
    const input = await mount();
    fireEvent.click(screen.getByText('Stocks'));
    expect(selected()).toBe('ETH');
    fireEvent.change(input, { target: { value: 'SOL' } });
    expect(selected()).toBe('');
    await act(async () => {
      key(input, 'Enter');
      key(input, 's', { ctrlKey: true });
    });
    expect(mockSwitch).not.toHaveBeenCalled();
    expect(mockFavorite).not.toHaveBeenCalled();
    await act(async () => {
      jest.advanceTimersByTime(300);
    });
    expect(selected()).toBe('SOL');
  });

  it('wraps primary tabs with a query and preserves modified arrows and IME', async () => {
    const input = await mount({ query: 'BTC' });
    fireEvent.change(input, { target: { value: 'BTC' } });
    mockActions.current.setTradeRouteViewState.mockClear();
    key(input, 'ArrowRight');
    expect(mockActions.current.setTradeRouteViewState).toHaveBeenLastCalledWith(
      { tokenSelectorTab: 'spot' },
    );
    key(input, 'ArrowRight');
    expect(mockActions.current.setTradeRouteViewState).toHaveBeenLastCalledWith(
      { tokenSelectorTab: 'favorites' },
    );
    expect(selected()).toBe('BTC');
    key(input, 'ArrowLeft');
    expect(mockActions.current.setTradeRouteViewState).toHaveBeenLastCalledWith(
      { tokenSelectorTab: 'spot' },
    );
    mockActions.current.setTradeRouteViewState.mockClear();
    key(input, 'ArrowLeft', { shiftKey: true });
    key(input, 'ArrowRight', { isComposing: true });
    expect(mockActions.current.setTradeRouteViewState).not.toHaveBeenCalled();
    expect((input as HTMLInputElement).value).toBe('BTC');
  });

  it('shares one target between pointer, arrow keys, Enter and favorites', async () => {
    const input = await mount();
    key(input, 'ArrowDown');
    expect(selected()).toBe('ETH');
    fireEvent.mouseMove(screen.getByTestId('row-SOL'));
    expect(selected()).toBe('SOL');
    expect(
      screen
        .getAllByTestId(/^row-/)
        .filter((row) => row.dataset.selected === 'true'),
    ).toHaveLength(1);
    await act(async () => {
      key(input, 's', { ctrlKey: true });
      key(input, 'Enter');
    });
    expect(mockFavorite).toHaveBeenCalledWith({
      mode: 'perp',
      coin: 'SOL',
      action: 'remove',
    });
    expect(mockSwitch).toHaveBeenCalledWith({ mode: 'perp', coin: 'SOL' });
  });

  it('selects next after deleting the first favorite, previous after last, and none when empty', async () => {
    const input = await mount({ tab: 'favorites' });
    await act(async () => {
      key(input, 's', { ctrlKey: true });
    });
    expect(selected()).toBe('ETH');
    key(input, 'ArrowDown');
    expect(selected()).toBe('SOL');
    await act(async () => {
      key(input, 's', { ctrlKey: true });
    });
    expect(selected()).toBe('ETH');
    await act(async () => {
      key(input, 's', { ctrlKey: true });
    });
    expect(selected()).toBe('');
    expect(screen.getByText('Empty favorites')).toBeTruthy();
    await act(async () => {
      key(input, 'Enter');
      key(input, 's', { ctrlKey: true });
    });
    expect(mockFavorite).toHaveBeenCalledTimes(3);
    expect(mockSwitch).not.toHaveBeenCalled();
  });
});
