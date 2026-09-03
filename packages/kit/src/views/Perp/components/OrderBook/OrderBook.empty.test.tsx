/** @jest-environment jsdom */

import type { ReactNode } from 'react';

import { OrderBook, OrderBookMobile } from '.';

import { fireEvent, render } from '@testing-library/react';

import { getVerticalOrderBookLayout } from '../../layouts/perpLayoutUtils';

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
  View: ({ children }: { children?: ReactNode }) => <div>{children}</div>,
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

jest.mock('./AnimatedDepthBlock', () => ({
  DepthBar: () => null,
  DepthBarColumn: () => null,
  SideRatioSegments: () => null,
}));

jest.mock('../../hooks/usePerpsActiveAssetCtxDisplay', () => ({
  usePerpsActiveAssetCtxDisplay: () => ({ assetCtx: undefined }),
}));

jest.mock('../../hooks/useTradingPrice', () => ({
  useTradingPrice: () => ({ midPrice: undefined }),
}));

describe('OrderBook empty vertical state', () => {
  it('fills the measured desktop layout with placeholder levels', () => {
    const containerHeight = 640;
    const maxLevelsPerSide = 18;
    const { levelsPerSide } = getVerticalOrderBookLayout(
      containerHeight,
      maxLevelsPerSide,
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
