/** @jest-environment jsdom */

import { type ComponentProps, type ReactNode, useState } from 'react';

import { DESKTOP_ORDER_BOOK_PRICE_HEIGHT, OrderBook, OrderBookMobile } from '.';

import { act, fireEvent, render, within } from '@testing-library/react';

import { usePerpLatestTrade } from '../../hooks/usePerpLatestTrade';
import { getVerticalOrderBookLayout } from '../../layouts/perpLayoutUtils';

import { DefaultLoadingNode } from './DefaultLoadingNode';
import { ORDER_BOOK_MODE_SELECTOR_HEIGHT } from './OrderBookModeToggle';

import type { IOrderBookDisplayMode } from './types';
import type {
  LayoutChangeEvent,
  StyleProp,
  TextStyle,
  ViewStyle,
} from 'react-native';

let mockVerticalLayout: ((event: LayoutChangeEvent) => void) | undefined;
let mockIsNativeAndroid = false;
let mockMarkPrice: string | undefined;
let mockTradeMode: 'perp' | 'spot' = 'perp';
let mockSpotAssetCtx: { coin: string; ctx: { markPrice: string } } | null =
  null;

jest.mock('react-intl', () => ({
  useIntl: () => ({
    formatMessage: ({ id }: { id: string }) => id,
  }),
}));

jest.mock('@tamagui/themes', () => ({
  colorTokens: {
    light: {
      green: { green3: '#efe' },
      red: { red3: '#fee' },
    },
  },
}));

jest.mock('react-native', () => ({
  Pressable: ({
    children,
    disabled,
    onPress,
    testID,
    accessibilityLabel,
    'aria-pressed': ariaPressed,
  }: {
    children?: ReactNode | ((state: { pressed: boolean }) => ReactNode);
    disabled?: boolean;
    onPress?: () => void;
    testID?: string;
    accessibilityLabel?: string;
    'aria-pressed'?: boolean;
  }) => (
    <button
      data-testid={testID}
      aria-label={accessibilityLabel}
      aria-pressed={ariaPressed}
      disabled={disabled}
      onClick={onPress}
      type="button"
    >
      {typeof children === 'function' ? children({ pressed: false }) : children}
    </button>
  ),
  StyleSheet: {
    create: <T,>(styles: T) => styles,
  },
  Text: ({
    children,
    style,
  }: {
    children?: ReactNode;
    style?: StyleProp<TextStyle>;
  }) => (
    <span
      style={{
        color: (Object.assign({}, ...[style].flat()) as TextStyle)
          .color as string,
      }}
    >
      {children}
    </span>
  ),
  TouchableOpacity: ({
    children,
    accessibilityLabel,
  }: {
    children?: ReactNode;
    accessibilityLabel?: string;
  }) => (
    <button type="button" aria-label={accessibilityLabel}>
      {children}
    </button>
  ),
  View: ({
    children,
    onLayout,
    style,
    testID,
  }: {
    children?: ReactNode;
    onLayout?: (event: LayoutChangeEvent) => void;
    style?: StyleProp<ViewStyle>;
    testID?: string;
  }) => {
    if (onLayout) mockVerticalLayout = onLayout;
    return (
      <div data-testid={testID} style={Object.assign({}, ...[style].flat())}>
        {children}
      </div>
    );
  },
}));

