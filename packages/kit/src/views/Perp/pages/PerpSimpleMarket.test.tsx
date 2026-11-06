/** @jest-environment jsdom */

import { createContext, useContext, useState } from 'react';
import type { PropsWithChildren } from 'react';

import { act, fireEvent, render } from '@testing-library/react';

import type { IPageHeaderProps } from '@onekeyhq/components/src/layouts/Page/PageHeader';

import type { ISimpleMarketChartPrice } from '../components/Simple/SimpleMarketChart';
import type { LayoutChangeEvent } from 'react-native';

const NavigationUpdates = createContext(0);
const route = { params: { coin: 'BTC' } };
let notifyNavigationUpdate = () => {};
let reportNavigationUpdates = false;
const setOptions = jest.fn(() => {
  if (reportNavigationUpdates) notifyNavigationUpdate();
});
const navigation = { setOptions, push: jest.fn(), popStack: jest.fn() };
const theme = {
  bgSubdued: { val: 'white' },
  bgApp: { val: 'black' },
  text: { val: 'black' },
};
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
}: PropsWithChildren<{
  testID?: string;
  animated?: boolean;
  minWidth?: number;
  alignSelf?: string;
  onLayout?: (event: LayoutChangeEvent) => void;
}>) => (
  <div
    data-testid={testID}
    data-animated={animated}
    data-min-width={minWidth}
    data-align-self={alignSelf}
    ref={(element) => {
      if (element && onLayout) layoutHandlers.set(element, onLayout);
    }}
  >
    {children}
  </div>
);
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
      Footer: Box,
    }),
    Button: Box,
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
    useActiveTradeInstrumentAtom: () => [
      { mode: 'perp', coin: 'BTC', assetId: 0 },
    ],
    useTradingLoadingAtom: () => [false],
  },
  '@onekeyhq/kit-bg/src/states/jotai/atoms': {
    usePerpsCustomSettingsAtom: () => [{ mobileTradingMode: 'simple' }],
  },
  '../hooks/useSimpleMarketFocus': { useSimpleMarketFocus: () => {} },
  '../hooks/usePerpsAccountScopedActivePositions': {
    usePerpsAccountScopedActivePositions: () => [],
  },
  '../hooks/usePerpsAssetCtx': {
    usePerpsAssetCtx: () => ({ assetCtx: {}, isLoading: false }),
  },
  '../hooks/useTradingPrice': {
    useTradingPrice: () => ({ midPrice: '120', isValid: true }),
  },
  '../PerpsAccountSelectorProviderMirror': {
    PerpsAccountSelectorProviderMirror: Mirror,
  },
  '../PerpsProviderMirror': { PerpsProviderMirror: Mirror },
  '../utils/simpleDisplay': { simplePrice: String, simpleUsd: String },
  '../components/MarketDetail/PerpMarketIntroContent': {
    PerpMarketIntroContent: Empty,
  },
  '../components/OrderInfoPanel/ClosePositionModal': {
    showClosePositionDialog: jest.fn(),
  },
  '../components/PerpActionButton': { PerpActionButton: Box },
  '../components/Simple/SimpleMarketHeader': { SimpleMarketHeader: Empty },
  '../components/Simple/SimpleMarketPortfolio': {
    SimpleMarketPortfolio: Empty,
  },
  '../components/Simple/SimpleOrderBook': { SimpleOrderBook: Empty },
  '../components/Simple/SimpleTradeHistory': { SimpleTradeHistory: Empty },
  '../components/TokenSelector/PerpTokenSelectorRow': {
    FavoriteButton: Empty,
  },
  '../components/Simple/SimpleMarketChart': {
    SimpleMarketChart: ({
      onPriceChange,
    }: {
      onPriceChange: (price: ISimpleMarketChartPrice) => void;
    }) => (
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
    ),
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
  'settles navigation updates while scrubbing and keeps linked prices unanimated (%j)',
  (platform) => {
    Object.assign(mocks['@onekeyhq/shared/src/platformEnv'].default, platform);
    reportNavigationUpdates = false;
    setOptions.mockClear();
    const { getByRole, getByTestId } = render(<Navigator />);
    reportNavigationUpdates = true;
    setOptions.mockClear();
    for (const price of [110, 115, 120]) {
      fireEvent.click(getByRole('button', { name: String(price) }));
      const displayed = getByTestId('perps-simple-market-price');
      expect(displayed.textContent).toBe(String(price));
      expect(displayed.getAttribute('data-animated')).toBe(
        String(price === 120),
      );
      expect(getByTestId('perps-simple-market-change').textContent).toBe(
        `(+${(price - 100).toFixed(2)}%)`,
      );
    }
    expect(setOptions).toHaveBeenCalledTimes(3);
  },
);
