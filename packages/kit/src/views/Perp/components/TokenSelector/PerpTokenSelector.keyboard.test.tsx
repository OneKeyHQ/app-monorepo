/** @jest-environment jsdom */

import type { PropsWithChildren, ReactNode } from 'react';

import { act, fireEvent, render, screen } from '@testing-library/react';

import platformEnv from '@onekeyhq/shared/src/platformEnv';
import type { EShortcutEvents } from '@onekeyhq/shared/src/shortcuts/shortcuts.enum';
import type {
  IPerpsUniverse,
  ISpotUniverse,
} from '@onekeyhq/shared/types/hyperliquid';

import {
  PerpTokenSelector,
  PerpTokenSelectorMobile,
} from './PerpTokenSelector';

import type { ITokenSelectorListItem } from './PerpTokenSelector';

const mockOriginalAddEventListener = globalThis.addEventListener;
const mockOriginalRemoveEventListener = globalThis.removeEventListener;

const mockUniverse: IPerpsUniverse[] = Array.from(
  { length: 12 },
  (_, index) => ({
    name: ['BTC', 'ETH'][index] ?? `TOKEN${index}`,
    assetId: index,
    marginTableId: index,
    szDecimals: 3,
    maxLeverage: 20,
  }),
);
let mockFiltered = { assetsByDex: [mockUniverse], query: '' };
const mockListeners = new Set<() => void>();
let mockDelayFilter = false;
let mockClosePopover = () => {};
const mockSwitchInstrument = jest.fn().mockResolvedValue(undefined);
const mockToggleFavorite = jest.fn<Promise<unknown> | void, [string]>();
const mockScrollToOffset = jest.fn();
const mockScrollIntoView = jest.fn();
let mockShortcutHandler: ((event: EShortcutEvents) => void) | undefined;
let mockRouteStatus = { focused: true, hidden: false };
const mockRouteListeners = new Set<() => void>();
let mockPageFocused = true;
const mockCtxs = { assetCtxsByDex: [] };
const mockOrder = { sequence: [] };
const mockEmpty = {};
let mockSpotUniverses: ISpotUniverse[] = [];
let mockSpotContexts: Record<string, { markPx: string; dayNtlVlm: string }> =
  {};
const mockActiveAccount = { walletType: 'software' };
const mockPushModal = jest.fn();
const mockPushFullModal = jest.fn();
const mockNavigation = {
  pushModal: mockPushModal,
  pushFullModal: mockPushFullModal,
};
const mockActions = {
  current: {
    switchTradeInstrument: mockSwitchInstrument,
    setTradeRouteViewState: jest.fn(),
    markAllAssetCtxsRequired: jest.fn(),
    markAllAssetCtxsNotRequired: jest.fn(),
  },
};
const mockIntl = { formatMessage: ({ id }: { id: string }) => id };

function updateFiltered(query: string, assets = mockUniverse) {
  mockFiltered = {
    assetsByDex: [
      assets.filter((item) => item.name.includes(query.toUpperCase())),
    ],
    query,
  };
  mockListeners.forEach((listener) => listener());
}