jest.mock('@onekeyhq/components', () => ({
  BRAND_FONT_NATIVE_FAMILY: {
    regular: 'Inter-Regular',
    medium: 'Inter-Medium',
    semibold: 'Inter-SemiBold',
    bold: 'Inter-Bold',
  },
  DashText: () => <span>--</span>,
  DebugRenderTracker: ({ children }: { children?: ReactNode }) => (
    <>{children}</>
  ),
  Haptics: { selection: jest.fn() },
  Icon: ({
    testID,
    name,
    color,
  }: {
    testID?: string;
    name: string;
    color?: string;
  }) => <span data-testid={testID} data-icon={name} data-color={color} />,
  Popover: () => null,
  Portal: {
    Body: ({ children }: { children?: ReactNode }) => <>{children}</>,
    Constant: { FULL_WINDOW_OVERLAY_PORTAL: 'full-window-overlay' },
  },
  Select: ({
    testID,
    renderTrigger,
  }: {
    testID?: string;
    renderTrigger: (props: { onPress: () => void }) => ReactNode;
  }) => (
    <div data-testid={testID}>
      {renderTrigger({ onPress: () => undefined })}
    </div>
  ),
  SizableText: ({ children }: { children?: ReactNode }) => (
    <span>{children}</span>
  ),
  Stack: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  TABULAR_NUMS: ['tabular-nums'],
  Tooltip: ({
    renderTrigger,
    renderContent,
  }: {
    renderTrigger: ReactNode;
    renderContent: string;
  }) => <div data-tooltip={renderContent}>{renderTrigger}</div>,
  XStack: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  YStack: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  useTheme: () => ({
    bgAccent: { val: '#0a0' },
    bgCriticalStrong: { val: '#f00' },
    bgHover: { val: '#f5f5f5' },
    bgSubdued: { val: '#eee' },
    borderActive: { val: '#333' },
    text: { val: '#111' },
    textSubdued: { val: '#666' },
    iconSubdued: { val: '#888' },
    iconDisabled: { val: '#ccc' },
  }),
  useThemeName: () => 'light',
}));

jest.mock('@onekeyhq/kit/src/states/jotai/contexts/hyperliquid', () => ({
  useActiveTradeInstrumentAtom: () => [{ coin: 'BTC', mode: mockTradeMode }],
}));

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  useSpotActiveAssetCtxAtom: () => [mockSpotAssetCtx],
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: {
    isNative: false,
    get isNativeAndroid() {
      return mockIsNativeAndroid;
    },
  },
}));

jest.mock('react-native-reanimated', () => ({
  useReducedMotion: () => false,
}));

jest.mock('../../hooks/usePerpsActiveAssetCtxDisplay', () => ({
  usePerpsActiveAssetCtxDisplay: () => ({
    assetCtx: mockMarkPrice ? { ctx: { markPrice: mockMarkPrice } } : undefined,
  }),
}));

jest.mock('../../hooks/useTradingPrice', () => ({
  useTradingPrice: () => ({ midPrice: undefined }),
}));

describe('OrderBook empty vertical state', () => {
  it('updates both sides immediately as the available height changes', () => {
    const props = {
      asks: [],
      bids: [],
      horizontal: false,
      initialContainerHeight: 640,
      maxLevelsPerSide: 18,
      showTickSelector: false,
      variant: 'web' as const,
    };
    const view = render(<OrderBook {...props} />);
    const resize = (height: number) => {
      act(() => {
        mockVerticalLayout?.({
          nativeEvent: { layout: { height, width: 300, x: 0, y: 0 } },
        } as LayoutChangeEvent);
      });
    };
    resize(640);
    expect(view.getAllByText('--')).toHaveLength(62);
    resize(500);
    expect(view.getAllByText('--')).toHaveLength(44);
    resize(546);
    expect(view.getAllByText('--')).toHaveLength(50);
    resize(668);
    expect(view.getAllByText('--')).toHaveLength(68);
    resize(500);
    expect(view.getAllByText('--')).toHaveLength(44);
  });

  it('fills the measured desktop layout with placeholder levels', () => {
    const containerHeight = 640;
    const maxLevelsPerSide = 18;
    const { levelsPerSide } = getVerticalOrderBookLayout(
      containerHeight - ORDER_BOOK_MODE_SELECTOR_HEIGHT,
      maxLevelsPerSide,
      true,
      DESKTOP_ORDER_BOOK_PRICE_HEIGHT + 1,
    );

    const { getAllByText, getByText } = render(
      <OrderBook
        asks={[]}
        bids={[]}
        horizontal={false}
        initialContainerHeight={containerHeight}
        maxLevelsPerSide={maxLevelsPerSide}
        showTickSelector={false}
        variant="web"
      />,
    );

    expect(getAllByText('--')).toHaveLength(levelsPerSide * 2 * 3 + 2);
    expect(getByText('B 50%')).toBeTruthy();
    expect(getByText('50% S')).toBeTruthy();
  });
});

