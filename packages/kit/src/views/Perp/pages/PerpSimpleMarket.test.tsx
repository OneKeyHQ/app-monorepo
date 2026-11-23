/** @jest-environment jsdom */

import {
  createContext,
  useContext,
  useState,
  useSyncExternalStore,
} from 'react';
import type { PropsWithChildren, ReactNode } from 'react';

import { act, fireEvent, render } from '@testing-library/react';

import type { IPageHeaderProps } from '@onekeyhq/components/src/layouts/Page/PageHeader';
import type { IPerpsAssetPosition } from '@onekeyhq/shared/types/hyperliquid';

import type { ISimpleMarketChartPrice } from '../components/Simple/SimpleMarketChart';
import type {
  LayoutChangeEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';

const NavigationUpdates = createContext(0);
const route = { params: { coin: 'BTC' } };
const instrument = { mode: 'perp', coin: 'BTC', assetId: 0 };
let positions: IPerpsAssetPosition[] = [];
let portfolioRenders = 0;
let midPrice = '120';
let assetCtx = { markPrice: '120', change24h: '20', change24hPercent: 20 };
let marketContentRenders = 0;
let metricRenders = 0;
const quoteListeners = new Set<() => void>();
const subscribeQuotes = (listener: () => void) => {
  quoteListeners.add(listener);
  return () => {
    quoteListeners.delete(listener);
  };
};
function updateMidPrice(price: string) {
  act(() => {
    midPrice = price;
    quoteListeners.forEach((listener) => listener());
  });
}
let renderHeaderTitle: (() => ReactNode) | undefined;
let chartRenders = 0;
const sectionRenders = { info: 0, history: 0, orderBook: 0, footer: 0 };
const scrollHandlers = new WeakMap<
  HTMLElement,
  (event: NativeSyntheticEvent<NativeScrollEvent>) => void
>();
let notifyNavigationUpdate = () => {};
let reportNavigationUpdates = false;
const setOptions = jest.fn((options: { headerTitle?: () => ReactNode }) => {
  renderHeaderTitle = options.headerTitle;
  if (reportNavigationUpdates) notifyNavigationUpdate();
});
const navigation = { setOptions, push: jest.fn(), popStack: jest.fn() };
const theme = {
  bgSubdued: { val: 'white' },
  bgApp: { val: 'black' },
  text: { val: 'black' },
};
const pressHandlers = new WeakMap<HTMLElement, () => void>();
const layoutHandlers = new WeakMap<
  HTMLElement,
  (event: LayoutChangeEvent) => void
>();
const Box = ({
  children,
  testID,
  animated,
  minWidth,
  alignSelf,
  onLayout,
  onScroll,
  onPress,
  disabled,
}: PropsWithChildren<{
  testID?: string;
  animated?: boolean;
  disabled?: boolean;
  minWidth?: number;
  alignSelf?: string;
  onPress?: () => void;
  onLayout?: (event: LayoutChangeEvent) => void;
  onScroll?: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
}>) => {
  if (testID === 'perps-simple-market-metrics') metricRenders += 1;
  return (
    <div
      data-testid={testID}
      data-animated={animated}
      data-disabled={disabled}
      data-min-width={minWidth}
      data-align-self={alignSelf}
      ref={(element) => {
        if (element && onLayout) layoutHandlers.set(element, onLayout);
        if (element && onPress && !disabled)
          pressHandlers.set(element, onPress);
        if (element && onScroll) scrollHandlers.set(element, onScroll);
      }}
    >
      {children}
    </div>
  );
};
const Empty = () => null;
const Mirror = ({ children }: PropsWithChildren) => children;

const mocks = {
  'react-native': {
    useWindowDimensions: () => ({ width: 390, height: 844 }),
  },
  'react-native-reanimated': { useReducedMotion: () => false },
  'react-intl': {
    useIntl: () => ({ formatMessage: ({ id }: { id: string }) => id }),
  },
  '@react-navigation/native': {
    useRoute: () => route,
    useNavigation: () => {
      useContext(NavigationUpdates);
      return navigation;
    },
    useIsFocused: () => {
      useContext(NavigationUpdates);
      return true;
    },
  },
  '@onekeyfe/react-native-native-overlay': {
    useOverlayPageScope: () => ({}),
    OverlayPageHostScope: Mirror,
    OverlayPageOwnerScope: Mirror,
  },
  '../../../../../components/src/hocs': { useIsOverlayPage: () => false },
  '../../../../../components/src/hooks': { useTheme: () => theme },
  '../../../../../components/src/primitives/Button/GlassHeaderContext': {
    toNoGlassHeaderItems: () => undefined,
    wrapHeaderRenderInGlass: (callback: unknown) => callback,
  },
  '../../../../../components/src/layouts/Navigation/Header/HeaderSearchBar': {
    __esModule: true,
    default: Empty,
  },
  '@onekeyhq/components': {
    Page: Object.assign(Box, {
      Header: (props: IPageHeaderProps) => {
        const { PageHeader } = jest.requireActual<
          typeof import('../../../../../components/src/layouts/Page/PageHeader')
        >('../../../../../components/src/layouts/Page/PageHeader');
        return <PageHeader {...props} />;
      },
      Body: Box,
      Footer: (props: PropsWithChildren) => {
        sectionRenders.footer += 1;
        return <Box {...props} />;
      },
    }),
    Button: Box,
    Divider: () => <hr data-testid="market-footer-divider" />,
    Icon: Empty,
    ScrollView: Box,
    SizableText: Box,
    Skeleton: Empty,
    XStack: Box,
    YStack: Box,
    useMedia: () => ({ gtMd: false }),
    useTheme: () => theme,
  },
  '@onekeyhq/shared/src/platformEnv': {
    __esModule: true,
    default: { isNative: true, isNativeIOS: true },
  },
  '@onekeyhq/shared/src/utils/perpsUtils': {
    parseDexCoin: (coin: string) => ({ displayName: coin }),
    formatPerpsCompactUsd: String,
  },
  '@onekeyhq/kit/src/components/RollingNumberText': {
    RollingNumberText: Box,
  },
  '@onekeyhq/kit/src/hooks/useAppNavigation': {
    __esModule: true,
    default: () => navigation,
  },
  '@onekeyhq/kit/src/hooks/useThemeVariant': {
    useThemeVariant: () => 'light',
  },
  '@onekeyhq/kit/src/states/jotai/contexts/hyperliquid': {
    useActiveTradeInstrumentAtom: () => [instrument],
    useTradingLoadingAtom: () => [false],
  },
  '@onekeyhq/kit-bg/src/states/jotai/atoms': {
    usePerpsActiveAccountAtom: () => [{ accountAddress: 'account-a' }],
    usePerpsCustomSettingsAtom: () => [{ mobileTradingMode: 'simple' }],
  },
  '../hooks/useSimpleMarketFocus': {
    useSimpleMarketFocus: () => {
      marketContentRenders += 1;
      return { failed: false, isSwitching: false, retry: jest.fn() };
    },
  },
  '../hooks/usePerpsAccountScopedActivePositions': {
    usePerpsAccountScopedActivePositions: () => positions,
  },
  '../hooks/usePerpsAssetCtx': {
    usePerpsAssetCtx: () => ({
      assetCtx: useSyncExternalStore(subscribeQuotes, () => assetCtx),
      isLoading: false,
    }),
  },
  '../hooks/useTradingPrice': {
    useTradingPrice: () => ({
      midPrice: useSyncExternalStore(subscribeQuotes, () => midPrice),
      isValid: true,
    }),
  },
  '../PerpsAccountSelectorProviderMirror': {
    PerpsAccountSelectorProviderMirror: Mirror,
  },
  '../PerpsProviderMirror': { PerpsProviderMirror: Mirror },
  '../utils/simpleDisplay': { simplePrice: String, simpleUsd: String },
  '../components/MarketDetail/PerpMarketIntroContent': {
    PerpMarketIntroContent: () => {
      sectionRenders.info += 1;
      return null;
    },
  },
  '../components/OrderInfoPanel/ClosePositionModal': {
    showClosePositionDialog: jest.fn(),
  },
  '../components/PerpActionButton': { PerpActionButton: Box },
  '../components/Simple/SimpleMarketHeader': {
    SimpleMarketHeader: ({
      price,
      changeLabel,
    }: {
      price: string;
      changeLabel: string;
    }) => (
      <div data-testid="scrolling-header-price">
        {price} {changeLabel}
      </div>
    ),
  },
  '../components/Simple/SimpleMarketPortfolio': {
    SimpleMarketPortfolio: () => {
      portfolioRenders += 1;
      return null;
    },
  },
  '../components/Simple/SimpleOrderBook': {
    SimpleOrderBook: () => {
      sectionRenders.orderBook += 1;
      return null;
    },
  },
  '../components/Simple/SimpleTradeHistory': {
    SimpleTradeHistory: () => {
      sectionRenders.history += 1;
      return null;
    },
  },
  '../components/TokenSelector/PerpTokenSelectorRow': {
    FavoriteButton: Empty,
  },
  '../components/Simple/SimpleMarketChart': {
    SimpleMarketChart: ({
      onPriceChange,
    }: {
      onPriceChange: (price: ISimpleMarketChartPrice) => void;
    }) => {
      chartRenders += 1;
      return (
        <>
          {[110, 115, 120].map((price) => (
            <button
              key={price}
              type="button"
              onClick={() =>
                onPriceChange({
                  coin: 'BTC',
                  range: '1D',
                  price,
                  change: String(price - 100),
                  changePercent: price - 100,
                  isScrubbing: price !== 120,
                })
              }
            >
              {price}
            </button>
          ))}
        </>
      );
    },
  },
};
Object.entries(mocks).forEach(([path, mock]) => jest.doMock(path, () => mock));
const { default: PerpSimpleMarket } =
  require('./PerpSimpleMarket') as typeof import('./PerpSimpleMarket');

function Navigator() {
  const [updates, setUpdates] = useState(0);
  // Model the navigator notifying its screen after Page.Header sets options.
  // Bound the failure so a regression cannot hang the test runner.
  expect(updates).toBeLessThanOrEqual(10);
  notifyNavigationUpdate = () => setUpdates((value) => value + 1);
  return (
    <NavigationUpdates.Provider value={updates}>
      <PerpSimpleMarket />
    </NavigationUpdates.Provider>
  );
}

it('keeps metric widths stable across rounded layouts and shorter values', () => {
  reportNavigationUpdates = false;
  const { getByTestId, rerender } = render(<PerpSimpleMarket />);
  const getColumn = () => {
    const column = getByTestId(
      'perps-simple-market-metrics',
    ).querySelector<HTMLElement>('[data-min-width]');
    expect(column).not.toBeNull();
    return column!;
  };
  const measure = (intrinsicWidth: number) => {
    const column = getColumn();
    const measured = [
      column,
      ...column.querySelectorAll<HTMLElement>('div'),
    ].find((element) => layoutHandlers.has(element));
    expect(measured).toBeDefined();
    if (!measured) return;
    // Model native floating-point noise and the width of stretched content.
    const constrainedWidth = Number(
      measured.dataset.minWidth ??
        (measured.dataset.alignSelf === 'flex-start'
          ? 0
          : column.dataset.minWidth),
    );
    const width = Math.max(intrinsicWidth, constrainedWidth) + 0.000_01;
    act(() => {
      layoutHandlers.get(measured)?.({
        nativeEvent: { layout: { x: 0, y: 0, height: 40, width } },
      } as LayoutChangeEvent);
    });
  };

  for (let index = 0; index < 20; index += 1) measure(60.25);
  expect(getColumn().dataset.minWidth).toBe('61');
  for (let index = 0; index < 20; index += 1) measure(48.25);
  expect(getColumn().dataset.minWidth).toBe('61');
  for (let index = 0; index < 20; index += 1) measure(68.25);
  expect(getColumn().dataset.minWidth).toBe('69');

  try {
    route.params.coin = 'ETH';
    rerender(<PerpSimpleMarket />);
    expect(getColumn().dataset.minWidth).toBe('0');
  } finally {
    route.params.coin = 'BTC';
  }
});

it.each([
  { isNative: true, isNativeIOS: true },
  { isNative: true, isNativeIOS: false },
  { isNative: false, isNativeIOS: false },
])(
  'updates linked prices without navigation updates while scrubbing (%j)',
  (platform) => {
    Object.assign(mocks['@onekeyhq/shared/src/platformEnv'].default, platform);
    reportNavigationUpdates = false;
    setOptions.mockClear();
    const { getByRole, getByTestId } = render(<Navigator />);
    expect(renderHeaderTitle).toBeDefined();
    render(<>{renderHeaderTitle?.()}</>);
    reportNavigationUpdates = true;
    setOptions.mockClear();
    for (const price of [110, 115, 120]) {
      fireEvent.click(getByRole('button', { name: String(price) }));
      const displayed = getByTestId('perps-simple-market-price');
      expect(displayed.textContent).toBe(String(price));
      expect(getByTestId('scrolling-header-price').textContent).toBe(
        `${price} +${(price - 100).toFixed(2)}%`,
      );
      expect(displayed.getAttribute('data-animated')).toBe(
        String(price === 120),
      );
      expect(getByTestId('perps-simple-market-change').textContent).toBe(
        `(+${(price - 100).toFixed(2)}%)`,
      );
    }
    expect(setOptions).not.toHaveBeenCalled();
  },
);

it.each([
  { isNative: true, isNativeIOS: true },
  { isNative: true, isNativeIOS: false },
  { isNative: false, isNativeIOS: false },
])(
  'keeps the position footer visible throughout scrolling and scoped to the current coin (%j)',
  (platform) => {
    Object.assign(mocks['@onekeyhq/shared/src/platformEnv'].default, platform);
    reportNavigationUpdates = false;
    const item: IPerpsAssetPosition = {
      type: 'oneWay',
      position: {
        coin: 'BTC',
        szi: '0.00104',
        leverage: { type: 'cross', value: 31 },
        entryPx: '64778',
        positionValue: '67.55',
        unrealizedPnl: '0.18',
        returnOnEquity: '0.0833',
        marginUsed: '2.21',
        liquidationPx: '63620.4',
        maxLeverage: 40,
        cumFunding: { allTime: '0', sinceOpen: '0', sinceChange: '0' },
      },
    };
    positions = [item];
    instrument.coin = 'ETH';
    try {
      const { getByTestId, queryByTestId, rerender } = render(
        <PerpSimpleMarket />,
      );
      const close = getByTestId('perps-simple-close-position');
      const add = getByTestId('perps-simple-add-position');
      expect(close.getAttribute('data-disabled')).toBe('true');
      expect(add.getAttribute('data-disabled')).toBe('true');
      expect(getByTestId('perps-simple-market-price').textContent).toBe('--');
      instrument.coin = 'BTC';
      rerender(<PerpSimpleMarket />);
      expect(close.getAttribute('data-disabled')).toBe('false');
      expect(add.getAttribute('data-disabled')).toBe('false');
      act(() => pressHandlers.get(close)?.());
      expect(
        mocks['../components/OrderInfoPanel/ClosePositionModal']
          .showClosePositionDialog,
      ).toHaveBeenCalledWith(
        expect.objectContaining({
          position: item.position,
          expectedAccountAddress: 'account-a',
          tradingUiMode: 'simple',
        }),
      );
      const footer = getByTestId('perps-simple-position-footer');
      expect(footer.textContent).toContain('perp.position_title');
      expect(footer.textContent).toContain('perp.position_b');
      expect(footer.textContent).toContain('67.55');
      expect(footer.textContent).toContain('+0.18');
      expect(
        footer.querySelector('[data-testid="market-footer-divider"]'),
      ).not.toBeNull();
      const priceBlock = getByTestId('perps-simple-market-price').parentElement;
      expect(priceBlock).not.toBeNull();
      if (!priceBlock) return;
      act(() => {
        layoutHandlers.get(priceBlock)?.({
          nativeEvent: { layout: { x: 0, y: 0, width: 350, height: 64 } },
        } as LayoutChangeEvent);
      });
      const renders = portfolioRenders;
      const navigationUpdates = setOptions.mock.calls.length;
      for (const y of [0, 100, 300, 600, 1000, 600, 100, 0]) {
        act(() => {
          scrollHandlers.get(getByTestId('perps-simple-market-scroll'))?.({
            nativeEvent: { contentOffset: { x: 0, y } },
          } as NativeSyntheticEvent<NativeScrollEvent>);
        });
        expect(getByTestId('perps-simple-position-footer')).toBe(footer);
        expect(footer.textContent).toContain('67.55');
      }
      expect(portfolioRenders).toBe(renders);
      expect(setOptions).toHaveBeenCalledTimes(navigationUpdates);
      positions = [
        {
          ...item,
          position: {
            ...item.position,
            szi: '-0.00104',
            positionValue: '68.10',
            unrealizedPnl: '-0.37',
          },
        },
      ];
      rerender(<PerpSimpleMarket />);
      expect(footer.textContent).toContain('perp.position_s');
      expect(footer.textContent).toContain('68.10');
      expect(footer.textContent).toContain('-0.37');
      route.params.coin = 'ETH';
      rerender(<PerpSimpleMarket />);
      expect(queryByTestId('perps-simple-position-footer')).toBeNull();
      route.params.coin = 'BTC';
      positions = [];
      rerender(<PerpSimpleMarket />);
      expect(queryByTestId('perps-simple-position-footer')).toBeNull();
    } finally {
      instrument.coin = 'BTC';
      positions = [];
      route.params.coin = 'BTC';
    }
  },
);

it('isolates the page and unrelated sections from live quotes and chart feedback', () => {
  reportNavigationUpdates = false;
  const { getByRole, getByTestId, rerender } = render(<PerpSimpleMarket />);
  const before = { ...sectionRenders, portfolio: portfolioRenders };
  const chartRendersBefore = chartRenders;
  const pageRendersBefore = marketContentRenders;
  const metricRendersBefore = metricRenders;
  const navigationUpdatesBefore = setOptions.mock.calls.length;
  try {
    for (const price of ['121', '122', '123']) {
      updateMidPrice(price);
      expect(getByTestId('perps-simple-market-price').textContent).toBe(price);
    }
    for (const price of [110, 115, 120]) {
      fireEvent.click(getByRole('button', { name: String(price) }));
      expect(getByTestId('perps-simple-market-price').textContent).toBe(
        String(price),
      );
    }
    expect(metricRenders).toBe(metricRendersBefore);
    act(() => {
      assetCtx = { markPrice: '124', change24h: '24', change24hPercent: 24 };
      quoteListeners.forEach((listener) => listener());
    });
    expect(getByTestId('perps-simple-market-metrics').textContent).toContain(
      '124',
    );
    expect(metricRenders).toBe(metricRendersBefore + 1);
    expect(marketContentRenders).toBe(pageRendersBefore);
    expect(setOptions).toHaveBeenCalledTimes(navigationUpdatesBefore);
    expect({ ...sectionRenders, portfolio: portfolioRenders }).toEqual(before);
    expect(chartRenders).toBe(chartRendersBefore + 3);
    route.params.coin = 'ETH';
    rerender(<PerpSimpleMarket />);
    expect(sectionRenders.info).toBeGreaterThan(before.info);
    expect(sectionRenders.history).toBeGreaterThan(before.history);
    expect(portfolioRenders).toBeGreaterThan(before.portfolio);
    expect(sectionRenders.footer).toBeGreaterThan(before.footer);
  } finally {
    midPrice = '120';
    assetCtx = { markPrice: '120', change24h: '20', change24hPercent: 20 };
    route.params.coin = 'BTC';
  }
});