jest.mock('@react-navigation/native', () => ({
  useIsFocused: () => mockPageFocused,
}));
jest.mock('react-native', () => ({
  ...jest.requireActual<typeof import('react-native')>('react-native'),
  useWindowDimensions: () => ({
    width: 1280,
    height: 720,
    scale: 1,
    fontScale: 1,
  }),
}));
jest.mock('../../../../../../components/src/forms/Input', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    Input: React.forwardRef<
      HTMLInputElement,
      {
        value: string;
        onChangeText: (text: string) => void;
        onChange?: (event: { nativeEvent: { text: string } }) => void;
        onKeyPress?: (event: {
          nativeEvent: KeyboardEvent;
          preventDefault: () => void;
        }) => void;
        onSubmitEditing?: (event: {
          nativeEvent: { text: string };
          preventDefault: () => void;
        }) => void;
        onCompositionStart?: React.CompositionEventHandler<HTMLInputElement>;
        onCompositionEnd?: React.CompositionEventHandler<HTMLInputElement>;
      }
    >((props, ref) => (
      <input
        ref={ref}
        aria-label="Asset search"
        value={props.value}
        onCompositionStart={props.onCompositionStart}
        onCompositionEnd={props.onCompositionEnd}
        onChange={(event) => {
          props.onChange?.({ nativeEvent: { text: event.target.value } });
          props.onChangeText(event.target.value);
        }}
        onKeyDown={(event) => {
          props.onKeyPress?.({
            nativeEvent: event.nativeEvent,
            preventDefault: () => event.preventDefault(),
          });
          if (
            event.key === 'Enter' &&
            !event.nativeEvent.isComposing &&
            event.nativeEvent.keyCode !== 229
          ) {
            props.onSubmitEditing?.({
              nativeEvent: { text: event.currentTarget.value },
              preventDefault: () => event.preventDefault(),
            });
          }
        }}
      />
    )),
  };
});
jest.mock('@onekeyhq/components', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const Box = ({
    children,
    onPress,
    role,
    onKeyDownCapture,
  }: PropsWithChildren<{
    onPress?: () => void;
    role?: string;
    onKeyDownCapture?: React.KeyboardEventHandler<HTMLDivElement>;
  }>) =>
    onPress ? (
      <button onClick={onPress}>{children}</button>
    ) : (
      <div role={role} onKeyDownCapture={onKeyDownCapture}>
        {children}
      </div>
    );
  return {
    Badge: Box,
    DebugRenderTracker: Box,
    ScrollView: Box,
    SizableText: Box,
    NumberSizeableText: Box,
    XStack: Box,
    YStack: Box,
    Icon: () => null,
    Spinner: () => null,
    Tooltip: () => null,
    useIsSplitMainActive: () => true,
    useShortcuts: (
      _event: EShortcutEvents,
      handler: (event: EShortcutEvents) => void,
    ) => {
      React.useEffect(() => {
        mockShortcutHandler = handler;
        return () => {
          if (mockShortcutHandler === handler) mockShortcutHandler = undefined;
        };
      }, [handler]);
    },
    SearchBar: jest.requireActual<
      typeof import('../../../../../../components/src/layouts/SearchBar')
    >('../../../../../../components/src/layouts/SearchBar').SearchBar,
    usePopoverContext: () => ({ closePopover: () => mockClosePopover() }),
    Popover: ({
      open,
      onOpenChange,
      renderContent,
    }: {
      open: boolean;
      onOpenChange: (open: boolean) => void;
      renderContent: ReactNode;
    }) => {
      mockClosePopover = () => onOpenChange(false);
      return (
        <>
          <button onClick={() => onOpenChange(true)}>Open selector</button>
          {open ? <div role="dialog">{renderContent}</div> : null}
        </>
      );
    },
    ListView: React.forwardRef<
      { scrollToOffset: typeof mockScrollToOffset },
      {
        data: ITokenSelectorListItem[];
        renderItem: (args: { item: ITokenSelectorListItem }) => ReactNode;
        keyExtractor: (item: ITokenSelectorListItem) => string;
      }
    >(({ data, renderItem, keyExtractor }, ref) => {
      React.useImperativeHandle(ref, () => ({
        scrollToOffset: mockScrollToOffset,
      }));
      return (
        <div>
          {data.map((item) => (
            <div key={keyExtractor(item)}>{renderItem({ item })}</div>
          ))}
        </div>
      );
    }),
  };
});
jest.mock('@onekeyhq/kit/src/hooks/useListenTabFocusState', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    __esModule: true,
    default: function useMockListenTabFocusState(
      _tab: unknown,
      callback: (focused: boolean, hidden: boolean) => void,
    ) {
      const route = React.useSyncExternalStore(
        (listener) => {
          mockRouteListeners.add(listener);
          return () => {
            mockRouteListeners.delete(listener);
          };
        },
        () => mockRouteStatus,
      );
      React.useEffect(
        () => callback(route.focused, route.hidden),
        [callback, route],
      );
    },
  };
});
jest.mock('@onekeyhq/kit/src/background/instance/backgroundApiProxy', () => ({
  serviceHyperliquid: {
    getSpotMeta: async () => ({ universes: mockSpotUniverses }),
    refreshSpotMeta: async () => undefined,
  },
  simpleDb: { perp: { getExpectMaxBuilderFee: async () => 1 } },
}));
jest.mock('@onekeyhq/kit/src/components/Token', () => ({ Token: () => null }));
jest.mock(
  '@onekeyhq/kit/src/hooks/useAppNavigation',
  () => () => mockNavigation,
);
jest.mock('@onekeyhq/kit/src/views/Market/components/PerpsBadges', () => ({
  PerpDexBadge: () => null,
}));
jest.mock('@onekeyhq/kit/src/utils/coldStartImagePreload', () => ({
  prewarmPerpsTokenSelectorImages: async () => undefined,
}));
jest.mock('../../utils/preloadPerpsTokenSelector', () => ({
  preloadPerpsMobileTokenSelectorPage: () => undefined,
}));
jest.mock('@onekeyhq/kit/src/states/jotai/contexts/hyperliquid', () => ({
  useHyperliquidActions: () => mockActions,
}));
jest.mock('@onekeyhq/kit/src/states/jotai/contexts/hyperliquid/atoms', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    usePerpsAllAssetsFilteredAtom: () => [
      React.useSyncExternalStore(
        (listener) => {
          mockListeners.add(listener);
          return () => {
            mockListeners.delete(listener);
          };
        },
        () => mockFiltered,
      ),
    ],
    usePerpsAllAssetCtxsAtom: () => [mockCtxs],
    usePerpsTokenSearchAliasesAtom: () => [undefined],
  };
});
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    usePerpTokenSelectorConfigPersistAtom: () =>
      React.useState({ activeTab: 'perps', field: '', direction: 'asc' }),
    usePerpTokenSelectorTabsAtom: () => [undefined],
    usePerpsActiveAccountAtom: () => [mockActiveAccount],
    usePerpsFavoritesOrderPersistAtom: () => [mockOrder],
    useSpotExternalMarketCapsAtom: () => [mockEmpty],
    spotAssetCtxsMapAtom: {
      get: async () => mockSpotContexts,
      sub: () => () => {},
    },
  };
});
jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms/spot', () => ({
  useSpotActiveAssetCtxAtom: () => [{}],
}));
jest.mock('../../hooks', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  return {
    usePerpTokenSelector: () => {
      const [searchQuery, setQuery] = React.useState('');
      return {
        searchQuery,
        setSearchQuery: (query: string) => {
          setQuery(query.trim().slice(0, 64));
          if (!mockDelayFilter) updateFiltered(query.trim().slice(0, 64));
        },
        refreshAllAssets: async () => undefined,
      };
    },
    usePerpActiveTabValidation: () => undefined,
    usePerpsFavorites: () => ({ favoriteItems: [], isReady: true }),
    usePrewarmPerpsTokenSelectorImages: () => async () => undefined,
  };
});
jest.mock('../../hooks/useActiveTradeDisplay', () => ({
  useActiveTradeDisplay: () => ({
    displayName: 'ETH',
    baseName: 'ETH',
    coin: 'ETH',
    mode: 'perp',
  }),
}));
jest.mock('../../hooks/usePerpsActiveAssetCtxDisplay', () => ({
  usePerpsActiveAssetCtxDisplay: () => ({}),
}));
jest.mock('./FavoritesEmptyState', () => ({
  FavoritesEmptyState: () => <div>No favorites</div>,
}));
jest.mock('./SortableHeaderCell', () => ({ SortableHeaderCell: () => null }));
jest.mock('./PerpTokenSelectorRow', () => ({
  PerpTokenSelectorRow: ({
    mockedToken,
    isKeyboardSelected,
    registerKeyboardRow,
    registerKeyboardFavorite,
  }: {
    mockedToken: ITokenSelectorListItem;
    isKeyboardSelected?: boolean;
    registerKeyboardRow?: (coin: string, node: unknown) => void;
    registerKeyboardFavorite?: (coin: string, toggle: () => void) => () => void;
  }) => {
    let unregisterFavorite: (() => void) | undefined;
    return (
      <div
        ref={(node) => {
          unregisterFavorite?.();
          const coin =
            mockedToken.spotUniverse?.name ?? mockedToken.tokenName ?? '';
          registerKeyboardRow?.(coin, node);
          unregisterFavorite = node
            ? registerKeyboardFavorite?.(coin, () => mockToggleFavorite(coin))
            : undefined;
        }}
        data-testid={`row-${mockedToken.spotUniverse?.name ?? mockedToken.tokenName}`}
        data-selected={Boolean(isKeyboardSelected)}
      >
        {mockedToken.tokenName}
      </div>
    );
  },
  TradingModeBadge: () => null,
  SPOT_TOKEN_SELECTOR_DESKTOP_COLUMN_LAYOUT: {
    asset: {},
    price: {},
    change24h: {},
    volume: {},
    marketCap: {},
  },
  MIXED_TOKEN_SELECTOR_DESKTOP_COLUMN_LAYOUT: {
    asset: {},
    price: {},
    change24h: {},
    volume: {},
    marketCap: {},
    fundingRate: {},
    openInterest: {},
  },
}));
jest.mock('react-intl', () => ({ useIntl: () => mockIntl }));