describe('OrderBook populated vertical resizing', () => {
  it('updates rows and depth bars before the next animation frame', () => {
    const frameGlobals = globalThis as {
      requestAnimationFrame: (callback: (timestamp: number) => void) => number;
      cancelAnimationFrame: (handle: number) => void;
    };
    const requestFrame = jest
      .spyOn(frameGlobals, 'requestAnimationFrame')
      .mockReturnValue(1);
    const cancelFrame = jest
      .spyOn(frameGlobals, 'cancelAnimationFrame')
      .mockImplementation(() => undefined);
    const onSelectLevel = jest.fn();
    const view = render(
      <OrderBook
        asks={Array.from({ length: 18 }, (_, index) => ({
          n: 1,
          px: String(101 + index),
          sz: '1',
        }))}
        bids={Array.from({ length: 18 }, (_, index) => ({
          n: 1,
          px: String(99 - index),
          sz: '1',
        }))}
        horizontal={false}
        initialContainerHeight={640}
        maxLevelsPerSide={18}
        onSelectLevel={onSelectLevel}
        selectedTickOption={{
          targetTick: 1,
          apiTick: 1,
          exact: true,
          nSigFigs: 3,
          multiplier: 1,
          label: '1',
          value: '1',
        }}
        showTickSelector={false}
        variant="web"
      />,
    );

    try {
      const onLayout = mockVerticalLayout;
      expect(onLayout).toBeDefined();
      for (const height of [640, 500, 683, 500]) {
        act(() => {
          onLayout?.({
            nativeEvent: { layout: { height, width: 300, x: 0, y: 0 } },
          } as LayoutChangeEvent);
        });
        const { levelsPerSide } = getVerticalOrderBookLayout(
          height - ORDER_BOOK_MODE_SELECTOR_HEIGHT,
          18,
          true,
          DESKTOP_ORDER_BOOK_PRICE_HEIGHT + 1,
        );
        const buttons = within(
          view.getByTestId('perp-orderbook-ladder'),
        ).getAllByRole<HTMLButtonElement>('button');
        const rows = buttons.filter((button) => !button.disabled);
        const bars = buttons.filter((button) => button.disabled);
        expect(rows).toHaveLength(levelsPerSide * 2);
        expect(bars).toHaveLength(levelsPerSide * 2);

        fireEvent.click(rows[0]);
        expect(onSelectLevel).toHaveBeenLastCalledWith(
          expect.objectContaining({
            side: 'ask',
            price: (100 + levelsPerSide).toFixed(2),
            index: levelsPerSide - 1,
          }),
        );
        fireEvent.click(rows[rows.length - 1]);
        expect(onSelectLevel).toHaveBeenLastCalledWith(
          expect.objectContaining({
            side: 'bid',
            price: (100 - levelsPerSide).toFixed(2),
            index: levelsPerSide - 1,
          }),
        );
      }
    } finally {
      view.unmount();
      requestFrame.mockRestore();
      cancelFrame.mockRestore();
    }
  });
});

jest.mock('../../hooks/usePerpLatestTrade', () => ({
  usePerpLatestTrade: jest.fn(() => ({
    trade: undefined,
    isInteractive: false,
    getSelectablePrice: () => undefined,
  })),
}));
jest.mock('../../hooks/usePerpMarketForeground', () => ({
  usePerpMarketForeground: () => true,
}));

