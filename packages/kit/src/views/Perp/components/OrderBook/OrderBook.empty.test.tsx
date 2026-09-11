/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { OrderBook, OrderBookMobile } from '.';

import { act, fireEvent, render, within } from '@testing-library/react';

import { getVerticalOrderBookLayout } from '../../layouts/perpLayoutUtils';

import type { LayoutChangeEvent } from 'react-native';

let mockVerticalLayout: ((event: LayoutChangeEvent) => void) | undefined;

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
  }: {
    children?: ReactNode | ((state: { pressed: boolean }) => ReactNode);
    disabled?: boolean;
    onPress?: () => void;
    testID?: string;
  }) => (
    <button
      data-testid={testID}
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
  Text: ({ children }: { children?: ReactNode }) => <span>{children}</span>,
  TouchableOpacity: ({ children }: { children?: ReactNode }) => (
    <button type="button">{children}</button>
  ),
  View: ({
    children,
    onLayout,
    testID,
  }: {
    children?: ReactNode;
    onLayout?: (event: LayoutChangeEvent) => void;
    testID?: string;
  }) => {
    if (onLayout) mockVerticalLayout = onLayout;
    return <div data-testid={testID}>{children}</div>;
  },
}));

jest.mock('@onekeyhq/components', () => ({
  DashText: () => <span>--</span>,
  DebugRenderTracker: ({ children }: { children?: ReactNode }) => (
    <>{children}</>
  ),
  Haptics: { selection: jest.fn() },
  Icon: () => null,
  Popover: () => null,
  Portal: {
    Body: ({ children }: { children?: ReactNode }) => <>{children}</>,
    Constant: { FULL_WINDOW_OVERLAY_PORTAL: 'full-window-overlay' },
  },
  Select: () => null,
  SizableText: ({ children }: { children?: ReactNode }) => (
    <span>{children}</span>
  ),
  Stack: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  TABULAR_NUMS: ['tabular-nums'],
  YStack: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
  useTheme: () => ({
    bgAccent: { val: '#0a0' },
    bgCriticalStrong: { val: '#f00' },
    bgHover: { val: '#f5f5f5' },
    bgSubdued: { val: '#eee' },
    borderActive: { val: '#333' },
    text: { val: '#111' },
    textSubdued: { val: '#666' },
  }),
  useThemeName: () => 'light',
}));

jest.mock('@onekeyhq/kit/src/states/jotai/contexts/hyperliquid', () => ({
  useActiveTradeInstrumentAtom: () => [{ coin: 'BTC', mode: 'perp' }],
}));

jest.mock('@onekeyhq/kit-bg/src/states/jotai/atoms', () => ({
  useSpotActiveAssetCtxAtom: () => [null],
}));

jest.mock('@onekeyhq/shared/src/platformEnv', () => ({
  __esModule: true,
  default: { isNative: false },
}));

jest.mock('react-native-reanimated', () => ({
  useReducedMotion: () => false,
}));

jest.mock('../../hooks/usePerpsActiveAssetCtxDisplay', () => ({
  usePerpsActiveAssetCtxDisplay: () => ({ assetCtx: undefined }),
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
    expect(view.getAllByText('--')).toHaveLength(73);
    resize(500);
    expect(view.getAllByText('--')).toHaveLength(55);
    resize(546);
    expect(view.getAllByText('--')).toHaveLength(61);
    resize(660);
    expect(view.getAllByText('--')).toHaveLength(73);
    resize(500);
    expect(view.getAllByText('--')).toHaveLength(55);
  });

  it('fills the measured desktop layout with placeholder levels', () => {
    const containerHeight = 640;
    const maxLevelsPerSide = 18;
    const { levelsPerSide } = getVerticalOrderBookLayout(
      containerHeight,
      maxLevelsPerSide,
      true,
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

    expect(getAllByText('--')).toHaveLength(levelsPerSide * 2 * 3 + 1);
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
        const { levelsPerSide } = getVerticalOrderBookLayout(height, 18, true);
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

describe('OrderBook mobile mid price', () => {
  it('selects the raw mid price from the mobile order book', () => {
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

    fireEvent.click(getByTestId('perp-orderbook-mid-price'));

    expect(onSelectMidPrice).toHaveBeenCalledTimes(1);
    expect(onSelectMidPrice).toHaveBeenCalledWith('101');
  });
});