async function openSelector() {
  render(<PerpTokenSelector />);
  await act(async () => {
    fireEvent.click(screen.getByText('Open selector'));
  });
  return screen.getByRole('textbox', { name: 'Asset search' });
}

describe('Perps selector keyboard navigation', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    jest.replaceProperty(platformEnv, 'isDesktop', false);
    globalThis.addEventListener =
      EventTarget.prototype.addEventListener.bind(globalThis);
    globalThis.removeEventListener =
      EventTarget.prototype.removeEventListener.bind(globalThis);
    HTMLElement.prototype.scrollIntoView = mockScrollIntoView;
    mockFiltered = { assetsByDex: [mockUniverse], query: '' };
    mockDelayFilter = false;
    mockSpotUniverses = [];
    mockSpotContexts = {};
    mockRouteStatus = { focused: true, hidden: false };
    mockPageFocused = true;
  });
  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    globalThis.addEventListener = mockOriginalAddEventListener;
    globalThis.removeEventListener = mockOriginalRemoveEventListener;
  });

  it('moves the highlight and selects only the highlighted instrument', async () => {
    const input = await openSelector();
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(mockSwitchInstrument).not.toHaveBeenCalled();
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(screen.getByTestId('row-BTC').dataset.selected).toBe('true');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(screen.getByTestId('row-ETH').dataset.selected).toBe('true');
    fireEvent.keyDown(input, { key: 'ArrowUp' });
    await act(async () => {
      fireEvent.keyDown(input, { key: 'Enter' });
    });
    expect(mockSwitchInstrument).toHaveBeenCalledWith({
      mode: 'perp',
      coin: 'BTC',
    });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('scrolls with the highlight and preserves its asset identity across refreshed results', async () => {
    const input = await openSelector();
    for (let i = 0; i < 9; i += 1)
      fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(screen.getByTestId('row-TOKEN8').dataset.selected).toBe('true');
    expect(mockScrollIntoView.mock.instances).toContain(
      screen.getByTestId('row-TOKEN8'),
    );
    act(() => {
      updateFiltered(
        '',
        [...mockUniverse].toReversed().map((item) => ({ ...item })),
      );
    });
    expect(screen.getByTestId('row-TOKEN8').dataset.selected).toBe('true');
    await act(async () => {
      fireEvent.keyDown(input, { key: 'Enter' });
    });
    expect(mockSwitchInstrument).toHaveBeenCalledWith({
      mode: 'perp',
      coin: 'TOKEN8',
    });
  });

  it('rejects the old highlight during debounce and while filtered data is stale', async () => {
    const input = await openSelector();
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.change(input, { target: { value: 'ETH' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(mockSwitchInstrument).not.toHaveBeenCalled();
    mockDelayFilter = true;
    act(() => {
      jest.advanceTimersByTime(300);
    });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(mockSwitchInstrument).not.toHaveBeenCalled();
    act(() => {
      updateFiltered('ETH');
    });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    await act(async () => {
      fireEvent.keyDown(input, { key: 'Enter' });
    });
    expect(mockSwitchInstrument).toHaveBeenCalledWith({
      mode: 'perp',
      coin: 'ETH',
    });
  });

  it('switches primary tabs with horizontal arrows and clears the old highlight', async () => {
    const input = await openSelector();
    const setRoute = mockActions.current.setTradeRouteViewState;
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'ArrowRight' });
    expect(setRoute).toHaveBeenLastCalledWith({ tokenSelectorTab: 'spot' });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(mockSwitchInstrument).not.toHaveBeenCalled();
    setRoute.mockClear();
    fireEvent.keyDown(input, { key: 'ArrowRight' });
    expect(setRoute).not.toHaveBeenCalled();
    fireEvent.keyDown(input, { key: 'ArrowLeft' });
    expect(setRoute).toHaveBeenLastCalledWith({ tokenSelectorTab: 'perps' });
    expect(screen.getByTestId('row-BTC').dataset.selected).toBe('false');
    fireEvent.keyDown(input, { key: 'ArrowLeft' });
    expect(setRoute).toHaveBeenLastCalledWith({
      tokenSelectorTab: 'favorites',
    });
    setRoute.mockClear();
    fireEvent.keyDown(input, { key: 'ArrowLeft' });
    expect(setRoute).not.toHaveBeenCalled();
  });

  it('preserves horizontal editing keys and IME composition', async () => {
    const input = await openSelector();
    const setRoute = mockActions.current.setTradeRouteViewState;
    setRoute.mockClear();
    for (const modifier of ['metaKey', 'ctrlKey', 'altKey', 'shiftKey']) {
      expect(
        fireEvent.keyDown(input, { key: 'ArrowRight', [modifier]: true }),
      ).toBe(true);
    }
    fireEvent.keyDown(input, { key: 'ArrowRight', isComposing: true });
    fireEvent.change(input, { target: { value: 'ETH' } });
    expect(fireEvent.keyDown(input, { key: 'ArrowLeft' })).toBe(true);
    expect(setRoute).not.toHaveBeenCalled();
  });

  it.each(['ArrowUp', 'ArrowDown'])(
    'preserves modified %s for native input editing without moving the highlight',
    async (key) => {
      const input = await openSelector();
      fireEvent.change(input, { target: { value: 'TOKEN' } });
      act(() => {
        jest.advanceTimersByTime(300);
      });
      fireEvent.keyDown(input, { key: 'ArrowDown' });
      fireEvent.keyDown(input, { key: 'ArrowDown' });
      expect(screen.getByTestId('row-TOKEN3').dataset.selected).toBe('true');
      mockScrollIntoView.mockClear();
      for (const modifier of ['metaKey', 'ctrlKey', 'altKey', 'shiftKey']) {
        expect(fireEvent.keyDown(input, { key, [modifier]: true })).toBe(true);
        expect(screen.getByTestId('row-TOKEN3').dataset.selected).toBe('true');
      }
      expect(mockScrollIntoView).not.toHaveBeenCalled();
      expect(mockSwitchInstrument).not.toHaveBeenCalled();
    },
  );

  it('clears the highlight on tab changes and does nothing for empty results', async () => {
    const input = await openSelector();
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.click(screen.getByText('dexmarket.spot'));
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(mockSwitchInstrument).not.toHaveBeenCalled();
  });

  it('leaves composing arrows and the IME confirmation Enter untouched', async () => {
    const input = await openSelector();
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(screen.getByTestId('row-BTC').dataset.selected).toBe('true');
    fireEvent.compositionStart(input);
    fireEvent.keyDown(input, { key: 'ArrowDown', keyCode: 229 });
    fireEvent.keyDown(input, { key: 'ArrowDown', isComposing: true });
    expect(screen.getByTestId('row-BTC').dataset.selected).toBe('true');
    expect(screen.getByTestId('row-ETH').dataset.selected).toBe('false');
    fireEvent.keyDown(input, { key: 'Enter', keyCode: 229 });
    fireEvent.compositionEnd(input);
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(mockSwitchInstrument).not.toHaveBeenCalled();
    act(() => {
      jest.advanceTimersByTime(1);
    });
    await act(async () => {
      fireEvent.keyDown(input, { key: 'Enter' });
    });
    expect(mockSwitchInstrument).toHaveBeenCalledTimes(1);
  });

  it('selects the actual spot pair instead of its displayed base symbol', async () => {
    const pair: ISpotUniverse = {
      name: '@107',
      index: 107,
      tokens: [1, 0],
      isCanonical: true,
      assetId: 10_107,
      baseName: 'UBTC',
      quoteName: 'USDC',
      displayName: 'BTC/USDC',
      baseSzDecimals: 5,
    };
    mockSpotUniverses = [pair];
    mockSpotContexts = { '@107': { markPx: '100', dayNtlVlm: '100000' } };
    const input = await openSelector();
    fireEvent.click(screen.getByText('dexmarket.spot'));
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(screen.getByTestId('row-@107').dataset.selected).toBe('true');
    fireEvent.keyDown(input, { key: 's', ctrlKey: true });
    expect(mockToggleFavorite).toHaveBeenLastCalledWith('@107');
    await act(async () => {
      fireEvent.keyDown(input, { key: 'Enter' });
    });
    expect(mockSwitchInstrument).toHaveBeenCalledWith({
      mode: 'spot',
      coin: '@107',
      spotUniverse: pair,
    });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it.each(['metaKey', 'ctrlKey'])(
    'favorites only the highlighted asset with %s+S without selecting it',
    async (modifier) => {
      const input = await openSelector();
      fireEvent.keyDown(input, { key: 'ArrowDown' });
      fireEvent.keyDown(input, { key: 's', [modifier]: true });
      expect(mockToggleFavorite).toHaveBeenLastCalledWith('BTC');
      fireEvent.keyDown(input, { key: 'ArrowDown' });
      fireEvent.keyDown(input, { key: 's', [modifier]: true });
      expect(mockToggleFavorite).toHaveBeenLastCalledWith('ETH');
      expect(mockToggleFavorite).toHaveBeenCalledTimes(2);
      expect(mockSwitchInstrument).not.toHaveBeenCalled();
      expect(screen.getByRole('dialog')).toBeDefined();
    },
  );

  it('captures favorite shortcuts from list focus only while inside the selector', async () => {
    const input = await openSelector();
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    const outsideHandler = jest.fn();
    document.body.addEventListener('keydown', outsideHandler);
    try {
      const row = screen.getByTestId('row-BTC');
      row.tabIndex = 0;
      row.focus();
      expect(document.activeElement).toBe(row);
      expect(fireEvent.keyDown(row, { key: 's', metaKey: true })).toBe(false);
      expect(mockToggleFavorite).toHaveBeenCalledTimes(1);
      expect(mockToggleFavorite).toHaveBeenCalledWith('BTC');
      expect(outsideHandler).not.toHaveBeenCalled();
      expect(
        fireEvent.keyDown(document.body, { key: 's', metaKey: true }),
      ).toBe(true);
      expect(outsideHandler).toHaveBeenCalledTimes(1);
      act(() => mockClosePopover());
      expect(
        fireEvent.keyDown(document.body, { key: 's', metaKey: true }),
      ).toBe(true);
      expect(mockToggleFavorite).toHaveBeenCalledTimes(1);
      expect(outsideHandler).toHaveBeenCalledTimes(2);
    } finally {
      document.body.removeEventListener('keydown', outsideHandler);
    }
  });

  it('ignores favorite shortcuts without a current highlight, while composing, repeating or filtering', async () => {
    const input = await openSelector();
    fireEvent.keyDown(input, { key: 's', metaKey: true });
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 's', metaKey: true, repeat: true });
    fireEvent.keyDown(input, { key: 's', metaKey: true, isComposing: true });
    fireEvent.keyDown(input, { key: 's', metaKey: true, keyCode: 229 });
    fireEvent.keyDown(input, { key: 's' });
    expect(mockToggleFavorite).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: 'ETH' } });
    fireEvent.keyDown(input, { key: 's', metaKey: true });
    mockDelayFilter = true;
    act(() => jest.advanceTimersByTime(300));
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 's', metaKey: true });
    expect(mockToggleFavorite).not.toHaveBeenCalled();
    act(() => updateFiltered('ETH'));
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 's', metaKey: true });
    expect(mockToggleFavorite).toHaveBeenLastCalledWith('ETH');
    act(() => updateFiltered('ETH', []));
    fireEvent.keyDown(input, { key: 's', metaKey: true });
    expect(mockToggleFavorite).toHaveBeenCalledTimes(1);
  });

  it('does not switch twice while a keyboard selection is pending', async () => {
    let finishSwitch: (() => void) | undefined;
    mockSwitchInstrument.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishSwitch = resolve;
        }),
    );
    const input = await openSelector();
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'Enter' });
    fireEvent.keyDown(input, { key: 'Enter' });
    expect(mockSwitchInstrument).toHaveBeenCalledTimes(1);
    await act(async () => {
      finishSwitch?.();
    });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('does not toggle a favorite twice while its persistence is pending', async () => {
    let finishFavorite: (() => void) | undefined;
    mockToggleFavorite.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishFavorite = resolve;
        }),
    );
    const input = await openSelector();
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 's', metaKey: true });
    fireEvent.keyDown(input, { key: 's', metaKey: true });
    expect(mockToggleFavorite).toHaveBeenCalledTimes(1);
    await act(async () => {
      finishFavorite?.();
    });
    fireEvent.keyDown(input, { key: 's', metaKey: true });
    expect(mockToggleFavorite).toHaveBeenCalledTimes(2);
  });

  it.each([false, true])(
    'does not claim Cmd/Ctrl+K in wide or narrow layouts (desktop=%s)',
    (isDesktop) => {
      jest.replaceProperty(platformEnv, 'isDesktop', isDesktop);
      mockShortcutHandler = undefined;
      const view = render(<PerpTokenSelector />);
      for (const modifier of ['metaKey', 'ctrlKey']) {
        expect(
          fireEvent.keyDown(document.body, { key: 'k', [modifier]: true }),
        ).toBe(true);
      }
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(mockShortcutHandler).toBeUndefined();
      view.rerender(<PerpTokenSelectorMobile />);
      for (const modifier of ['metaKey', 'ctrlKey']) {
        expect(
          fireEvent.keyDown(document.body, { key: 'k', [modifier]: true }),
        ).toBe(true);
      }
      expect(mockPushFullModal).not.toHaveBeenCalled();
      expect(mockPushModal).not.toHaveBeenCalled();
      expect(mockShortcutHandler).toBeUndefined();
    },
  );

  it('announces the current keyboard target without moving input focus', async () => {
    const input = await openSelector();
    input.focus();
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(screen.getByRole('status').textContent).toBe('BTC');
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    expect(screen.getByRole('status').textContent).toBe('ETH');
    expect(document.activeElement).toBe(input);
  });

  it('closes an existing popover when its leaf page loses focus', async () => {
    await openSelector();
    act(() => {
      mockPageFocused = false;
      mockRouteStatus = { focused: true, hidden: false };
      mockRouteListeners.forEach((listener) => listener());
    });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('reports a failed favorite update and releases the keyboard action for retry', async () => {
    const error = new Error('Favorite update failed');
    const errorLog = jest
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);
    mockToggleFavorite.mockRejectedValueOnce(error);
    const input = await openSelector();
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    await act(async () => {
      fireEvent.keyDown(input, { key: 's', metaKey: true });
    });
    expect(errorLog).toHaveBeenCalledWith(
      'Failed to update token favorite:',
      error,
    );
    fireEvent.keyDown(input, { key: 's', metaKey: true });
    expect(mockToggleFavorite).toHaveBeenCalledTimes(2);
  });

  it('shows shortcut hints inside the selector', async () => {
    await openSelector();
    expect(screen.getByText('Enter')).toBeDefined();
    expect(screen.getByText('Esc')).toBeDefined();
    expect(screen.getByText('↑↓')).toBeDefined();
    expect(screen.getByText('←→')).toBeDefined();
    expect(screen.getByText('global.favorites')).toBeDefined();
  });
});