describe('OrderBook mobile latest trade price', () => {
  afterEach(() => {
    jest.mocked(usePerpLatestTrade).mockReturnValue({
      trade: undefined,
      isInteractive: false,
      getSelectablePrice: () => undefined,
    });
  });

  it.each([
    { side: 'B' as const, color: 'rgb(0, 170, 0)' },
    { side: 'A' as const, color: 'rgb(255, 0, 0)' },
  ])(
    'renders the latest $side trade in the theme color and selects its raw price',
    ({ side, color }) => {
      jest.mocked(usePerpLatestTrade).mockReturnValue({
        trade: {
          coin: 'BTC',
          side,
          px: '99.75',
          sz: '1',
          time: 1000,
          tid: 1,
          hash: '0x123',
          users: ['0x1', '0x2'],
        },
        isInteractive: true,
        getSelectablePrice: () => '99.75',
      });
      const onSelectMidPrice = jest.fn();
      const { getByTestId } = render(
        <OrderBookMobile
          asks={[{ n: 1, px: '102', sz: '1' }]}
          bids={[{ n: 1, px: '100', sz: '1' }]}
          onSelectMidPrice={onSelectMidPrice}
          showTickSelector={false}
          variant="mobileVertical"
        />,
      );
      const price = getByTestId('perp-orderbook-latest-price');
      expect(price.textContent).toBe('99.75');
      expect((price.firstElementChild as HTMLElement).style.color).toBe(color);
      fireEvent.click(price);
      expect(onSelectMidPrice).toHaveBeenCalledWith('99.75');
    },
  );

  it('shows a disabled placeholder rather than substituting the book mid price', () => {
    const onSelectMidPrice = jest.fn();
    const { getByTestId } = render(
      <OrderBookMobile
        asks={[{ n: 1, px: '102', sz: '1' }]}
        bids={[{ n: 1, px: '100', sz: '1' }]}
        onSelectMidPrice={onSelectMidPrice}
        variant="mobileVertical"
      />,
    );
    const price = getByTestId('perp-orderbook-latest-price');
    expect(price.textContent).toBe('--');
    fireEvent.click(price);
    expect(onSelectMidPrice).not.toHaveBeenCalled();
  });
});

function MobileOrderBookModeHarness(
  props: ComponentProps<typeof OrderBookMobile>,
) {
  const [mode, setMode] = useState<IOrderBookDisplayMode>('both');
  return (
    <OrderBookMobile
      {...props}
      displayMode={mode}
      onDisplayModeChange={setMode}
    />
  );
}

describe('OrderBook mobile display modes', () => {
  const props = {
    asks: Array.from({ length: 6 }, (_, index) => ({
      n: 1,
      px: String(101 + index),
      sz: index < 2 ? '3' : '1',
    })),
    bids: Array.from({ length: 6 }, (_, index) => ({
      n: 1,
      px: String(100 - index),
      sz: index < 2 ? '1' : '100',
    })),
    maxLevelsPerSide: 2,
    priceDecimals: 0,
    showTickSelector: false,
    variant: 'mobileVertical' as const,
  };

  it('cycles both/bids/asks with a fixed height and an unchanged B/S ratio', () => {
    const view = render(<MobileOrderBookModeHarness {...props} />);
    const toggle = view.getByTestId('perp-orderbook-mode-toggle');
    const body = view.getByTestId('perp-orderbook-mobile-body');
    const expectRatioAndHeight = () => {
      expect(body.style.height).toBe('148px');
      expect(view.getByText('B 25%')).toBeTruthy();
      expect(view.getByText('75% S')).toBeTruthy();
    };
    expect(
      within(view.getByTestId('perp-orderbook-asks')).getAllByRole('button'),
    ).toHaveLength(2);
    expect(
      within(view.getByTestId('perp-orderbook-bids')).getAllByRole('button'),
    ).toHaveLength(2);
    expectRatioAndHeight();

    fireEvent.click(toggle);
    expect(view.queryByTestId('perp-orderbook-asks')).toBeNull();
    expect(
      within(view.getByTestId('perp-orderbook-bids')).getAllByRole('button'),
    ).toHaveLength(4);
    expectRatioAndHeight();

    fireEvent.click(toggle);
    expect(view.queryByTestId('perp-orderbook-bids')).toBeNull();
    expect(
      within(view.getByTestId('perp-orderbook-asks')).getAllByRole('button'),
    ).toHaveLength(4);
    expectRatioAndHeight();

    fireEvent.click(toggle);
    expect(
      within(view.getByTestId('perp-orderbook-asks')).getAllByRole('button'),
    ).toHaveLength(2);
    expect(
      within(view.getByTestId('perp-orderbook-bids')).getAllByRole('button'),
    ).toHaveLength(2);
    expectRatioAndHeight();
  });

  it('selects the displayed price and side after switching to either single side', () => {
    const onSelectLevel = jest.fn();
    const view = render(
      <MobileOrderBookModeHarness {...props} onSelectLevel={onSelectLevel} />,
    );
    const toggle = view.getByTestId('perp-orderbook-mode-toggle');
    fireEvent.click(toggle);
    fireEvent.click(
      within(view.getByTestId('perp-orderbook-bids')).getByText('97'),
    );
    expect(onSelectLevel).toHaveBeenLastCalledWith(
      expect.objectContaining({ price: '97', side: 'bid', index: 3 }),
    );

    fireEvent.click(toggle);
    fireEvent.click(
      within(view.getByTestId('perp-orderbook-asks')).getByText('104'),
    );
    expect(onSelectLevel).toHaveBeenLastCalledWith(
      expect.objectContaining({ price: '104', side: 'ask', index: 3 }),
    );
    fireEvent.click(
      within(view.getByTestId('perp-orderbook-asks')).getByText('101'),
    );
    expect(onSelectLevel).toHaveBeenLastCalledWith(
      expect.objectContaining({ price: '101', side: 'ask', index: 0 }),
    );
  });

  it('retains the selected mode and space across loading and sparse snapshots', () => {
    const view = render(<MobileOrderBookModeHarness {...props} />);
    fireEvent.click(view.getByTestId('perp-orderbook-mode-toggle'));
    view.rerender(
      <MobileOrderBookModeHarness
        {...props}
        asks={[]}
        bids={[]}
        symbol="ETH"
      />,
    );
    expect(view.queryByTestId('perp-orderbook-asks')).toBeNull();
    expect(
      within(view.getByTestId('perp-orderbook-bids')).getAllByText('--'),
    ).toHaveLength(8);
    expect(view.getByTestId('perp-orderbook-mobile-body').style.height).toBe(
      '148px',
    );

    view.rerender(
      <MobileOrderBookModeHarness
        {...props}
        asks={props.asks.slice(0, 1)}
        bids={props.bids.slice(0, 1)}
        symbol="ETH"
      />,
    );
    expect(view.queryByTestId('perp-orderbook-asks')).toBeNull();
    expect(view.getByTestId('perp-orderbook-bids').style.height).toBe('88px');
    expect(view.getByTestId('perp-orderbook-mobile-body').style.height).toBe(
      '148px',
    );
    expect(
      within(view.getByTestId('perp-orderbook-bids')).getAllByRole('button'),
    ).toHaveLength(1);
  });
});

describe('OrderBook Android horizontal layout', () => {
  afterEach(() => {
    mockIsNativeAndroid = false;
  });

  it('reserves all rows through the loading transition when switching coins', () => {
    mockIsNativeAndroid = true;
    const props = {
      horizontal: true,
      maxLevelsPerSide: 13,
      loadingNode: (
        <DefaultLoadingNode variant="mobileHorizontal" maxLevelsPerSide={13} />
      ),
      showTickSelector: false,
      variant: 'mobileHorizontal' as const,
    };
    const view = render(
      <OrderBook {...props} asks={[]} bids={[]} symbol="ETH" />,
    );
    for (const [symbol, ask, bid, rows, height] of [
      ['ETH', '2354', '2353', 13, '372px'],
      ['xyz:XYZ100', '', '', 13, '372px'],
      ['xyz:XYZ100', '29767', '29766', 13, '372px'],
      ['xyz:XYZ100', '29767', '29766', 5, '180px'],
    ] as const) {
      view.rerender(
        <OrderBook
          {...props}
          asks={ask ? [{ n: 1, px: ask, sz: '1' }] : []}
          bids={bid ? [{ n: 1, px: bid, sz: '1' }] : []}
          maxLevelsPerSide={rows}
          symbol={symbol}
        />,
      );
      expect(
        (view.container.firstElementChild as HTMLElement).style.height,
      ).toBe(height);
      expect(view.getByText('global.buy')).toBeTruthy();
      expect(view.getByText('global.sell')).toBeTruthy();
      if (!ask) expect(view.getAllByText('--')).toHaveLength(52);
    }
  });

  it.each([
    { isNativeAndroid: false, horizontal: true, variant: 'mobileHorizontal' },
    { isNativeAndroid: true, horizontal: false, variant: 'mobileVertical' },
  ] as const)('preserves the existing height for %j', (platform) => {
    mockIsNativeAndroid = platform.isNativeAndroid;
    const view = render(
      <OrderBook
        asks={[]}
        bids={[]}
        horizontal={platform.horizontal}
        loadingNode={null}
        showTickSelector={false}
        variant={platform.variant}
      />,
    );

    expect((view.container.firstElementChild as HTMLElement).style.height).toBe(
      '100%',
    );
  });
});

describe('OrderBook desktop display modes', () => {
  const props: ComponentProps<typeof OrderBook> = {
    asks: Array.from({ length: 40 }, (_, index) => ({
      n: 1,
      px: String(101 + index),
      sz: '1',
    })),
    bids: Array.from({ length: 40 }, (_, index) => ({
      n: 1,
      px: String(99 - index),
      sz: index < 12 ? '2' : '10',
    })),
    horizontal: false,
    initialContainerHeight: 640,
    maxLevelsPerSide: 18,
    showTickSelector: false,
    variant: 'web',
  };
  it('switches sides immediately with stable height and ratios, selecting the displayed levels', () => {
    const frameGlobals = globalThis as {
      requestAnimationFrame: (callback: (timestamp: number) => void) => number;
      cancelAnimationFrame: (handle: number) => void;
    };
    const requestFrame = jest
      .spyOn(frameGlobals, 'requestAnimationFrame')
      .mockReturnValue(1);
    const cancelFrame = jest
      .spyOn(frameGlobals, 'cancelAnimationFrame')
      .mockImplementation(() => undefined);
    const onSelectLevel = jest.fn();
    const view = render(<OrderBook {...props} onSelectLevel={onSelectLevel} />);
    try {
      const ladder = view.getByTestId('perp-orderbook-ladder');
      const height = ladder.style.height;
      const rows = () =>
        within(ladder)
          .getAllByRole<HTMLButtonElement>('button')
          .filter((button) => !button.disabled);
      expect(rows()).toHaveLength(20);
      expect(view.getByText('B 67%')).toBeTruthy();
      const cases = [
        {
          mode: 'bids',
          first: { side: 'bid', price: '99.00', index: 0 },
          last: { side: 'bid', price: '80.00', index: 19 },
        },
        {
          mode: 'asks',
          first: { side: 'ask', price: '120.00', index: 19 },
          last: { side: 'ask', price: '101.00', index: 0 },
        },
        {
          mode: 'both',
          first: { side: 'ask', price: '110.00', index: 9 },
          last: { side: 'bid', price: '90.00', index: 9 },
        },
      ];
      for (const { mode, first, last } of cases) {
        fireEvent.click(view.getByTestId(`perp-orderbook-mode-${mode}`));
        expect(
          view
            .getByTestId(`perp-orderbook-mode-${mode}`)
            .getAttribute('aria-pressed'),
        ).toBe('true');
        expect(ladder.style.height).toBe(height);
        expect(rows()).toHaveLength(20);
        expect(view.getByText('B 67%')).toBeTruthy();
        expect(view.getByText('33% S')).toBeTruthy();
        fireEvent.click(rows()[0]);
        expect(onSelectLevel).toHaveBeenLastCalledWith(
          expect.objectContaining(first),
        );
        fireEvent.click(rows()[19]);
        expect(onSelectLevel).toHaveBeenLastCalledWith(
          expect.objectContaining(last),
        );
      }
      fireEvent.click(view.getByTestId('perp-orderbook-mode-asks'));
      act(() =>
        mockVerticalLayout?.({
          nativeEvent: { layout: { height: 500, width: 300, x: 0, y: 0 } },
        } as LayoutChangeEvent),
      );
      expect(rows()).toHaveLength(14);
      fireEvent.click(rows()[0]);
      expect(onSelectLevel).toHaveBeenLastCalledWith(
        expect.objectContaining({ side: 'ask', price: '114.00', index: 13 }),
      );
    } finally {
      view.unmount();
      requestFrame.mockRestore();
      cancelFrame.mockRestore();
    }
  });

  it('retains the selected side across loading, shallow books, and coin changes', () => {
    const onSelectLevel = jest.fn();
    const view = render(
      <OrderBook {...props} symbol="BTC" onSelectLevel={onSelectLevel} />,
    );
    fireEvent.click(view.getByTestId('perp-orderbook-mode-asks'));
    const ladder = view.getByTestId('perp-orderbook-ladder');
    const height = ladder.style.height;
    view.rerender(
      <OrderBook
        {...props}
        symbol="ETH"
        asks={[]}
        bids={[]}
        onSelectLevel={onSelectLevel}
      />,
    );
    expect(
      view.getByTestId('perp-orderbook-mode-asks').getAttribute('aria-pressed'),
    ).toBe('true');
    expect(ladder.style.height).toBe(height);
    expect(view.getAllByText('--')).toHaveLength(62);
    expect(view.queryByTestId('perp-orderbook-price-direction')).toBeNull();
    for (const button of within(ladder).getAllByRole('button'))
      fireEvent.click(button);
    expect(onSelectLevel).not.toHaveBeenCalled();
    view.rerender(
      <OrderBook
        {...props}
        symbol="ETH"
        asks={[{ n: 1, px: '200', sz: '2' }]}
        bids={[]}
        onSelectLevel={onSelectLevel}
      />,
    );
    const rows = within(ladder)
      .getAllByRole<HTMLButtonElement>('button')
      .filter((button) => !button.disabled);
    expect(rows).toHaveLength(1);
    expect(ladder.style.height).toBe(height);
    fireEvent.click(rows[0]);
    expect(onSelectLevel).toHaveBeenLastCalledWith(
      expect.objectContaining({ side: 'ask', price: '200.00', index: 0 }),
    );
  });

  it.each([
    { side: 'B' as const, color: 'rgb(0, 170, 0)' },
    { side: 'A' as const, color: 'rgb(255, 0, 0)' },
  ])(
    'shows the latest $side price beside the mark price, with precision above the ladder',
    ({ side, color }) => {
      mockMarkPrice = '98.5';
      jest.mocked(usePerpLatestTrade).mockReturnValue({
        trade: {
          coin: 'BTC',
          side,
          px: '99.75',
          sz: '1',
          time: 1000,
          tid: 1,
          hash: '0x123',
          users: ['0x1', '0x2'],
        },
        isInteractive: true,
        getSelectablePrice: () => '99.75',
      });
      const view = render(
        <OrderBook
          {...props}
          showTickSelector
          priceDecimals={6}
          selectedTickOption={{
            targetTick: 0.0001,
            apiTick: 0.0001,
            exact: true,
            nSigFigs: 3,
            multiplier: 1,
            label: '0.0001',
            value: '0.0001',
          }}
        />,
      );
      try {
        const prices = within(
          view.getByTestId('perp-desktop-orderbook-latest-price'),
        );
        expect(prices.getByText('99.75').style.color).toBe(color);
        expect(
          prices
            .getByText('99.75')
            .closest('[data-tooltip]')
            ?.getAttribute('data-tooltip'),
        ).toBe('perp.token_selector_last_price');
        const direction = prices.getByTestId('perp-orderbook-price-direction');
        expect(direction.getAttribute('data-icon')).toBe(
          side === 'B' ? 'ArrowTopOutline' : 'ArrowBottomOutline',
        );
        expect(direction.getAttribute('data-color')).toBe(
          side === 'B' ? '$bgAccent' : '$bgCriticalStrong',
        );
        expect(prices.getByText('98.5').style.color).toBe('rgb(102, 102, 102)');
        expect(
          prices
            .getByText('98.5')
            .closest('[data-tooltip]')
            ?.getAttribute('data-tooltip'),
        ).toBe('perp.mark_price_tooltip');
        expect(
          within(view.getByTestId('perp-orderbook-controls')).getByTestId(
            'perp-select',
          ),
        ).toBeTruthy();
        expect(
          within(view.getByTestId('perp-select')).queryByText(
            'perp.orderbook_spread',
          ),
        ).toBeNull();
        expect(
          within(view.getByTestId('perp-select')).getByText('0.0001'),
        ).toBeTruthy();
        expect(
          within(view.getByTestId('perp-select')).getByRole('button', {
            name: 'perp.orderbook_spread 0.0001',
          }),
        ).toBeTruthy();
        expect(
          within(view.getByTestId('perp-select')).queryByText('0.000100'),
        ).toBeNull();
        expect(view.getByText('perp.orderbook_size (BTC)')).toBeTruthy();
        expect(view.getByText('perp.orderbook_total (BTC)')).toBeTruthy();
        expect(
          within(view.getByTestId('perp-orderbook-ladder')).queryByTestId(
            'perp-select',
          ),
        ).toBeNull();
      } finally {
        view.unmount();
        mockMarkPrice = undefined;
        jest.mocked(usePerpLatestTrade).mockReturnValue({
          trade: undefined,
          isInteractive: false,
          getSelectablePrice: () => undefined,
        });
      }
    },
  );

  it('keeps the horizontal detail book free of desktop controls', () => {
    const view = render(<OrderBook {...props} horizontal />);
    expect(view.queryByTestId('perp-orderbook-mode-both')).toBeNull();
  });
});

it('does not display a previous spot pair reference price after switching coins', () => {
  mockTradeMode = 'spot';
  mockSpotAssetCtx = { coin: '@1', ctx: { markPrice: '123.45' } };
  const view = render(
    <OrderBook
      symbol="@2"
      bids={[]}
      asks={[]}
      horizontal={false}
      variant="web"
    />,
  );
  try {
    const prices = within(
      view.getByTestId('perp-desktop-orderbook-latest-price'),
    );
    expect(prices.queryByText('≈$123.45')).toBeNull();
    mockSpotAssetCtx = { coin: '@3', ctx: { markPrice: '234.56' } };
    view.rerender(
      <OrderBook
        symbol="@3"
        bids={[]}
        asks={[]}
        horizontal={false}
        variant="web"
      />,
    );
    expect(view.getByText('≈$234.56')).toBeTruthy();
  } finally {
    view.unmount();
    mockTradeMode = 'perp';
    mockSpotAssetCtx = null;
  }
});
